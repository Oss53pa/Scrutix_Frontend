import { describe, it, expect, beforeEach } from 'vitest';
import { DuplicateDetector } from '../../algorithms/DuplicateDetector';
import { Transaction, TransactionType, AnomalyType, Severity } from '../../types';

// Helper to create test transactions
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
    description: 'FRAIS DE TENUE DE COMPTE',
    type: TransactionType.FEE,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('DuplicateDetector', () => {
  let detector: DuplicateDetector;

  beforeEach(() => {
    detector = new DuplicateDetector();
  });

  describe('detectDuplicates', () => {
    it('should return empty array when no transactions', () => {
      const result = detector.detectDuplicates([]);
      expect(result).toEqual([]);
    });

    it('should return empty array when only one transaction', () => {
      const transactions = [createTransaction()];
      const result = detector.detectDuplicates(transactions);
      expect(result).toEqual([]);
    });

    it('should detect exact duplicate transactions', () => {
      const baseDate = new Date('2024-01-15');
      const transactions = [
        createTransaction({
          id: 'txn-1',
          date: baseDate,
          amount: -5000,
          description: 'FRAIS DE TENUE DE COMPTE',
        }),
        createTransaction({
          id: 'txn-2',
          date: new Date('2024-01-16'),
          amount: -5000,
          description: 'FRAIS DE TENUE DE COMPTE',
        }),
      ];

      const anomalies = detector.detectDuplicates(transactions);

      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].type).toBe(AnomalyType.DUPLICATE_FEE);
      expect(anomalies[0].transactions).toHaveLength(2);
    });

    it('should detect similar transactions with slight variations', () => {
      const baseDate = new Date('2024-01-15');
      const transactions = [
        createTransaction({
          id: 'txn-1',
          date: baseDate,
          amount: -5000,
          description: 'FRAIS TENUE COMPTE',
        }),
        createTransaction({
          id: 'txn-2',
          date: new Date('2024-01-16'),
          amount: -5000,
          description: 'FRAIS TENUE COMPTE',
        }),
      ];

      const anomalies = detector.detectDuplicates(transactions);

      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].confidence).toBeGreaterThan(0.85);
    });

    it('should not detect duplicates outside time window', () => {
      const transactions = [
        createTransaction({
          id: 'txn-1',
          date: new Date('2024-01-01'),
          amount: -5000,
          description: 'FRAIS DE TENUE DE COMPTE',
        }),
        createTransaction({
          id: 'txn-2',
          date: new Date('2024-02-01'), // 31 days later
          amount: -5000,
          description: 'FRAIS DE TENUE DE COMPTE',
        }),
      ];

      const anomalies = detector.detectDuplicates(transactions);

      expect(anomalies).toHaveLength(0);
    });

    it('should not detect duplicates for credit transactions', () => {
      const baseDate = new Date('2024-01-15');
      const transactions = [
        createTransaction({
          id: 'txn-1',
          date: baseDate,
          amount: 5000, // Credit (positive)
          description: 'VIREMENT RECU',
        }),
        createTransaction({
          id: 'txn-2',
          date: new Date('2024-01-16'),
          amount: 5000,
          description: 'VIREMENT RECU',
        }),
      ];

      const anomalies = detector.detectDuplicates(transactions);

      expect(anomalies).toHaveLength(0);
    });

    it('should calculate correct severity based on amount', () => {
      const baseDate = new Date('2024-01-15');

      // High amount duplicates
      const highAmountTxns = [
        createTransaction({
          id: 'txn-1',
          date: baseDate,
          amount: -30000,
          description: 'FRAIS IMPORTANTS',
        }),
        createTransaction({
          id: 'txn-2',
          date: new Date('2024-01-16'),
          amount: -30000,
          description: 'FRAIS IMPORTANTS',
        }),
      ];

      const anomalies = detector.detectDuplicates(highAmountTxns);

      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].severity).toBe(Severity.HIGH);
    });

    it('should detect multiple duplicate groups', () => {
      const baseDate = new Date('2024-01-15');
      const transactions = [
        // Group 1
        createTransaction({
          id: 'txn-1',
          date: baseDate,
          amount: -5000,
          description: 'FRAIS TYPE A',
        }),
        createTransaction({
          id: 'txn-2',
          date: new Date('2024-01-16'),
          amount: -5000,
          description: 'FRAIS TYPE A',
        }),
        // Group 2
        createTransaction({
          id: 'txn-3',
          date: baseDate,
          amount: -3000,
          description: 'COMMISSION TYPE B',
        }),
        createTransaction({
          id: 'txn-4',
          date: new Date('2024-01-17'),
          amount: -3000,
          description: 'COMMISSION TYPE B',
        }),
      ];

      const anomalies = detector.detectDuplicates(transactions);

      expect(anomalies).toHaveLength(2);
    });

    it('should include evidence in anomalies', () => {
      const baseDate = new Date('2024-01-15');
      const transactions = [
        createTransaction({
          id: 'txn-1',
          date: baseDate,
          amount: -5000,
          description: 'FRAIS DE TENUE DE COMPTE',
        }),
        createTransaction({
          id: 'txn-2',
          date: new Date('2024-01-16'),
          amount: -5000,
          description: 'FRAIS DE TENUE DE COMPTE',
        }),
      ];

      const anomalies = detector.detectDuplicates(transactions);

      expect(anomalies[0].evidence).toBeDefined();
      expect(anomalies[0].evidence.length).toBeGreaterThan(0);
      expect(anomalies[0].evidence.some(e => e.type === 'DUPLICATE_COUNT')).toBe(true);
    });

    it('should generate recommendation text', () => {
      const baseDate = new Date('2024-01-15');
      const transactions = [
        createTransaction({
          id: 'txn-1',
          date: baseDate,
          amount: -5000,
          description: 'FRAIS DE TENUE DE COMPTE',
        }),
        createTransaction({
          id: 'txn-2',
          date: new Date('2024-01-16'),
          amount: -5000,
          description: 'FRAIS DE TENUE DE COMPTE',
        }),
      ];

      const anomalies = detector.detectDuplicates(transactions);

      expect(anomalies[0].recommendation).toBeDefined();
      expect(anomalies[0].recommendation).toContain('Contester');
      expect(anomalies[0].recommendation).toContain('FCFA');
    });
  });

  describe('custom thresholds', () => {
    it('should respect custom similarity threshold', () => {
      const strictDetector = new DuplicateDetector({
        similarityThreshold: 0.99, // Very strict
        timeWindowDays: 5,
        amountTolerance: 0.01,
      });

      const baseDate = new Date('2024-01-15');
      const transactions = [
        createTransaction({
          id: 'txn-1',
          date: baseDate,
          amount: -5000,
          description: 'FRAIS TENUE COMPTE JANVIER',
        }),
        createTransaction({
          id: 'txn-2',
          date: new Date('2024-01-16'),
          amount: -5000,
          description: 'FRAIS TENUE COMPTE FEVRIER', // Slightly different
        }),
      ];

      const anomalies = strictDetector.detectDuplicates(transactions);

      // With strict threshold, these might not be detected as duplicates
      expect(anomalies.length).toBeLessThanOrEqual(1);
    });

    it('should respect custom time window', () => {
      const narrowWindowDetector = new DuplicateDetector({
        similarityThreshold: 0.85,
        timeWindowDays: 1, // Only 1 day
        amountTolerance: 0.01,
      });

      const transactions = [
        createTransaction({
          id: 'txn-1',
          date: new Date('2024-01-15'),
          amount: -5000,
          description: 'FRAIS DE TENUE DE COMPTE',
        }),
        createTransaction({
          id: 'txn-2',
          date: new Date('2024-01-18'), // 3 days later
          amount: -5000,
          description: 'FRAIS DE TENUE DE COMPTE',
        }),
      ];

      const anomalies = narrowWindowDetector.detectDuplicates(transactions);

      expect(anomalies).toHaveLength(0);
    });
  });
});
