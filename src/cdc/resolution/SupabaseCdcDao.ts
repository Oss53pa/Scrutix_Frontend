// ============================================================================
// CDC — Supabase Data Access Object
// Implements CdcDataAccess for Supabase backend
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AccountContext,
  Agreement,
  AgreementCondition,
  BankReferenceCondition,
  BankReferenceVersion,
  CdcBank,
  CdcBankAccount,
  CdcOrganization,
  RegulatoryJurisdiction,
  RegulatoryRule,
} from '../types';
import type { CdcDataAccess } from './ResolutionEngine';

export class SupabaseCdcDao implements CdcDataAccess {
  constructor(private supabase: SupabaseClient) {}

  async getAccountContext(accountId: string): Promise<AccountContext> {
    // 1. Load account
    const { data: accountRow, error: accErr } = await this.supabase
      .schema('atlasbanx')
      .from('cdc_bank_accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (accErr || !accountRow) {
      throw new Error(`Compte introuvable: ${accountId}`);
    }

    const account = this.mapAccount(accountRow);

    // 2. Load organization + ancestors
    const organization = await this.loadOrganization(account.organizationId);
    const ancestors = await this.loadAncestors(organization);

    // 3. Load bank
    const { data: bankRow, error: bankErr } = await this.supabase
      .schema('atlasbanx')
      .from('cdc_banks')
      .select('*')
      .eq('id', account.bankId)
      .single();

    if (bankErr || !bankRow) {
      throw new Error(`Banque introuvable: ${account.bankId}`);
    }

    const bank = this.mapBank(bankRow);

    // 4. Load jurisdictions
    const jurisdictions = await this.loadJurisdictions(bank.jurisdictionIds);

    return { account, organization, ancestors, bank, jurisdictions };
  }

  async findAgreements(
    orgId: string,
    bankId: string,
    accountId: string | null,
    layer: number,
    referenceDate: Date,
  ): Promise<Agreement[]> {
    const dateStr = referenceDate.toISOString().slice(0, 10);

    let query = this.supabase
      .schema('atlasbanx')
      .from('agreements')
      .select('*')
      .eq('scope_org_id', orgId)
      .eq('bank_id', bankId)
      .eq('layer', layer)
      .is('recorded_to', null)
      .lte('valid_from', dateStr)
      .eq('validation_status', 'validated');

    // valid_to is null (open-ended) or >= referenceDate
    // Supabase doesn't support OR in filters cleanly, so we fetch and filter
    const { data, error } = await query;
    if (error) throw new Error(`Erreur requête agreements: ${error.message}`);

    return (data ?? [])
      .filter((row: any) => !row.valid_to || row.valid_to >= dateStr)
      .filter((row: any) => {
        // Account scoping: null = all accounts, or match specific account
        if (accountId && row.account_id && row.account_id !== accountId) {
          return false;
        }
        return true;
      })
      .map(this.mapAgreement);
  }

  async findAgreementConditions(
    agreementId: string,
    rubricCode: string,
  ): Promise<AgreementCondition[]> {
    const { data, error } = await this.supabase
      .schema('atlasbanx')
      .from('agreement_conditions')
      .select('*')
      .eq('agreement_id', agreementId)
      .eq('rubric_code', rubricCode);

    if (error) throw new Error(`Erreur requête agreement_conditions: ${error.message}`);
    return (data ?? []).map(this.mapAgreementCondition);
  }

  async findBankReferenceVersion(
    bankId: string,
    referenceDate: Date,
  ): Promise<BankReferenceVersion | null> {
    const dateStr = referenceDate.toISOString().slice(0, 10);

    const { data, error } = await this.supabase
      .schema('atlasbanx')
      .from('bank_reference_versions')
      .select('*')
      .eq('bank_id', bankId)
      .eq('validation_status', 'published')
      .is('superseded_by', null)
      .lte('effective_from', dateStr)
      .order('effective_from', { ascending: false })
      .limit(1);

    if (error) throw new Error(`Erreur requête bank_reference_versions: ${error.message}`);

    const row = (data ?? []).find(
      (r: any) => !r.effective_to || r.effective_to >= dateStr,
    );

    return row ? this.mapBankRefVersion(row) : null;
  }

  async findBankReferenceConditions(
    versionId: string,
    rubricCode: string,
  ): Promise<BankReferenceCondition[]> {
    const { data, error } = await this.supabase
      .schema('atlasbanx')
      .from('bank_reference_conditions')
      .select('*')
      .eq('reference_version_id', versionId)
      .eq('rubric_code', rubricCode);

    if (error) throw new Error(`Erreur requête bank_reference_conditions: ${error.message}`);
    return (data ?? []).map(this.mapBankRefCondition);
  }

  async findRegulatoryRules(
    jurisdictionIds: string[],
    rubricCode: string,
    referenceDate: Date,
  ): Promise<RegulatoryRule[]> {
    if (jurisdictionIds.length === 0) return [];

    const dateStr = referenceDate.toISOString().slice(0, 10);

    const { data, error } = await this.supabase
      .schema('atlasbanx')
      .from('regulatory_rules')
      .select('*')
      .in('jurisdiction_id', jurisdictionIds)
      .eq('rubric_code', rubricCode)
      .is('superseded_by', null)
      .lte('valid_from', dateStr);

    if (error) throw new Error(`Erreur requête regulatory_rules: ${error.message}`);

    return (data ?? [])
      .filter((r: any) => !r.valid_to || r.valid_to >= dateStr)
      .map(this.mapRegulatoryRule);
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private async loadOrganization(id: string): Promise<CdcOrganization> {
    const { data, error } = await this.supabase
      .schema('atlasbanx')
      .from('cdc_organizations')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw new Error(`Organisation introuvable: ${id}`);
    return this.mapOrganization(data);
  }

  private async loadAncestors(org: CdcOrganization): Promise<CdcOrganization[]> {
    const ancestors: CdcOrganization[] = [];
    let current = org;

    while (current.parentId) {
      const parent = await this.loadOrganization(current.parentId);
      ancestors.unshift(parent); // root first
      current = parent;
    }

    return ancestors;
  }

  private async loadJurisdictions(ids: string[]): Promise<RegulatoryJurisdiction[]> {
    if (ids.length === 0) return [];

    const { data, error } = await this.supabase
      .schema('atlasbanx')
      .from('regulatory_jurisdictions')
      .select('*')
      .in('id', ids);

    if (error) throw new Error(`Erreur requête jurisdictions: ${error.message}`);
    return (data ?? []).map(this.mapJurisdiction);
  }

  // ==========================================================================
  // Row mappers
  // ==========================================================================

  private mapAccount(row: any): CdcBankAccount {
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
}
