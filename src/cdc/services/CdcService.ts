// ============================================================================
// CDC — Service principal (façade)
// Point d'entrée unique pour les composants UI
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../../lib/supabase';
import { ResolutionEngine } from '../resolution/ResolutionEngine';
import { SupabaseCdcDao } from '../resolution/SupabaseCdcDao';
import { CdcAuditOrchestrator, type AuditInput, type AuditOutput } from '../audit/CdcAuditOrchestrator';
import { RUBRICS_TAXONOMY, type RubricSeed } from '../taxonomy/rubrics';
import type {
  CdcBank,
  CdcOrganization,
  CdcBankAccount,
  Agreement,
  AgreementCondition,
  BankReferenceVersion,
  BankReferenceCondition,
  RegulatoryJurisdiction,
  RegulatoryRule,
  ResolutionRequest,
  ResolutionResult,
  CdcAuditSession,
  Ecart,
} from '../types';

export class CdcService {
  private supabase: SupabaseClient;
  private dao: SupabaseCdcDao;
  private resolver: ResolutionEngine;
  private orchestrator: CdcAuditOrchestrator;

  constructor(supabase?: SupabaseClient) {
    const client = supabase ?? getSupabaseClient();
    if (!client) throw new Error('Supabase non configuré');
    this.supabase = client;
    this.dao = new SupabaseCdcDao(this.supabase);
    this.resolver = new ResolutionEngine(this.dao);
    this.orchestrator = new CdcAuditOrchestrator(this.dao, this.supabase);
  }

  // ==========================================================================
  // Resolution
  // ==========================================================================

  async resolve(req: ResolutionRequest): Promise<ResolutionResult> {
    return this.resolver.resolve(req);
  }

  async resolveMany(requests: ResolutionRequest[]): Promise<ResolutionResult[]> {
    return this.resolver.resolveMany(requests);
  }

  // ==========================================================================
  // Audit
  // ==========================================================================

  async runAudit(input: AuditInput): Promise<AuditOutput> {
    return this.orchestrator.runAudit(input);
  }

  async getAuditSessions(
    tenantId: string,
    limit = 20,
  ): Promise<CdcAuditSession[]> {
    const { data, error } = await this.supabase
      .schema('atlasbanx')
      .from('cdc_audit_sessions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Erreur chargement sessions: ${error.message}`);
    return (data ?? []).map(this.mapSession);
  }

  async getAuditEcarts(sessionId: string): Promise<Ecart[]> {
    const { data, error } = await this.supabase
      .schema('atlasbanx')
      .from('cdc_ecarts')
      .select('*')
      .eq('audit_session_id', sessionId)
      .order('code', { ascending: true });

    if (error) throw new Error(`Erreur chargement écarts: ${error.message}`);
    return (data ?? []).map(this.mapEcart);
  }

  // ==========================================================================
  // Banks CRUD
  // ==========================================================================

  async listBanks(zone?: string): Promise<CdcBank[]> {
    let query = this.supabase
      .schema('atlasbanx')
      .from('cdc_banks')
      .select('*')
      .eq('is_active', true)
      .order('code');

    if (zone) query = query.eq('zone', zone);

    const { data, error } = await query;
    if (error) throw new Error(`Erreur listBanks: ${error.message}`);
    return (data ?? []).map(this.mapBank);
  }

  async createBank(bank: Omit<CdcBank, 'id' | 'createdAt'>): Promise<CdcBank> {
    const { data, error } = await this.supabase
      .schema('atlasbanx')
      .from('cdc_banks')
      .insert({
        code: bank.code,
        legal_name: bank.legalName,
        country_iso: bank.countryIso,
        zone: bank.zone,
        jurisdiction_ids: bank.jurisdictionIds,
        swift_bic: bank.swiftBic,
        parent_group: bank.parentGroup,
        is_active: bank.isActive,
      })
      .select()
      .single();

    if (error) throw new Error(`Erreur createBank: ${error.message}`);
    return this.mapBank(data);
  }

  // ==========================================================================
  // Organizations CRUD
  // ==========================================================================

  async listOrganizations(tenantId: string): Promise<CdcOrganization[]> {
    const { data, error } = await this.supabase
      .schema('atlasbanx')
      .from('cdc_organizations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('legal_name');

    if (error) throw new Error(`Erreur listOrganizations: ${error.message}`);
    return (data ?? []).map(this.mapOrganization);
  }

  async createOrganization(
    org: Omit<CdcOrganization, 'id' | 'createdAt'>,
  ): Promise<CdcOrganization> {
    const { data, error } = await this.supabase
      .schema('atlasbanx')
      .from('cdc_organizations')
      .insert({
        tenant_id: org.tenantId,
        parent_id: org.parentId,
        legal_name: org.legalName,
        trade_name: org.tradeName,
        org_type: org.orgType,
        rccm: org.rccm,
        tax_id: org.taxId,
        country_iso: org.countryIso,
        is_active: org.isActive,
      })
      .select()
      .single();

    if (error) throw new Error(`Erreur createOrganization: ${error.message}`);
    return this.mapOrganization(data);
  }

  // ==========================================================================
  // Bank Accounts CRUD
  // ==========================================================================

  async listBankAccounts(organizationId: string): Promise<CdcBankAccount[]> {
    const { data, error } = await this.supabase
      .schema('atlasbanx')
      .from('cdc_bank_accounts')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('account_label');

    if (error) throw new Error(`Erreur listBankAccounts: ${error.message}`);
    return (data ?? []).map(this.mapBankAccount);
  }

  async createBankAccount(
    account: Omit<CdcBankAccount, 'id' | 'createdAt'>,
  ): Promise<CdcBankAccount> {
    const { data, error } = await this.supabase
      .schema('atlasbanx')
      .from('cdc_bank_accounts')
      .insert({
        organization_id: account.organizationId,
        bank_id: account.bankId,
        account_number: account.accountNumber,
        account_label: account.accountLabel,
        account_type: account.accountType,
        currency: account.currency,
        iban: account.iban,
        opened_at: account.openedAt?.toISOString().slice(0, 10) ?? null,
        is_active: account.isActive,
      })
      .select()
      .single();

    if (error) throw new Error(`Erreur createBankAccount: ${error.message}`);
    return this.mapBankAccount(data);
  }

  // ==========================================================================
  // Agreements CRUD
  // ==========================================================================

  async listAgreements(
    orgId: string,
    bankId?: string,
  ): Promise<Agreement[]> {
    let query = this.supabase
      .schema('atlasbanx')
      .from('agreements')
      .select('*')
      .eq('scope_org_id', orgId)
      .is('recorded_to', null)
      .order('valid_from', { ascending: false });

    if (bankId) query = query.eq('bank_id', bankId);

    const { data, error } = await query;
    if (error) throw new Error(`Erreur listAgreements: ${error.message}`);
    return (data ?? []).map(this.mapAgreement);
  }

  async createAgreement(
    agreement: Omit<Agreement, 'id' | 'createdAt' | 'recordedFrom' | 'recordedTo' | 'supersededBy'>,
  ): Promise<Agreement> {
    const { data, error } = await this.supabase
      .schema('atlasbanx')
      .from('agreements')
      .insert({
        layer: agreement.layer,
        scope_org_id: agreement.scopeOrgId,
        bank_id: agreement.bankId,
        account_id: agreement.accountId,
        agreement_label: agreement.agreementLabel,
        signed_at: agreement.signedAt instanceof Date
          ? agreement.signedAt.toISOString().slice(0, 10)
          : agreement.signedAt,
        valid_from: agreement.validFrom instanceof Date
          ? agreement.validFrom.toISOString().slice(0, 10)
          : agreement.validFrom,
        valid_to: agreement.validTo
          ? (agreement.validTo instanceof Date
              ? agreement.validTo.toISOString().slice(0, 10)
              : agreement.validTo)
          : null,
        source_pdf_url: agreement.sourcePdfUrl,
        source_hash_sha256: agreement.sourceHashSha256,
        validation_status: agreement.validationStatus,
        validated_by: agreement.validatedBy,
      })
      .select()
      .single();

    if (error) throw new Error(`Erreur createAgreement: ${error.message}`);
    return this.mapAgreement(data);
  }

  async addAgreementConditions(
    agreementId: string,
    conditions: Array<Omit<AgreementCondition, 'id' | 'createdAt' | 'agreementId'>>,
  ): Promise<AgreementCondition[]> {
    const rows = conditions.map((c) => ({
      agreement_id: agreementId,
      rubric_code: c.rubricCode,
      dimensions: c.dimensions,
      value_numeric: c.valueNumeric,
      value_formula: c.valueFormula,
      pdf_bbox: c.pdfBbox,
      pdf_page: c.pdfPage,
      notes: c.notes,
    }));

    const { data, error } = await this.supabase
      .schema('atlasbanx')
      .from('agreement_conditions')
      .insert(rows)
      .select();

    if (error) throw new Error(`Erreur addAgreementConditions: ${error.message}`);
    return (data ?? []).map(this.mapAgreementCondition);
  }

  // ==========================================================================
  // Bank Reference CRUD
  // ==========================================================================

  async createBankReferenceVersion(
    version: Omit<BankReferenceVersion, 'id' | 'createdAt' | 'supersededBy'>,
  ): Promise<BankReferenceVersion> {
    const { data, error } = await this.supabase
      .schema('atlasbanx')
      .from('bank_reference_versions')
      .insert({
        bank_id: version.bankId,
        version_label: version.versionLabel,
        effective_from: version.effectiveFrom instanceof Date
          ? version.effectiveFrom.toISOString().slice(0, 10)
          : version.effectiveFrom,
        effective_to: version.effectiveTo
          ? (version.effectiveTo instanceof Date
              ? version.effectiveTo.toISOString().slice(0, 10)
              : version.effectiveTo)
          : null,
        source_pdf_url: version.sourcePdfUrl,
        source_hash_sha256: version.sourceHashSha256,
        validation_status: version.validationStatus,
        validated_by: version.validatedBy,
        validated_at: version.validatedAt?.toISOString() ?? null,
        published_at: version.publishedAt?.toISOString() ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(`Erreur createBankReferenceVersion: ${error.message}`);
    return this.mapBankRefVersion(data);
  }

  async addBankReferenceConditions(
    versionId: string,
    conditions: Array<Omit<BankReferenceCondition, 'id' | 'createdAt' | 'referenceVersionId'>>,
  ): Promise<BankReferenceCondition[]> {
    const rows = conditions.map((c) => ({
      reference_version_id: versionId,
      rubric_code: c.rubricCode,
      dimensions: c.dimensions,
      value_numeric: c.valueNumeric,
      value_formula: c.valueFormula,
      pdf_bbox: c.pdfBbox,
      pdf_page: c.pdfPage,
      notes: c.notes,
    }));

    const { data, error } = await this.supabase
      .schema('atlasbanx')
      .from('bank_reference_conditions')
      .insert(rows)
      .select();

    if (error) throw new Error(`Erreur addBankReferenceConditions: ${error.message}`);
    return (data ?? []).map(this.mapBankRefCondition);
  }

  // ==========================================================================
  // Regulatory CRUD
  // ==========================================================================

  async listJurisdictions(): Promise<RegulatoryJurisdiction[]> {
    const { data, error } = await this.supabase
      .schema('atlasbanx')
      .from('regulatory_jurisdictions')
      .select('*')
      .order('code');

    if (error) throw new Error(`Erreur listJurisdictions: ${error.message}`);
    return (data ?? []).map(this.mapJurisdiction);
  }

  async listRegulatoryRules(
    jurisdictionId: string,
  ): Promise<RegulatoryRule[]> {
    const { data, error } = await this.supabase
      .schema('atlasbanx')
      .from('regulatory_rules')
      .select('*')
      .eq('jurisdiction_id', jurisdictionId)
      .is('superseded_by', null)
      .order('rubric_code');

    if (error) throw new Error(`Erreur listRegulatoryRules: ${error.message}`);
    return (data ?? []).map(this.mapRegulatoryRule);
  }

  // ==========================================================================
  // Taxonomy
  // ==========================================================================

  getTaxonomy(): RubricSeed[] {
    return RUBRICS_TAXONOMY;
  }

  async seedTaxonomy(): Promise<number> {
    const rows = RUBRICS_TAXONOMY.map((r) => ({
      code: r.code,
      parent_code: r.parentCode,
      category: r.category,
      display_label_fr: r.displayLabelFr,
      unit: r.unit,
      is_dimensional: r.isDimensional,
      description: r.description,
    }));

    const { error } = await this.supabase
      .schema('atlasbanx')
      .from('rubrics_taxonomy')
      .upsert(rows, { onConflict: 'code' });

    if (error) throw new Error(`Erreur seedTaxonomy: ${error.message}`);
    return rows.length;
  }

  // ==========================================================================
  // Row mappers
  // ==========================================================================

  private mapBank(row: any): CdcBank {
    return {
      id: row.id,
      code: row.code,
      legalName: row.legal_name,
      countryIso: row.country_iso,
      zone: row.zone,
      jurisdictionIds: row.jurisdiction_ids ?? [],
      swiftBic: row.swift_bic,
      parentGroup: row.parent_group,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
    };
  }

  private mapOrganization(row: any): CdcOrganization {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      parentId: row.parent_id,
      legalName: row.legal_name,
      tradeName: row.trade_name,
      orgType: row.org_type,
      rccm: row.rccm,
      taxId: row.tax_id,
      countryIso: row.country_iso,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
    };
  }

  private mapBankAccount(row: any): CdcBankAccount {
    return {
      id: row.id,
      organizationId: row.organization_id,
      bankId: row.bank_id,
      accountNumber: row.account_number,
      accountLabel: row.account_label,
      accountType: row.account_type,
      currency: row.currency,
      iban: row.iban,
      openedAt: row.opened_at ? new Date(row.opened_at) : null,
      closedAt: row.closed_at ? new Date(row.closed_at) : null,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
    };
  }

  private mapAgreement(row: any): Agreement {
    return {
      id: row.id,
      layer: row.layer,
      scopeOrgId: row.scope_org_id,
      bankId: row.bank_id,
      accountId: row.account_id,
      agreementLabel: row.agreement_label,
      signedAt: new Date(row.signed_at),
      validFrom: new Date(row.valid_from),
      validTo: row.valid_to ? new Date(row.valid_to) : null,
      recordedFrom: new Date(row.recorded_from),
      recordedTo: row.recorded_to ? new Date(row.recorded_to) : null,
      sourcePdfUrl: row.source_pdf_url,
      sourceHashSha256: row.source_hash_sha256,
      validationStatus: row.validation_status,
      validatedBy: row.validated_by,
      supersededBy: row.superseded_by,
      createdAt: new Date(row.created_at),
    };
  }

  private mapAgreementCondition(row: any): AgreementCondition {
    return {
      id: row.id,
      agreementId: row.agreement_id,
      rubricCode: row.rubric_code,
      dimensions: row.dimensions,
      valueNumeric: row.value_numeric != null ? Number(row.value_numeric) : null,
      valueFormula: row.value_formula,
      pdfBbox: row.pdf_bbox,
      pdfPage: row.pdf_page,
      notes: row.notes,
      createdAt: new Date(row.created_at),
    };
  }

  private mapBankRefVersion(row: any): BankReferenceVersion {
    return {
      id: row.id,
      bankId: row.bank_id,
      versionLabel: row.version_label,
      effectiveFrom: new Date(row.effective_from),
      effectiveTo: row.effective_to ? new Date(row.effective_to) : null,
      sourcePdfUrl: row.source_pdf_url,
      sourceHashSha256: row.source_hash_sha256,
      validationStatus: row.validation_status,
      validatedBy: row.validated_by,
      validatedAt: row.validated_at ? new Date(row.validated_at) : null,
      publishedAt: row.published_at ? new Date(row.published_at) : null,
      supersededBy: row.superseded_by,
      createdAt: new Date(row.created_at),
    };
  }

  private mapBankRefCondition(row: any): BankReferenceCondition {
    return {
      id: row.id,
      referenceVersionId: row.reference_version_id,
      rubricCode: row.rubric_code,
      dimensions: row.dimensions,
      valueNumeric: row.value_numeric != null ? Number(row.value_numeric) : null,
      valueFormula: row.value_formula,
      pdfBbox: row.pdf_bbox,
      pdfPage: row.pdf_page,
      notes: row.notes,
      createdAt: new Date(row.created_at),
    };
  }

  private mapJurisdiction(row: any): RegulatoryJurisdiction {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      scopeCountries: row.scope_countries,
      parentId: row.parent_id,
      createdAt: new Date(row.created_at),
    };
  }

  private mapRegulatoryRule(row: any): RegulatoryRule {
    return {
      id: row.id,
      jurisdictionId: row.jurisdiction_id,
      rubricCode: row.rubric_code,
      productCategory: row.product_category,
      ruleType: row.rule_type,
      valueNumeric: row.value_numeric != null ? Number(row.value_numeric) : null,
      valueFormula: row.value_formula,
      unit: row.unit,
      validFrom: new Date(row.valid_from),
      validTo: row.valid_to ? new Date(row.valid_to) : null,
      sourceReference: row.source_reference,
      sourceDocument: row.source_document,
      recordedAt: new Date(row.recorded_at),
      recordedBy: row.recorded_by,
      supersededBy: row.superseded_by,
    };
  }

  private mapSession(row: any): CdcAuditSession {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      organizationId: row.organization_id,
      accountId: row.account_id,
      periodStart: new Date(row.period_start),
      periodEnd: new Date(row.period_end),
      status: row.status,
      totalOperations: row.total_operations ?? 0,
      totalEcarts: row.total_ecarts ?? 0,
      totalImpactCentimes: BigInt(row.total_impact_centimes ?? 0),
      ecartsByCode: row.ecarts_by_code ?? {},
      startedAt: row.started_at ? new Date(row.started_at) : null,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      startedBy: row.started_by,
      error: row.error,
      createdAt: new Date(row.created_at),
    };
  }

  private mapEcart(row: any): Ecart {
    return {
      id: row.id,
      auditSessionId: row.audit_session_id,
      code: row.code,
      rubricCode: row.rubric_code,
      resolutionId: row.resolution_id,
      expectedCentimes: BigInt(row.expected_centimes),
      actualCentimes: BigInt(row.actual_centimes),
      ecartCentimes: BigInt(row.ecart_centimes),
      scoring: {
        materialiteCentimes: BigInt(row.materialite_centimes),
        confiance: row.confiance,
        recuperabilite: row.recuperabilite,
      },
      operationDate: row.operation_date ? new Date(row.operation_date) : null,
      operationRef: row.operation_ref,
      description: row.description,
      details: row.details ?? {},
    };
  }
}
