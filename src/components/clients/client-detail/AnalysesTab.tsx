import { memo } from 'react';
import { Search } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody, Button, Badge, DetectionBadge } from '../../ui';
import { formatCurrency, formatDate } from '../../../utils';
import { Severity, AnomalyType, ANOMALY_TYPE_LABELS, Anomaly } from '../../../types';
import { ClientAnalytics } from './types';

interface AnalysesTabProps {
  clientAnomalies: Anomaly[];
  analytics: ClientAnalytics;
  navigate: (path: string) => void;
}

export const AnalysesTab = memo(function AnalysesTab({
  clientAnomalies,
  analytics,
  navigate,
}: AnalysesTabProps) {
  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-primary-900">{clientAnomalies.length}</p>
          <p className="text-xs text-primary-500">Total anomalies</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{analytics.confirmedCount}</p>
          <p className="text-xs text-primary-500">Confirmees</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-amber-600">{analytics.pendingCount}</p>
          <p className="text-xs text-primary-500">En attente</p>
        </Card>
      </div>

      <Card>
        <CardHeader
          action={
            <Button size="sm" onClick={() => navigate('/analyses')}>
              <Search className="w-3 h-3 mr-1" />
              Lancer analyse
            </Button>
          }
        >
          <CardTitle>Historique des anomalies</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {clientAnomalies.length === 0 ? (
            <div className="p-8 text-center">
              <Search className="w-10 h-10 text-primary-300 mx-auto mb-3" />
              <h3 className="font-medium text-primary-900 mb-1">Aucune analyse effectuee</h3>
              <p className="text-sm text-primary-500 mb-4">Lancez une analyse pour detecter les anomalies</p>
            </div>
          ) : (
            <div className="divide-y divide-primary-100">
              {clientAnomalies.map((anomaly) => (
                <div key={anomaly.id} className="px-6 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        anomaly.severity === Severity.CRITICAL ? 'error' :
                        anomaly.severity === Severity.HIGH ? 'warning' : 'secondary'
                      }>
                        {ANOMALY_TYPE_LABELS[anomaly.type as AnomalyType] || anomaly.type}
                      </Badge>
                      <DetectionBadge source={anomaly.detectionSource} size="sm" />
                      <Badge variant={anomaly.status === 'confirmed' ? 'success' : 'secondary'}>
                        {anomaly.status === 'confirmed' ? 'Confirme' : 'En attente'}
                      </Badge>
                    </div>
                    <span className="font-bold text-primary-900">
                      {formatCurrency(anomaly.amount, 'XAF')}
                    </span>
                  </div>
                  <p className="text-sm text-primary-600">{anomaly.recommendation}</p>
                  <p className="text-xs text-primary-400 mt-1">{formatDate(anomaly.detectedAt)}</p>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
});
