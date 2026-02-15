// ============================================================================
// SCRUTIX - Types TypeScript
// Application d'audit bancaire pour cabinet d'expertise comptable
// ============================================================================

// Export report viewer types
export * from './report';

// ----------------------------------------------------------------------------
// Enumerations
// ----------------------------------------------------------------------------

export enum TransactionType {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
  FEE = 'FEE',
  INTEREST = 'INTEREST',
  TRANSFER = 'TRANSFER',
  CARD = 'CARD',
  ATM = 'ATM',
  CHECK = 'CHECK',
  OTHER = 'OTHER',
}

export enum AnomalyType {
  // Modules existants
  DUPLICATE_FEE = 'DUPLICATE_FEE',
  GHOST_FEE = 'GHOST_FEE',
  OVERCHARGE = 'OVERCHARGE',
  INTEREST_ERROR = 'INTEREST_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  ROUNDING_ABUSE = 'ROUNDING_ABUSE',
  // Nouveaux modules
  VALUE_DATE_ERROR = 'VALUE_DATE_ERROR',       // Dates de valeur
  SUSPICIOUS_TRANSACTION = 'SUSPICIOUS_TRANSACTION', // Opérations suspectes
  COMPLIANCE_VIOLATION = 'COMPLIANCE_VIOLATION', // Conformité contractuelle
  CASHFLOW_ANOMALY = 'CASHFLOW_ANOMALY',       // Anomalie trésorerie
  RECONCILIATION_GAP = 'RECONCILIATION_GAP',   // Écart rapprochement
  MULTI_BANK_ISSUE = 'MULTI_BANK_ISSUE',       // Problème multi-banques
  OHADA_NON_COMPLIANCE = 'OHADA_NON_COMPLIANCE', // Non-conformité OHADA
  AML_ALERT = 'AML_ALERT',                     // Alerte anti-blanchiment
  // Modules d'audit par catégorie de frais
  FEE_ANOMALY = 'FEE_ANOMALY',                 // Anomalie générique de frais
}

export enum Severity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum AnalysisStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

// ----------------------------------------------------------------------------
// Core Models
// ----------------------------------------------------------------------------

export interface Transaction {
  id: string;
  clientId: string;
  accountNumber: string;
  bankCode: string;
  bankName?: string;
  date: Date;
  valueDate: Date;
  amount: number;
  balance: number;
  description: string;
  reference?: string;
  type: TransactionType;
  category?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Evidence {
  type: string;
  description: string;
  value: string | number;
  reference?: string;
  // Références aux conditions bancaires
  source?: string; // Ex: "Grille tarifaire SGBC 2024", "Conditions générales"
  conditionRef?: string; // Ex: "Section 3.2 - Frais de tenue de compte"
  expectedValue?: string | number; // Valeur attendue selon les conditions
  appliedValue?: string | number; // Valeur réellement appliquée
}

// Source de detection des anomalies
export type DetectionSource = 'algorithm' | 'ai' | 'hybrid';

export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: Severity;
  confidence: number; // 0-1
  amount: number;
  transactions: Transaction[];
  evidence: Evidence[];
  recommendation: string;
  status: 'pending' | 'confirmed' | 'dismissed' | 'contested';
  detectedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  notes?: string;
  // Source de detection
  detectionSource?: DetectionSource;
  aiAnalysis?: {
    explanation?: string;
    suggestedActions?: string[];
    regulatoryReference?: string;
  };
}

export interface Client {
  id: string;
  name: string;
  code: string;
  // Informations legales
  legalName?: string;
  siret?: string;
  rccm?: string;
  nif?: string;
  legalForm?: string; // SARL, SA, SAS, etc.
  capital?: number;
  currency?: string;
  // Coordonnees
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  email?: string;
  phone?: string;
  website?: string;
  // Contact principal
  contactName?: string;
  contactRole?: string;
  contactEmail?: string;
  contactPhone?: string;
  // Informations metier
  sector?: string;
  activity?: string;
  employeeCount?: number;
  annualRevenue?: number;
  fiscalYearEnd?: string; // MM-DD format
  // Notes et suivi
  notes?: string;
  tags?: string[];
  // Comptes et dates
  accounts: BankAccount[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ClientStatistics {
  clientId: string;
  totalStatements: number;
  totalTransactions: number;
  totalAnalyses: number;
  totalAnomalies: number;
  totalSavings: number;
  totalReports: number;
  lastImportDate?: Date;
  lastAnalysisDate?: Date;
}

export interface BankAccount {
  id: string;
  clientId: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
  currency: string;
  isActive: boolean;
}

export interface BankStatement {
  id: string;
  clientId: string;
  accountId: string;
  bankCode: string;
  bankName: string;
  fileName: string;
  fileType: 'csv' | 'excel' | 'pdf';
  periodStart: Date;
  periodEnd: Date;
  transactionCount: number;
  importedAt: Date;
  status: 'imported' | 'analyzed' | 'archived';
}

// Zone monétaire africaine
export type MonetaryZone = 'CEMAC' | 'UEMOA';

export interface Bank {
  id: string;
  code: string;
  name: string;
  country: string;
  zone?: MonetaryZone;
  logo?: string;
  conditions: BankConditions | null; // Grille active actuelle (rétrocompatibilité)
  conditionGrids?: ConditionGrid[]; // Historique de toutes les grilles
  activeGridId?: string; // ID de la grille actuellement active
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Labels des zones monétaires
export const MONETARY_ZONE_LABELS: Record<MonetaryZone, string> = {
  CEMAC: 'CEMAC (Afrique Centrale)',
  UEMOA: 'UEMOA (Afrique de l\'Ouest)',
};

// Devises par zone
export const ZONE_CURRENCIES: Record<MonetaryZone, { code: string; name: string }> = {
  CEMAC: { code: 'XAF', name: 'Franc CFA BEAC' },
  UEMOA: { code: 'XOF', name: 'Franc CFA BCEAO' },
};

// Pays CEMAC
export const CEMAC_COUNTRIES: Record<string, string> = {
  CM: 'Cameroun',
  CF: 'Centrafrique',
  CG: 'Congo',
  GA: 'Gabon',
  GQ: 'Guinée Équatoriale',
  TD: 'Tchad',
};

// Pays UEMOA
export const UEMOA_COUNTRIES: Record<string, string> = {
  BJ: 'Bénin',
  BF: 'Burkina Faso',
  CI: 'Côte d\'Ivoire',
  GW: 'Guinée-Bissau',
  ML: 'Mali',
  NE: 'Niger',
  SN: 'Sénégal',
  TG: 'Togo',
};

// Tous les pays africains (CEMAC + UEMOA)
export const AFRICAN_COUNTRIES: Record<string, string> = {
  ...CEMAC_COUNTRIES,
  ...UEMOA_COUNTRIES,
};

export interface ClientReport {
  id: string;
  clientId: string;
  title: string;
  type: 'audit' | 'summary' | 'detailed' | 'recovery';
  period: {
    start: Date;
    end: Date;
  };
  anomalyCount: number;
  totalAmount: number;
  recoveredAmount: number;
  status: 'draft' | 'final' | 'sent';
  generatedAt: Date;
  sentAt?: Date;
  filePath?: string;
}

// ----------------------------------------------------------------------------
// AI Audit Integration
// ----------------------------------------------------------------------------

export interface AIAuditConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface AIAuditRequest {
  clientId: string;
  transactions: Transaction[];
  bankConditions?: BankConditions;
  context?: string;
  analysisType: 'full' | 'anomalies' | 'recommendations' | 'summary';
}

export interface AIAuditResponse {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  analysis?: {
    summary: string;
    findings: AIFinding[];
    recommendations: string[];
    riskScore: number;
    confidence: number;
  };
  tokensUsed?: number;
  processingTime?: number;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface AIFinding {
  type: string;
  severity: Severity;
  description: string;
  evidence: string[];
  suggestedAction: string;
  estimatedImpact: number;
}

// ----------------------------------------------------------------------------
// Bank Conditions
// ----------------------------------------------------------------------------

export interface FeeSchedule {
  code: string;
  name: string;
  amount: number;
  type: 'fixed' | 'percentage' | 'tiered';
  minAmount?: number;
  maxAmount?: number;
  percentage?: number;
}

export interface InterestRate {
  type: 'overdraft' | 'authorized' | 'unauthorized' | 'savings';
  rate: number; // Annual rate as decimal (0.18 = 18%)
  calculationMethod: 'simple' | 'compound';
  dayCountConvention: 'ACT/360' | 'ACT/365' | '30/360';
}

// Grille tarifaire versionnée - permet de gérer l'historique des conditions
export interface ConditionGrid {
  id: string;
  bankId: string;
  version: string; // ex: "2024-01", "2024-06"
  name: string; // ex: "Conditions Tarifaires 2024"
  effectiveDate: Date; // Date de prise d'effet
  expirationDate?: Date; // Date d'expiration (si connue)
  status: 'active' | 'archived' | 'draft'; // Statut de la grille
  conditions: BankConditions;
  sourceDocument?: ArchivedDocument; // Document source (PDF importé)
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string; // Qui a créé cette version
  notes?: string; // Notes sur cette version
}

export interface BankConditions {
  id: string;
  bankCode: string;
  bankName: string;
  country: string;
  currency: string;
  effectiveDate: Date;
  expirationDate?: Date;
  fees: FeeSchedule[];
  interestRates: InterestRate[];
  isActive: boolean;

  // Structure complète des conditions bancaires africaines
  // Frais de tenue de compte
  accountFees?: AccountFees;
  // Opérations de guichet
  counterOperations?: CounterOperationFees;
  // Cartes bancaires
  cardFees?: CardFees;
  // Virements
  transferFees?: TransferFees;
  // Chèques
  checkFees?: CheckFees;
  // Prélèvements et effets
  debitFees?: DebitFees;
  // Crédits et découverts
  creditFees?: CreditFees;
  // Services divers
  miscFees?: MiscFees;
  // Pénalités
  penalties?: PenaltyFees;
  // Documents PDF archivés
  documents?: ArchivedDocument[];
}

// Frais de tenue de compte
export interface AccountFees {
  tenueCompte: { particulier: number; professionnel: number; entreprise: number };
  fraisOuverture: number;
  fraisCloture: number;
  fraisInactivite: number; // compte inactif
  releveCompte: { mensuel: number; duplicata: number };
  attestationSolde: number;
  lettreInjonction: number;
  droitTimbre: number;
}

// Opérations de guichet
export interface CounterOperationFees {
  versementEspeces: { gratuit: boolean; commission: number; minimum: number };
  retraitEspeces: { commission: number; minimum: number };
  changeManuel: { achat: number; vente: number };
  certificationSignature: number;
}

// Cartes bancaires
export interface CardFees {
  cartes: CardType[];
  oppositionCarte: number;
  renouvellementAnticipe: number;
  codePinOublie: number;
  retraitDabAutreBanque: number;
  paiementTpe: number;
  consultationSolde: number;
}

export interface CardType {
  nom: string;
  type: 'debit' | 'credit' | 'prepaid';
  reseau: 'VISA' | 'MASTERCARD' | 'GIM-UEMOA' | 'GIMAC';
  cotisationAnnuelle: number;
  plafondRetrait: number;
  plafondPaiement: number;
  validite: number; // années
}

// Virements
export interface TransferFees {
  virementInterne: { commission: number; minimum: number; maximum: number };
  virementCemacUemoa: { commission: number; minimum: number; swift: number };
  virementInternational: { commission: number; minimum: number; swift: number; fraisCorrespondant: number };
  virementInstantane: number;
  ordreVirementPermanent: number;
  rejetVirement: number;
}

// Chèques
export interface CheckFees {
  carnetCheques: { feuilles25: number; feuilles50: number };
  chequeGuichet: number;
  chequeCertifie: number;
  oppositionCheque: number;
  chequeImpaye: number;
  chequeRetourne: number;
  encaissementChequePlace: number;
  encaissementChequeDeplacement: number;
  certificationCheque: number;
}

// Prélèvements et effets
export interface DebitFees {
  prelevement: { emission: number; reception: number; rejet: number };
  effetCommerce: { encaissement: number; escompte: number; impaye: number };
  lcr: { emission: number; reception: number };
}

// Crédits et découverts
export interface CreditFees {
  decouvertAutorise: { tauxAnnuel: number; commissionMouvement: number; commissionPlusForte: number };
  decouvertNonAutorise: { tauxAnnuel: number; penalite: number };
  creditConsommation: { tauxMin: number; tauxMax: number; fraisDossier: number };
  creditImmobilier: { tauxMin: number; tauxMax: number; fraisDossier: number };
  tauxUsure: number;
}

// Services divers
export interface MiscFees {
  smsAlerte: number;
  eBanking: { abonnement: number; parOperation: number };
  mobileBanking: { abonnement: number };
  coffre: { petit: number; moyen: number; grand: number };
  assuranceCompte: number;
  garantieLocative: number;
  cautionMarche: number;
}

// Pénalités
export interface PenaltyFees {
  chequeRejete: number;
  incidentPaiement: number;
  decouvertDepasse: number;
  retardRemboursement: number;
  commissionIntervention: number;
  fraisContentieux: number;
}

// Document PDF archivé
export interface ArchivedDocument {
  id: string;
  name: string;
  type: 'conditions' | 'tarifs' | 'annexe' | 'autre';
  uploadDate: Date;
  effectiveDate: Date;
  fileData: string; // Base64 encoded PDF
  fileSize: number;
  extractedAt?: Date;
  isActive: boolean;
}

// ----------------------------------------------------------------------------
// Analysis
// ----------------------------------------------------------------------------

export interface DetectionThresholds {
  duplicateDetection: {
    similarityThreshold: number; // 0-1
    timeWindowDays: number;
    amountTolerance: number; // percentage
  };
  ghostFeeDetection: {
    entropyThreshold: number;
    orphanWindowDays: number;
    minConfidence: number;
  };
  overchargeDetection: {
    tolerancePercentage: number;
    useHistoricalBaseline: boolean;
  };
  interestCalculation: {
    toleranceAmount: number;
    tolerancePercentage: number;
  };
}

export interface AnalysisConfig {
  clientId: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  bankCodes?: string[];
  thresholds: DetectionThresholds;
  enabledDetectors: AnomalyType[];
}

export interface AnalysisResult {
  id: string;
  config: AnalysisConfig;
  status: AnalysisStatus;
  progress: number; // 0-100
  anomalies: Anomaly[];
  statistics: AnalysisStatistics;
  summary: AnalysisSummary;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface AnalysisStatistics {
  totalTransactions: number;
  totalAmount: number;
  totalAnomalies: number;
  totalAnomalyAmount: number;
  anomaliesByType: Record<AnomalyType, number>;
  anomaliesBySeverity: Record<Severity, number>;
  anomalyRate: number; // percentage
  potentialSavings: number;
}

export interface AnalysisSummary {
  status: 'OK' | 'WARNING' | 'CRITICAL';
  message: string;
  keyFindings: string[];
  recommendations: string[];
  estimatedRecovery: number;
}

// ----------------------------------------------------------------------------
// Import
// ----------------------------------------------------------------------------

export interface ImportedRow {
  [key: string]: string | number | null;
}

export interface ColumnMapping {
  sourceColumn: string;
  targetField: keyof Transaction | null;
  transform?: (value: string) => unknown;
}

export interface ImportConfig {
  clientId: string;
  bankCode: string;
  fileType: 'csv' | 'excel' | 'pdf';
  columnMappings: ColumnMapping[];
  dateFormat: string;
  decimalSeparator: '.' | ',';
  thousandsSeparator: ',' | '.' | ' ' | '';
  skipRows: number;
  hasHeader: boolean;
}

export interface ImportResult {
  success: boolean;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  errors: ImportError[];
  transactions: Transaction[];
}

export interface ImportError {
  row: number;
  column?: string;
  value?: string;
  message: string;
}

// ----------------------------------------------------------------------------
// Reports
// ----------------------------------------------------------------------------

export interface ReportConfig {
  title: string;
  clientId: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  sections: ReportSection[];
  format: 'pdf' | 'excel';
  includeDetails: boolean;
  includeRecommendations: boolean;
}

export interface ReportSection {
  type: 'summary' | 'anomalies' | 'transactions' | 'statistics' | 'recommendations';
  title: string;
  enabled: boolean;
  filters?: {
    anomalyTypes?: AnomalyType[];
    severities?: Severity[];
  };
}

// ----------------------------------------------------------------------------
// UI State
// ----------------------------------------------------------------------------

export interface FilterState {
  search: string;
  anomalyTypes: AnomalyType[];
  severities: Severity[];
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  amountRange: {
    min: number | null;
    max: number | null;
  };
  status: Array<Anomaly['status']>;
}

export interface SortState {
  field: string;
  direction: 'asc' | 'desc';
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

// ----------------------------------------------------------------------------
// Daily Balance (for interest calculations)
// ----------------------------------------------------------------------------

export interface DailyBalance {
  date: Date;
  balance: number;
  accountNumber: string;
}

// ----------------------------------------------------------------------------
// Utility Types
// ----------------------------------------------------------------------------

export type TransactionInput = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>;

export type AnomalyInput = Omit<Anomaly, 'id' | 'detectedAt'>;

export interface DateRange {
  start: Date;
  end: Date;
}

// Type guards
export function isTransaction(obj: unknown): obj is Transaction {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'amount' in obj &&
    'date' in obj &&
    'description' in obj
  );
}

export function isAnomaly(obj: unknown): obj is Anomaly {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'type' in obj &&
    'severity' in obj &&
    'transactions' in obj
  );
}

// Anomaly type labels (French)
export const ANOMALY_TYPE_LABELS: Record<AnomalyType, string> = {
  // Modules existants
  [AnomalyType.DUPLICATE_FEE]: 'Frais en double',
  [AnomalyType.GHOST_FEE]: 'Frais fantôme',
  [AnomalyType.OVERCHARGE]: 'Surfacturation',
  [AnomalyType.INTEREST_ERROR]: 'Erreur d\'intérêts',
  [AnomalyType.UNAUTHORIZED]: 'Frais non autorisé',
  [AnomalyType.ROUNDING_ABUSE]: 'Abus d\'arrondi',
  // Nouveaux modules
  [AnomalyType.VALUE_DATE_ERROR]: 'Erreur date de valeur',
  [AnomalyType.SUSPICIOUS_TRANSACTION]: 'Opération suspecte',
  [AnomalyType.COMPLIANCE_VIOLATION]: 'Non-conformité',
  [AnomalyType.CASHFLOW_ANOMALY]: 'Anomalie trésorerie',
  [AnomalyType.RECONCILIATION_GAP]: 'Écart rapprochement',
  [AnomalyType.MULTI_BANK_ISSUE]: 'Problème multi-banques',
  [AnomalyType.OHADA_NON_COMPLIANCE]: 'Non-conformité OHADA',
  [AnomalyType.AML_ALERT]: 'Alerte anti-blanchiment',
};

// Severity labels (French)
export const SEVERITY_LABELS: Record<Severity, string> = {
  [Severity.LOW]: 'Faible',
  [Severity.MEDIUM]: 'Moyen',
  [Severity.HIGH]: 'Élevé',
  [Severity.CRITICAL]: 'Critique',
};

// Transaction type labels (French)
export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  [TransactionType.DEBIT]: 'Débit',
  [TransactionType.CREDIT]: 'Crédit',
  [TransactionType.FEE]: 'Frais',
  [TransactionType.INTEREST]: 'Intérêts',
  [TransactionType.TRANSFER]: 'Virement',
  [TransactionType.CARD]: 'Carte',
  [TransactionType.ATM]: 'Retrait DAB',
  [TransactionType.CHECK]: 'Chèque',
  [TransactionType.OTHER]: 'Autre',
};

// Default detection thresholds
export const DEFAULT_THRESHOLDS: DetectionThresholds = {
  duplicateDetection: {
    similarityThreshold: 0.85,
    timeWindowDays: 5,
    amountTolerance: 0.01,
  },
  ghostFeeDetection: {
    entropyThreshold: 2.5,
    orphanWindowDays: 1,
    minConfidence: 0.7,
  },
  overchargeDetection: {
    tolerancePercentage: 0.02,
    useHistoricalBaseline: true,
  },
  interestCalculation: {
    toleranceAmount: 1,
    tolerancePercentage: 0.01,
  },
};

// ----------------------------------------------------------------------------
// Billing / Facturation
// ----------------------------------------------------------------------------

export interface BillingConfig {
  clientId: string;
  forfaitMensuel: number;
  commissionSucces: number; // percentage (0.20 = 20%)
  seuilMinimum: number;
}

export interface Invoice {
  id: string;
  numero: string;
  clientId: string;
  clientName: string;
  periode: {
    start: Date;
    end: Date;
  };
  lignes: InvoiceLine[];
  sousTotal: number;
  tva: number;
  tauxTva: number;
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  dateEmission: Date;
  dateEcheance: Date;
  datePaiement?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceLine {
  description: string;
  quantite: number;
  prixUnitaire: number;
  montant: number;
  type: 'forfait' | 'commission' | 'service' | 'autre';
}

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  montant: number;
  methode: 'virement' | 'cheque' | 'especes' | 'mobile_money';
  reference?: string;
  datePaiement: Date;
  notes?: string;
}

// ----------------------------------------------------------------------------
// Users / Utilisateurs
// ----------------------------------------------------------------------------

export type UserRole = 'admin' | 'auditor' | 'reader';

export interface User {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CabinetSettings {
  id: string;
  nom: string;
  logo?: string;
  adresse: string;
  telephone: string;
  email: string;
  siteWeb?: string;
  numeroContribuable: string;
  rccm?: string;
  devise: 'XAF' | 'XOF' | 'EUR' | 'USD';
  pays: string;
  zone?: MonetaryZone;
  tauxTvaDefaut: number;
}

// ----------------------------------------------------------------------------
// Notifications
// ----------------------------------------------------------------------------

export type NotificationType =
  | 'anomaly_critical'
  | 'anomaly_detected'
  | 'import_complete'
  | 'analysis_complete'
  | 'invoice_due'
  | 'invoice_overdue'
  | 'system';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  createdAt: Date;
}

// ----------------------------------------------------------------------------
// Import Queue
// ----------------------------------------------------------------------------

export interface ImportQueueItem {
  id: string;
  fileName: string;
  fileType: 'pdf' | 'excel' | 'csv' | 'ofx';
  fileSize: number;
  clientId?: string;
  clientName?: string;
  bankCode?: string;
  bankName?: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
  detectedPeriod?: {
    start: Date;
    end: Date;
  };
  transactionCount?: number;
  createdAt: Date;
  completedAt?: Date;
}

// Role labels
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrateur',
  auditor: 'Auditeur',
  reader: 'Lecteur',
};

// Invoice status labels
export const INVOICE_STATUS_LABELS: Record<Invoice['status'], string> = {
  draft: 'Brouillon',
  sent: 'Envoyée',
  paid: 'Payée',
  overdue: 'En retard',
  cancelled: 'Annulée',
};
