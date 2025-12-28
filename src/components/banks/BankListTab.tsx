import {
  Landmark,
  Plus,
  Pencil,
  Trash2,
  Eye,
  CheckCircle2,
  AlertCircle,
  MapPin,
} from 'lucide-react';
import { Card, CardBody, Button, Badge } from '../ui';
import type { Bank, MonetaryZone } from '../../types';
import { AFRICAN_COUNTRIES, ZONE_CURRENCIES, CEMAC_COUNTRIES, UEMOA_COUNTRIES } from '../../types';

function getZoneFromCountry(country: string): MonetaryZone | null {
  if (country in CEMAC_COUNTRIES) return 'CEMAC';
  if (country in UEMOA_COUNTRIES) return 'UEMOA';
  return null;
}

interface BankListTabProps {
  banks: Bank[];
  onAdd: () => void;
  onEdit: (bank: Bank) => void;
  onDelete: (bankId: string) => void;
  onViewConditions: (bankId: string) => void;
  getClientCount: (bankCode: string) => number;
}

export function BankListTab({
  banks,
  onAdd,
  onEdit,
  onDelete,
  onViewConditions,
  getClientCount,
}: BankListTabProps) {
  if (banks.length === 0) {
    return (
      <Card>
        <CardBody className="p-12 text-center">
          <Landmark className="w-12 h-12 text-primary-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-primary-900 mb-2">Aucune banque trouvee</h3>
          <p className="text-primary-500 mb-6">Ajoutez une banque pour commencer</p>
          <Button onClick={onAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter une banque
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="p-0">
        <table className="w-full">
          <thead className="bg-primary-50 border-b border-primary-200">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-primary-500 uppercase">
                Banque
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-primary-500 uppercase">
                Pays / Zone
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-primary-500 uppercase">
                Code BIC
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-primary-500 uppercase">
                Devise
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-primary-500 uppercase">
                Clients
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-primary-500 uppercase">
                Conditions
              </th>
              <th className="text-right px-6 py-3 text-xs font-medium text-primary-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-primary-100">
            {banks.map((bank) => {
              const zone = bank.zone || getZoneFromCountry(bank.country);
              const currency = zone ? ZONE_CURRENCIES[zone] : null;

              return (
                <tr key={bank.id} className="hover:bg-primary-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          zone === 'CEMAC'
                            ? 'bg-blue-100'
                            : zone === 'UEMOA'
                            ? 'bg-green-100'
                            : 'bg-primary-100'
                        }`}
                      >
                        <Landmark
                          className={`w-5 h-5 ${
                            zone === 'CEMAC'
                              ? 'text-blue-600'
                              : zone === 'UEMOA'
                              ? 'text-green-600'
                              : 'text-primary-600'
                          }`}
                        />
                      </div>
                      <span className="font-medium text-primary-900">{bank.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary-400" />
                      <div>
                        <p className="text-sm text-primary-900">
                          {AFRICAN_COUNTRIES[bank.country] || bank.country}
                        </p>
                        {zone && (
                          <Badge
                            variant={zone === 'CEMAC' ? 'info' : 'success'}
                            className="text-xs mt-0.5"
                          >
                            {zone}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-primary-600 font-mono">{bank.code}</td>
                  <td className="px-6 py-4 text-sm">
                    {currency ? (
                      <span className="font-medium text-primary-900">{currency.code}</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="secondary">{getClientCount(bank.code)}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    {bank.conditions ? (
                      <Badge variant="success">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Configure
                      </Badge>
                    ) : (
                      <Badge variant="warning">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        A configurer
                      </Badge>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onViewConditions(bank.id)}
                        className="p-2 hover:bg-primary-100 rounded-lg text-primary-600"
                        title="Voir les conditions"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onEdit(bank)}
                        className="p-2 hover:bg-primary-100 rounded-lg text-primary-600"
                        title="Modifier"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(bank.id)}
                        className="p-2 hover:bg-primary-100 rounded-lg text-red-600"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}
