import { memo, useMemo, useState } from 'react';
import {
  FileText, Upload, Clock, Landmark, ExternalLink,
  ChevronDown, ChevronRight, CreditCard,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody, Button, Badge } from '../../ui';
import { formatCurrency, formatDate } from '../../../utils';
import type { Bank, BankStatement, BankAccount, Transaction } from '../../../types';

interface StatementsTabProps {
  clientStatements: BankStatement[];
  clientTransactions: Transaction[];
  clientAccounts: BankAccount[];
  banks: Bank[];
  navigate: (path: string) => void;
  onOpenStatement?: (statementId: string) => void;
  /** Switch to the in-page Import tab instead of navigating away. */
  onOpenImport?: () => void;
}

// ============================================================================
// Arborescence : Banque → Compte → Releve
// ============================================================================

interface BankNode {
  bankCode: string;
  bankName: string;
  accounts: AccountNode[];
}

interface AccountNode {
  account: BankAccount;
  statements: BankStatement[];
}

function buildTree(
  accounts: BankAccount[],
  statements: BankStatement[],
  banks: Bank[],
): BankNode[] {
  // Group accounts by bankCode
  const bankMap = new Map<string, { bankName: string; accounts: Map<string, AccountNode> }>();

  for (const acc of accounts) {
    if (!bankMap.has(acc.bankCode)) {
      const bank = banks.find((b) => b.code === acc.bankCode);
      bankMap.set(acc.bankCode, {
        bankName: bank?.name ?? acc.bankName ?? acc.bankCode,
        accounts: new Map(),
      });
    }
    const node = bankMap.get(acc.bankCode)!;
    if (!node.accounts.has(acc.id)) {
      node.accounts.set(acc.id, { account: acc, statements: [] });
    }
  }

  // Assign statements to their accounts
  for (const stmt of statements) {
    // Find account by accountId or by bankCode match
    let placed = false;
    for (const [, bankNode] of bankMap) {
      for (const [, accNode] of bankNode.accounts) {
        if (accNode.account.id === stmt.accountId ||
            (accNode.account.bankCode === stmt.bankCode && accNode.account.accountNumber === (stmt as unknown as { accountNumber?: string }).accountNumber)) {
          accNode.statements.push(stmt);
          placed = true;
          break;
        }
      }
      if (placed) break;
    }

    // If statement has no matching account, create a virtual one under its bank
    if (!placed) {
      if (!bankMap.has(stmt.bankCode)) {
        bankMap.set(stmt.bankCode, {
          bankName: stmt.bankName ?? stmt.bankCode,
          accounts: new Map(),
        });
      }
      const bankNode = bankMap.get(stmt.bankCode)!;
      const virtualId = `virtual-${stmt.bankCode}-${stmt.accountId ?? 'default'}`;
      if (!bankNode.accounts.has(virtualId)) {
        bankNode.accounts.set(virtualId, {
          account: {
            id: virtualId,
            clientId: stmt.clientId,
            accountNumber: stmt.accountId ?? '',
            bankCode: stmt.bankCode,
            bankName: stmt.bankName,
            currency: 'XAF',
            isActive: true,
          },
          statements: [],
        });
      }
      bankNode.accounts.get(virtualId)!.statements.push(stmt);
    }
  }

  // Convert to array and sort
  return Array.from(bankMap.entries())
    .map(([bankCode, node]) => ({
      bankCode,
      bankName: node.bankName,
      accounts: Array.from(node.accounts.values()).sort(
        (a, b) => a.account.accountNumber.localeCompare(b.account.accountNumber),
      ),
    }))
    .sort((a, b) => a.bankName.localeCompare(b.bankName));
}

// ============================================================================
// StatementsTab
// ============================================================================

export const StatementsTab = memo(function StatementsTab({
  clientStatements,
  clientTransactions,
  clientAccounts,
  banks,
  navigate,
  onOpenStatement,
  onOpenImport,
}: StatementsTabProps) {
  const tree = useMemo(
    () => buildTree(clientAccounts, clientStatements, banks),
    [clientAccounts, clientStatements, banks],
  );
  const goImport = onOpenImport ?? (() => navigate('/import'));

  if (tree.length === 0) {
    return (
      <Card>
        <CardBody className="py-12 text-center">
          <Landmark className="w-12 h-12 text-primary-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-primary-900 mb-2">Aucune banque configuree</h3>
          <p className="text-primary-500 mb-4">
            Ajoutez un compte bancaire et importez des releves pour commencer.
          </p>
          <Button onClick={goImport}>
            <Upload className="w-4 h-4 mr-2" />
            Importer un releve
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-primary-700">
          {tree.length} banque{tree.length > 1 ? 's' : ''} · {clientStatements.length} releve{clientStatements.length > 1 ? 's' : ''}
        </h2>
        <Button size="sm" onClick={goImport}>
          <Upload className="w-3.5 h-3.5 mr-1.5" />
          Importer
        </Button>
      </div>

      {tree.map((bankNode) => (
        <BankSection
          key={bankNode.bankCode}
          bankNode={bankNode}
          transactions={clientTransactions}
          onOpenStatement={onOpenStatement}
        />
      ))}
    </div>
  );
});

// ============================================================================
// BankSection — niveau 1 (banque)
// ============================================================================

function BankSection({
  bankNode,
  transactions,
  onOpenStatement,
}: {
  bankNode: BankNode;
  transactions: Transaction[];
  onOpenStatement?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const totalStatements = bankNode.accounts.reduce((s, a) => s + a.statements.length, 0);

  return (
    <Card>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary-50/50 transition-colors"
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-primary-400" /> : <ChevronRight className="w-4 h-4 text-primary-400" />}
        <Landmark className="w-5 h-5 text-primary-600" />
        <div className="flex-1 text-left">
          <span className="text-sm font-semibold text-primary-900">{bankNode.bankName}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-primary-500">
          <span>{bankNode.accounts.length} compte{bankNode.accounts.length > 1 ? 's' : ''}</span>
          <span>{totalStatements} releve{totalStatements > 1 ? 's' : ''}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-primary-100">
          {bankNode.accounts.map((accNode) => (
            <AccountSection
              key={accNode.account.id}
              accNode={accNode}
              transactions={transactions}
              onOpenStatement={onOpenStatement}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

// ============================================================================
// AccountSection — niveau 2 (compte)
// ============================================================================

function AccountSection({
  accNode,
  transactions,
  onOpenStatement,
}: {
  accNode: AccountNode;
  transactions: Transaction[];
  onOpenStatement?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const { account, statements } = accNode;

  return (
    <div className="border-t border-primary-50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-2.5 pl-10 hover:bg-primary-50/30 transition-colors"
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-primary-400" /> : <ChevronRight className="w-3.5 h-3.5 text-primary-400" />}
        <CreditCard className="w-4 h-4 text-primary-500" />
        <div className="flex-1 text-left">
          <span className="text-sm font-medium text-primary-800 font-mono">{account.accountNumber || 'Compte principal'}</span>
          <span className="text-xs text-primary-500 ml-2">{account.currency}</span>
        </div>
        <Badge variant={account.isActive ? 'success' : 'secondary'} className="text-[10px]">
          {account.isActive ? 'Actif' : 'Inactif'}
        </Badge>
        <span className="text-xs text-primary-500">
          {statements.length} releve{statements.length > 1 ? 's' : ''}
        </span>
      </button>

      {expanded && statements.length > 0 && (
        <div className="pl-16 pr-4 pb-2 space-y-1">
          {statements
            .sort((a, b) => new Date(b.periodStart).getTime() - new Date(a.periodStart).getTime())
            .map((stmt) => (
              <StatementRow
                key={stmt.id}
                statement={stmt}
                onOpen={() => onOpenStatement?.(stmt.id)}
              />
            ))}
        </div>
      )}

      {expanded && statements.length === 0 && (
        <p className="pl-16 pr-4 pb-3 text-xs text-primary-400">
          Aucun releve importe pour ce compte.
        </p>
      )}
    </div>
  );
}

// ============================================================================
// StatementRow — niveau 3 (releve)
// ============================================================================

function StatementRow({
  statement,
  onOpen,
}: {
  statement: BankStatement;
  onOpen?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-primary-50 group transition-colors">
      <FileText className="w-4 h-4 text-primary-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-primary-900 truncate">
            {formatDate(statement.periodStart)} — {formatDate(statement.periodEnd)}
          </span>
          <Badge
            variant={statement.status === 'analyzed' ? 'success' : statement.status === 'imported' ? 'warning' : 'secondary'}
            className="text-[10px] shrink-0"
          >
            {statement.status === 'analyzed' ? 'Analyse' : statement.status === 'imported' ? 'A analyser' : 'Archive'}
          </Badge>
        </div>
        <p className="text-xs text-primary-500 truncate">
          {statement.transactionCount} transactions · {statement.fileName}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-primary-400">
          <Clock className="w-3 h-3 inline mr-0.5" />
          {formatDate(statement.importedAt)}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onOpen?.(); }}
          className="p-1.5 rounded-md text-amber-600 hover:bg-amber-50 hover:text-amber-800 opacity-0 group-hover:opacity-100 transition-all"
          title="Ouvrir le releve (analyse detaillee)"
        >
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
