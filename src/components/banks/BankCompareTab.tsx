import { X } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '../ui';
import type { Bank } from '../../types';
import { formatCurrency } from '../../utils';

interface BankCompareTabProps {
  banks: Bank[];
  compareBanks: string[];
  onToggleBank: (bankId: string) => void;
}

export function BankCompareTab({ banks, compareBanks, onToggleBank }: BankCompareTabProps) {
  const banksWithConditions = banks.filter((b) => b.conditions);

  // Get all unique fee codes from selected banks
  const allFeeCodes = new Map<string, string>();
  compareBanks.forEach((bankId) => {
    const bank = banks.find((b) => b.id === bankId);
    bank?.conditions?.fees.forEach((fee) => {
      if (!allFeeCodes.has(fee.code)) {
        allFeeCodes.set(fee.code, fee.name);
      }
    });
  });

  const getFeeAmount = (bank: Bank, feeCode: string) => {
    const fee = bank.conditions?.fees.find((f) => f.code === feeCode);
    if (!fee) return null;
    if (fee.type === 'percentage') return `${fee.percentage}%`;
    return formatCurrency(fee.amount, 'XAF');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Selectionnez les banques a comparer (2-5)</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="flex flex-wrap gap-2">
            {banksWithConditions.map((bank) => (
              <button
                key={bank.id}
                onClick={() => onToggleBank(bank.id)}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  compareBanks.includes(bank.id)
                    ? 'bg-primary-900 text-white border-primary-900'
                    : 'bg-white text-primary-700 border-primary-300 hover:border-primary-500'
                }`}
              >
                {bank.name}
                {compareBanks.includes(bank.id) && <X className="w-4 h-4 ml-2 inline" />}
              </button>
            ))}
          </div>
          {banksWithConditions.length === 0 && (
            <p className="text-primary-500 text-center py-4">
              Configurez les conditions des banques pour pouvoir les comparer
            </p>
          )}
        </CardBody>
      </Card>

      {compareBanks.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Comparaison des tarifs</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-primary-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-primary-700">
                      Service
                    </th>
                    {compareBanks.map((bankId) => {
                      const bank = banks.find((b) => b.id === bankId);
                      return (
                        <th
                          key={bankId}
                          className="text-right px-4 py-3 text-sm font-medium text-primary-700"
                        >
                          {bank?.name}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary-100">
                  {Array.from(allFeeCodes.entries()).map(([code, name]) => (
                    <tr key={code}>
                      <td className="px-4 py-3 text-sm">{name}</td>
                      {compareBanks.map((bankId) => {
                        const bank = banks.find((b) => b.id === bankId);
                        const amount = bank ? getFeeAmount(bank, code) : null;
                        return (
                          <td key={bankId} className="px-4 py-3 text-sm text-right font-medium">
                            {amount || '-'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {allFeeCodes.size === 0 && (
                    <tr>
                      <td
                        colSpan={compareBanks.length + 1}
                        className="px-4 py-8 text-center text-primary-500"
                      >
                        Aucun frais a comparer
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
