// ============================================================================
// ReconciliationTab — module SYSCOHADA compte 521
// ============================================================================
// Spec onglets 2-5 §2 : zone d'import + table 2 colonnes + zone écarts
// + bouton "Générer l'état de rapprochement".
// ============================================================================

import { useMemo, useState } from 'react';
import { Upload, ExternalLink, AlertTriangle, CheckCircle2, FileSpreadsheet, ArrowRightLeft } from 'lucide-react';
import { AmountFCFA } from '../../../../components/shared';
import { RoleGuard } from '../../../../components/shared';
import type {
  BankTransaction,
  LedgerEntry,
  BankReconciliation,
  ReconciliationDiscrepancy,
  DiscrepancyKind,
} from '../../types/statement.types';

interface ReconciliationTabProps {
  statementLabel: string;
  bankCode: string;
  accountNumber: string;
  periodStart: string;
  periodEnd: string;
  bankTxs: BankTransaction[];
  ledgerEntries: LedgerEntry[];
  reconciliation: BankReconciliation | null;
  /** Permet à l'enfant de demander un (re)matching après import du grand livre. */
  onRecompute?: () => void;
  onPushDiscrepancyToAtlas?: (discrepancyId: string) => void;
  onIgnoreDiscrepancy?: (discrepancyId: string) => void;
  onImportFromAtlasFinance?: () => void;
  onImportFromFile?: (file: File) => void;
  onGenerateStatement?: () => void;
}

export function ReconciliationTab(props: ReconciliationTabProps) {
  const { reconciliation } = props;

  if (!reconciliation) {
    return <ImportZone {...props} />;
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <ReconciliationProgress reconciliation={reconciliation} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <BankColumn {...props} />
        <LedgerColumn {...props} />
      </div>
      <DiscrepanciesPanel
        discrepancies={reconciliation.discrepancies}
        onPushToAtlas={props.onPushDiscrepancyToAtlas}
        onIgnore={props.onIgnoreDiscrepancy}
      />
      <FinalStateCard
        bankCode={props.bankCode}
        accountNumber={props.accountNumber}
        periodStart={props.periodStart}
        periodEnd={props.periodEnd}
        reconciliation={reconciliation}
        onGenerate={props.onGenerateStatement}
      />
    </div>
  );
}

// ============================================================================
// Import zone
// ============================================================================

function ImportZone(props: ReconciliationTabProps) {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="border-2 border-dashed border-canvas-300 rounded-xl p-8 text-center bg-white">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 text-amber-700 mb-4">
          <Upload className="w-7 h-7" />
        </div>
        <h2 className="text-base font-semibold text-ink-900">Importer le grand livre du compte 521</h2>
        <p className="mt-2 text-xs text-ink-600">
          Pour produire l'état de rapprochement, importez le grand livre de la période
          <span className="font-mono"> {props.periodStart} → {props.periodEnd}</span>{' '}
          depuis Atlas Finance ou téléchargez un fichier Excel/CSV.
        </p>

        <div className="mt-5 flex flex-col items-center gap-2">
          <button
            onClick={props.onImportFromAtlasFinance}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700"
          >
            Importer depuis Atlas Finance
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-canvas-300 text-sm cursor-pointer hover:bg-canvas-50">
            <FileSpreadsheet className="w-4 h-4" />
            Téléverser un fichier
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && props.onImportFromFile) props.onImportFromFile(f);
              }}
            />
          </label>
        </div>

        <p className="mt-4 text-[10px] text-ink-500 font-mono">
          Format attendu : Date | Pièce | Libellé | Débit | Crédit | Solde
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Progress bar
// ============================================================================

function ReconciliationProgress({ reconciliation }: { reconciliation: BankReconciliation }) {
  const rate = reconciliation.matchRate;
  const tone =
    rate >= 95 ? 'bg-emerald-500'
    : rate >= 70 ? 'bg-amber-500'
    : 'bg-rose-500';

  const matchedBank = reconciliation.matchedPairs.length;
  const matchedLedger = reconciliation.matchedPairs.length;

  return (
    <div className="bg-white border border-canvas-200 rounded-lg p-3">
      <div className="flex items-center justify-between text-xs text-ink-700 mb-2">
        <span>
          Rapprochement : <b>{matchedBank}</b> / {matchedBank + reconciliation.unmatchedBank.length} transactions banque
          {' '}·{' '}
          <b>{matchedLedger}</b> / {matchedLedger + reconciliation.unmatchedLedger.length} écritures compta
        </span>
        <span className="font-mono font-semibold">{rate}%</span>
      </div>
      <div className="h-2 bg-canvas-100 rounded-full overflow-hidden">
        <div className={`h-full ${tone} transition-all`} style={{ width: `${rate}%` }} />
      </div>
    </div>
  );
}

// ============================================================================
// Columns
// ============================================================================

function BankColumn({ bankTxs, reconciliation, bankCode, periodStart, periodEnd }: ReconciliationTabProps) {
  const matched = new Set(reconciliation?.matchedPairs.map((p) => p.bankTxId) ?? []);
  const totalCentimes = bankTxs.reduce((s, t) => s + (t.creditCentimes - t.debitCentimes), 0);
  const finalBalance = bankTxs.length > 0 ? bankTxs[bankTxs.length - 1].runningBalanceCentimes : 0;

  return (
    <div className="bg-white border border-canvas-200 rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-canvas-200 bg-canvas-50">
        <div className="text-xs text-ink-500">Côté banque · {bankCode}</div>
        <div className="text-[10px] text-ink-400 font-mono">{periodStart} → {periodEnd}</div>
        <div className="mt-1 text-xs">
          <span className="text-ink-700">{bankTxs.length} transactions</span>
          <span className="text-ink-400"> · </span>
          <span className="text-ink-900">solde fin : <AmountFCFA value={finalBalance} /></span>
        </div>
      </div>
      <div className="max-h-96 overflow-auto">
        <table className="w-full text-[11px]">
          <tbody>
            {bankTxs.map((tx) => {
              const isMatched = matched.has(tx.id);
              return (
                <tr key={tx.id} className={`border-b border-canvas-100 ${isMatched ? 'bg-emerald-50/50 text-ink-500' : ''}`}>
                  <td className="px-2 py-1 w-6">
                    <input type="checkbox" checked={isMatched} readOnly className="accent-emerald-600" />
                  </td>
                  <td className="px-1 py-1 font-mono text-[10px] text-ink-500 whitespace-nowrap">{tx.date}</td>
                  <td className="px-1 py-1 font-mono truncate max-w-[200px]" title={tx.label}>{tx.label}</td>
                  <td className="px-1 py-1 text-right">
                    <AmountFCFA
                      value={tx.creditCentimes - tx.debitCentimes}
                      colorize
                      compact
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LedgerColumn({ ledgerEntries, reconciliation, periodStart, periodEnd }: ReconciliationTabProps) {
  const matched = new Set(reconciliation?.matchedPairs.map((p) => p.ledgerEntryId) ?? []);
  const finalBalance = ledgerEntries.length > 0 ? ledgerEntries[ledgerEntries.length - 1].runningBalanceCentimes : 0;

  return (
    <div className="bg-white border border-canvas-200 rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-canvas-200 bg-canvas-50">
        <div className="text-xs text-ink-500">Côté compta · compte 521000</div>
        <div className="text-[10px] text-ink-400 font-mono">{periodStart} → {periodEnd}</div>
        <div className="mt-1 text-xs">
          <span className="text-ink-700">{ledgerEntries.length} écritures</span>
          <span className="text-ink-400"> · </span>
          <span className="text-ink-900">solde fin : <AmountFCFA value={finalBalance} /></span>
        </div>
      </div>
      <div className="max-h-96 overflow-auto">
        <table className="w-full text-[11px]">
          <tbody>
            {ledgerEntries.map((e) => {
              const isMatched = matched.has(e.id);
              return (
                <tr key={e.id} className={`border-b border-canvas-100 ${isMatched ? 'bg-emerald-50/50 text-ink-500' : ''}`}>
                  <td className="px-2 py-1 w-6">
                    <input type="checkbox" checked={isMatched} readOnly className="accent-emerald-600" />
                  </td>
                  <td className="px-1 py-1 font-mono text-[10px] text-ink-500 whitespace-nowrap">{e.date}</td>
                  <td className="px-1 py-1 font-mono text-[9px] text-ink-400">{e.pieceRef}</td>
                  <td className="px-1 py-1 truncate max-w-[160px]" title={e.label}>{e.label}</td>
                  <td className="px-1 py-1 text-right">
                    <AmountFCFA
                      value={e.debitCentimes - e.creditCentimes}
                      colorize
                      compact
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// Discrepancies panel
// ============================================================================

const KIND_LABEL: Record<DiscrepancyKind, string> = {
  bank_only:        'Op banque non comptabilisée',
  ledger_only:      'Écriture compta absente du relevé',
  amount_mismatch:  'Écart de montant',
  date_mismatch:    'Écart de date',
  duplicate_bank:   'Doublon côté banque',
  duplicate_ledger: 'Doublon côté compta',
};

function DiscrepanciesPanel({
  discrepancies,
  onPushToAtlas,
  onIgnore,
}: {
  discrepancies: ReconciliationDiscrepancy[];
  onPushToAtlas?: (id: string) => void;
  onIgnore?: (id: string) => void;
}) {
  const grouped = useMemo(() => {
    const m = new Map<DiscrepancyKind, ReconciliationDiscrepancy[]>();
    for (const d of discrepancies) {
      const arr = m.get(d.kind) ?? [];
      arr.push(d);
      m.set(d.kind, arr);
    }
    return m;
  }, [discrepancies]);

  if (discrepancies.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-800 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4" />
        Aucun écart détecté — le rapprochement est parfait.
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 mb-3">
        <AlertTriangle className="w-4 h-4" />
        {discrepancies.length} écart{discrepancies.length > 1 ? 's' : ''} détecté{discrepancies.length > 1 ? 's' : ''}
      </div>
      {Array.from(grouped.entries()).map(([kind, items]) => (
        <div key={kind} className="mb-3">
          <h4 className="text-xs font-semibold text-amber-900 mb-1.5">
            {KIND_LABEL[kind]} ({items.length})
          </h4>
          <div className="space-y-1.5">
            {items.map((d) => (
              <DiscrepancyCard
                key={d.id}
                d={d}
                onPushToAtlas={onPushToAtlas}
                onIgnore={onIgnore}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DiscrepancyCard({
  d,
  onPushToAtlas,
  onIgnore,
}: {
  d: ReconciliationDiscrepancy;
  onPushToAtlas?: (id: string) => void;
  onIgnore?: (id: string) => void;
}) {
  return (
    <div className="bg-white border border-amber-200 rounded p-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-ink-900">{d.description}</div>
          {d.gapCentimes !== 0 && (
            <div className="text-[10px] text-ink-500 font-mono mt-0.5">
              Écart : <AmountFCFA value={d.gapCentimes} colorize compact />
            </div>
          )}
        </div>
      </div>
      {d.proposedJournal && d.proposedJournal.length > 0 && (
        <div className="mt-2 bg-canvas-50 border border-canvas-200 rounded px-2 py-1.5">
          <div className="text-[10px] uppercase tracking-wider text-ink-500 mb-1">Écriture proposée</div>
          <table className="w-full text-[10px] font-mono">
            <tbody>
              {d.proposedJournal.map((line, i) => (
                <tr key={i}>
                  <td className="text-ink-700">{line.accountCode}</td>
                  <td className="text-ink-700">{line.accountLabel}</td>
                  <td className="text-right text-ink-900">
                    {line.debitCentimes > 0
                      ? <AmountFCFA value={line.debitCentimes} compact />
                      : ''}
                  </td>
                  <td className="text-right text-ink-900">
                    {line.creditCentimes > 0
                      ? <AmountFCFA value={line.creditCentimes} compact />
                      : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <RoleGuard role={['senior', 'dg']}>
        <div className="mt-2 flex items-center justify-end gap-1">
          {onPushToAtlas && (
            <button
              onClick={() => onPushToAtlas(d.id)}
              className="px-2 py-0.5 text-[10px] bg-amber-600 text-white rounded hover:bg-amber-700"
            >
              <ArrowRightLeft className="inline w-3 h-3 mr-1" />
              Pousser vers Atlas Finance
            </button>
          )}
          {onIgnore && (
            <button
              onClick={() => onIgnore(d.id)}
              className="px-2 py-0.5 text-[10px] border border-canvas-300 rounded hover:bg-canvas-50"
            >
              Ignorer
            </button>
          )}
        </div>
      </RoleGuard>
    </div>
  );
}

// ============================================================================
// Final state card
// ============================================================================

function FinalStateCard(props: {
  bankCode: string;
  accountNumber: string;
  periodStart: string;
  periodEnd: string;
  reconciliation: BankReconciliation;
  onGenerate?: () => void;
}) {
  const { reconciliation } = props;
  const r = reconciliation;
  const adjustments = r.discrepancies.filter((d) => d.kind === 'bank_only' || d.kind === 'ledger_only');

  return (
    <div className="bg-white border border-canvas-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">État de rapprochement</h3>
        <RoleGuard role={['senior', 'dg']}>
          <button
            onClick={props.onGenerate}
            className="px-3 py-1.5 text-xs font-semibold rounded bg-amber-600 text-white hover:bg-amber-700"
          >
            Générer l'état de rapprochement
          </button>
        </RoleGuard>
      </div>
      <div className="font-mono text-[11px] text-ink-700 leading-relaxed">
        <div className="mb-1 text-ink-500">
          Compte 521000 · {props.bankCode} · {props.accountNumber}
        </div>
        <div className="mb-2 text-ink-500">
          Période : du {props.periodStart} au {props.periodEnd}
        </div>
        <SoftLine label="Solde du grand livre" amount={r.totalLedgerCentimes} />
        {adjustments.map((d) => (
          <SoftLine key={d.id} label={d.description.slice(0, 60)} amount={d.gapCentimes} indent />
        ))}
        <div className="border-t border-canvas-300 my-1" />
        <SoftLine label="Solde rapproché" amount={r.totalLedgerCentimes - r.gapCentimes} bold />
        <SoftLine label="Solde du relevé" amount={r.totalBankCentimes} />
        <div className="border-t border-canvas-300 my-1" />
        <SoftLine label="Écart" amount={r.gapCentimes} bold />
      </div>
      {r.gapCentimes !== 0 && (
        <div className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
          ⚠ Écart non nul de <AmountFCFA value={Math.abs(r.gapCentimes)} /> — vérifier les opérations en suspens.
        </div>
      )}
    </div>
  );
}

function SoftLine({ label, amount, indent, bold }: { label: string; amount: number; indent?: boolean; bold?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-2 ${bold ? 'font-semibold' : ''}`}>
      <span className={indent ? 'pl-4' : ''}>{label}</span>
      <span className="border-b border-dotted border-canvas-300 flex-1 mx-2" />
      <AmountFCFA value={amount} colorize={indent} />
    </div>
  );
}
