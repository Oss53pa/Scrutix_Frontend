import { Client, BankStatement, AuditReport, Transaction, Anomaly, Bank } from '../../../types';

export type TabType = 'overview' | 'info' | 'statements' | 'analyses' | 'savings' | 'reports';

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
