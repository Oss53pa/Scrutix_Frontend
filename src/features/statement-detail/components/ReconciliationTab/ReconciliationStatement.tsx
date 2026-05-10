// ============================================================================
// ReconciliationStatement — état de rapprochement final SYSCOHADA
// ============================================================================

import { AmountFCFA, RoleGuard } from '../../../../components/shared';
import type { BankReconciliation } from '../../types/statement.types';

interface ReconciliationStatementProps {
  bankCode: string;
  accountNumber: string;
  periodStart: string;
  periodEnd: string;
  reconciliation: BankReconciliation;
  onGenerate?: () => void;
}

export function ReconciliationStatement(props: ReconciliationStatementProps) {
  const r = props.reconciliation;
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
        <div className="mb-1 text-ink-500">Compte 521000 · {props.bankCode} · {props.accountNumber}</div>
        <div className="mb-2 text-ink-500">Période : du {props.periodStart} au {props.periodEnd}</div>
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
