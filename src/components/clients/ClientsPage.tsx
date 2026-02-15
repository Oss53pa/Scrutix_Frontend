import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Building2,
  FileText,
  BarChart3,
  AlertTriangle,
  PiggyBank,
  MoreVertical,
  Pencil,
  Trash2,
  LayoutGrid,
  List,
  ChevronRight,
} from 'lucide-react';
import { Button, Card, Input, Modal, Badge } from '../ui';
import { useClientStore } from '../../store/clientStore';
import { useTransactionStore } from '../../store/transactionStore';
import { useAnalysisStore } from '../../store/analysisStore';
import type { Client } from '../../types';

export function ClientsPage() {
  const navigate = useNavigate();
  const { clients, addClient, updateClient, deleteClient, statements, reports } = useClientStore();
  const { transactions } = useTransactionStore();
  const { analysisHistory = [], currentAnalysis } = useAnalysisStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

  const filteredClients = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStats = (clientId: string) => {
    const clientStatements = statements.filter((s) => s.clientId === clientId);
    const clientTransactions = transactions.filter((t) => t.clientId === clientId);
    const allResults = [...(currentAnalysis ? [currentAnalysis] : []), ...analysisHistory];
    const clientAnomalies = allResults.flatMap((r) => r.anomalies).filter((a) =>
      a.transactions.some((t) => t.clientId === clientId)
    );
    const clientReports = reports.filter((r) => r.clientId === clientId);
    const confirmedAnomalies = clientAnomalies.filter((a) => a.status === 'confirmed');
    const totalSavings = confirmedAnomalies.reduce((sum, a) => sum + a.amount, 0);

    return {
      statements: clientStatements.length,
      transactions: clientTransactions.length,
      anomalies: clientAnomalies.length,
      savings: totalSavings,
      reports: clientReports.length,
    };
  };

  const handleSaveClient = (data: Partial<Client>) => {
    if (editingClient) {
      updateClient(editingClient.id, data);
      setEditingClient(null);
    } else {
      addClient({
        name: data.name || '',
        code: data.code || '',
        siret: data.siret,
        address: data.address,
        email: data.email,
        phone: data.phone,
        contactName: data.contactName,
      });
      setShowAddModal(false);
    }
  };

  const handleDelete = (id: string) => {
    deleteClient(id);
    setDeleteConfirm(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary-900">Clients</h1>
          <p className="text-sm text-primary-500">Gestion des clients et dossiers d'audit</p>
        </div>
        <Button size="sm" onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4 mr-1" />Nouveau client
        </Button>
      </div>

      {/* Search & View Toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
          <Input type="text" placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 py-1.5 text-sm" />
        </div>
        <div className="flex border border-primary-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('card')}
            className={`p-2 transition-colors ${viewMode === 'card' ? 'bg-primary-900 text-white' : 'bg-white text-primary-500 hover:bg-primary-50'}`}
            title="Vue cartes"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 transition-colors ${viewMode === 'table' ? 'bg-primary-900 text-white' : 'bg-white text-primary-500 hover:bg-primary-50'}`}
            title="Vue tableau"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Clients List */}
      {viewMode === 'card' ? (
        filteredClients.length === 0 ? (
          <Card className="p-8 text-center">
            <Building2 className="w-10 h-10 text-primary-300 mx-auto mb-3" />
            <h3 className="text-base font-medium text-primary-900 mb-1">{searchTerm ? 'Aucun client trouvé' : 'Aucun client'}</h3>
            <p className="text-sm text-primary-500 mb-4">{searchTerm ? 'Modifiez votre recherche' : 'Ajoutez votre premier client'}</p>
            {!searchTerm && <Button size="sm" onClick={() => setShowAddModal(true)}><Plus className="w-4 h-4 mr-1" />Ajouter</Button>}
          </Card>
        ) : (
        /* Card View */
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map((client) => {
            const stats = getStats(client.id);
            return (
              <Card key={client.id} className="p-3 hover:border-primary-300 transition-colors cursor-pointer group" onClick={() => navigate(`/clients/${client.id}`)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary-900 flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-primary-900">{client.name}</h3>
                      <p className="text-xs text-primary-500">{client.code}</p>
                    </div>
                  </div>
                  <div className="relative">
                    <button onClick={(e) => e.stopPropagation()} className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-primary-100 transition-all">
                      <MoreVertical className="w-3.5 h-3.5 text-primary-500" />
                    </button>
                    <div className="absolute right-0 top-6 z-10 hidden group-hover:block">
                      <div className="bg-white border border-primary-200 rounded-lg shadow-lg py-0.5 min-w-[100px]">
                        <button onClick={(e) => { e.stopPropagation(); setEditingClient(client); }} className="w-full px-2 py-1.5 text-left text-xs hover:bg-primary-50 flex items-center gap-1.5"><Pencil className="w-3 h-3" />Modifier</button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(client.id); }} className="w-full px-2 py-1.5 text-left text-xs hover:bg-primary-50 text-red-600 flex items-center gap-1.5"><Trash2 className="w-3 h-3" />Supprimer</button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5 text-xs"><FileText className="w-3.5 h-3.5 text-primary-400" /><span className="text-primary-600">{stats.statements} relevés</span></div>
                  <div className="flex items-center gap-1.5 text-xs"><BarChart3 className="w-3.5 h-3.5 text-primary-400" /><span className="text-primary-600">{stats.transactions} tx</span></div>
                  <div className="flex items-center gap-1.5 text-xs"><AlertTriangle className="w-3.5 h-3.5 text-severity-medium" /><span className="text-primary-600">{stats.anomalies} anom.</span></div>
                  <div className="flex items-center gap-1.5 text-xs"><PiggyBank className="w-3.5 h-3.5 text-primary-600" /><span className="text-primary-600 font-medium">{stats.savings.toLocaleString('fr-FR', { style: 'currency', currency: 'XAF' })}</span></div>
                </div>
                {client.accounts.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-primary-100">
                    <Badge variant="secondary">{client.accounts.length} compte{client.accounts.length > 1 ? 's' : ''}</Badge>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
        )
      ) : (
        /* Table View - Always show */
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-primary-50 border-b border-primary-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-primary-600 uppercase">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-primary-600 uppercase">Code</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-primary-600 uppercase">Relevés</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-primary-600 uppercase">Opérations</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-primary-600 uppercase">Anomalies</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-primary-600 uppercase">Économies</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-primary-600 uppercase">Comptes</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-primary-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-100">
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center">
                      <Building2 className="w-8 h-8 text-primary-300 mx-auto mb-2" />
                      <p className="text-sm text-primary-500">
                        {searchTerm ? 'Aucun client trouvé' : 'Aucun client enregistré'}
                      </p>
                      {!searchTerm && (
                        <Button size="sm" variant="ghost" className="mt-2" onClick={() => setShowAddModal(true)}>
                          <Plus className="w-3 h-3 mr-1" />Ajouter un client
                        </Button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((client) => {
                    const stats = getStats(client.id);
                    return (
                      <tr
                        key={client.id}
                        className="hover:bg-primary-50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/clients/${client.id}`)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-primary-900 flex items-center justify-center flex-shrink-0">
                              <Building2 className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-sm font-medium text-primary-900">{client.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-primary-600 font-mono">{client.code}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 text-sm text-primary-600">
                            <FileText className="w-3.5 h-3.5 text-primary-400" />
                            {stats.statements}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 text-sm text-primary-600">
                            <BarChart3 className="w-3.5 h-3.5 text-primary-400" />
                            {stats.transactions}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {stats.anomalies > 0 ? (
                            <Badge variant="warning">{stats.anomalies}</Badge>
                          ) : (
                            <span className="text-sm text-primary-400">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-medium text-primary-600">
                            {stats.savings.toLocaleString('fr-FR', { style: 'currency', currency: 'XAF' })}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {client.accounts.length > 0 ? (
                            <Badge variant="secondary">{client.accounts.length}</Badge>
                          ) : (
                            <span className="text-sm text-primary-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingClient(client); }}
                              className="p-1.5 hover:bg-primary-100 rounded text-primary-500 hover:text-primary-700"
                              title="Modifier"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirm(client.id); }}
                              className="p-1.5 hover:bg-red-50 rounded text-primary-500 hover:text-red-600"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <ChevronRight className="w-4 h-4 text-primary-400" />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <ClientFormModal
        isOpen={showAddModal || !!editingClient}
        onClose={() => {
          setShowAddModal(false);
          setEditingClient(null);
        }}
        onSave={handleSaveClient}
        client={editingClient}
      />

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Supprimer le client"
      >
        <p className="text-primary-600 mb-6">
          Êtes-vous sûr de vouloir supprimer ce client ? Cette action supprimera également tous les relevés, analyses et rapports associés.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>
            Annuler
          </Button>
          <Button
            variant="primary"
            className="bg-red-600 hover:bg-red-700"
            onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
          >
            Supprimer
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// Client Form Modal
interface ClientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Client>) => void;
  client?: Client | null;
}

function ClientFormModal({ isOpen, onClose, onSave, client }: ClientFormModalProps) {
  const [formData, setFormData] = useState({
    name: client?.name || '',
    code: client?.code || '',
    siret: client?.siret || '',
    address: client?.address || '',
    email: client?.email || '',
    phone: client?.phone || '',
    contactName: client?.contactName || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    setFormData({ name: '', code: '', siret: '', address: '', email: '', phone: '', contactName: '' });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={client ? 'Modifier le client' : 'Nouveau client'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-primary-700 mb-1">
              Nom de l'entreprise *
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="SARL Exemple"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-700 mb-1">
              Code client *
            </label>
            <Input
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="CLI001"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-700 mb-1">
              SIRET
            </label>
            <Input
              value={formData.siret}
              onChange={(e) => setFormData({ ...formData, siret: e.target.value })}
              placeholder="123 456 789 00012"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-primary-700 mb-1">
              Adresse
            </label>
            <Input
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="123 rue Exemple, 75001 Paris"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-700 mb-1">
              Email
            </label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="contact@exemple.fr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-700 mb-1">
              Téléphone
            </label>
            <Input
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="01 23 45 67 89"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-primary-700 mb-1">
              Nom du contact
            </label>
            <Input
              value={formData.contactName}
              onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
              placeholder="Jean Dupont"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit">
            {client ? 'Enregistrer' : 'Créer le client'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
