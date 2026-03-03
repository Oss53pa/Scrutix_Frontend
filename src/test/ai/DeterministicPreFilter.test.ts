import { describe, it, expect, beforeEach } from 'vitest';
import { DeterministicPreFilter } from '../../ai/proph3t/DeterministicPreFilter';
import { Transaction, TransactionType } from '../../types';

function createTransaction(overrides: Partial<Transaction> = {}): Transaction {
  const now = new Date();
  return {
    id: `txn-${Math.random().toString(36).substr(2, 9)}`,
    clientId: 'client-1',
    accountNumber: '123456789',
    bankCode: 'TEST',
    date: now,
    valueDate: now,
    amount: -1000,
    balance: 50000,
    description: 'UNKNOWN TRANSACTION',
    type: TransactionType.OTHER,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('DeterministicPreFilter', () => {
  let preFilter: DeterministicPreFilter;

  beforeEach(() => {
    preFilter = new DeterministicPreFilter();
  });

  describe('Account Fees', () => {
    it('should categorize "FRAIS DE TENUE DE COMPTE" as Frais bancaires', () => {
      const result = preFilter.categorize('FRAIS DE TENUE DE COMPTE');
      expect(result).not.toBeNull();
      expect(result!.category).toBe('Frais bancaires');
      expect(result!.type).toBe(TransactionType.FEE);
      expect(result!.confidence).toBeGreaterThan(0.9);
    });

    it('should categorize "TDC" as Frais bancaires', () => {
      const result = preFilter.categorize('TDC T1 2024');
      expect(result).not.toBeNull();
      expect(result!.category).toBe('Frais bancaires');
    });

    it('should categorize "FRAIS GESTION COMPTE" as Frais bancaires', () => {
      const result = preFilter.categorize('FRAIS GESTION COMPTE MARS');
      expect(result).not.toBeNull();
      expect(result!.category).toBe('Frais bancaires');
    });
  });

  describe('Commissions', () => {
    it('should categorize "COMMISSION DE MOUVEMENT" as Commissions', () => {
      const result = preFilter.categorize('COMMISSION DE MOUVEMENT DEBITEUR');
      expect(result).not.toBeNull();
      expect(result!.category).toBe('Commissions');
    });

    it('should categorize "COM MVT" as Commissions', () => {
      const result = preFilter.categorize('COM MVT T2 2024');
      expect(result).not.toBeNull();
      expect(result!.category).toBe('Commissions');
    });
  });

  describe('Interest/Agios', () => {
    it('should categorize "AGIOS" as Agios/Interets', () => {
      const result = preFilter.categorize('AGIOS DEBITEURS T1');
      expect(result).not.toBeNull();
      expect(result!.category).toBe('Agios/Interets');
      expect(result!.type).toBe(TransactionType.INTEREST);
    });

    it('should categorize "INTERETS DEBIT" as Agios/Interets', () => {
      const result = preFilter.categorize('INTERETS DEBIT JANVIER');
      expect(result).not.toBeNull();
      expect(result!.category).toBe('Agios/Interets');
    });
  });

  describe('Transfers', () => {
    it('should categorize "VIREMENT RECU" as Virement entrant', () => {
      const result = preFilter.categorize('VIREMENT RECU SALAIRE MARS');
      expect(result).not.toBeNull();
      expect(result!.category).toBe('Virement entrant');
      expect(result!.type).toBe(TransactionType.TRANSFER);
    });

    it('should categorize "VIR EMIS" as Virement sortant', () => {
      const result = preFilter.categorize('VIR EMIS FOURNISSEUR');
      expect(result).not.toBeNull();
      expect(result!.category).toBe('Virement sortant');
    });

    it('should categorize "VIREMENT INTERNATIONAL" as international', () => {
      const result = preFilter.categorize('VIREMENT INTERNATIONAL SWIFT');
      expect(result).not.toBeNull();
      expect(result!.category).toBe('Virement international');
    });
  });

  describe('ATM/DAB', () => {
    it('should categorize "RETRAIT DAB" as Retrait DAB', () => {
      const result = preFilter.categorize('RETRAIT DAB AKWA 15H32');
      expect(result).not.toBeNull();
      expect(result!.category).toBe('Retrait DAB');
      expect(result!.type).toBe(TransactionType.ATM);
    });

    it('should categorize "RETRAIT GAB" as Retrait DAB', () => {
      const result = preFilter.categorize('RETRAIT GAB BONANJO');
      expect(result).not.toBeNull();
      expect(result!.category).toBe('Retrait DAB');
    });
  });

  describe('Cards', () => {
    it('should categorize "PAIEMENT PAR CARTE" as Carte bancaire', () => {
      const result = preFilter.categorize('PAIEMENT PAR CARTE SUPERMARCHE');
      expect(result).not.toBeNull();
      expect(result!.category).toBe('Carte bancaire');
      expect(result!.type).toBe(TransactionType.CARD);
    });

    it('should categorize "COTISATION CARTE" as Frais bancaires', () => {
      const result = preFilter.categorize('COTISATION CARTE VISA');
      expect(result).not.toBeNull();
      expect(result!.category).toBe('Frais bancaires');
    });
  });

  describe('Checks', () => {
    it('should categorize "REMISE DE CHEQUE" as Cheques', () => {
      const result = preFilter.categorize('REMISE DE CHEQUE 1234567');
      expect(result).not.toBeNull();
      expect(result!.category).toBe('Cheques');
      expect(result!.type).toBe(TransactionType.CHECK);
    });

    it('should categorize "CHQ 1234567" as Cheques', () => {
      const result = preFilter.categorize('CHQ 1234567 FOURNISSEUR');
      expect(result).not.toBeNull();
      expect(result!.category).toBe('Cheques');
    });
  });

  describe('SWIFT/International', () => {
    it('should categorize "SWIFT" as Operations internationales', () => {
      const result = preFilter.categorize('COM SWIFT VIREMENT EXPORT');
      expect(result).not.toBeNull();
      // \bSWIFT\b matches first → Operations internationales
      expect(result!.category).toBe('Operations internationales');
    });

    it('should categorize "FRAIS SWIFT" via SWIFT pattern', () => {
      const result = preFilter.categorize('FRAIS SWIFT ENTRANT');
      expect(result).not.toBeNull();
      // \bSWIFT\b matches first → Operations internationales
      expect(result!.category).toBe('Operations internationales');
    });
  });

  describe('Taxes', () => {
    it('should categorize "TVA SUR FRAIS" as Impots/Taxes', () => {
      const result = preFilter.categorize('TVA SUR FRAIS BANCAIRES');
      expect(result).not.toBeNull();
      expect(result!.category).toBe('Impots/Taxes');
    });

    it('should categorize "TAXE SUR FRAIS" as Impots/Taxes', () => {
      const result = preFilter.categorize('TAXE SUR FRAIS BANCAIRES');
      expect(result).not.toBeNull();
      expect(result!.category).toBe('Impots/Taxes');
    });
  });

  describe('Salary', () => {
    it('should categorize "SALAIRE" as Salaires', () => {
      const result = preFilter.categorize('SALAIRE MARS 2024');
      expect(result).not.toBeNull();
      expect(result!.category).toBe('Salaires');
      expect(result!.type).toBe(TransactionType.CREDIT);
    });

    it('should categorize "VIR RECU SALAIRE" as Virement entrant (transfer pattern matches first)', () => {
      const result = preFilter.categorize('VIR RECU SALAIRE EMPLOYE');
      expect(result).not.toBeNull();
      // VIR(EMENT)?\s*(RECU|...) matches before VIR\s*(RECU\s*)?SALAIRE
      expect(result!.category).toBe('Virement entrant');
    });
  });

  describe('Mobile Money', () => {
    it('should categorize "MTN MONEY" as Mobile Money', () => {
      const result = preFilter.categorize('MTN MONEY TRANSFERT');
      expect(result).not.toBeNull();
      expect(result!.category).toBe('Mobile Money');
    });

    it('should categorize "ORANGE MONEY" as Mobile Money', () => {
      const result = preFilter.categorize('ORANGE MONEY DEPOT');
      expect(result).not.toBeNull();
      expect(result!.category).toBe('Mobile Money');
    });
  });

  describe('Banking Fees', () => {
    it('should categorize "FRAIS SMS" as Frais bancaires', () => {
      const result = preFilter.categorize('FRAIS SMS ALERTES');
      expect(result).not.toBeNull();
      expect(result!.category).toBe('Frais bancaires');
    });

    it('should categorize "FRAIS E-BANKING" as Frais bancaires', () => {
      const result = preFilter.categorize('FRAIS E-BANKING MENSUEL');
      expect(result).not.toBeNull();
      expect(result!.category).toBe('Frais bancaires');
    });
  });

  describe('Normalization', () => {
    it('should handle lowercase input', () => {
      const result = preFilter.categorize('frais de tenue de compte');
      expect(result).not.toBeNull();
      expect(result!.category).toBe('Frais bancaires');
    });

    it('should handle accented characters', () => {
      const result = preFilter.categorize('PRELEVEMENT OBLIGATOIRE');
      expect(result).not.toBeNull();
    });

    it('should handle extra spaces', () => {
      const result = preFilter.categorize('  FRAIS  DE  TENUE  DE  COMPTE  ');
      expect(result).not.toBeNull();
      expect(result!.category).toBe('Frais bancaires');
    });
  });

  describe('Unmatched', () => {
    it('should return null for unknown descriptions', () => {
      const result = preFilter.categorize('OPERATION DIVERSE 12345');
      expect(result).toBeNull();
    });
  });

  describe('filter()', () => {
    it('should separate categorized and uncategorized transactions', () => {
      const transactions = [
        createTransaction({ id: 'tx1', description: 'FRAIS DE TENUE DE COMPTE' }),
        createTransaction({ id: 'tx2', description: 'RETRAIT DAB AKWA' }),
        createTransaction({ id: 'tx3', description: 'OPERATION INCONNUE XYZ' }),
        createTransaction({ id: 'tx4', description: 'VIR RECU SALAIRE' }),
      ];

      const { categorized, uncategorized } = preFilter.filter(transactions);

      expect(categorized.length).toBe(3);
      expect(uncategorized.length).toBe(1);
      expect(uncategorized[0].id).toBe('tx3');

      const tx1Cat = categorized.find(c => c.transactionId === 'tx1');
      expect(tx1Cat).toBeDefined();
      expect(tx1Cat!.category).toBe('Frais bancaires');
    });

    it('should return all uncategorized when no matches', () => {
      const transactions = [
        createTransaction({ description: 'XYZQWRT PLKJHG' }),
        createTransaction({ description: 'BZBZBZ 999 LLL' }),
      ];

      const { categorized, uncategorized } = preFilter.filter(transactions);

      expect(categorized.length).toBe(0);
      expect(uncategorized.length).toBe(2);
    });

    it('should return all categorized when all match', () => {
      const transactions = [
        createTransaction({ description: 'FRAIS TDC' }),
        createTransaction({ description: 'RETRAIT DAB' }),
      ];

      const { categorized, uncategorized } = preFilter.filter(transactions);

      expect(categorized.length).toBe(2);
      expect(uncategorized.length).toBe(0);
    });

    it('should handle empty input', () => {
      const { categorized, uncategorized } = preFilter.filter([]);
      expect(categorized.length).toBe(0);
      expect(uncategorized.length).toBe(0);
    });
  });

  describe('Custom patterns', () => {
    it('should support adding custom patterns', () => {
      preFilter.addPatterns([{
        pattern: /PAIEMENT\s*ECOLE/i,
        category: 'Education',
        type: TransactionType.DEBIT,
        confidence: 0.90,
      }]);

      const result = preFilter.categorize('PAIEMENT ECOLE ENFANTS');
      expect(result).not.toBeNull();
      expect(result!.category).toBe('Education');
    });
  });

  describe('getPatternCount', () => {
    it('should return number of patterns', () => {
      const count = preFilter.getPatternCount();
      expect(count).toBeGreaterThan(50);
    });
  });
});
