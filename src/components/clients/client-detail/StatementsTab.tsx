import { memo, useMemo, useState } from 'react';
import {
  FileText, Upload, Clock, Landmark, Eye, Download, ExternalLink,
  ChevronDown, ChevronRight, ArrowDownCircle, ArrowUpCircle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody, Button, Badge } from '../../ui';
import { formatCurrency, formatDate } from '../../../utils';
import type { Bank, BankStatement, Transaction } from '../../../types';

interface StatementsTabProps {
  clientStatements: BankStatement[];
  clientTransactions: Transaction[];
  banks: Bank[];
  navigate: (path: string) => void;
  onOpenStatement?: (statementId: string) => void;
}

export const StatementsTab = memo(function StatementsTab({
  clientStatements,
  clientTransactions,
  navigate,
  onOpenStatement,
}: StatementsTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader
        action={
          <Button onClick={() => navigate('/import')}>
            <Upload className="w-4 h-4 mr-2" />
            Importer relevé
          </Button>
        }
      >
        <CardTitle>Journal des relevés bancaires</CardTitle>
      </CardHeader>
      <CardBody className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-primary-50 border-b border-primary-100">
              <tr>
                <th className="w-8 px-2"></th>
                <Th>Date import</Th>
                <Th>Fichier</Th>
                <Th>Banque</Th>
                <Th>Période</Th>
                <Th align="center">Transactions</Th>
                <Th align="center">Statut</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-100">
              {clientStatements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <FileText className="w-12 h-12 text-primary-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-primary-900 mb-2">Aucun relevé importé</h3>
                    <p className="text-primary-500 mb-4">Importez des relevés bancaires pour commencer l'analyse</p>
                    <Button onClick={() => navigate('/import')}>
                      <Upload className="w-4 h-4 mr-2" />
                      Importer un relevé
                    </Button>
                  </td>
                </tr>
              ) : (
                clientStatements.map((statement) => {
                  const isExpanded = expandedId === statement.id;
                  return (
                    <StatementRow
                      key={statement.id}
                      statement={statement}
                      isExpanded={isExpanded}
                      onToggle={() => setExpandedId(isExpanded ? null : statement.id)}
                      transactions={clientTransactions}
                      onOpen={() => onOpenStatement?.(statement.id)}
                    />
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
});

// ===========================================================================
// STATEMENT ROW (with expandable journal detail)
// ===========================================================================

function StatementRow({
  statement,
  isExpanded,
  onToggle,
  transactions,
  onOpen,
}: {
  statement: BankStatement;
  isExpanded: boolean;
  onToggle: () => void;
  transactions: Transaction[];
  onOpen?: () => void;
}) {
  return (
    <>
      <tr className={`hover:bg-primary-50 cursor-pointer ${isExpanded ? 'bg-primary-50/40' : ''}`} onClick={onToggle}>
        <td className="px-2 text-center text-primary-400">
          {isExpanded ? <ChevronDown className="w-4 h-4 inline" /> : <ChevronRight className="w-4 h-4 inline" />}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary-400" />
            <span className="text-sm text-primary-900">{formatDate(statement.importedAt)}</span>
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary-400" />
            <span className="text-sm font-medium text-primary-900">{statement.fileName}</span>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <Landmark className="w-4 h-4 text-primary-400" />
            <span className="text-sm text-primary-700">{statement.bankName}</span>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className="text-sm text-primary-700">
            {formatDate(statement.periodStart)} — {formatDate(statement.periodEnd)}
          </span>
        </td>
        <td className="px-6 py-4 text-center">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
            {statement.transactionCount}
          </span>
        </td>
        <td className="px-6 py-4 text-center">
          <Badge variant={
            statement.status === 'analyzed' ? 'success' :
            statement.status === 'imported' ? 'warning' : 'secondary'
          }>
            {statement.status === 'analyzed' ? 'Analysé' :
             statement.status === 'imported' ? 'À analyser' : 'Archivé'}
          </Badge>
        </td>
        <td className="px-6 py-4 text-right">
          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={onOpen}
              className="p-1.5 hover:bg-amber-100 rounded text-amber-600 hover:text-amber-800 transition-colors"
              title="Ouvrir le releve (analyse detaillee)"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              onClick={onToggle}
              className={`p-1.5 rounded transition-colors ${
                isExpanded
                  ? 'bg-primary-100 text-primary-700'
                  : 'hover:bg-primary-100 text-primary-500 hover:text-primary-700'
              }`}
              title={isExpanded ? 'Masquer le detail' : 'Voir le detail des ecritures'}
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              className="p-1.5 hover:bg-primary-100 rounded text-primary-500 hover:text-primary-700"
              title="Telecharger"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={8} className="bg-canvas-50/40 p-0">
            <StatementJournal statement={statement} transactions={transactions} />
          </td>
        </tr>
      )}
    </>
  );
}

// ===========================================================================
// JOURNAL DETAIL — bank-statement-style ledger with progressive balance
// ===========================================================================

function StatementJournal({
  statement,
  transactions,
}: {
  statement: BankStatement;
  transactions: Transaction[];
}) {
  // Filter transactions belonging to this statement (same bank + within period)
  const journal = useMemo(() => {
    const startMs = new Date(statement.periodStart).getTime();
    const endMs = new Date(statement.periodEnd).getTime();
    const filtered = transactions
      .filter((t) => t.bankCode === statement.bankCode)
      .filter((t) => {
        const ts = new Date(t.date).getTime();
        return ts >= startMs && ts <= endMs;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Reconstruct progressive balance — prefer the recorded balance, fall back
    // to a computed running total when balance is missing.
    let running = 0;
    const firstWithBalance = filtered.find((t) => typeof t.balance === 'number' && Number.isFinite(t.balance));
    if (firstWithBalance) {
      // Initial balance = first row balance - first row amount
      running = firstWithBalance.balance - firstWithBalance.amount;
    }
    return filtered.map((t, i) => {
      const recorded = typeof t.balance === 'number' && Number.isFinite(t.balance) ? t.balance : null;
      running = recorded ?? running + t.amount;
      return {
        ...t,
        progressiveBalance: running,
        seq: i + 1,
        balanceFromRecord: recorded !== null,
      };
    });
  }, [statement, transactions]);

  // Header summary
  const totalDebit = journal.reduce((s, t) => s + (t.amount < 0 ? -t.amount : 0), 0);
  const totalCredit = journal.reduce((s, t) => s + (t.amount > 0 ? t.amount : 0), 0);
  const openingBalance = journal.length > 0 ? journal[0].progressiveBalance - journal[0].amount : 0;
  const closingBalance = journal.length > 0 ? journal[journal.length - 1].progressiveBalance : 0;

  if (journal.length === 0) {
    return (
      <div className="px-6 py-6 text-center text-primary-500 text-sm">
        Aucune écriture trouvée pour ce relevé. Vérifie que les transactions ont bien été importées.
      </div>
    );
  }

  return (
    <div className="px-6 py-4">
      {/* Summary header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <SummaryTile label="Solde initial" value={formatCurrency(openingBalance, 'XAF')} tone="ink" />
        <SummaryTile label="Total débits" value={formatCurrency(totalDebit, 'XAF')} tone="red" />
        <SummaryTile label="Total crédits" value={formatCurrency(totalCredit, 'XAF')} tone="emerald" />
        <SummaryTile label="Solde final" value={formatCurrency(closingBalance, 'XAF')} tone={closingBalance >= 0 ? 'emerald' : 'red'} />
      </div>

      {/* Sanity check banner */}
      {journal.length > 1 && (() => {
        const expected = openingBalance + totalCredit - totalDebit;
        const diff = Math.abs(expected - closingBalance);
        if (diff < 1) return null;
        return (
          <div className="mb-3 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-900">
            ⚠ Réconciliation : solde initial + crédits − débits = {formatCurrency(expected, 'XAF')}
            {' '}vs solde final récupéré {formatCurrency(closingBalance, 'XAF')}.
            Écart : {formatCurrency(diff, 'XAF')}.
          </div>
        );
      })()}

      {/* Journal table — bank statement style */}
      <div className="overflow-x-auto rounded-lg border border-primary-200 bg-white">
        <table className="w-full text-xs">
          <thead className="bg-primary-50">
            <tr className="text-[10px] uppercase tracking-wider text-primary-600 font-semibold">
              <th className="px-3 py-2 text-left w-12">#</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Date valeur</th>
              <th className="px-3 py-2 text-left">Libellé</th>
              <th className="px-3 py-2 text-left">Référence</th>
              <th className="px-3 py-2 text-right">Débit</th>
              <th className="px-3 py-2 text-right">Crédit</th>
              <th className="px-3 py-2 text-right">Solde progressif</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-primary-100">
            {journal.map((tx) => {
              const isDebit = tx.amount < 0;
              const isCredit = tx.amount > 0;
              return (
                <tr key={tx.id} className="hover:bg-primary-50/60">
                  <td className="px-3 py-2 text-primary-400 tabular-nums">{tx.seq}</td>
                  <td className="px-3 py-2 text-primary-700 tabular-nums whitespace-nowrap">
                    {formatDate(tx.date)}
                  </td>
                  <td className="px-3 py-2 text-primary-500 tabular-nums whitespace-nowrap">
                    {formatDate(tx.valueDate ?? tx.date)}
                  </td>
                  <td className="px-3 py-2 text-primary-900">
                    <div className="flex items-center gap-1.5">
                      {isDebit && <ArrowDownCircle className="w-3 h-3 text-red-500 flex-shrink-0" />}
                      {isCredit && <ArrowUpCircle className="w-3 h-3 text-emerald-600 flex-shrink-0" />}
                      <span className="truncate max-w-[280px]">{tx.description || '—'}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-primary-500 font-mono whitespace-nowrap">
                    {tx.reference || '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium text-red-700 whitespace-nowrap">
                    {isDebit ? formatCurrency(Math.abs(tx.amount), 'XAF') : ''}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium text-emerald-700 whitespace-nowrap">
                    {isCredit ? formatCurrency(tx.amount, 'XAF') : ''}
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums font-semibold whitespace-nowrap ${
                    tx.progressiveBalance < 0 ? 'text-red-700' : 'text-primary-900'
                  }`}>
                    {formatCurrency(tx.progressiveBalance, 'XAF')}
                    {!tx.balanceFromRecord && (
                      <span className="text-[9px] text-primary-400 ml-1" title="Solde recalculé (non récupéré du PDF)">±</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-primary-50 border-t border-primary-200">
            <tr className="text-xs font-semibold">
              <td colSpan={5} className="px-3 py-2 text-right text-primary-700 uppercase tracking-wider text-[10px]">
                Totaux
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-red-700">
                {formatCurrency(totalDebit, 'XAF')}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                {formatCurrency(totalCredit, 'XAF')}
              </td>
              <td className={`px-3 py-2 text-right tabular-nums ${
                closingBalance < 0 ? 'text-red-700' : 'text-primary-900'
              }`}>
                {formatCurrency(closingBalance, 'XAF')}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-[11px] text-primary-400 mt-2">
        {journal.length} écriture{journal.length > 1 ? 's' : ''} importée{journal.length > 1 ? 's' : ''} pour la période {formatDate(statement.periodStart)} — {formatDate(statement.periodEnd)}.
        Le solde progressif est calculé depuis le solde initial reconstruit ; les lignes marquées <strong>±</strong> ont été recalculées (pas de solde dans le PDF source).
      </p>
    </div>
  );
}

// ===========================================================================
// HELPERS
// ===========================================================================

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'center' | 'right' }) {
  return (
    <th className={`px-6 py-3 text-${align} text-xs font-semibold text-primary-600 uppercase tracking-wider`}>
      {children}
    </th>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone: 'ink' | 'red' | 'emerald' }) {
  const toneClass =
    tone === 'red' ? 'text-red-700 bg-red-50 border-red-200'
    : tone === 'emerald' ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : 'text-primary-900 bg-white border-primary-200';
  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-wider opacity-70 font-semibold">{label}</p>
      <p className="text-sm font-bold tabular-nums mt-0.5">{value}</p>
    </div>
  );
}
