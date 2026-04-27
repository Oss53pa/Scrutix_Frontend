// ============================================================================
// ATLASBANX - Mappers between domain types and Supabase row types
// Handles snake_case ↔ camelCase and Date ↔ ISO string conversions.
// ============================================================================

import type {
  Client,
  BankAccount,
  BankStatement,
  Transaction,
  TransactionType,
} from '../../types';
import type {
  DbClient,
  DbClientInsert,
  DbBankAccount,
  DbBankAccountInsert,
  DbBankStatement,
  DbBankStatementInsert,
  DbTransaction,
  DbTransactionInsert,
} from '../database.types';

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

const toIso = (d: Date | string | undefined | null): string | null => {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
};

const toIsoRequired = (d: Date | string): string => {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
};

const toDate = (s: string | null | undefined): Date => {
  return s ? new Date(s) : new Date();
};

// ----------------------------------------------------------------------------
// Client
// ----------------------------------------------------------------------------

export function dbToClient(row: DbClient): Client {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    legalName: row.legal_name ?? undefined,
    siret: row.siret ?? undefined,
    rccm: row.rccm ?? undefined,
    nif: row.nif ?? undefined,
    legalForm: row.legal_form ?? undefined,
    capital: row.capital ?? undefined,
    currency: row.currency ?? undefined,
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    postalCode: row.postal_code ?? undefined,
    country: row.country ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    website: row.website ?? undefined,
    contactName: row.contact_name ?? undefined,
    contactRole: row.contact_role ?? undefined,
    contactEmail: row.contact_email ?? undefined,
    contactPhone: row.contact_phone ?? undefined,
    sector: row.sector ?? undefined,
    activity: row.activity ?? undefined,
    employeeCount: row.employee_count ?? undefined,
    annualRevenue: row.annual_revenue ?? undefined,
    fiscalYearEnd: row.fiscal_year_end ?? undefined,
    notes: row.notes ?? undefined,
    tags: row.tags ?? undefined,
    accounts: [], // Populated separately via bank_accounts join
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function clientToDb(
  client: Partial<Client>,
  userId: string,
): DbClientInsert {
  return {
    id: client.id,
    user_id: userId,
    name: client.name ?? '',
    code: client.code ?? '',
    legal_name: client.legalName ?? null,
    siret: client.siret ?? null,
    rccm: client.rccm ?? null,
    nif: client.nif ?? null,
    legal_form: client.legalForm ?? null,
    capital: client.capital ?? null,
    currency: client.currency ?? null,
    address: client.address ?? null,
    city: client.city ?? null,
    postal_code: client.postalCode ?? null,
    country: client.country ?? null,
    email: client.email ?? null,
    phone: client.phone ?? null,
    website: client.website ?? null,
    contact_name: client.contactName ?? null,
    contact_role: client.contactRole ?? null,
    contact_email: client.contactEmail ?? null,
    contact_phone: client.contactPhone ?? null,
    sector: client.sector ?? null,
    activity: client.activity ?? null,
    employee_count: client.employeeCount ?? null,
    annual_revenue: client.annualRevenue ?? null,
    fiscal_year_end: client.fiscalYearEnd ?? null,
    notes: client.notes ?? null,
    tags: client.tags ?? null,
  };
}

// ----------------------------------------------------------------------------
// BankAccount
// ----------------------------------------------------------------------------

export function dbToBankAccount(row: DbBankAccount): BankAccount {
  return {
    id: row.id,
    clientId: row.client_id,
    accountNumber: row.account_number,
    bankCode: row.bank_code,
    bankName: row.bank_name,
    currency: row.currency,
    isActive: row.is_active,
  };
}

export function bankAccountToDb(
  account: BankAccount,
  userId: string,
): DbBankAccountInsert {
  return {
    id: account.id,
    user_id: userId,
    client_id: account.clientId,
    account_number: account.accountNumber,
    bank_code: account.bankCode,
    bank_name: account.bankName,
    currency: account.currency,
    is_active: account.isActive,
  };
}

// ----------------------------------------------------------------------------
// BankStatement
// ----------------------------------------------------------------------------

export function dbToBankStatement(row: DbBankStatement): BankStatement {
  return {
    id: row.id,
    clientId: row.client_id,
    accountId: row.account_id ?? '',
    bankCode: row.bank_code,
    bankName: row.bank_name,
    fileName: row.file_name,
    fileType: row.file_type,
    periodStart: toDate(row.period_start),
    periodEnd: toDate(row.period_end),
    transactionCount: row.transaction_count,
    importedAt: toDate(row.imported_at),
    status: row.status,
  };
}

export function bankStatementToDb(
  statement: Omit<BankStatement, 'id' | 'importedAt'> & { id?: string },
  userId: string,
): DbBankStatementInsert {
  return {
    id: statement.id,
    user_id: userId,
    client_id: statement.clientId,
    account_id: statement.accountId || null,
    bank_code: statement.bankCode,
    bank_name: statement.bankName,
    file_name: statement.fileName,
    file_type: statement.fileType,
    period_start: toIsoRequired(statement.periodStart),
    period_end: toIsoRequired(statement.periodEnd),
    transaction_count: statement.transactionCount,
    status: statement.status,
  };
}

// ----------------------------------------------------------------------------
// Transaction
// ----------------------------------------------------------------------------

export function dbToTransaction(row: DbTransaction): Transaction {
  return {
    id: row.id,
    clientId: row.client_id,
    accountNumber: row.account_number ?? '',
    bankCode: row.bank_code,
    bankName: row.bank_name ?? undefined,
    date: toDate(row.date),
    valueDate: toDate(row.value_date),
    amount: Number(row.amount),
    balance: row.balance !== null ? Number(row.balance) : 0,
    description: row.description,
    reference: row.reference ?? undefined,
    type: row.type as TransactionType,
    category: row.category ?? undefined,
    metadata: row.metadata,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function transactionToDb(
  transaction: Transaction,
  userId: string,
  clientId?: string,
): DbTransactionInsert {
  return {
    id: transaction.id,
    user_id: userId,
    client_id: clientId ?? transaction.clientId,
    account_id: null,
    account_number: transaction.accountNumber || null,
    bank_code: transaction.bankCode,
    bank_name: transaction.bankName ?? null,
    date: toIsoRequired(transaction.date),
    value_date: toIso(transaction.valueDate),
    amount: transaction.amount,
    balance: transaction.balance,
    description: transaction.description,
    reference: transaction.reference ?? null,
    type: transaction.type,
    category: transaction.category ?? null,
    metadata: transaction.metadata ?? {},
  };
}
