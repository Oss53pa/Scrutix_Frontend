import { memo } from 'react';
import { FileBarChart, Plus, Calendar, Eye, Download, Send } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody, Button, Badge } from '../../ui';
import { formatCurrency, formatDate } from '../../../utils';
import { AuditReport } from '../../../types';

interface ReportsTabProps {
  clientReports: AuditReport[];
  navigate: (path: string) => void;
}

export const ReportsTab = memo(function ReportsTab({
  clientReports,
  navigate,
}: ReportsTabProps) {
  return (
    <Card>
      <CardHeader
        action={
          <Button onClick={() => navigate('/reports')}>
            <Plus className="w-4 h-4 mr-2" />
            Nouveau rapport
          </Button>
        }
      >
        <CardTitle>Journal des rapports d'audit</CardTitle>
      </CardHeader>
      <CardBody className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-primary-50 border-b border-primary-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-primary-600 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-primary-600 uppercase tracking-wider">
                  Titre
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-primary-600 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-primary-600 uppercase tracking-wider">
                  Periode
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-primary-600 uppercase tracking-wider">
                  Anomalies
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-primary-600 uppercase tracking-wider">
                  Montant
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-primary-600 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-primary-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-100">
              {clientReports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <FileBarChart className="w-12 h-12 text-primary-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-primary-900 mb-2">Aucun rapport</h3>
                    <p className="text-primary-500 mb-4">Generez un rapport d'audit pour ce client</p>
                    <Button onClick={() => navigate('/reports')}>
                      <Plus className="w-4 h-4 mr-2" />
                      Creer un rapport
                    </Button>
                  </td>
                </tr>
              ) : (
                clientReports.map((report) => (
                  <tr key={report.id} className="hover:bg-primary-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary-400" />
                        <span className="text-sm text-primary-900">{formatDate(report.generatedAt)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <FileBarChart className="w-4 h-4 text-primary-400" />
                        <span className="text-sm font-medium text-primary-900">{report.title}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-primary-700">
                        {report.type === 'audit' ? 'Audit complet' :
                         report.type === 'summary' ? 'Synthese' :
                         report.type === 'anomaly' ? 'Anomalies' : 'Standard'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-primary-700">
                        {report.period?.start && report.period?.end
                          ? `${formatDate(report.period.start)} - ${formatDate(report.period.end)}`
                          : 'Non definie'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-200 text-primary-800">
                        {report.anomalyCount || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-medium text-primary-600">
                        {formatCurrency(report.totalAmount || 0, 'XAF')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge
                        variant={
                          report.status === 'sent' ? 'success' :
                          report.status === 'final' ? 'info' : 'secondary'
                        }
                      >
                        {report.status === 'sent' ? 'Envoye' :
                         report.status === 'final' ? 'Finalise' : 'Brouillon'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="p-1.5 hover:bg-primary-100 rounded text-primary-500 hover:text-primary-700"
                          title="Voir rapport"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 hover:bg-primary-100 rounded text-primary-500 hover:text-primary-700"
                          title="Telecharger PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {report.status !== 'sent' && (
                          <button
                            className="p-1.5 hover:bg-primary-100 rounded text-primary-500 hover:text-primary-600"
                            title="Envoyer"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
});
