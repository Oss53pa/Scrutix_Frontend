import { memo } from 'react';
import {
  Building2,
  MapPin,
  User,
  Briefcase,
  FileText,
  Clock,
  Landmark,
  Mail,
  Phone,
  Globe,
  Users,
  TrendingUp,
  Calendar,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody, Button, Badge } from '../../ui';
import { formatCurrency, formatDate } from '../../../utils';
import { Client, Bank } from '../../../types';

interface InfoTabProps {
  client: Client;
  banks: Bank[];
  setShowAddAccount: (show: boolean) => void;
  removeAccount: (clientId: string, accountId: string) => void;
}

export const InfoTab = memo(function InfoTab({
  client,
  banks,
  setShowAddAccount,
  removeAccount,
}: InfoTabProps) {
  return (
    <div className="space-y-4">
      {/* Identite de l'entreprise */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Identite de l'entreprise
          </CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-primary-500 uppercase mb-1">Raison sociale</p>
              <p className="font-medium text-primary-900">{client.legalName || client.name}</p>
            </div>
            <div>
              <p className="text-xs text-primary-500 uppercase mb-1">Code client</p>
              <p className="font-medium text-primary-900">{client.code}</p>
            </div>
            <div>
              <p className="text-xs text-primary-500 uppercase mb-1">Forme juridique</p>
              <p className="font-medium text-primary-900">{client.legalForm || 'Non renseigne'}</p>
            </div>
            <div>
              <p className="text-xs text-primary-500 uppercase mb-1">RCCM</p>
              <p className="font-medium text-primary-900">{client.rccm || client.siret || 'Non renseigne'}</p>
            </div>
            <div>
              <p className="text-xs text-primary-500 uppercase mb-1">NIF</p>
              <p className="font-medium text-primary-900">{client.nif || 'Non renseigne'}</p>
            </div>
            <div>
              <p className="text-xs text-primary-500 uppercase mb-1">Capital social</p>
              <p className="font-medium text-primary-900">
                {client.capital ? formatCurrency(client.capital, client.currency || 'XAF') : 'Non renseigne'}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Coordonnees */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Coordonnees
          </CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-primary-500 uppercase mb-1">Adresse</p>
              <p className="font-medium text-primary-900">{client.address || 'Non renseignee'}</p>
            </div>
            <div>
              <p className="text-xs text-primary-500 uppercase mb-1">Ville</p>
              <p className="font-medium text-primary-900">{client.city || 'Non renseignee'}</p>
            </div>
            <div>
              <p className="text-xs text-primary-500 uppercase mb-1">Code postal</p>
              <p className="font-medium text-primary-900">{client.postalCode || 'Non renseigne'}</p>
            </div>
            <div>
              <p className="text-xs text-primary-500 uppercase mb-1">Pays</p>
              <p className="font-medium text-primary-900">{client.country || 'Non renseigne'}</p>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary-400" />
              <div>
                <p className="text-xs text-primary-500 uppercase mb-1">Email</p>
                <p className="font-medium text-primary-900">{client.email || 'Non renseigne'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary-400" />
              <div>
                <p className="text-xs text-primary-500 uppercase mb-1">Telephone</p>
                <p className="font-medium text-primary-900">{client.phone || 'Non renseigne'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary-400" />
              <div>
                <p className="text-xs text-primary-500 uppercase mb-1">Site web</p>
                <p className="font-medium text-primary-900">{client.website || 'Non renseigne'}</p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Contact principal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Contact principal
          </CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-primary-500 uppercase mb-1">Nom du contact</p>
              <p className="font-medium text-primary-900">{client.contactName || 'Non renseigne'}</p>
            </div>
            <div>
              <p className="text-xs text-primary-500 uppercase mb-1">Fonction</p>
              <p className="font-medium text-primary-900">{client.contactRole || 'Non renseigne'}</p>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary-400" />
              <div>
                <p className="text-xs text-primary-500 uppercase mb-1">Email contact</p>
                <p className="font-medium text-primary-900">{client.contactEmail || 'Non renseigne'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary-400" />
              <div>
                <p className="text-xs text-primary-500 uppercase mb-1">Tel. contact</p>
                <p className="font-medium text-primary-900">{client.contactPhone || 'Non renseigne'}</p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Informations metier */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            Informations metier
          </CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-primary-500 uppercase mb-1">Secteur d'activite</p>
              <p className="font-medium text-primary-900">{client.sector || 'Non renseigne'}</p>
            </div>
            <div>
              <p className="text-xs text-primary-500 uppercase mb-1">Activite principale</p>
              <p className="font-medium text-primary-900">{client.activity || 'Non renseignee'}</p>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary-400" />
              <div>
                <p className="text-xs text-primary-500 uppercase mb-1">Effectif</p>
                <p className="font-medium text-primary-900">
                  {client.employeeCount ? `${client.employeeCount} employes` : 'Non renseigne'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary-400" />
              <div>
                <p className="text-xs text-primary-500 uppercase mb-1">Chiffre d'affaires annuel</p>
                <p className="font-medium text-primary-900">
                  {client.annualRevenue ? formatCurrency(client.annualRevenue, client.currency || 'XAF') : 'Non renseigne'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary-400" />
              <div>
                <p className="text-xs text-primary-500 uppercase mb-1">Cloture exercice fiscal</p>
                <p className="font-medium text-primary-900">{client.fiscalYearEnd || '31 decembre'}</p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Notes et tags */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Notes et etiquettes
          </CardTitle>
        </CardHeader>
        <CardBody>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-primary-500 uppercase mb-2">Etiquettes</p>
              <div className="flex flex-wrap gap-2">
                {client.tags && client.tags.length > 0 ? (
                  client.tags.map((tag, idx) => (
                    <Badge key={idx} variant="secondary">{tag}</Badge>
                  ))
                ) : (
                  <span className="text-primary-400 text-sm">Aucune etiquette</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs text-primary-500 uppercase mb-2">Notes</p>
              <p className="text-sm text-primary-700 whitespace-pre-wrap">
                {client.notes || 'Aucune note'}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Dates de suivi */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Suivi
          </CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-primary-500 uppercase mb-1">Date de creation</p>
              <p className="font-medium text-primary-900">{formatDate(client.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-primary-500 uppercase mb-1">Derniere mise a jour</p>
              <p className="font-medium text-primary-900">{formatDate(client.updatedAt)}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Comptes bancaires */}
      <Card>
        <CardHeader
          action={
            <Button variant="secondary" size="sm" onClick={() => setShowAddAccount(true)}>
              <Plus className="w-3 h-3 mr-1" />
              Ajouter compte
            </Button>
          }
        >
          <CardTitle className="flex items-center gap-2">
            <Landmark className="w-4 h-4" />
            Comptes bancaires
          </CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {client.accounts.length === 0 ? (
            <div className="p-6 text-center">
              <Landmark className="w-8 h-8 text-primary-300 mx-auto mb-2" />
              <p className="text-primary-500">Aucun compte bancaire enregistre</p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={() => setShowAddAccount(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Ajouter un compte
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-primary-50 border-b border-primary-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-primary-600 uppercase tracking-wider">
                      Banque
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-primary-600 uppercase tracking-wider">
                      Numero de compte
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-primary-600 uppercase tracking-wider">
                      IBAN
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
                  {client.accounts.map((account) => {
                    const bank = banks.find((b) => b.code === account.bankCode);
                    return (
                      <tr key={account.id} className="hover:bg-primary-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
                              <Landmark className="w-4 h-4 text-primary-600" />
                            </div>
                            <span className="font-medium text-primary-900">{bank?.name || account.bankCode}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-primary-700 font-mono">{account.accountNumber}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-primary-500 font-mono">{account.iban || '-'}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Badge variant={account.isActive ? 'success' : 'secondary'}>
                            {account.isActive ? 'Actif' : 'Inactif'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              className="p-1.5 hover:bg-primary-100 rounded text-primary-500 hover:text-primary-700"
                              title="Modifier"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => removeAccount(client.id, account.id)}
                              className="p-1.5 hover:bg-red-50 rounded text-primary-500 hover:text-red-600"
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
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
});
