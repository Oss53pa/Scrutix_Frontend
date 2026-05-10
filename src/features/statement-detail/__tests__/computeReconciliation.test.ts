// ============================================================================
// Tests — computeReconciliationDiscrepancies
// ============================================================================
// Spec onglets 2-5 §2.5 : 5 catégories d'écarts SYSCOHADA.
// Test par cas : matching parfait, bank_only, ledger_only, amount_mismatch,
// date_mismatch, duplicate_bank, duplicate_ledger, déduplication.
// ============================================================================

import { describe, it, expect } from 'vitest';
import { computeReconciliationDiscrepancies } from '../reconciliation/computeReconciliation';
import type { BankTransaction, LedgerEntry } from '../types/statement.types';

function bank(over: Partial<BankTransaction>): BankTransaction {
  return {
    id: 't', date: '2026-01-01', label: 'OP', debitCentimes: 0, creditCentimes: 0,
    runningBalanceCentimes: 0, ...over,
  };
}

function ledger(over: Partial<LedgerEntry>): LedgerEntry {
  return {
    id: 'l', date: '2026-01-01', pieceRef: 'p', label: 'OP',
    accountCode: '521000', debitCentimes: 0, creditCentimes: 0,
    runningBalanceCentimes: 0, ...over,
  };
}

describe('computeReconciliationDiscrepancies', () => {
  it('matching parfait : 0 écart', () => {
    const out = computeReconciliationDiscrepancies(
      [bank({ id: 't1', label: 'VIR EMIS X', debitCentimes: 100_000, runningBalanceCentimes: -100_000 })],
      [ledger({ id: 'l1', label: 'VIR EMIS X', creditCentimes: 100_000 })],
    );
    expect(out.matches).toHaveLength(1);
    expect(out.matches[0]).toMatchObject({ bankTxId: 't1', ledgerEntryId: 'l1' });
    expect(out.discrepancies).toHaveLength(0);
    expect(out.matchRate).toBe(100);
  });

  it('bank_only : transaction banque sans correspondance', () => {
    const out = computeReconciliationDiscrepancies(
      [bank({ id: 't1', debitCentimes: 50_000, label: 'frais NSIA' })],
      [],
    );
    expect(out.discrepancies).toHaveLength(1);
    expect(out.discrepancies[0].kind).toBe('bank_only');
    expect(out.matchRate).toBe(0);
  });

  it('ledger_only : écriture compta sans correspondance', () => {
    const out = computeReconciliationDiscrepancies(
      [],
      [ledger({ id: 'l1', creditCentimes: 100_000, label: 'cheque non presente' })],
    );
    expect(out.discrepancies.find((d) => d.kind === 'ledger_only')).toBeTruthy();
  });

  it('date_mismatch : décalage > 1 jour mais montant identique', () => {
    const out = computeReconciliationDiscrepancies(
      [bank({ id: 't1', date: '2026-04-10', label: 'VIR RECU CLIENT', creditCentimes: 250_000_000 })],
      [ledger({ id: 'l1', date: '2026-04-12', label: 'Recette client',
                accountCode: '521000', debitCentimes: 250_000_000 })],
    );
    expect(out.matches).toHaveLength(1);
    const dm = out.discrepancies.find((d) => d.kind === 'date_mismatch');
    expect(dm).toBeTruthy();
  });

  it('amount_mismatch : montants divergents', () => {
    const out = computeReconciliationDiscrepancies(
      [bank({ id: 't1', date: '2026-03-01', label: 'COM MVT', debitCentimes: 87_600 })],
      [ledger({ id: 'l1', date: '2026-03-01', label: 'commission mouvement',
                accountCode: '627100', debitCentimes: 60_000 })],
    );
    const am = out.discrepancies.find((d) => d.kind === 'amount_mismatch');
    expect(am).toBeTruthy();
  });

  it('duplicate_bank : transaction enregistrée 2× côté banque', () => {
    const out = computeReconciliationDiscrepancies(
      [
        bank({ id: 't1', date: '2026-04-28', label: 'SMS', debitCentimes: 1000 }),
        bank({ id: 't2', date: '2026-04-28', label: 'SMS', debitCentimes: 1000 }),
      ],
      [ledger({ id: 'l1', date: '2026-04-28', label: 'sms', accountCode: '627200', debitCentimes: 1000 })],
    );
    const dup = out.discrepancies.find((d) => d.kind === 'duplicate_bank');
    expect(dup).toBeTruthy();
  });

  it('duplicate_ledger : écriture enregistrée 2× côté compta', () => {
    const out = computeReconciliationDiscrepancies(
      [bank({ id: 't1', date: '2026-04-28', label: 'SMS', debitCentimes: 1000 })],
      [
        ledger({ id: 'l1', date: '2026-04-28', label: 'sms', accountCode: '627200', debitCentimes: 1000 }),
        ledger({ id: 'l2', date: '2026-04-28', label: 'sms', accountCode: '627200', debitCentimes: 1000 }),
      ],
    );
    const dup = out.discrepancies.find((d) => d.kind === 'duplicate_ledger');
    expect(dup).toBeTruthy();
  });

  it('match rate calculé correctement (3/4 = 75%)', () => {
    const out = computeReconciliationDiscrepancies(
      [
        bank({ id: 't1', date: '2026-01-01', label: 'A', debitCentimes: 100 }),
        bank({ id: 't2', date: '2026-01-02', label: 'B', debitCentimes: 200 }),
        bank({ id: 't3', date: '2026-01-03', label: 'C', debitCentimes: 300 }),
        bank({ id: 't4', date: '2026-01-04', label: 'D', debitCentimes: 400 }),
      ],
      [
        ledger({ id: 'l1', date: '2026-01-01', label: 'A', accountCode: '521', creditCentimes: 100 }),
        ledger({ id: 'l2', date: '2026-01-02', label: 'B', accountCode: '521', creditCentimes: 200 }),
        ledger({ id: 'l3', date: '2026-01-03', label: 'C', accountCode: '521', creditCentimes: 300 }),
      ],
    );
    expect(out.matchRate).toBe(75);
  });

  it('totaux retournés sont signés cohérents avec la convention banque', () => {
    const out = computeReconciliationDiscrepancies(
      [
        bank({ id: 't1', creditCentimes: 1000 }),  // recette
        bank({ id: 't2', debitCentimes: 300 }),     // dépense
      ],
      [],
    );
    expect(out.totalBankCentimes).toBe(700);  // +1000 - 300
  });
});
