// ============================================================================
// ATLASBANX - One-shot migration: localStorage → Supabase
// On first authenticated boot, if Supabase has no data for this user but
// localStorage contains legacy clients/transactions/statements, push them up.
// A per-user flag in localStorage prevents re-migration.
// ============================================================================

import { clientsRepo, transactionsRepo, banksRepo, analysesRepo, reportsRepo } from './repositories';
import type { Client, BankStatement, Transaction, BankAccount, Bank, AnalysisResult } from '../types';
import type { ReportDraft as RepoReportDraft, GeneratedReport as RepoGeneratedReport } from './repositories';

const FLAG_PREFIX = 'atlasbanx-migrated-to-supabase-';

interface LegacyClientState {
  clients?: Client[];
  statements?: BankStatement[];
}

interface LegacyTransactionState {
  transactions?: Transaction[];
}

interface PersistedShape<T> {
  state?: T;
  version?: number;
}

function readLegacy<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedShape<T>;
    return parsed.state ?? (parsed as unknown as T);
  } catch {
    return null;
  }
}

/**
 * Migrate local zustand-persist data to Supabase for the given user.
 * Idempotent — runs at most once per user.
 */
export async function migrateLocalToSupabase(userId: string): Promise<{
  migrated: boolean;
  clients: number;
  statements: number;
  transactions: number;
}> {
  const flagKey = `${FLAG_PREFIX}${userId}`;
  if (localStorage.getItem(flagKey) === 'true') {
    return { migrated: false, clients: 0, statements: 0, transactions: 0 };
  }

  try {
    // 1. Check server state — only migrate if remote is empty (don't clobber)
    const existingClients = await clientsRepo.fetchAll(userId);
    // Also read local data early so we can distinguish "server has data from a
    // previous partial migration" from "server was already populated by another
    // client". If we have local data AND the server has data, it may be from a
    // partial migration — continue to push the rest.
    const legacyClientsRaw = readLegacy<LegacyClientState>('atlasbanx-clients');
    const legacyTransactionsRaw = readLegacy<LegacyTransactionState>('atlasbanx-transactions');
    const hasLocalData = (legacyClientsRaw?.clients?.length ?? 0) > 0 || (legacyTransactionsRaw?.transactions?.length ?? 0) > 0;

    if (existingClients.length > 0 && !hasLocalData) {
      // Server already has data and there's nothing local to migrate
      localStorage.setItem(flagKey, 'true');
      return { migrated: false, clients: 0, statements: 0, transactions: 0 };
    }

    // 2. Use legacy local data already read above
    const clients = legacyClientsRaw?.clients ?? [];
    const statements = legacyClientsRaw?.statements ?? [];
    const transactions = legacyTransactionsRaw?.transactions ?? [];

    // Build a set of IDs already on the server to skip them during migration
    const existingClientIds = new Set(existingClients.map((c) => c.id));

    if (clients.length === 0 && transactions.length === 0) {
      // Nothing to migrate
      localStorage.setItem(flagKey, 'true');
      return { migrated: false, clients: 0, statements: 0, transactions: 0 };
    }

    // 3. Push clients + their bank accounts (skip already-migrated ones)
    let clientCount = 0;
    for (const client of clients) {
      if (existingClientIds.has(client.id)) continue;
      try {
        await clientsRepo.insert(userId, client);
        clientCount++;
        // Then insert each account
        for (const account of client.accounts ?? []) {
          try {
            await clientsRepo.addAccount(userId, account as BankAccount);
          } catch (err) {
            console.error('[migrate] addAccount failed:', err);
          }
        }
      } catch (err) {
        console.error('[migrate] insertClient failed:', err);
      }
    }

    // 4. Push statements
    let statementCount = 0;
    for (const statement of statements) {
      try {
        // Rebuild as insert-shape (preserving id and importedAt is fine;
        // addStatement will keep the id)
        await clientsRepo.addStatement(userId, {
          id: statement.id,
          clientId: statement.clientId,
          accountId: statement.accountId,
          bankCode: statement.bankCode,
          bankName: statement.bankName,
          fileName: statement.fileName,
          fileType: statement.fileType,
          periodStart: new Date(statement.periodStart),
          periodEnd: new Date(statement.periodEnd),
          transactionCount: statement.transactionCount,
          status: statement.status,
        });
        statementCount++;
      } catch (err) {
        console.error('[migrate] addStatement failed:', err);
      }
    }

    // 5. Push transactions in bulk per clientId
    let txCount = 0;
    const byClient = new Map<string, Transaction[]>();
    for (const t of transactions) {
      if (!t.clientId) continue;
      const list = byClient.get(t.clientId) ?? [];
      list.push({
        ...t,
        date: new Date(t.date),
        valueDate: t.valueDate ? new Date(t.valueDate) : new Date(t.date),
        createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
        updatedAt: t.updatedAt ? new Date(t.updatedAt) : new Date(),
      });
      byClient.set(t.clientId, list);
    }
    for (const [clientId, txs] of byClient) {
      try {
        await transactionsRepo.bulkInsert(userId, clientId, txs);
        txCount += txs.length;
      } catch (err) {
        console.error('[migrate] bulkInsert transactions failed:', err);
      }
    }

    // 6. Migrate banks (with grids, conditions, documents)
    try {
      const legacyBanks = readLegacy<{ banks?: Bank[] }>('atlasbanx-banks');
      const banks = legacyBanks?.banks ?? [];
      if (banks.length > 0) {
        const remoteBanks = await banksRepo.fetchAll(userId);
        if (remoteBanks.length === 0) {
          await banksRepo.upsertMany(userId, banks);
        }
      }
    } catch (err) {
      console.error('[migrate] banks failed:', err);
    }

    // 7. Migrate analyses (current + history) and their anomalies
    try {
      const legacyAnalysis = readLegacy<{
        currentAnalysis?: AnalysisResult | null;
        analysisHistory?: AnalysisResult[];
      }>('atlasbanx-analysis');
      const current = legacyAnalysis?.currentAnalysis ?? null;
      const history = legacyAnalysis?.analysisHistory ?? [];
      const remote = await analysesRepo.fetchAll(userId);
      if (remote.history.length === 0 && !remote.current) {
        if (current) {
          await analysesRepo.create(userId, current, { isCurrent: true });
        }
        for (const h of history) {
          if (current && h.id === current.id) continue;
          await analysesRepo.create(userId, h, { isCurrent: false });
        }
      }
    } catch (err) {
      console.error('[migrate] analyses failed:', err);
    }

    // 8. Migrate report drafts + generated reports
    try {
      const legacyReports = readLegacy<{
        currentDraft?: RepoReportDraft | null;
        generatedReports?: RepoGeneratedReport[];
      }>('atlasbanx-reports');
      const remoteDraft = await reportsRepo.fetchDraft(userId);
      if (!remoteDraft && legacyReports?.currentDraft) {
        await reportsRepo.upsertDraft(userId, legacyReports.currentDraft);
      }
      const remoteGenerated = await reportsRepo.fetchGenerated(userId);
      if (remoteGenerated.length === 0 && legacyReports?.generatedReports) {
        for (const r of legacyReports.generatedReports) {
          try {
            await reportsRepo.addGenerated(userId, r);
          } catch (err) {
            console.error('[migrate] addGenerated failed:', err);
          }
        }
      }
    } catch (err) {
      console.error('[migrate] reports failed:', err);
    }

    localStorage.setItem(flagKey, 'true');
    return {
      migrated: true,
      clients: clientCount,
      statements: statementCount,
      transactions: txCount,
    };
  } catch (err) {
    console.error('[migrate] migrateLocalToSupabase failed:', err);
    // Do NOT set the flag — allow retry on next boot
    return { migrated: false, clients: 0, statements: 0, transactions: 0 };
  }
}
