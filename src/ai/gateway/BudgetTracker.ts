// ============================================================================
// SCRUTIX - Budget Tracker
// Suivi du budget IA avec stockage IndexedDB et reset mensuel
// ============================================================================

import { openDB, IDBPDatabase } from 'idb';
import type { GatewayUsageRecord, GatewayBudgetStatus } from './GatewayTypes';
import type { AIProviderType } from '../types';

const DB_NAME = 'scrutix-ai-budget';
const STORE_NAME = 'usage';
const DB_VERSION = 1;

/**
 * Tracker de budget IA avec persistence IndexedDB
 * Reset automatique mensuel
 */
export class BudgetTracker {
  private db: IDBPDatabase | null = null;
  private monthlyBudgetXAF: number;
  private alertThreshold: number;

  constructor(monthlyBudgetXAF: number = 50000, alertThreshold: number = 0.75) {
    this.monthlyBudgetXAF = monthlyBudgetXAF;
    this.alertThreshold = alertThreshold;
  }

  /**
   * Met a jour la configuration
   */
  configure(monthlyBudgetXAF: number, alertThreshold: number): void {
    this.monthlyBudgetXAF = monthlyBudgetXAF;
    this.alertThreshold = alertThreshold;
  }

  /**
   * Initialise IndexedDB
   */
  private async getDb(): Promise<IDBPDatabase> {
    if (this.db) return this.db;

    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('month', 'month');
          store.createIndex('provider', 'provider');
          store.createIndex('timestamp', 'timestamp');
        }
      },
    });

    return this.db;
  }

  /**
   * Retourne le mois en cours au format YYYY-MM
   */
  private getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Enregistre une utilisation
   */
  async recordUsage(record: Omit<GatewayUsageRecord, 'id' | 'timestamp' | 'month'>): Promise<void> {
    const db = await this.getDb();

    const entry: GatewayUsageRecord = {
      ...record,
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      month: this.getCurrentMonth(),
    };

    await db.put(STORE_NAME, entry);
  }

  /**
   * Retourne le status du budget
   */
  async getBudgetStatus(): Promise<GatewayBudgetStatus> {
    const currentMonth = this.getCurrentMonth();
    const db = await this.getDb();

    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.store.index('month');
    const records = await index.getAll(currentMonth) as GatewayUsageRecord[];

    const usedXAF = records.reduce((sum, r) => sum + r.costXAF, 0);
    const usedPercent = this.monthlyBudgetXAF > 0 ? usedXAF / this.monthlyBudgetXAF : 0;

    return {
      monthlyBudgetXAF: this.monthlyBudgetXAF,
      usedXAF,
      remainingXAF: Math.max(0, this.monthlyBudgetXAF - usedXAF),
      usedPercent,
      alertTriggered: usedPercent >= this.alertThreshold,
      budgetExceeded: usedPercent >= 1,
      currentMonth,
    };
  }

  /**
   * Retourne l'utilisation par provider pour le mois en cours
   */
  async getUsageByProvider(): Promise<Record<AIProviderType, {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    costXAF: number;
  }>> {
    const currentMonth = this.getCurrentMonth();
    const db = await this.getDb();

    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.store.index('month');
    const records = await index.getAll(currentMonth) as GatewayUsageRecord[];

    const byProvider: Record<string, {
      requests: number;
      inputTokens: number;
      outputTokens: number;
      costXAF: number;
    }> = {};

    for (const record of records) {
      if (!byProvider[record.provider]) {
        byProvider[record.provider] = { requests: 0, inputTokens: 0, outputTokens: 0, costXAF: 0 };
      }
      byProvider[record.provider].requests++;
      byProvider[record.provider].inputTokens += record.inputTokens;
      byProvider[record.provider].outputTokens += record.outputTokens;
      byProvider[record.provider].costXAF += record.costXAF;
    }

    return byProvider as Record<AIProviderType, {
      requests: number;
      inputTokens: number;
      outputTokens: number;
      costXAF: number;
    }>;
  }

  /**
   * Determine si on doit basculer sur PROPH3T
   */
  async shouldSwitchToProph3t(): Promise<boolean> {
    const status = await this.getBudgetStatus();
    return status.usedPercent >= this.alertThreshold;
  }

  /**
   * Retourne l'historique d'utilisation pour un mois
   */
  async getMonthlyHistory(month?: string): Promise<GatewayUsageRecord[]> {
    const targetMonth = month || this.getCurrentMonth();
    const db = await this.getDb();

    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.store.index('month');
    return await index.getAll(targetMonth) as GatewayUsageRecord[];
  }

  /**
   * Nettoie les enregistrements anciens (> 12 mois)
   */
  async cleanup(): Promise<number> {
    const db = await this.getDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');

    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 12);
    const cutoff = cutoffDate.getTime();

    let deleted = 0;
    let cursor = await tx.store.openCursor();

    while (cursor) {
      const record = cursor.value as GatewayUsageRecord;
      if (record.timestamp < cutoff) {
        await cursor.delete();
        deleted++;
      }
      cursor = await cursor.continue();
    }

    await tx.done;
    return deleted;
  }
}
