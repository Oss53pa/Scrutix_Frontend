// ============================================================================
// CDC Architecture v1.0 — Types TypeScript
// Moteur de résolution 5 couches pour conditions bancaires
// ============================================================================

// ============================================================================
// Couche L1 : Réglementaire
// ============================================================================

export interface RegulatoryJurisdiction {
  id: string;
  code: string;          // 'BCEAO', 'COBAC', 'CI-USURE'
  name: string;
  scopeCountries: string[];
  parentId: string | null;
  createdAt: Date;
}

export interface RegulatoryRule {
  id: string;
  jurisdictionId: string;
  rubricCode: string;
  productCategory: string | null;
  ruleType: 'cap_max' | 'cap_min' | 'formula';
  valueNumeric: number | null;
  valueFormula: ConditionFormula | null;
  unit: ConditionUnit;
  validFrom: Date;
  validTo: Date | null;
  sourceReference: string | null;
  sourceDocument: string | null;
  recordedAt: Date;
  recordedBy: string | null;
  supersededBy: string | null;
}

// ============================================================================
// Taxonomie des rubriques
// ============================================================================

export type RubricCategory =
  | 'compte'
  | 'decouverts'
  | 'cartes'
  | 'virements'
  | 'cheques'
  | 'credits'
  | 'ebanking'
  | 'operations_speciales'
  | 'incidents';

export type ConditionUnit = 'percent' | 'fcfa' | 'days' | 'count';

export interface RubricTaxonomy {
  id: string;
  code: string;
  parentCode: string | null;
  category: RubricCategory;
  displayLabelFr: string;
  unit: ConditionUnit;
  isDimensional: boolean;
  description: string | null;
}

// ============================================================================
// Couche L2 : Référentiel banque
// ============================================================================

export interface CdcBank {
  id: string;
  code: string;
  legalName: string;
  countryIso: string;
  zone: 'UEMOA' | 'CEMAC';
  jurisdictionIds: string[];
  swiftBic: string | null;
  parentGroup: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface BankReferenceVersion {
  id: string;
  bankId: string;
  versionLabel: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  sourcePdfUrl: string;
  sourceHashSha256: string;
  validationStatus: 'draft' | 'validated' | 'published';
  validatedBy: string | null;
  validatedAt: Date | null;
  publishedAt: Date | null;
  supersededBy: string | null;
  createdAt: Date;
}

export interface BankReferenceCondition {
  id: string;
  referenceVersionId: string;
  rubricCode: string;
  dimensions: ConditionDimensions | null;
  valueNumeric: number | null;
  valueFormula: ConditionFormula | null;
  pdfBbox: PdfBbox | null;
  pdfPage: number | null;
  notes: string | null;
  createdAt: Date;
}

// ============================================================================
// Couches L3/L4/L5 : Conventions client
// ============================================================================

export type OrgType = 'cabinet' | 'group' | 'subsidiary' | 'client';

export interface CdcOrganization {
  id: string;
  tenantId: string;
  parentId: string | null;
  legalName: string;
  tradeName: string | null;
  orgType: OrgType;
  rccm: string | null;
  taxId: string | null;
  countryIso: string;
  isActive: boolean;
  createdAt: Date;
}

export type AccountType = 'courant' | 'epargne' | 'devise' | 'titres';

export interface CdcBankAccount {
  id: string;
  organizationId: string;
  bankId: string;
  accountNumber: string;
  accountLabel: string | null;
  accountType: AccountType;
  currency: string;
  iban: string | null;
  openedAt: Date | null;
  closedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}

export type AgreementLayer = 3 | 4 | 5;

export interface Agreement {
  id: string;
  layer: AgreementLayer;
  scopeOrgId: string;
  bankId: string;
  accountId: string | null;
  agreementLabel: string;
  signedAt: Date;
  validFrom: Date;
  validTo: Date | null;
  recordedFrom: Date;
  recordedTo: Date | null;
  sourcePdfUrl: string | null;
  sourceHashSha256: string | null;
  validationStatus: 'draft' | 'validated';
  validatedBy: string | null;
  supersededBy: string | null;
  createdAt: Date;
}

export interface AgreementCondition {
  id: string;
  agreementId: string;
  rubricCode: string;
  dimensions: ConditionDimensions | null;
  valueNumeric: number | null;
  valueFormula: ConditionFormula | null;
  pdfBbox: PdfBbox | null;
  pdfPage: number | null;
  notes: string | null;
  createdAt: Date;
}

// ============================================================================
// Dimensions & Formules
// ============================================================================

export interface ConditionDimensions {
  montant?: { min: number; max: number };
  profil?: 'particulier' | 'pme' | 'corporate';
  dureeJours?: number;
  garantie?: 'aucune' | 'caution' | 'hypotheque' | 'nantissement';
  devise?: string;
  canal?: 'agence' | 'ebanking' | 'mobile';
  [key: string]: unknown;
}

export interface ConditionFormula {
  type: 'tiered' | 'linear' | 'custom';
  expression?: string;
  tiers?: Array<{
    min: number;
    max: number;
    rate: number;
    fixed: number;
  }>;
  parameters?: Record<string, number>;
}

export interface PdfBbox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ============================================================================
// Moteur de résolution
// ============================================================================

/**
 * Mode de résolution réglementaire (CDC §5.2 étape 4).
 *
 * - 'strict' (audit) : la valeur résolue depuis L5–L2 est conservée même
 *   si elle dépasse un plafond L1. La violation est ajoutée au receipt.
 *   C'est ce que l'audit doit détecter : la banque a effectivement
 *   appliqué une valeur au-delà du plafond.
 *
 * - 'prescriptif' (simulation) : la valeur est plafonnée à la limite
 *   réglementaire. Utilisé pour les projections, simulations,
 *   présentation au client de "ce qui aurait dû être appliqué".
 */
export type ResolutionMode = 'strict' | 'prescriptif';

export interface ResolutionRequest {
  accountId: string;
  rubricCode: string;
  referenceDate: Date;
  /** Mode strict (audit) par défaut. Voir ResolutionMode. */
  mode?: ResolutionMode;
  dimensions?: {
    montantCentimes?: bigint;
    profil?: 'particulier' | 'pme' | 'corporate';
    dureeJours?: number;
    garantie?: 'aucune' | 'caution' | 'hypotheque' | 'nantissement';
    devise?: string;
    canal?: 'agence' | 'ebanking' | 'mobile';
  };
}

export interface RegulatoryViolation {
  ruleId: string;
  code: EcartCode;
  message: string;
  capValue: number;
  resolvedValue: number;
  unit: ConditionUnit;
}

export interface SupersededLayer {
  layer: number;
  reason: string;
}

export interface ResolutionReceipt {
  layerUsed: 1 | 2 | 3 | 4 | 5;
  sourceId: string;
  sourceLabel: string;
  validFrom: Date;
  validTo: Date | null;
  supersededLayers: SupersededLayer[];
  regulatoryViolations: RegulatoryViolation[];
  /** Mode utilisé pour la résolution (CDC §5.2). */
  mode: ResolutionMode;
  /** Valeur brute résolue avant plafonnement éventuel (mode prescriptif). */
  rawValue: number | null;
  /** TRUE si la valeur a été plafonnée par L1 (mode prescriptif). */
  capApplied: boolean;
  /**
   * Signature HMAC-SHA256 du receipt canonicalisé.
   * Vérifiable a posteriori avec la clé Atlas Studio.
   * CDC §8.3 — receipt cryptographiquement signé.
   */
  signature: string;
  /** Algorithme de signature, pour évolution future. */
  signatureAlgo: 'hmac-sha256';
  /** Identifiant de la clé utilisée (rotation). */
  signatureKeyId: string;
  /** Hash SHA-256 du receipt précédent dans la chaîne d'audit (chained signing). */
  previousHash: string | null;
  /** Hash SHA-256 du receipt courant (sert de previousHash au suivant). */
  receiptHash: string;
}

export interface ResolutionResult {
  value: number | null;
  formula: ConditionFormula | null;
  receipt: ResolutionReceipt;
  resolvedAt: Date;
}

// ============================================================================
// Codes d'écart
// ============================================================================

export type EcartCode =
  | 'E01'  // Taux excessif
  | 'E02'  // Violation réglementaire
  | 'E03'  // Date valeur abusive
  | 'E04'  // Assiette erronée
  | 'E05'  // Double prélèvement
  | 'E06'  // Frais non conventionné
  | 'E07'  // Erreur de calcul
  | 'E08'; // Manquement transparence

export const ECART_LABELS: Record<EcartCode, string> = {
  E01: 'Taux excessif — taux appliqué > taux convenu (< L1)',
  E02: 'Violation réglementaire — dépasse plafond BCEAO/COBAC',
  E03: 'Date valeur abusive — DV plus défavorable que conventionnée',
  E04: 'Assiette erronée — base de calcul ≠ convention',
  E05: 'Double prélèvement — même frais facturé 2× sur période',
  E06: 'Frais non conventionné — pas de support contractuel résolvable',
  E07: 'Erreur de calcul — taux correct mais résultat numérique faux',
  E08: 'Manquement transparence — frais sans libellé clair',
};

export type Recuperabilite = 'forte' | 'moyenne' | 'faible';

export interface EcartScoring {
  materialiteCentimes: bigint;
  confiance: number;           // 0-100
  recuperabilite: Recuperabilite;
}

export interface Ecart {
  id: string;
  auditSessionId: string;
  code: EcartCode;
  rubricCode: string;
  resolutionId: string | null;
  expectedCentimes: bigint;
  actualCentimes: bigint;
  ecartCentimes: bigint;
  scoring: EcartScoring;
  operationDate: Date | null;
  operationRef: string | null;
  description: string;
  details: Record<string, unknown>;
}

// ============================================================================
// Session d'audit CDC
// ============================================================================

export interface CdcAuditSession {
  id: string;
  tenantId: string;
  organizationId: string;
  accountId: string;
  periodStart: Date;
  periodEnd: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
  totalOperations: number;
  totalEcarts: number;
  totalImpactCentimes: bigint;
  ecartsByCode: Record<EcartCode, number>;
  startedAt: Date | null;
  completedAt: Date | null;
  startedBy: string | null;
  error: string | null;
  createdAt: Date;
}

// ============================================================================
// Contexte de résolution (chargé en début d'audit)
// ============================================================================

export interface AccountContext {
  account: CdcBankAccount;
  organization: CdcOrganization;
  ancestors: CdcOrganization[];   // ordered root → parent
  bank: CdcBank;
  jurisdictions: RegulatoryJurisdiction[];
}

// ============================================================================
// Calculs financiers
// ============================================================================

export interface DailyPosition {
  date: Date;
  balanceCentimes: bigint;
  isDebit: boolean;
}

export interface AgiosResult {
  totalAgiosCentimes: bigint;
  agiosAutoriseCentimes: bigint;
  agiosNonAutoriseCentimes: bigint;
  nombreJoursDebiteurs: number;
  soldeDebiteurMoyen: bigint;
  tauxApplique: number;
  tauxConvenu: number;
  base: 360 | 365;
  details: Array<{
    date: Date;
    soldeCentimes: bigint;
    agiosCentimes: bigint;
    zone: 'autorise' | 'non_autorise';
  }>;
}

export interface CommissionMouvementResult {
  totalCommissionCentimes: bigint;
  assietteCentimes: bigint;
  tauxApplique: number;
  tauxConvenu: number;
  operationsEligibles: number;
  operationsExclues: number;
  assiette: CommissionAssiette;
}

export type CommissionAssiette =
  | 'tous_debits'
  | 'hors_retraits_especes'
  | 'hors_virements_internes'
  | 'hors_prelevements'
  | 'hors_agios_commissions';

export interface CpfdResult {
  cpfdCentimes: bigint;
  plusFortDecouvertCentimes: bigint;
  tauxCpfd: number;
  plafondReglementaireCentimes: bigint | null;
  isViolation: boolean;
  dateMaxDecouvert: Date;
}

export interface ValueDateResult {
  operationDate: Date;
  valueDateApplied: Date;
  valueDateExpected: Date;
  ecartJours: number;
  ecartMaxAutorise: number;
  impactCentimes: bigint;
  typeOperation: string;
}
