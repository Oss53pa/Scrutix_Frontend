import { useState, useEffect } from 'react';
import { Modal, Button, Input, Select } from '../ui';
import type { Bank, MonetaryZone } from '../../types';
import { CEMAC_COUNTRIES, UEMOA_COUNTRIES } from '../../types';

function getZoneFromCountry(country: string): MonetaryZone | null {
  if (country in CEMAC_COUNTRIES) return 'CEMAC';
  if (country in UEMOA_COUNTRIES) return 'UEMOA';
  return null;
}

interface BankFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Bank>) => void;
  bank?: Bank | null;
}

export function BankFormModal({ isOpen, onClose, onSave, bank }: BankFormModalProps) {
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    country: 'CM',
    zone: 'CEMAC' as MonetaryZone,
  });

  // Reset form when bank changes
  useEffect(() => {
    if (bank) {
      setFormData({
        code: bank.code,
        name: bank.name,
        country: bank.country,
        zone: bank.zone || getZoneFromCountry(bank.country) || 'CEMAC',
      });
    } else {
      setFormData({
        code: '',
        name: '',
        country: 'CM',
        zone: 'CEMAC',
      });
    }
  }, [bank, isOpen]);

  const handleCountryChange = (country: string) => {
    const zone = getZoneFromCountry(country) || 'CEMAC';
    setFormData({ ...formData, country, zone });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const countriesForZone = formData.zone === 'CEMAC' ? CEMAC_COUNTRIES : UEMOA_COUNTRIES;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={bank ? 'Modifier la banque' : 'Nouvelle banque'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Zone Selection */}
        <div>
          <label className="block text-sm font-medium text-primary-700 mb-2">Zone monetaire *</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, zone: 'CEMAC', country: 'CM' })}
              className={`p-4 rounded-lg border-2 text-left transition-colors ${
                formData.zone === 'CEMAC'
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-primary-200 hover:border-primary-300'
              }`}
            >
              <p className="font-semibold text-primary-900">CEMAC</p>
              <p className="text-xs text-primary-500">Afrique Centrale</p>
              <p className="text-xs text-primary-600 mt-1">XAF - Franc CFA BEAC</p>
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, zone: 'UEMOA', country: 'CI' })}
              className={`p-4 rounded-lg border-2 text-left transition-colors ${
                formData.zone === 'UEMOA'
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-primary-200 hover:border-primary-300'
              }`}
            >
              <p className="font-semibold text-primary-900">UEMOA</p>
              <p className="text-xs text-primary-500">Afrique de l'Ouest</p>
              <p className="text-xs text-primary-600 mt-1">XOF - Franc CFA BCEAO</p>
            </button>
          </div>
        </div>

        {/* Country */}
        <div>
          <label className="block text-sm font-medium text-primary-700 mb-1">Pays *</label>
          <Select value={formData.country} onChange={(e) => handleCountryChange(e.target.value)}>
            {Object.entries(countriesForZone).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </Select>
        </div>

        {/* Bank Code */}
        <div>
          <label className="block text-sm font-medium text-primary-700 mb-1">Code BIC/SWIFT *</label>
          <Input
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            placeholder="BICECMCX"
            required
          />
          <p className="text-xs text-primary-400 mt-1">
            Code d'identification bancaire (8 ou 11 caracteres)
          </p>
        </div>

        {/* Bank Name */}
        <div>
          <label className="block text-sm font-medium text-primary-700 mb-1">Nom de la banque *</label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="BICEC - Banque Internationale du Cameroun"
            required
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit">{bank ? 'Enregistrer' : 'Creer la banque'}</Button>
        </div>
      </form>
    </Modal>
  );
}
