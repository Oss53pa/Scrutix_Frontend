// ============================================================================
// computeReconciliationDiscrepancies — algorithme de matching SYSCOHADA
// ============================================================================
// Spec onglets 2-5 §2.5 : 5 catégories d'écarts SYSCOHADA classiques.
//
// Heuristique : pour chaque tx banque, on cherche la meilleure écriture
// compta candidate dans une fenêtre de ±7 jours. Score = montant exact (0
// = parfait) + bonus si label proche. On laisse passer les écarts >= seuil
// pour les classer comme amount_mismatch / date_mismatch.
//
// Pure TypeScript, déterministe, testable unitairement sans backend.
// ============================================================================

import type {
  BankTransaction,
  LedgerEntry,
  ReconciliationDiscrepancy,
  ReconciliationMatch,
} from '../types/statement.types';

const DATE_WINDOW_DAYS = 7;
const SOFT_DATE_THRESHOLD_DAYS = 1;   // au-delà → date_mismatch
const FUZZY_LABEL_TOKENS = 2;         // tokens communs minimum pour bonus label

export interface ReconciliationOutcome {
  matches: ReconciliationMatch[];
  unmatchedBank: string[];
  unmatchedLedger: string[];
  discrepancies: ReconciliationDiscrepancy[];
  totalBankCentimes: number;
  totalLedgerCentimes: number;
  matchRate: number;                  // 0..100
}

/**
 * Calcule les paires matchées + écarts entre transactions banque et écritures
 * de grand livre. Compatible compte 521 (banque actif) où :
 *   - une dépense banque (debit > 0) ↔ écriture compta avec credit sur 521
 *   - une recette banque (credit > 0) ↔ écriture compta avec debit sur 521
 */
export function computeReconciliationDiscrepancies(
  bankTxs: BankTransaction[],
  ledgerEntries: LedgerEntry[],
): ReconciliationOutcome {
  const usedLedger = new Set<string>();
  const matches: ReconciliationMatch[] = [];
  const discrepancies: ReconciliationDiscrepancy[] = [];

  // 1. Détection des doublons côté banque (même date + même libellé + même montant)
  const bankGroups = new Map<string, BankTransaction[]>();
  for (const tx of bankTxs) {
    const k = `${tx.date}|${normLabel(tx.label)}|${signedAmount(tx)}`;
    const arr = bankGroups.get(k) ?? [];
    arr.push(tx);
    bankGroups.set(k, arr);
  }
  for (const arr of bankGroups.values()) {
    if (arr.length > 1) {
      // Le 1er reste à matcher normalement, les suivants sont signalés comme doublons
      for (let i = 1; i < arr.length; i++) {
        discrepancies.push({
          id: 'dup-bank-' + arr[i].id,
          kind: 'duplicate_bank',
          bankTxId: arr[i].id,
          gapCentimes: signedAmount(arr[i]),
          description: `Transaction enregistrée ${arr.length} fois côté banque`,
        });
      }
    }
  }

  // 2. Détection des doublons côté compta
  const ledgerGroups = new Map<string, LedgerEntry[]>();
  for (const e of ledgerEntries) {
    const k = `${e.date}|${normLabel(e.label)}|${signedLedgerOn521(e)}`;
    const arr = ledgerGroups.get(k) ?? [];
    arr.push(e);
    ledgerGroups.set(k, arr);
  }
  for (const arr of ledgerGroups.values()) {
    if (arr.length > 1) {
      for (let i = 1; i < arr.length; i++) {
        discrepancies.push({
          id: 'dup-ledger-' + arr[i].id,
          kind: 'duplicate_ledger',
          ledgerEntryId: arr[i].id,
          gapCentimes: signedLedgerOn521(arr[i]),
          description: `Écriture comptabilisée ${arr.length} fois`,
        });
      }
    }
  }

  // 3. Matching banque → compta, par ordre des transactions banque
  const dedupedBank = bankTxs.filter((tx) => {
    const key = `${tx.date}|${normLabel(tx.label)}|${signedAmount(tx)}`;
    const grp = bankGroups.get(key);
    return !grp || grp[0].id === tx.id; // garde uniquement le 1er du groupe
  });
  const dedupedLedger = ledgerEntries.filter((e) => {
    const key = `${e.date}|${normLabel(e.label)}|${signedLedgerOn521(e)}`;
    const grp = ledgerGroups.get(key);
    return !grp || grp[0].id === e.id;
  });

  for (const tx of dedupedBank) {
    const candidates = dedupedLedger.filter((e) => {
      if (usedLedger.has(e.id)) return false;
      const days = Math.abs(daysBetween(e.date, tx.date));
      return days <= DATE_WINDOW_DAYS;
    });

    let best: { entry: LedgerEntry; score: number; daysGap: number; amountGap: number } | null = null;
    for (const e of candidates) {
      const txAmount = signedAmount(tx);            // négatif si débit banque
      const ledgerAmount = signedLedgerOn521(e);    // signé selon impact 521
      const amountGap = Math.abs(txAmount - ledgerAmount);
      const daysGap = Math.abs(daysBetween(e.date, tx.date));
      const labelBonus = labelOverlap(tx.label, e.label) >= FUZZY_LABEL_TOKENS ? -50_000 : 0;
      // Score : on minimise (gap montant + 5k * jours + bonus label)
      const score = amountGap + daysGap * 5_000 + labelBonus;
      if (!best || score < best.score) {
        best = { entry: e, score, daysGap, amountGap };
      }
    }

    if (!best) {
      discrepancies.push({
        id: 'bo-' + tx.id,
        kind: 'bank_only',
        bankTxId: tx.id,
        gapCentimes: signedAmount(tx),
        description: `Op banque sans correspondance compta : ${tx.label.slice(0, 60)}`,
      });
      continue;
    }

    // Match retenu : on calcule la confiance et on flag éventuellement
    const txAmount = signedAmount(tx);
    const sameAmount = best.amountGap < 100; // tolérance 1 FCFA arrondi
    const sameDate = best.daysGap <= SOFT_DATE_THRESHOLD_DAYS;
    const confidence = clamp01(
      0.9 * (sameAmount ? 1 : Math.max(0, 1 - best.amountGap / Math.max(1, Math.abs(txAmount)))) -
      0.05 * Math.min(7, best.daysGap),
    );

    matches.push({ bankTxId: tx.id, ledgerEntryId: best.entry.id, confidence });
    usedLedger.add(best.entry.id);

    if (!sameAmount) {
      discrepancies.push({
        id: 'am-' + tx.id,
        kind: 'amount_mismatch',
        bankTxId: tx.id,
        ledgerEntryId: best.entry.id,
        gapCentimes: txAmount - signedLedgerOn521(best.entry),
        description: `Écart de montant : ${best.amountGap} centimes`,
      });
    } else if (!sameDate) {
      discrepancies.push({
        id: 'dt-' + tx.id,
        kind: 'date_mismatch',
        bankTxId: tx.id,
        ledgerEntryId: best.entry.id,
        gapCentimes: 0,
        description: `Décalage de ${best.daysGap} jour(s) entre banque et compta`,
      });
    }
  }

  // 4. ledger_only : écritures non matchées
  for (const e of dedupedLedger) {
    if (usedLedger.has(e.id)) continue;
    discrepancies.push({
      id: 'lo-' + e.id,
      kind: 'ledger_only',
      ledgerEntryId: e.id,
      gapCentimes: -signedLedgerOn521(e),
      description: `Écriture compta sans correspondance banque : ${e.label.slice(0, 60)}`,
    });
  }

  // 5. Totaux + match rate
  const totalBank = bankTxs.reduce((s, t) => s + signedAmount(t), 0);
  const totalLedger = ledgerEntries.reduce((s, e) => s + signedLedgerOn521(e), 0);
  const matchedBankIds = new Set(matches.map((m) => m.bankTxId));
  const matchedLedgerIds = new Set(matches.map((m) => m.ledgerEntryId));
  const unmatchedBank = bankTxs.filter((t) => !matchedBankIds.has(t.id)).map((t) => t.id);
  const unmatchedLedger = ledgerEntries.filter((e) => !matchedLedgerIds.has(e.id)).map((e) => e.id);
  const matchRate = bankTxs.length > 0
    ? Math.round((matchedBankIds.size / bankTxs.length) * 100)
    : 0;

  return {
    matches,
    unmatchedBank,
    unmatchedLedger,
    discrepancies,
    totalBankCentimes: totalBank,
    totalLedgerCentimes: totalLedger,
    matchRate,
  };
}

// ============================================================================
// Helpers
// ============================================================================

/** Montant signé d'une transaction banque : négatif si débit, positif si crédit. */
function signedAmount(tx: BankTransaction): number {
  return tx.creditCentimes - tx.debitCentimes;
}

/**
 * Impact signé sur le compte 521 (banque) :
 *   - écriture qui CRÉDITE 521 → la banque a moins (débit banque = sortie)
 *   - écriture qui DÉBITE 521 → la banque a plus (crédit banque = entrée)
 *
 * On normalise pour que le signe matche celui de signedAmount().
 */
function signedLedgerOn521(e: LedgerEntry): number {
  // Si l'écriture concerne directement 521 : debit → +, credit → −
  if (e.accountCode.startsWith('521')) {
    return e.debitCentimes - e.creditCentimes;
  }
  // Sinon, c'est la contrepartie (charge ou produit) : on inverse.
  // Charge (debit) → 521 a été crédité (sortie de banque) → −
  // Produit (credit) → 521 a été débité (entrée de banque) → +
  return e.creditCentimes - e.debitCentimes;
}

function normLabel(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function labelOverlap(a: string, b: string): number {
  const ta = new Set(normLabel(a).split(' ').filter((w) => w.length >= 3));
  const tb = new Set(normLabel(b).split(' ').filter((w) => w.length >= 3));
  let n = 0;
  for (const t of ta) if (tb.has(t)) n++;
  return n;
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.round((da - db) / 86400000);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
