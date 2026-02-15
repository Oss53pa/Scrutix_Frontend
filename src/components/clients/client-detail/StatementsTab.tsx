import { memo } from 'react';
import { FileText, Upload, Clock, Landmark, Eye, Download } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody, Button, Badge } from '../../ui';
import { formatDate } from '../../../utils';
import { BankStatement } from '../../../types';

interface StatementsTabProps {
  clientStatements: BankStatement[];
  navigate: (path: string) => void;
}

export const StatementsTab = memo(function StatementsTab({
  clientStatements,
  navigate,
}: StatementsTabProps) {
  return (
    <Card>
      <CardHeader
        action={
          <Button onClick={() => navigate('/import')}>
            <Upload className="w-4 h-4 mr-2" />
            Importer releve
          </Button>
        }
      >
        <CardTitle>Journal des releves bancaires</CardTitle>
      </CardHeader>
      <CardBody className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-primary-50 border-b border-primary-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-primary-600 uppercase tracking-wider">
                  Date import
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-primary-600 uppercase tracking-wider">
                  Fichier
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-primary-600 uppercase tracking-wider">
                  Banque
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-primary-600 uppercase tracking-wider">
                  Periode
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-primary-600 uppercase tracking-wider">
                  Transactions
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
              {clientStatements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <FileText className="w-12 h-12 text-primary-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-primary-900 mb-2">Aucun releve importe</h3>
                    <p className="text-primary-500 mb-4">Importez des releves bancaires pour commencer l'analyse</p>
                    <Button onClick={() => navigate('/import')}>
                      <Upload className="w-4 h-4 mr-2" />
                      Importer un releve
                    </Button>
                  </td>
                </tr>
              ) : (
                clientStatements.map((statement) => (
                  <tr key={statement.id} className="hover:bg-primary-50">
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
                        {formatDate(statement.periodStart)} - {formatDate(statement.periodEnd)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                        {statement.transactionCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge
                        variant={
                          statement.status === 'analyzed' ? 'success' :
                          statement.status === 'imported' ? 'warning' : 'secondary'
                        }
                      >
                        {statement.status === 'analyzed' ? 'Analyse' :
                         statement.status === 'imported' ? 'A analyser' : 'Archive'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="p-1.5 hover:bg-primary-100 rounded text-primary-500 hover:text-primary-700"
                          title="Voir details"
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
});
