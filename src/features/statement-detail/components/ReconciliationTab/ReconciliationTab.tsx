// ============================================================================
// ReconciliationTab — orchestrateur du module SYSCOHADA compte 521
// ============================================================================
// Compose ReconciliationImport / ReconciliationProgress / ReconciliationTable
// / DiscrepanciesPanel / ReconciliationStatement (spec §7).
// ============================================================================

import type {
  BankReconciliation, BankTransaction, LedgerEntry,
} from '../../types/statement.types';
import { ReconciliationImport } from './ReconciliationImport';
import { ReconciliationProgress } from './ReconciliationProgress';
import { ReconciliationTable } from './ReconciliationTable';
import { DiscrepanciesPanel } from './DiscrepanciesPanel';
import { ReconciliationStatement } from './ReconciliationStatement';

interface ReconciliationTabProps {
  statementLabel: string;
  bankCode: string;
  accountNumber: string;
  periodStart: string;
  periodEnd: string;
  bankTxs: BankTransaction[];
  ledgerEntries: LedgerEntry[];
  reconciliation: BankReconciliation | null;
  onRecompute?: () => void;
  onPushDiscrepancyToAtlas?: (discrepancyId: string) => void;
  onIgnoreDiscrepancy?: (discrepancyId: string) => void;
  onImportFromAtlasFinance?: () => void;
  onImportFromFile?: (file: File) => void;
  onGenerateStatement?: () => void;
}

export function ReconciliationTab(props: ReconciliationTabProps) {
  if (!props.reconciliation) {
    return (
      <ReconciliationImport
        periodStart={props.periodStart}
        periodEnd={props.periodEnd}
        onImportFromAtlasFinance={props.onImportFromAtlasFinance}
        onImportFromFile={props.onImportFromFile}
      />
    );
  }
  return (
    <div className="flex flex-col gap-4 p-4">
      <ReconciliationProgress reconciliation={props.reconciliation} />
      <ReconciliationTable
        bankCode={props.bankCode}
        periodStart={props.periodStart}
        periodEnd={props.periodEnd}
        bankTxs={props.bankTxs}
        ledgerEntries={props.ledgerEntries}
        reconciliation={props.reconciliation}
      />
      <DiscrepanciesPanel
        discrepancies={props.reconciliation.discrepancies}
        onPushToAtlas={props.onPushDiscrepancyToAtlas}
        onIgnore={props.onIgnoreDiscrepancy}
      />
      <ReconciliationStatement
        bankCode={props.bankCode}
        accountNumber={props.accountNumber}
        periodStart={props.periodStart}
        periodEnd={props.periodEnd}
        reconciliation={props.reconciliation}
        onGenerate={props.onGenerateStatement}
      />
    </div>
  );
}
