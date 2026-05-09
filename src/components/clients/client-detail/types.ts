import { Client, BankStatement, AuditReport, Transaction, Anomaly, Bank } from '../../../types';

export type TabType = 'overview' | 'info' | 'statements' | 'analyses' | 'savings' | 'reports';

export interface BankBreakdown {
  bankCode: string;
  bankName: string;
  zone: 'CEMAC' | 'UEMOA' | null;
  transactions: number;
  totalVolume: number;
  creditVolume: number;
  debitVolume: number;
  feeVolume: number;
  anomalies: number;
  /** Confirmed savings */
  savings: number;
  /** Pending (potential) savings */
  potentialSavings: number;
  /** % of debits classified as fees */
  feeRate: number;
  /** Anomalies / transactions */
  anomalyRate: number;
}

export interface ClientAnalytics {
  totalSavings: number;
  potentialSavings: number;
  riskScore: number;
  riskLevel: string;
  riskColor: 'red' | 'yellow' | 'green';
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  topTypes: Array<{
    type: string;
    label: string;
    count: number;
    amount: number;
  }>;
  totalVolume: number;
  creditVolume: number;
  debitVolume: number;
  avgTransaction: number;
  monthlyTrend: Array<{
    month: string;
    transactions: number;
    volume: number;
    anomalies: number;
    savings: number;
  }>;
  totalFees: number;
  bankDistribution: Array<{
    name: string;
    count: number;
    color: string;
  }>;
  confirmationRate: number;
  confirmedCount: number;
  pendingCount: number;
  /** Per-bank breakdown for consolidated view + intra-client benchmark */
  banks: BankBreakdown[];
}

export interface TabProps {
  client: Client;
  analytics: ClientAnalytics;
  clientTransactions: Transaction[];
  clientAnomalies: Anomaly[];
  clientStatements: BankStatement[];
  clientReports: AuditReport[];
  banks: Bank[];
  navigate: (path: string) => void;
  setShowAddAccount: (show: boolean) => void;
  addAccount: (clientId: string, account: { bankCode: string; accountNumber: string; iban?: string }) => void;
  removeAccount: (clientId: string, accountId: string) => void;
}
