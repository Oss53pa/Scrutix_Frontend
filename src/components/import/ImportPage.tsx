import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSearch, Trash2, Building2, Plus, Landmark } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardBody, CardFooter, Button, Alert, ConfirmDialog, Select, Input, Badge } from '../ui';
import { FileUploader } from './FileUploader';
import { useTransactionStore } from '../../store';
import { useClientStore } from '../../store/clientStore';
import { useBankStore } from '../../store/bankStore';
import { Transaction, AFRICAN_COUNTRIES } from '../../types';
import { formatCurrency, formatDate } from '../../utils';

export function ImportPage() {
  const navigate = useNavigate();
  const { transactions, addTransactions, clearTransactions, getTransactionCount } = useTransactionStore();
  const { clients, addAccount, addStatement } = useClientStore();
  const { banks } = useBankStore();

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedBankCode, setSelectedBankCode] = useState<string>('');
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccountNumber, setNewAccountNumber] = useState('');

  // Get selected client
  const selectedClient = useMemo(() =>
    clients.find(c => c.id === selectedClientId),
    [clients, selectedClientId]
  );

  // Get selected account
  const selectedAccount = useMemo(() =>
    selectedClient?.accounts.find(a => a.id === selectedAccountId),
    [selectedClient, selectedAccountId]
  );

  // Get selected bank
  const selectedBank = useMemo(() =>
    banks.find(b => b.code === selectedBankCode),
    [banks, selectedBankCode]
  );

  interface ImportInfo {
    transactions: Transaction[];
    fileName: string;
    fileType: 'csv' | 'excel' | 'pdf';
    periodStart: Date;
    periodEnd: Date;
  }

  const handleImportComplete = (info: ImportInfo) => {
    // Add transactions to the transaction store
    addTransactions(info.transactions);

    // Get bank info
    const bankCode = selectedAccount?.bankCode || selectedBankCode;
    const bank = banks.find(b => b.code === bankCode);

    // Register the bank statement in the client store
    addStatement(selectedClientId, {
      accountId: selectedAccountId || 'new-account',
      bankCode: bankCode,
      bankName: bank?.name || bankCode,
      fileName: info.fileName,
      fileType: info.fileType,
      periodStart: info.periodStart,
      periodEnd: info.periodEnd,
      transactionCount: info.transactions.length,
      status: 'imported',
    });
  };

  const handleClearData = () => {
    clearTransactions();
    setShowClearConfirm(false);
  };

  const handleAddAccount = () => {
    if (selectedClientId && newAccountNumber && selectedBankCode) {
      const bank = banks.find(b => b.code === selectedBankCode);
      addAccount(selectedClientId, {
        accountNumber: newAccountNumber,
        bankCode: selectedBankCode,
        bankName: bank?.name || selectedBankCode,
        currency: 'XAF',
        isActive: true,
      });
      setNewAccountNumber('');
      setShowNewAccount(false);
    }
  };

  const transactionCount = getTransactionCount();

  // Check if ready to import
  const canImport = selectedClientId && (selectedAccountId || (showNewAccount && newAccountNumber && selectedBankCode));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Import de relevés bancaires</h1>
        <p className="page-description">
          Importez vos relevés bancaires pour lancer l'analyse des anomalies
        </p>
      </div>

      {/* Step 1: Client Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary-900 text-white text-sm flex items-center justify-center">1</span>
            Sélectionner le client
          </CardTitle>
          <CardDescription>
            Choisissez le client propriétaire du relevé bancaire
          </CardDescription>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            {clients.length === 0 ? (
              <Alert variant="warning" title="Aucun client">
                <p className="mt-1">Vous devez d'abord créer un client avant d'importer des relevés.</p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => navigate('/clients')}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Créer un client
                </Button>
              </Alert>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-700 mb-1">
                    Client *
                  </label>
                  <Select
                    value={selectedClientId}
                    onChange={(e) => {
                      setSelectedClientId(e.target.value);
                      setSelectedAccountId('');
                      setShowNewAccount(false);
                    }}
                  >
                    <option value="">-- Sélectionner un client --</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name} ({client.code})
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Client info */}
                {selectedClient && (
                  <div className="flex items-center gap-3 p-3 bg-primary-50 rounded-lg">
                    <div className="w-10 h-10 rounded-lg bg-primary-900 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-primary-900">{selectedClient.name}</p>
                      <p className="text-sm text-primary-500">
                        {selectedClient.accounts.length} compte(s) bancaire(s)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Step 2: Account Selection */}
      {selectedClient && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary-900 text-white text-sm flex items-center justify-center">2</span>
              Sélectionner le compte bancaire
            </CardTitle>
            <CardDescription>
              Choisissez le compte bancaire du relevé ou ajoutez-en un nouveau
            </CardDescription>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              {/* Existing accounts - Select dropdown */}
              {selectedClient.accounts.length > 0 && !showNewAccount && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-primary-700 mb-1">
                      Compte bancaire *
                    </label>
                    <Select
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                    >
                      <option value="">-- Sélectionner un compte --</option>
                      {selectedClient.accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.bankName} - {account.accountNumber} ({account.currency})
                        </option>
                      ))}
                    </Select>
                  </div>

                  {/* Selected account preview */}
                  {selectedAccount && (
                    <div className="p-4 rounded-lg border-2 border-primary-900 bg-primary-50 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Landmark className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-primary-900">{selectedAccount.bankName}</p>
                        <p className="text-sm text-primary-500 font-mono">{selectedAccount.accountNumber}</p>
                      </div>
                      <Badge variant="secondary">{selectedAccount.currency}</Badge>
                    </div>
                  )}
                </div>
              )}

              {/* Add new account */}
              {!showNewAccount ? (
                <Button
                  variant="ghost"
                  onClick={() => setShowNewAccount(true)}
                  className="w-full border-2 border-dashed border-primary-300 hover:border-primary-400"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter un nouveau compte
                </Button>
              ) : (
                <div className="p-4 border-2 border-primary-300 rounded-lg bg-primary-50 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-primary-900">Nouveau compte bancaire</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowNewAccount(false);
                        setNewAccountNumber('');
                        setSelectedBankCode('');
                      }}
                    >
                      Annuler
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-primary-700 mb-1">
                        Banque *
                      </label>
                      <Select
                        value={selectedBankCode}
                        onChange={(e) => setSelectedBankCode(e.target.value)}
                      >
                        <option value="">-- Sélectionner une banque --</option>
                        <optgroup label="CEMAC (XAF)">
                          {banks.filter(b => b.zone === 'CEMAC' || ['CM', 'GA', 'CG', 'TD', 'CF', 'GQ'].includes(b.country)).map((bank) => (
                            <option key={bank.id} value={bank.code}>
                              {bank.name} ({AFRICAN_COUNTRIES[bank.country] || bank.country})
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="UEMOA (XOF)">
                          {banks.filter(b => b.zone === 'UEMOA' || ['CI', 'SN', 'BF', 'ML', 'BJ', 'TG', 'NE', 'GW'].includes(b.country)).map((bank) => (
                            <option key={bank.id} value={bank.code}>
                              {bank.name} ({AFRICAN_COUNTRIES[bank.country] || bank.country})
                            </option>
                          ))}
                        </optgroup>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-primary-700 mb-1">
                        Numéro de compte *
                      </label>
                      <Input
                        value={newAccountNumber}
                        onChange={(e) => setNewAccountNumber(e.target.value)}
                        placeholder="Ex: 10001-23456-78901234567-89"
                      />
                    </div>
                  </div>

                  {selectedBankCode && newAccountNumber && (
                    <div className="flex justify-end">
                      <Button onClick={handleAddAccount} size="sm">
                        <Plus className="w-4 h-4 mr-1" />
                        Enregistrer le compte
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Step 3: Upload card */}
      <Card className={!canImport ? 'opacity-50 pointer-events-none' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full text-sm flex items-center justify-center ${
              canImport ? 'bg-primary-900 text-white' : 'bg-primary-300 text-white'
            }`}>3</span>
            Téléverser les fichiers
          </CardTitle>
          <CardDescription>
            {canImport ? (
              <>
                Import pour <strong>{selectedClient?.name}</strong>
                {selectedAccount && (
                  <> - Compte <strong className="font-mono">{selectedAccount.accountNumber}</strong> ({selectedAccount.bankName})</>
                )}
              </>
            ) : (
              'Sélectionnez d\'abord un client et un compte bancaire'
            )}
          </CardDescription>
        </CardHeader>
        <CardBody>
          <FileUploader
            onImportComplete={handleImportComplete}
            clientId={selectedClientId}
            bankCode={selectedAccount?.bankCode || selectedBankCode}
            accountNumber={selectedAccount?.accountNumber || newAccountNumber}
          />
        </CardBody>
      </Card>

      {/* Current data summary */}
      {transactionCount > 0 && (
        <Card>
          <CardHeader
            action={
              <Button variant="ghost" size="sm" onClick={() => setShowClearConfirm(true)}>
                <Trash2 className="w-4 h-4" />
                Effacer
              </Button>
            }
          >
            <CardTitle>Données importées</CardTitle>
            <CardDescription>
              {transactionCount} transaction{transactionCount > 1 ? 's' : ''} en mémoire
            </CardDescription>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-primary-500">Transactions</p>
                <p className="text-xl font-semibold text-primary-900">
                  {transactionCount.toLocaleString('fr-FR')}
                </p>
              </div>
              <div>
                <p className="text-sm text-primary-500">Première date</p>
                <p className="text-xl font-semibold text-primary-900">
                  {transactions.length > 0
                    ? formatDate(
                        transactions.reduce((min, t) =>
                          new Date(t.date) < new Date(min.date) ? t : min
                        ).date
                      )
                    : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-primary-500">Dernière date</p>
                <p className="text-xl font-semibold text-primary-900">
                  {transactions.length > 0
                    ? formatDate(
                        transactions.reduce((max, t) =>
                          new Date(t.date) > new Date(max.date) ? t : max
                        ).date
                      )
                    : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-primary-500">Volume total</p>
                <p className="text-xl font-semibold text-primary-900">
                  {formatCurrency(
                    transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0),
                    'XAF'
                  )}
                </p>
              </div>
            </div>
          </CardBody>
          <CardFooter>
            <div className="flex justify-end">
              <Button variant="primary" onClick={() => navigate('/analysis')}>
                <FileSearch className="w-4 h-4" />
                Lancer l'analyse
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* Instructions */}
      <Alert variant="info" title="Conseils pour l'import">
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li>Exportez vos relevés au format CSV ou Excel depuis votre banque</li>
          <li>Assurez-vous que les colonnes contiennent: date, montant, description</li>
          <li>Les montants négatifs représentent les débits (frais)</li>
          <li>Vous pouvez importer plusieurs fichiers à la fois</li>
        </ul>
      </Alert>

      {/* Clear confirmation dialog */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClearData}
        title="Effacer les données"
        message={`Êtes-vous sûr de vouloir effacer les ${transactionCount} transactions importées ? Cette action est irréversible.`}
        confirmLabel="Effacer"
        variant="danger"
      />
    </div>
  );
}
