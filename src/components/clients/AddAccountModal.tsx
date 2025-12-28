import { useState } from 'react';
import { Modal, Button, Input, Select } from '../ui';
import type { BankAccount, Bank } from '../../types';

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (account: Omit<BankAccount, 'id' | 'clientId'>) => void;
  banks: Bank[];
}

export function AddAccountModal({ isOpen, onClose, onSave, banks }: AddAccountModalProps) {
  const [formData, setFormData] = useState({
    bankCode: '',
    bankName: '',
    accountNumber: '',
    currency: 'XAF',
    isActive: true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const bank = banks.find((b) => b.code === formData.bankCode);
    onSave({
      ...formData,
      bankName: bank?.name || formData.bankCode,
    });
    setFormData({ bankCode: '', bankName: '', accountNumber: '', currency: 'XAF', isActive: true });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajouter un compte bancaire">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-primary-700 mb-1">Banque *</label>
          <Select
            value={formData.bankCode}
            onChange={(e) => setFormData({ ...formData, bankCode: e.target.value })}
            required
          >
            <option value="">Selectionner une banque</option>
            {banks.map((bank) => (
              <option key={bank.id} value={bank.code}>
                {bank.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium text-primary-700 mb-1">Numero de compte *</label>
          <Input
            value={formData.accountNumber}
            onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
            placeholder="Ex: 10001-23456-78"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary-700 mb-1">Devise</label>
          <Select
            value={formData.currency}
            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
          >
            <option value="XAF">XAF (Franc CFA)</option>
            <option value="XOF">XOF (Franc CFA BCEAO)</option>
            <option value="EUR">EUR (Euro)</option>
            <option value="USD">USD (Dollar)</option>
          </Select>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit">Ajouter</Button>
        </div>
      </form>
    </Modal>
  );
}
