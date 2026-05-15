import { memo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ExternalLink } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody, DetectionBadge } from '../../ui';
import { formatCurrency, formatDate } from '../../../utils';
import { AnomalyType, ANOMALY_TYPE_LABELS, Anomaly } from '../../../types';
import type { Anomaly as WorkflowAnomaly } from '../../../features/statement-detail/types/statement.types';
import { ClientAnalytics } from './types';

interface SavingsTabProps {
  analytics: ClientAnalytics;
  clientAnomalies: Anomaly[];
  /** Anomalies workflow réellement validées (validated/signed/closed). */
  workflowRealizedAnomalies?: WorkflowAnomaly[];
  /** Si true, on affiche la liste workflow (vraies validations) au lieu du legacy. */
  workflowSourced?: boolean;
  onOpenStatement?: (statementId: string) => void;
}

const WF_LABELS: Record<string, string> = {
  commission_excessive: 'Commission excessive',
  agio_errone: 'Agios erronés',
  frais_double: 'Frais facturé en double',
  convention_violee: 'Convention non respectée',
  date_valeur_abusive: 'Date de valeur abusive',
  frais_non_justifie: 'Frais non justifié',
  lcb_ft: 'Soupçon LCB-FT',
  pays_gafi_risque: 'Pays GAFI à risque',
  beneficiaire_inedit: 'Bénéficiaire inédit',
  montant_anormal: 'Montant anormal',
  doublon_transaction: 'Transaction dupliquée',
  autre: 'Autre',
};

export const SavingsTab = memo(function SavingsTab({
  analytics,
  clientAnomalies,
  workflowRealizedAnomalies,
  workflowSourced = false,
  onOpenStatement,
}: SavingsTabProps) {
  const legacyConfirmed = clientAnomalies.filter((a) => a.status === 'confirmed');
  const useWorkflow = workflowSourced && workflowRealizedAnomalies !== undefined;
  const realizedCount = useWorkflow ? workflowRealizedAnomalies!.length : legacyConfirmed.length;

  return (
    <div className="space-y-4">
      {/* Savings Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-3 bg-gradient-to-br from-primary-600 to-primary-700 text-white">
          <p className="text-xs text-primary-100 mb-0.5">Economies totales</p>
          <p className="text-2xl font-bold">{formatCurrency(analytics.totalSavings, 'XAF')}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-primary-500 mb-0.5">Economies potentielles</p>
          <p className="text-2xl font-bold text-primary-600">{formatCurrency(analytics.potentialSavings, 'XAF')}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-primary-500 mb-0.5">Taux de confirmation</p>
          <p className="text-2xl font-bold text-primary-600">{analytics.confirmationRate}%</p>
        </Card>
      </div>

      {/* Savings Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Evolution des economies</CardTitle>
        </CardHeader>
        <CardBody>
          <div style={{ width: '100%', height: 192 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100} debounce={50}>
              <AreaChart data={analytics.monthlyTrend}>
                <defs>
                  <linearGradient id="colorSavingsTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis dataKey="month" stroke="#737373" fontSize={12} />
                <YAxis stroke="#737373" fontSize={12} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value, 'XAF')}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px' }}
                />
                <Area
                  type="monotone"
                  dataKey="savings"
                  stroke="#22c55e"
                  fill="url(#colorSavingsTrend)"
                  name="Economies"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      {/* Detail list */}
      <Card>
        <CardHeader>
          <CardTitle>Detail des economies</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {realizedCount === 0 ? (
            <div className="p-6 text-center text-primary-500 text-sm">
              {useWorkflow
                ? 'Aucune anomalie validee pour le moment. Validez les anomalies depuis le detail du releve.'
                : 'Aucune economie realisee pour le moment'}
            </div>
          ) : useWorkflow ? (
            <div className="divide-y divide-primary-100">
              {workflowRealizedAnomalies!.map((a) => {
                const amountXAF = a.potentialRecoveryCentimes
                  ? a.potentialRecoveryCentimes / 100
                  : Math.abs(a.transaction.amountCentimes) / 100;
                const label = WF_LABELS[a.type] || a.type;
                return (
                  <div key={a.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-primary-900 truncate">{label}</p>
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {a.status === 'closed' ? 'Cloture' : a.status === 'signed' ? 'Signee' : 'Validee'}
                        </span>
                      </div>
                      <p className="text-sm text-primary-500 truncate">{a.title}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <p className="text-lg font-bold text-primary-600">
                        +{formatCurrency(amountXAF, 'XAF')}
                      </p>
                      {onOpenStatement && (
                        <button
                          onClick={() => onOpenStatement(a.statementId)}
                          className="p-1.5 rounded-md text-amber-600 hover:bg-amber-50 hover:text-amber-800 transition-all"
                          title="Ouvrir le releve"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="divide-y divide-primary-100">
              {legacyConfirmed.map((anomaly) => (
                <div key={anomaly.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-primary-900">
                        {ANOMALY_TYPE_LABELS[anomaly.type as AnomalyType] || anomaly.type}
                      </p>
                      <DetectionBadge source={anomaly.detectionSource} size="sm" />
                    </div>
                    <p className="text-sm text-primary-500">{formatDate(anomaly.detectedAt)}</p>
                  </div>
                  <p className="text-lg font-bold text-primary-600">
                    +{formatCurrency(anomaly.amount, 'XAF')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
});
