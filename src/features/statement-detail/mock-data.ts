// ============================================================================
// AtlasBanx — Mock data pour la page relevé (dev sans backend)
// ============================================================================
// Couvre les 4 onglets de la spec : Anomalies, Rapprochement, Rapport,
// PROPH3T. 4 anomalies dont 1 critical, 1 high, 2 medium.
// ============================================================================

import type {
  Anomaly,
  AuditEntry,
  AnomalyComment,
  BankTransaction,
  LedgerEntry,
  ReconciliationDiscrepancy,
  BankReconciliation,
  SignedReport,
  BankComplaintLetter,
  AccountConvention,
  ProphetMessage,
  ProphetConversation,
} from './types/statement.types';
import type { MentionableUser } from '../../components/shared/MentionInput';

// ============================================================================
// IDs cohérents
// ============================================================================

const STATEMENT_ID = 'stmt-nsia-pamela-2026-q1q2';
const ACCOUNT_ID = 'acc-nsia-pamela';

const USERS = {
  pamela:  { userId: 'u-pamela',  handle: 'PameA',  displayName: 'Pamela ATOKOUNA',   role: 'dg' as const },
  cheick:  { userId: 'u-cheick',  handle: 'CheickS',displayName: 'Cheick SANANKOUA',  role: 'dg' as const },
  kadi:    { userId: 'u-kadi',    handle: 'KadiL',  displayName: 'Kadi LAMINE',        role: 'junior' as const },
  fatou:   { userId: 'u-fatou',   handle: 'FatouD', displayName: 'Fatou DIALLO',       role: 'senior' as const },
  ahmed:   { userId: 'u-ahmed',   handle: 'AhmedB', displayName: 'Ahmed BOCOUM',       role: 'consultation' as const },
};

export const MOCK_TEAM: MentionableUser[] = Object.values(USERS);

// ============================================================================
// Anomalies (4) — couvre toutes les sévérités du workflow
// ============================================================================

const NOW = new Date('2026-05-09T21:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000).toISOString();
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600000).toISOString();

export const MOCK_ANOMALIES: Anomaly[] = [
  // -----------------------------------------------------------------
  // 1. CRITICAL — pays GAFI / LCB-FT — en attente DG (validated → signed)
  // -----------------------------------------------------------------
  {
    id: 'anom-1',
    statementId: STATEMENT_ID,
    type: 'pays_gafi_risque',
    severity: 'critical',
    status: 'validated',
    title: 'Virement vers entité non identifiée',
    description: 'Bénéficiaire absent du registre OHADA · montant > 1M · première transaction',
    transaction: {
      id: 'tx-1',
      date: '2026-03-15',
      label: 'VIR EMIS SCI MARIGOT COCODY ABIDJAN',
      amountCentimes: -320_000_000, // -3.2M FCFA
      balanceAfterCentimes: 842_567_000,
      pdfPage: 4,
    },
    detection: {
      algorithm: 'detection_pays_gafi_risque_v3',
      confidence: 0.94,
      rule: 'Bénéficiaire absent du registre OHADA + montant > 1M + bénéficiaire inédit',
    },
    qualifiedBy: { userId: USERS.kadi.userId,   userHandle: USERS.kadi.handle,   at: daysAgo(1) },
    validatedBy: { userId: USERS.fatou.userId,  userHandle: USERS.fatou.handle,  at: hoursAgo(4) },
    assignedTo: USERS.cheick.userId,
    createdAt: daysAgo(2),
  },

  // -----------------------------------------------------------------
  // 2. HIGH — commission excessive — qualifiée, en attente senior
  // -----------------------------------------------------------------
  {
    id: 'anom-2',
    statementId: STATEMENT_ID,
    type: 'commission_excessive',
    severity: 'high',
    status: 'qualified',
    title: 'Commission de mouvement excédentaire (mars 2026)',
    description: 'Commission facturée 87 600 FCFA vs plafond conventionnel 60 000 FCFA',
    transaction: {
      id: 'tx-2',
      date: '2026-03-31',
      label: 'COM MOUVEMENT MARS 2026',
      amountCentimes: -8_760_000,
      balanceAfterCentimes: 760_320_000,
      pdfPage: 7,
    },
    detection: {
      algorithm: 'detection_commission_excessive_v2',
      confidence: 0.97,
      rule: 'Commission > plafond convention 12/03/2025 art. 7.3',
    },
    conventionId: 'conv-nsia-pamela-2025',
    conventionLabel: 'Convention NSIA × ATOKOUNA · 12/03/2025',
    qualifiedBy: { userId: USERS.kadi.userId, userHandle: USERS.kadi.handle, at: daysAgo(1) },
    potentialRecoveryCentimes: 2_760_000,
    createdAt: daysAgo(3),
  },

  // -----------------------------------------------------------------
  // 3. MEDIUM — agio erroné — détectée, à qualifier
  // -----------------------------------------------------------------
  {
    id: 'anom-3',
    statementId: STATEMENT_ID,
    type: 'agio_errone',
    severity: 'medium',
    status: 'detected',
    title: 'Agio sur découvert non autorisé',
    description: 'Calcul d\'agios divergent : attendu 14 250 FCFA, facturé 18 700 FCFA',
    transaction: {
      id: 'tx-3',
      date: '2026-03-12',
      label: 'INT DEBITEURS T1 2026',
      amountCentimes: -1_870_000,
      balanceAfterCentimes: 654_780_000,
      pdfPage: 6,
    },
    detection: {
      algorithm: 'detection_agio_errone_v2',
      confidence: 0.88,
      rule: 'Méthode des nombres : écart de 4 450 FCFA vs calcul de référence',
    },
    conventionId: 'conv-nsia-pamela-2025',
    conventionLabel: 'Convention NSIA × ATOKOUNA · 12/03/2025',
    potentialRecoveryCentimes: 445_000,
    createdAt: daysAgo(4),
  },

  // -----------------------------------------------------------------
  // 4. MEDIUM — frais double — qualifiée, prête à clôturer
  // -----------------------------------------------------------------
  {
    id: 'anom-4',
    statementId: STATEMENT_ID,
    type: 'frais_double',
    severity: 'medium',
    status: 'qualified',
    title: 'Double prélèvement frais SMS',
    description: 'Abonnement SMS facturé 2× le 28/04/2026 (1 000 FCFA)',
    transaction: {
      id: 'tx-4',
      date: '2026-04-28',
      label: 'ABONNEMENT SMS BANKING',
      amountCentimes: -100_000,
      balanceAfterCentimes: 612_450_000,
      pdfPage: 9,
    },
    detection: {
      algorithm: 'detection_doublons_v3',
      confidence: 0.99,
      rule: 'Même libellé + même montant + même date',
    },
    qualifiedBy: { userId: USERS.kadi.userId, userHandle: USERS.kadi.handle, at: hoursAgo(8) },
    potentialRecoveryCentimes: 100_000,
    createdAt: daysAgo(2),
  },
];

// ============================================================================
// Commentaires
// ============================================================================

export const MOCK_COMMENTS: AnomalyComment[] = [
  {
    id: 'cmt-1',
    anomalyId: 'anom-1',
    author: { userId: USERS.kadi.userId, handle: USERS.kadi.handle, role: 'junior' },
    content:
      "Vérifié au RCCM, l'entité existe mais immatriculée en mars 2026. Demande de KYC envoyée par le DAF. À mon avis légitime mais doit être validé.",
    mentions: [],
    createdAt: daysAgo(1),
  },
  {
    id: 'cmt-2',
    anomalyId: 'anom-1',
    author: { userId: USERS.fatou.userId, handle: USERS.fatou.handle, role: 'senior' },
    content:
      "OK pour qualification. Je remonte au DG vu le montant > 3M. @CheickS pour signature.",
    mentions: [USERS.cheick.userId],
    createdAt: hoursAgo(4),
  },
  {
    id: 'cmt-3',
    anomalyId: 'anom-2',
    author: { userId: USERS.kadi.userId, handle: USERS.kadi.handle, role: 'junior' },
    content: 'Plafond 60 000 explicite à l\'art. 7.3 de la convention NSIA. Surcharge légitime à réclamer.',
    mentions: [],
    createdAt: daysAgo(1),
  },
];

// ============================================================================
// Audit trail (append-only)
// ============================================================================

let prevHash: string | null = null;
function buildAuditEntry(over: Omit<AuditEntry, 'id' | 'hash' | 'prevHash'>): AuditEntry {
  // Hash factice pour mock — en prod calculé serveur via SHA-256
  const fakeHash = 'h' + Math.random().toString(36).slice(2, 10);
  const entry: AuditEntry = { ...over, id: 'audit-' + fakeHash, hash: fakeHash, prevHash };
  prevHash = fakeHash;
  return entry;
}

export const MOCK_AUDIT_TRAIL: AuditEntry[] = [
  buildAuditEntry({
    entityType: 'anomaly',
    entityId: 'anom-1',
    action: 'created',
    actor: { userId: 'system', handle: 'system', role: 'dg' },
    payload: { newValue: { status: 'detected', severity: 'critical' } },
    createdAt: daysAgo(2),
  }),
  buildAuditEntry({
    entityType: 'anomaly',
    entityId: 'anom-1',
    action: 'qualified',
    actor: { userId: USERS.kadi.userId, handle: USERS.kadi.handle, role: 'junior' },
    payload: { oldValue: { status: 'detected' }, newValue: { status: 'qualified' }, comment: 'Légitime selon RCCM' },
    createdAt: daysAgo(1),
  }),
  buildAuditEntry({
    entityType: 'anomaly',
    entityId: 'anom-1',
    action: 'commented',
    actor: { userId: USERS.kadi.userId, handle: USERS.kadi.handle, role: 'junior' },
    payload: { comment: 'Commentaire ajouté' },
    createdAt: daysAgo(1),
  }),
  buildAuditEntry({
    entityType: 'anomaly',
    entityId: 'anom-1',
    action: 'validated',
    actor: { userId: USERS.fatou.userId, handle: USERS.fatou.handle, role: 'senior' },
    payload: { oldValue: { status: 'qualified' }, newValue: { status: 'validated' }, comment: 'Remonté au DG' },
    createdAt: hoursAgo(4),
  }),
];

// ============================================================================
// Convention de référence
// ============================================================================

export const MOCK_CONVENTION: AccountConvention = {
  id: 'conv-nsia-pamela-2025',
  accountId: ACCOUNT_ID,
  signedDate: '2025-03-12',
  expiresDate: null,
  documentUrl: '/mock/conv-nsia-2025.pdf',
  rules: {
    commissionMouvement: { plafondCentimes: 6_000_000, period: 'monthly' },
    decouvert: { taux: 11.5, plafondCentimes: 1_000_000_000 },
  },
  uploadedBy: USERS.pamela.userId,
  createdAt: '2025-03-13T08:00:00Z',
};

// ============================================================================
// Reconciliation — grand livre 521 + 5 disconcordances
// ============================================================================

export const MOCK_BANK_TRANSACTIONS: BankTransaction[] = [
  { id: 'tx-1', date: '2026-03-15', label: 'VIR EMIS SCI MARIGOT', debitCentimes: 320_000_000, creditCentimes: 0, runningBalanceCentimes: 842_567_000 },
  { id: 'tx-2', date: '2026-03-31', label: 'COM MOUVEMENT MARS 2026', debitCentimes: 8_760_000, creditCentimes: 0, runningBalanceCentimes: 760_320_000 },
  { id: 'tx-3', date: '2026-03-12', label: 'INT DEBITEURS T1 2026', debitCentimes: 1_870_000, creditCentimes: 0, runningBalanceCentimes: 654_780_000 },
  { id: 'tx-4', date: '2026-04-28', label: 'ABONNEMENT SMS BANKING', debitCentimes: 100_000, creditCentimes: 0, runningBalanceCentimes: 612_450_000 },
  { id: 'tx-5', date: '2026-04-28', label: 'ABONNEMENT SMS BANKING', debitCentimes: 100_000, creditCentimes: 0, runningBalanceCentimes: 612_350_000 },
  { id: 'tx-6', date: '2026-03-15', label: 'FRAIS BANCAIRES NSIA', debitCentimes: 4_525_000, creditCentimes: 0, runningBalanceCentimes: 837_995_000 },
  { id: 'tx-7', date: '2026-04-10', label: 'VIR RECU CLIENT XYZ', debitCentimes: 0, creditCentimes: 250_000_000, runningBalanceCentimes: 1_062_450_000 },
];

export const MOCK_LEDGER_ENTRIES: LedgerEntry[] = [
  { id: 'le-1', date: '2026-03-15', pieceRef: 'BQ-2603-001', label: 'Virement SCI Marigot', accountCode: '521000', debitCentimes: 0, creditCentimes: 320_000_000, runningBalanceCentimes: 850_092_000 },
  { id: 'le-2', date: '2026-03-31', pieceRef: 'BQ-3103-002', label: 'Commission mouvement', accountCode: '627100', debitCentimes: 8_760_000, creditCentimes: 0, runningBalanceCentimes: 768_545_000 },
  // tx-3 (agio) absent du grand livre → écart bank_only
  { id: 'le-3', date: '2026-04-28', pieceRef: 'BQ-2804-003', label: 'Frais SMS', accountCode: '627200', debitCentimes: 100_000, creditCentimes: 0, runningBalanceCentimes: 612_445_000 },
  // tx-5 doublon SMS absent du grand livre
  // tx-6 frais bancaires NSIA absent du grand livre → écart bank_only
  { id: 'le-4', date: '2026-04-12', pieceRef: 'BQ-1204-004', label: 'Recette client XYZ', accountCode: '521000', debitCentimes: 250_000_000, creditCentimes: 0, runningBalanceCentimes: 1_062_445_000 },
  // Note : date diffère (10 vs 12 avril) → date_mismatch
  { id: 'le-5', date: '2026-04-15', pieceRef: 'BQ-1504-005', label: 'Chèque émis FOURNISSEUR ABC (non débité)', accountCode: '521000', debitCentimes: 0, creditCentimes: 4_500_000, runningBalanceCentimes: 1_057_945_000 },
];

export const MOCK_DISCREPANCIES: ReconciliationDiscrepancy[] = [
  {
    id: 'disc-1',
    kind: 'bank_only',
    bankTxId: 'tx-3',
    gapCentimes: 1_870_000,
    description: 'Agio sur découvert non comptabilisé au grand livre',
    proposedJournal: [
      { accountCode: '661100', accountLabel: 'Intérêts débiteurs', debitCentimes: 1_870_000, creditCentimes: 0 },
      { accountCode: '521000', accountLabel: 'NSIA',                debitCentimes: 0, creditCentimes: 1_870_000 },
    ],
  },
  {
    id: 'disc-2',
    kind: 'bank_only',
    bankTxId: 'tx-5',
    gapCentimes: 100_000,
    description: 'Doublon SMS non comptabilisé (sera contesté)',
    proposedJournal: [
      { accountCode: '627200', accountLabel: 'Frais télécoms', debitCentimes: 100_000, creditCentimes: 0 },
      { accountCode: '521000', accountLabel: 'NSIA',           debitCentimes: 0, creditCentimes: 100_000 },
    ],
  },
  {
    id: 'disc-3',
    kind: 'bank_only',
    bankTxId: 'tx-6',
    gapCentimes: 4_525_000,
    description: 'Frais bancaires non comptabilisés',
    proposedJournal: [
      { accountCode: '627100', accountLabel: 'Services bancaires', debitCentimes: 4_525_000, creditCentimes: 0 },
      { accountCode: '521000', accountLabel: 'NSIA',                debitCentimes: 0, creditCentimes: 4_525_000 },
    ],
  },
  {
    id: 'disc-4',
    kind: 'date_mismatch',
    bankTxId: 'tx-7',
    ledgerEntryId: 'le-4',
    gapCentimes: 0,
    description: 'Décalage de 2 jours entre date banque (10/04) et date compta (12/04)',
  },
  {
    id: 'disc-5',
    kind: 'ledger_only',
    ledgerEntryId: 'le-5',
    gapCentimes: -4_500_000,
    description: 'Chèque émis non encore présenté à la banque',
  },
  {
    id: 'disc-6',
    kind: 'duplicate_bank',
    bankTxId: 'tx-5',
    gapCentimes: 100_000,
    description: 'Transaction enregistrée 2× côté banque (anomalie #4)',
  },
];

export const MOCK_RECONCILIATION: BankReconciliation = {
  id: 'rec-1',
  statementId: STATEMENT_ID,
  ledgerSource: 'atlas_finance',
  ledgerImportedAt: hoursAgo(2),
  matchedPairs: [
    { bankTxId: 'tx-1', ledgerEntryId: 'le-1', confidence: 0.99 },
    { bankTxId: 'tx-2', ledgerEntryId: 'le-2', confidence: 0.99 },
    { bankTxId: 'tx-4', ledgerEntryId: 'le-3', confidence: 0.95 },
    { bankTxId: 'tx-7', ledgerEntryId: 'le-4', confidence: 0.85 },
  ],
  unmatchedBank: ['tx-3', 'tx-5', 'tx-6'],
  unmatchedLedger: ['le-5'],
  discrepancies: MOCK_DISCREPANCIES,
  totalBankCentimes:    1_248_732_000,
  totalLedgerCentimes:  1_261_232_000,
  gapCentimes:            -12_500_000,
  matchRate: 86,
  generatedAt: null,
};

// ============================================================================
// Signed report
// ============================================================================

export const MOCK_SIGNED_REPORT_DRAFT: SignedReport = {
  id: 'rpt-draft',
  statementId: STATEMENT_ID,
  template: 'valeur_probante',
  documentUrl: '/mock/report-preview.pdf',
  hash: 'a3f2c891d4e789f0a3f2c891d4e789f0a3f2c891d4e789f0a3f2c891d4e789f0',
  status: 'draft',
  recipients: [],
  createdAt: NOW.toISOString(),
};

// ============================================================================
// Bank complaint letter
// ============================================================================

export const MOCK_COMPLAINT_LETTER: BankComplaintLetter = {
  id: 'cmpl-draft',
  statementId: STATEMENT_ID,
  bankCode: 'NSIA-CI',
  bankLegalName: 'NSIA Banque Côte d\'Ivoire',
  totalAmountClaimedCentimes: 18_725_000,
  anomaliesIncluded: ['anom-2', 'anom-3', 'anom-4'],
  status: 'draft',
  amountRecoveredCentimes: 0,
  conventionRef: { id: MOCK_CONVENTION.id, signedDate: MOCK_CONVENTION.signedDate },
  createdAt: NOW.toISOString(),
};

// ============================================================================
// PROPH3T conversations
// ============================================================================

export const MOCK_PROPHET_SUGGESTIONS: string[] = [
  'Combien de frais SWIFT ce trimestre ?',
  'Liste les bénéficiaires > 5M FCFA',
  'Compare avec Ecobank du même trimestre',
  'Reformule l\'anomalie #2 en mail au client',
  'Quelles sont les contreparties inédites ?',
];

export const MOCK_PROPHET_CONV: ProphetConversation = {
  id: 'conv-1',
  statementId: STATEMENT_ID,
  userId: USERS.pamela.userId,
  context: { accountId: ACCOUNT_ID, clientId: 'client-pamela' },
  messages: [],
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
};

export function buildSampleProphetReply(question: string): ProphetMessage {
  if (/swift/i.test(question)) {
    return {
      id: 'msg-' + Math.random().toString(36).slice(2),
      role: 'assistant',
      content:
        'Sur la période 10/02 → 08/05/2026, j\'identifie 4 transactions SWIFT pour un total de 67 850 FCFA.\n\n' +
        '• 12/02 · 18 200 FCFA · VIR SWIFT FR76\n' +
        '• 23/03 · 15 400 FCFA · VIR SWIFT BE68\n' +
        '• 04/04 · 19 250 FCFA · VIR SWIFT US45\n' +
        '• 28/04 · 15 000 FCFA · VIR SWIFT FR76',
      citations: [
        { kind: 'transaction', id: 'tx-swift-1', label: 'VIR SWIFT FR76 12/02' },
        { kind: 'transaction', id: 'tx-swift-2', label: 'VIR SWIFT BE68 23/03' },
      ],
      followUps: [
        'Décompose par pays bénéficiaire',
        'Compare au trimestre précédent',
      ],
      createdAt: new Date().toISOString(),
    };
  }

  return {
    id: 'msg-' + Math.random().toString(36).slice(2),
    role: 'assistant',
    content:
      'Voici une analyse synthétique basée sur ce relevé. Les calculs sont déterministes et tirés des transactions extraites — je ne pioche que dans le contexte du relevé courant.',
    followUps: ['Donne-moi le top 5 des bénéficiaires', 'Détaille les anomalies tarifaires'],
    createdAt: new Date().toISOString(),
  };
}

// ============================================================================
// Helpers exposés
// ============================================================================

export const MOCK_USERS = USERS;
export const MOCK_STATEMENT_ID = STATEMENT_ID;
export const MOCK_ACCOUNT_ID = ACCOUNT_ID;
