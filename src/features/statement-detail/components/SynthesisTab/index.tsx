// ============================================================================
// SynthesisTab — orchestrateur des 7 cards spec V1
// ============================================================================

import { useMemo } from 'react';
import { KpiGrid } from './KpiGrid';
import { TreasuryChart } from './TreasuryChart';
import { FeesEvolutionCard } from './FeesEvolutionCard';
import { FlowsCategorizationCard } from './FlowsCategorizationCard';
import { TopCounterpartiesCard } from './TopCounterpartiesCard';
import { ComplianceLcbFtCard } from './ComplianceLcbFtCard';
import { ProphetSuggestionCard } from './ProphetSuggestionCard';
import type { Anomaly, BankTransaction } from '../../types/statement.types';

interface SynthesisTabProps {
  bankTxs: BankTransaction[];
  anomalies: Anomaly[];
  finalBalanceCentimes: number;
  /** Bank-side overdraft threshold in units (negative). Optional. */
  overdraftThresholdUnits?: number | null;
  /** Suggestion text generated upstream (PROPH3T or heuristic). */
  prophetSuggestion?: string;
  prophetActions?: Array<{ label: string; onClick?: () => void }>;
  onSeeAllCounterparties?: () => void;
}

export function SynthesisTab(props: SynthesisTabProps) {
  const stats = useMemo(() => {
    let totalDebit = 0, totalCredit = 0, debitCount = 0, creditCount = 0, fees = 0;
    for (const t of props.bankTxs) {
      totalDebit += t.debitCentimes;
      totalCredit += t.creditCentimes;
      if (t.debitCentimes > 0) debitCount++;
      if (t.creditCentimes > 0) creditCount++;
      // Frais bancaires : libellés contenant des mots clés
      if (/comm|frais|agios|tenue|rejet|sms|abonnement\s*sms|swift/i.test(t.label) && t.debitCentimes > 0) {
        fees += t.debitCentimes;
      }
    }
    const startBal = props.bankTxs[0]?.runningBalanceCentimes ?? props.finalBalanceCentimes;
    const finalBalanceDeltaPct = startBal !== 0
      ? ((props.finalBalanceCentimes - startBal) / Math.abs(startBal)) * 100
      : null;
    return {
      totalDebit, totalCredit, debitCount, creditCount, fees,
      startBal,
      finalBalanceDeltaPct,
    };
  }, [props.bankTxs, props.finalBalanceCentimes]);

  // Suggestion par défaut si PROPH3T pas disponible
  const fallbackText = useMemo(() => buildFallbackSuggestion(props.bankTxs, props.anomalies), [props.bankTxs, props.anomalies]);

  return (
    <div className="p-4 sm:p-6 space-y-4 overflow-y-auto h-full">
      <KpiGrid
        finalBalanceCentimes={props.finalBalanceCentimes / 100 * 100}
        startBalanceCentimes={stats.startBal}
        totalCreditCentimes={stats.totalCredit}
        totalDebitCentimes={stats.totalDebit}
        feesCentimes={stats.fees}
        creditCount={stats.creditCount}
        debitCount={stats.debitCount}
        feesDeltaPct={null /* fees vs trim. préc. — nécessite données historiques */}
        finalBalanceDeltaPct={stats.finalBalanceDeltaPct}
      />

      <TreasuryChart
        bankTxs={props.bankTxs}
        overdraftThresholdUnits={props.overdraftThresholdUnits ?? null}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FeesEvolutionCard bankTxs={props.bankTxs} agiosWarning />
        <FlowsCategorizationCard bankTxs={props.bankTxs} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TopCounterpartiesCard bankTxs={props.bankTxs} onSeeAll={props.onSeeAllCounterparties} />
        <ComplianceLcbFtCard anomalies={props.anomalies} />
      </div>

      <ProphetSuggestionCard
        text={props.prophetSuggestion ?? fallbackText}
        actions={props.prophetActions ?? []}
      />
    </div>
  );
}

function buildFallbackSuggestion(txs: BankTransaction[], anomalies: Anomaly[]): string {
  const tariffaires = anomalies.filter(
    (a) => ['commission_excessive', 'agio_errone', 'frais_double', 'convention_violee'].includes(a.type)
      && (a.status === 'qualified' || a.status === 'validated' || a.status === 'detected'),
  );
  const totalRecovery = tariffaires.reduce((s, a) => s + (a.potentialRecoveryCentimes ?? 0), 0);

  if (tariffaires.length > 0) {
    return `${tariffaires.length} anomalie${tariffaires.length > 1 ? 's' : ''} tarifaire${tariffaires.length > 1 ? 's' : ''} identifiée${tariffaires.length > 1 ? 's' : ''} sur ce relevé. Montant à rétrocéder estimé : ${formatFcfa(totalRecovery / 100)} FCFA. Tu peux préparer une lettre de réclamation depuis l'onglet Rapport.`;
  }
  if (anomalies.length === 0) {
    return 'Aucune anomalie détectée — le relevé est conforme aux conventions appliquées. Tu peux générer un rapport synthèse depuis l\'onglet Rapport.';
  }
  return `${anomalies.length} anomalie${anomalies.length > 1 ? 's' : ''} détectée${anomalies.length > 1 ? 's' : ''}. Consulte l'onglet Anomalies pour qualifier et valider.`;
}

function formatFcfa(units: number): string {
  const s = String(Math.abs(Math.round(units)));
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ' ';
    out += s[i];
  }
  return out;
}
