// ============================================================================
// AtlasBanx — Statement detail · domain types
// ============================================================================
// Couverture spec onglets 2-5 + drawer PROPH3T.
// Tout est strict/strongly-typed pour permettre le découplage UI/store/API.
// ============================================================================

import type { CabinetRole } from '../../../workspace/types';

// ============================================================================
// Anomalies — workflow de validation à 3 niveaux
// ============================================================================

/**
 * Sévérité d'une anomalie. Détermine le workflow obligatoire :
 *   - low/medium  : Détectée → Qualifiée (junior+)
 *   - high        : Détectée → Qualifiée → Validée (senior)
 *   - critical    : Détectée → Qualifiée → Validée → Signée (DG)
 */
export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Statut courant d'une anomalie. Cycle de vie :
 *   detected → qualified → validated → signed
 *   detected → false_positive
 *   qualified|validated|signed → closed (clôture finale)
 */
export type AnomalyStatus =
  | 'detected'
  | 'qualified'
  | 'validated'
  | 'signed'
  | 'closed'
  | 'false_positive';

/** Catégories métier d'anomalie. Drive l'icône, le filtre et la lettre de réclamation. */
export type AnomalyType =
  | 'commission_excessive'         // Commission dépassant le plafond convenu
  | 'agio_errone'                  // Calcul d'agios incorrect
  | 'frais_double'                 // Même frais facturé 2 fois
  | 'convention_violee'            // Tarif appliqué hors convention
  | 'date_valeur_abusive'          // DV plus défavorable que conventionnée
  | 'frais_non_justifie'           // Frais sans support contractuel
  | 'lcb_ft'                       // Soupçon LCB-FT
  | 'pays_gafi_risque'             // Bénéficiaire pays GAFI
  | 'beneficiaire_inedit'          // Première transaction avec ce bénéficiaire
  | 'montant_anormal'              // Outlier statistique
  | 'doublon_transaction'          // Transaction dupliquée côté banque
  | 'autre';

export interface AnomalyTransactionRef {
  id: string;
  date: string;                    // ISO date
  label: string;
  amountCentimes: number;          // négatif = débit
  balanceAfterCentimes?: number;
  pdfPage?: number;                // page du relevé source
}

export interface AnomalyDetectionMeta {
  algorithm: string;               // ex. 'detection_pays_gafi_risque_v3'
  confidence: number;              // 0..1
  rule: string;                    // explication courte
}

export interface Anomaly {
  id: string;
  statementId: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  status: AnomalyStatus;
  title: string;                   // "Virement vers entité non identifiée"
  description: string;             // ligne explicative
  transaction: AnomalyTransactionRef;
  detection: AnomalyDetectionMeta;
  /** Convention référencée si l'anomalie est tarifaire. */
  conventionId?: string | null;
  conventionLabel?: string | null;
  /** Acteur ayant qualifié (junior+). */
  qualifiedBy?: { userId: string; userHandle: string; at: string } | null;
  validatedBy?: { userId: string; userHandle: string; at: string } | null;
  signedBy?: { userId: string; userHandle: string; at: string } | null;
  closedBy?: { userId: string; userHandle: string; at: string; reason?: string } | null;
  assignedTo?: string | null;      // userId
  /** Estimation de récupérabilité financière en centimes. */
  potentialRecoveryCentimes?: number;
  createdAt: string;
}

// ============================================================================
// Audit log — append-only chain
// ============================================================================

export type AuditAction =
  | 'created'
  | 'assigned'
  | 'qualified'
  | 'commented'
  | 'validated'
  | 'signed'
  | 'closed'
  | 'reopened'
  | 'false_positive_marked'
  | 'severity_changed';

export interface AuditEntry {
  id: string;
  entityType: 'anomaly' | 'statement' | 'report' | 'complaint';
  entityId: string;
  action: AuditAction;
  actor: { userId: string; handle: string; role: CabinetRole };
  payload: {
    oldValue?: unknown;
    newValue?: unknown;
    comment?: string;
    [key: string]: unknown;
  };
  hash: string;                    // SHA-256 hex (court côté UI)
  prevHash: string | null;
  createdAt: string;
}

// ============================================================================
// Anomaly comments
// ============================================================================

export interface AnomalyComment {
  id: string;
  anomalyId: string;
  author: { userId: string; handle: string; role: CabinetRole };
  content: string;
  mentions: string[];              // userIds
  createdAt: string;
}

// ============================================================================
// Reconciliation SYSCOHADA
// ============================================================================

export type LedgerSource = 'atlas_finance' | 'manual_upload' | 'api_pull';

export interface BankTransaction {
  id: string;
  date: string;
  valueDate?: string;
  label: string;
  reference?: string | null;
  debitCentimes: number;           // 0 si crédit
  creditCentimes: number;          // 0 si débit
  runningBalanceCentimes: number;
}

export interface LedgerEntry {
  id: string;
  date: string;
  pieceRef: string;                // n° pièce comptable
  label: string;
  accountCode: string;             // ex. '521000', '627100'
  debitCentimes: number;
  creditCentimes: number;
  runningBalanceCentimes: number;
}

export type DiscrepancyKind =
  | 'bank_only'                    // op banque sans correspondance compta
  | 'ledger_only'                  // écriture compta sans correspondance banque
  | 'amount_mismatch'              // montants divergents
  | 'date_mismatch'                // décalage de date
  | 'duplicate_bank'               // doublon côté banque
  | 'duplicate_ledger';            // doublon côté compta

export interface ReconciliationDiscrepancy {
  id: string;
  kind: DiscrepancyKind;
  bankTxId?: string | null;
  ledgerEntryId?: string | null;
  /** Écart financier en centimes (signé). */
  gapCentimes: number;
  description: string;
  /** Écriture de redressement proposée (deux lignes débit/crédit). */
  proposedJournal?: Array<{
    accountCode: string;
    accountLabel: string;
    debitCentimes: number;
    creditCentimes: number;
  }>;
}

export interface ReconciliationMatch {
  bankTxId: string;
  ledgerEntryId: string;
  confidence: number;              // 0..1
}

export interface BankReconciliation {
  id: string;
  statementId: string;
  ledgerSource: LedgerSource;
  ledgerImportedAt: string;
  matchedPairs: ReconciliationMatch[];
  unmatchedBank: string[];
  unmatchedLedger: string[];
  discrepancies: ReconciliationDiscrepancy[];
  totalBankCentimes: number;
  totalLedgerCentimes: number;
  gapCentimes: number;
  matchRate: number;               // 0..100
  reconciliationStateUrl?: string | null;
  generatedAt?: string | null;
}

// ============================================================================
// Reports
// ============================================================================

export type ReportTemplate = 'synthese' | 'valeur_probante' | 'export';
export type SignatureType = 'simple' | 'advist';

export interface SignedReport {
  id: string;
  statementId: string;
  template: ReportTemplate;
  signerId?: string | null;
  signerHandle?: string | null;
  signatureType?: SignatureType | null;
  documentUrl: string;
  proofBundleUrl?: string | null;
  hash: string;
  timestampRfc3161?: string | null;
  recipients: ReportRecipient[];
  status: 'draft' | 'signed' | 'sent' | 'failed';
  signedAt?: string | null;
  createdAt: string;
}

export interface ReportRecipient {
  email: string;
  displayName: string;
  /** 'client' = externe ; 'internal' = équipe cabinet. */
  audience: 'client' | 'internal' | 'bank' | 'authority';
}

// ============================================================================
// Bank complaint letter
// ============================================================================

export type ComplaintStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'partial';

export interface BankComplaintLetter {
  id: string;
  statementId: string;
  bankCode: string;
  bankLegalName: string;
  totalAmountClaimedCentimes: number;
  anomaliesIncluded: string[];     // anomalyIds
  documentUrl?: string | null;
  status: ComplaintStatus;
  sentAt?: string | null;
  resolutionReceivedAt?: string | null;
  amountRecoveredCentimes: number;
  conventionRef?: { id: string; signedDate: string } | null;
  createdAt: string;
}

// ============================================================================
// Account convention (couche L4/L5 simplifiée page relevé)
// ============================================================================

export interface AccountConvention {
  id: string;
  accountId: string;
  signedDate: string;
  expiresDate?: string | null;
  documentUrl?: string | null;
  rules: Record<string, unknown>;  // structure libre
  uploadedBy?: string | null;
  createdAt: string;
}

// ============================================================================
// PROPH3T copilot
// ============================================================================

export type ProphetRole = 'user' | 'assistant' | 'system';

export interface ProphetCitation {
  kind: 'transaction' | 'anomaly' | 'convention' | 'calc';
  id: string;
  label: string;
}

export interface ProphetMessage {
  id: string;
  role: ProphetRole;
  content: string;
  /** Sources cliquables liées à la réponse. */
  citations?: ProphetCitation[];
  /** Questions de suivi suggérées par PROPH3T. */
  followUps?: string[];
  /** Outils invoqués (pour traçabilité). */
  toolCalls?: Array<{ tool: string; args: unknown; result?: unknown }>;
  createdAt: string;
}

export interface ProphetConversation {
  id: string;
  statementId: string | null;
  userId: string;
  context: {
    clientId?: string;
    accountId?: string;
    [k: string]: unknown;
  };
  messages: ProphetMessage[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Dialog action types — utilisé par les ConfirmDialogs
// ============================================================================

export type DialogKind =
  | 'qualifyDialog'
  | 'validateDialog'
  | 'signDialog'
  | 'rejectDialog'
  | 'falsePositiveDialog'
  | 'closeDialog';

export interface DialogAction {
  label: string;
  primary?: boolean;
  secondary?: boolean;
  opens: DialogKind;
}
