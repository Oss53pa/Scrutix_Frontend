import { Landmark, Upload, History, Pencil, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody, Button } from '../ui';
import type { Bank } from '../../types';
import { formatCurrency } from '../../utils';

interface BankConditionsTabProps {
  banks: Bank[];
  selectedBankId: string | null;
  onSelectBank: (bankId: string) => void;
  onOpenConditions: (bankId: string) => void;
}

export function BankConditionsTab({ banks, selectedBankId, onSelectBank, onOpenConditions }: BankConditionsTabProps) {
  const selectedBank = selectedBankId ? banks.find((b) => b.id === selectedBankId) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Bank Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Selectionner une banque</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          <div className="divide-y divide-primary-100">
            {banks.map((bank) => (
              <button
                key={bank.id}
                onClick={() => onSelectBank(bank.id)}
                className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-primary-50 transition-colors ${
                  selectedBankId === bank.id ? 'bg-primary-100' : ''
                }`}
              >
                <Landmark className="w-5 h-5 text-primary-600" />
                <span className="flex-1 text-left font-medium text-primary-900">{bank.name}</span>
                {bank.conditions && <CheckCircle2 className="w-4 h-4 text-green-600" />}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Conditions Detail */}
      <div className="lg:col-span-2">
        {selectedBank ? (
          <Card>
            <CardHeader
              action={
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => onOpenConditions(selectedBank.id)}>
                    <Upload className="w-4 h-4 mr-1" />
                    Importer PDF
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onOpenConditions(selectedBank.id)}>
                    <History className="w-4 h-4 mr-1" />
                    Historique
                  </Button>
                </div>
              }
            >
              <CardTitle>Conditions - {selectedBank.name}</CardTitle>
            </CardHeader>
            <CardBody>
              {selectedBank.conditions ? (
                <div className="space-y-6">
                  {/* Fees */}
                  <div>
                    <h4 className="font-medium text-primary-900 mb-3">Frais bancaires</h4>
                    <div className="border border-primary-200 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-primary-50">
                          <tr>
                            <th className="text-left px-4 py-2 text-xs font-medium text-primary-500">
                              Service
                            </th>
                            <th className="text-right px-4 py-2 text-xs font-medium text-primary-500">
                              Montant
                            </th>
                            <th className="text-right px-4 py-2 text-xs font-medium text-primary-500">
                              Type
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-primary-100">
                          {selectedBank.conditions.fees.map((fee) => (
                            <tr key={fee.code}>
                              <td className="px-4 py-2 text-sm">{fee.name}</td>
                              <td className="px-4 py-2 text-sm text-right">
                                {fee.type === 'percentage'
                                  ? `${fee.percentage}%`
                                  : formatCurrency(fee.amount, 'XAF')}
                              </td>
                              <td className="px-4 py-2 text-sm text-right text-primary-500">
                                {fee.type === 'fixed' ? 'Fixe' : fee.type === 'percentage' ? '%' : 'Palier'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Interest Rates */}
                  <div>
                    <h4 className="font-medium text-primary-900 mb-3">Taux d'interet</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedBank.conditions.interestRates.map((rate) => (
                        <div key={rate.type} className="p-4 border border-primary-200 rounded-lg">
                          <p className="text-sm text-primary-500 mb-1">
                            {rate.type === 'overdraft'
                              ? 'Decouvert'
                              : rate.type === 'authorized'
                              ? 'Autorise'
                              : rate.type === 'unauthorized'
                              ? 'Non autorise'
                              : 'Epargne'}
                          </p>
                          <p className="text-2xl font-bold text-primary-900">
                            {(rate.rate * 100).toFixed(2)}%
                          </p>
                          <p className="text-xs text-primary-400">
                            {rate.calculationMethod} - {rate.dayCountConvention}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-primary-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-primary-900 mb-2">
                    Conditions non configurees
                  </h3>
                  <p className="text-primary-500 mb-6">
                    Importez ou saisissez les conditions tarifaires
                  </p>
                  <div className="flex justify-center gap-3">
                    <Button variant="secondary" onClick={() => onOpenConditions(selectedBank.id)}>
                      <Upload className="w-4 h-4 mr-2" />
                      Importer PDF
                    </Button>
                    <Button onClick={() => onOpenConditions(selectedBank.id)}>
                      <Pencil className="w-4 h-4 mr-2" />
                      Saisir manuellement
                    </Button>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        ) : (
          <Card className="p-12 text-center">
            <Landmark className="w-12 h-12 text-primary-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-primary-900 mb-2">Selectionnez une banque</h3>
            <p className="text-primary-500">
              Choisissez une banque pour voir ses conditions tarifaires
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
