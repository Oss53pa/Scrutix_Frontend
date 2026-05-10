// ============================================================================
// ReconciliationTable — 2 colonnes (banque / compta) avec checkboxes
// ============================================================================

import { AmountFCFA } from '../../../../components/shared';
import type {
  BankReconciliation, BankTransaction, LedgerEntry,
} from '../../types/statement.types';

interface ReconciliationTableProps {
  bankCode: string;
  periodStart: string;
  periodEnd: string;
  bankTxs: BankTransaction[];
  ledgerEntries: LedgerEntry[];
  reconciliation: BankReconciliation | null;
}

export function ReconciliationTable(props: ReconciliationTableProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <BankColumn {...props} />
      <LedgerColumn {...props} />
    </div>
  );
}

function BankColumn({ bankTxs, reconciliation, bankCode, periodStart, periodEnd }: ReconciliationTableProps) {
  const matched = new Set(reconciliation?.matchedPairs.map((p) => p.bankTxId) ?? []);
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
                    <AmountFCFA value={tx.creditCentimes - tx.debitCentimes} colorize compact />
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

function LedgerColumn({ ledgerEntries, reconciliation, periodStart, periodEnd }: ReconciliationTableProps) {
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
                    <AmountFCFA value={e.debitCentimes - e.creditCentimes} colorize compact />
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
