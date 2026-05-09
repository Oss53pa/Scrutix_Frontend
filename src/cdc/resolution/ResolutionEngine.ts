// ============================================================================
// CDC — Moteur de résolution 5 couches
// Cascade descendante L5 → L4 → L3 → L2, vérification L1
// ============================================================================

import type {
  ResolutionRequest,
  ResolutionResult,
  RegulatoryViolation,
  SupersededLayer,
  AccountContext,
  ConditionDimensions,
  ConditionFormula,
  AgreementCondition,
  BankReferenceCondition,
  RegulatoryRule,
  Agreement,
  BankReferenceVersion,
  ResolutionMode,
} from '../types';
import { ReceiptSigner, createDevSigner } from './ReceiptSigner';

// ============================================================================
// Data access interface (injectable for testing / Supabase swap)
// ============================================================================

export interface CdcDataAccess {
  getAccountContext(accountId: string): Promise<AccountContext>;

  findAgreements(
    orgId: string,
    bankId: string,
    accountId: string | null,
    layer: number,
    referenceDate: Date,
  ): Promise<Agreement[]>;

  findAgreementConditions(
    agreementId: string,
    rubricCode: string,
  ): Promise<AgreementCondition[]>;

  findBankReferenceVersion(
    bankId: string,
    referenceDate: Date,
  ): Promise<BankReferenceVersion | null>;

  findBankReferenceConditions(
    versionId: string,
    rubricCode: string,
  ): Promise<BankReferenceCondition[]>;

  findRegulatoryRules(
    jurisdictionIds: string[],
    rubricCode: string,
    referenceDate: Date,
  ): Promise<RegulatoryRule[]>;
}

// ============================================================================
// Resolution cache (in-memory, scoped to a single audit job)
// ============================================================================

type CacheKey = string;

function buildCacheKey(req: ResolutionRequest): CacheKey {
  const dimHash = req.dimensions
    ? JSON.stringify(req.dimensions, (_k, v) =>
        typeof v === 'bigint' ? v.toString() : v
      )
    : '';
  const mode = req.mode ?? 'strict';
  return `${req.accountId}|${req.rubricCode}|${req.referenceDate.toISOString().slice(0, 10)}|${mode}|${dimHash}`;
}

// ============================================================================
// Dimension matching
// ============================================================================

function dimensionsMatch(
  condDims: ConditionDimensions | null,
  reqDims: ResolutionRequest['dimensions'],
): boolean {
  if (!condDims) return true; // catch-all condition
  if (!reqDims) return false; // condition has dimensions but request doesn't → no match

  for (const [key, constraint] of Object.entries(condDims)) {
    if (constraint === undefined || constraint === null) continue;

    if (key === 'montant' && typeof constraint === 'object' && constraint !== null && 'min' in constraint) {
      const montant = reqDims.montantCentimes;
      const range = constraint as { min: number; max: number };
      if (montant !== undefined) {
        const m = Number(montant);
        if (m < range.min || m > range.max) return false;
      } else {
        return false; // dimension required but not provided
      }
      continue;
    }

    const reqValue = (reqDims as Record<string, unknown>)[key];
    if (reqValue === undefined) return false; // dimension required but not provided
    if (reqValue !== constraint) return false;
  }

  return true;
}

// ============================================================================
// ResolutionEngine
// ============================================================================

export class ResolutionEngine {
  private dao: CdcDataAccess;
  private signer: ReceiptSigner;
  private cache = new Map<CacheKey, ResolutionResult>();
  private contextCache = new Map<string, AccountContext>();

  constructor(dao: CdcDataAccess, signer?: ReceiptSigner) {
    this.dao = dao;
    // Default DEV signer if none provided (tenant-derived key).
    // Production code paths should inject a signer wired to Supabase Vault.
    this.signer = signer ?? createDevSigner('default');
  }

  clearCache(): void {
    this.cache.clear();
    this.contextCache.clear();
  }

  /** Réinitialise la chaîne d'audit (nouveau job). */
  resetChain(seedHash: string | null = null): void {
    this.signer.resetChain(seedHash);
  }

  /** Tête actuelle de la chaîne — à persister côté audit_session. */
  currentChainHead(): string | null {
    return this.signer.currentHead();
  }

  async resolve(req: ResolutionRequest): Promise<ResolutionResult> {
    const cacheKey = buildCacheKey(req);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const mode: ResolutionMode = req.mode ?? 'strict';
    const ctx = await this.loadContext(req.accountId);
    const superseded: SupersededLayer[] = [];

    // === Cascade descendante L5 → L4 → L3 → L2 ===
    for (const layer of [5, 4, 3, 2] as const) {
      const hit = await this.tryLayer(layer, req, ctx, superseded);
      if (hit) {
        const violations = await this.checkL1(hit.value, req, ctx);

        // CDC §5.2 étape 4 — mode prescriptif : on plafonne à L1
        const rawValue = hit.value;
        let finalValue = hit.value;
        let capApplied = false;
        if (mode === 'prescriptif' && rawValue !== null && violations.length > 0) {
          // Apply tightest cap_max / loosest cap_min from violations
          for (const v of violations) {
            if (rawValue > v.capValue && finalValue !== null && finalValue > v.capValue) {
              finalValue = v.capValue;
              capApplied = true;
            }
          }
        }

        const partial = {
          layerUsed: layer as 1 | 2 | 3 | 4 | 5,
          sourceId: hit.sourceId,
          sourceLabel: hit.sourceLabel,
          validFrom: hit.validFrom,
          validTo: hit.validTo,
          supersededLayers: superseded,
          regulatoryViolations: violations,
          mode,
          rawValue,
          capApplied,
        };
        const signedReceipt = await this.signer.sign(partial);

        const result: ResolutionResult = {
          value: finalValue,
          formula: hit.formula,
          receipt: signedReceipt,
          resolvedAt: new Date(),
        };
        this.cache.set(cacheKey, result);
        return result;
      }
    }

    // No value resolved at any layer
    throw new ResolutionError(
      `Aucune condition résolvable pour rubrique=${req.rubricCode}, ` +
      `compte=${req.accountId}, date=${req.referenceDate.toISOString().slice(0, 10)}`,
      req,
    );
  }

  async resolveMany(requests: ResolutionRequest[]): Promise<ResolutionResult[]> {
    // CDC : chain integrity — sign sequentially, not in parallel,
    // so previousHash → receiptHash chaining is deterministic.
    const results: ResolutionResult[] = [];
    for (const r of requests) {
      results.push(await this.resolve(r));
    }
    return results;
  }

  // ==========================================================================
  // Layer resolution
  // ==========================================================================

  private async tryLayer(
    layer: 2 | 3 | 4 | 5,
    req: ResolutionRequest,
    ctx: AccountContext,
    superseded: SupersededLayer[],
  ): Promise<LayerHit | null> {
    if (layer === 5 || layer === 4 || layer === 3) {
      return this.tryAgreementLayer(layer, req, ctx, superseded);
    }
    return this.tryL2(req, ctx);
  }

  private async tryAgreementLayer(
    layer: 3 | 4 | 5,
    req: ResolutionRequest,
    ctx: AccountContext,
    superseded: SupersededLayer[],
  ): Promise<LayerHit | null> {
    // Determine which org IDs to search
    const orgIds = this.getOrgIdsForLayer(layer, ctx);

    for (const orgId of orgIds) {
      const agreements = await this.dao.findAgreements(
        orgId,
        ctx.bank.id,
        layer === 5 ? ctx.account.id : null, // L5 can be account-scoped
        layer,
        req.referenceDate,
      );

      // Sort by signed_at DESC (most recent first)
      agreements.sort(
        (a, b) => new Date(b.signedAt).getTime() - new Date(a.signedAt).getTime(),
      );

      for (const agreement of agreements) {
        const conditions = await this.dao.findAgreementConditions(
          agreement.id,
          req.rubricCode,
        );

        const match = this.findDimensionalMatch(conditions, req.dimensions);
        if (match) {
          return {
            value: match.valueNumeric,
            formula: match.valueFormula as ConditionFormula | null,
            sourceId: match.id,
            sourceLabel: `L${layer}: ${agreement.agreementLabel}`,
            validFrom: new Date(agreement.validFrom),
            validTo: agreement.validTo ? new Date(agreement.validTo) : null,
          };
        }
      }
    }

    // Layer didn't match → record as superseded
    superseded.push({
      layer,
      reason: `Aucune condition L${layer} applicable pour ${req.rubricCode}`,
    });
    return null;
  }

  private async tryL2(
    req: ResolutionRequest,
    ctx: AccountContext,
  ): Promise<LayerHit | null> {
    const version = await this.dao.findBankReferenceVersion(
      ctx.bank.id,
      req.referenceDate,
    );
    if (!version) return null;

    const conditions = await this.dao.findBankReferenceConditions(
      version.id,
      req.rubricCode,
    );

    const match = this.findDimensionalMatch(conditions, req.dimensions);
    if (!match) return null;

    return {
      value: match.valueNumeric,
      formula: match.valueFormula as ConditionFormula | null,
      sourceId: match.id,
      sourceLabel: `L2: ${version.versionLabel} (${ctx.bank.code})`,
      validFrom: new Date(version.effectiveFrom),
      validTo: version.effectiveTo ? new Date(version.effectiveTo) : null,
    };
  }

  // ==========================================================================
  // L1 verification (never overrides — only flags violations)
  // ==========================================================================

  private async checkL1(
    resolvedValue: number | null,
    req: ResolutionRequest,
    ctx: AccountContext,
  ): Promise<RegulatoryViolation[]> {
    if (resolvedValue === null) return [];

    const jurisdictionIds = ctx.jurisdictions.map((j) => j.id);
    const rules = await this.dao.findRegulatoryRules(
      jurisdictionIds,
      req.rubricCode,
      req.referenceDate,
    );

    const violations: RegulatoryViolation[] = [];
    for (const rule of rules) {
      if (rule.ruleType === 'cap_max' && rule.valueNumeric !== null) {
        if (resolvedValue > rule.valueNumeric) {
          violations.push({
            ruleId: rule.id,
            code: 'E02',
            message: `Valeur résolue (${resolvedValue}) dépasse le plafond réglementaire (${rule.valueNumeric} ${rule.unit})`,
            capValue: rule.valueNumeric,
            resolvedValue,
            unit: rule.unit,
          });
        }
      }
      if (rule.ruleType === 'cap_min' && rule.valueNumeric !== null) {
        if (resolvedValue < rule.valueNumeric) {
          violations.push({
            ruleId: rule.id,
            code: 'E02',
            message: `Valeur résolue (${resolvedValue}) en dessous du plancher réglementaire (${rule.valueNumeric} ${rule.unit})`,
            capValue: rule.valueNumeric,
            resolvedValue,
            unit: rule.unit,
          });
        }
      }
    }

    return violations;
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private async loadContext(accountId: string): Promise<AccountContext> {
    const cached = this.contextCache.get(accountId);
    if (cached) return cached;

    const ctx = await this.dao.getAccountContext(accountId);
    this.contextCache.set(accountId, ctx);
    return ctx;
  }

  private getOrgIdsForLayer(
    layer: 3 | 4 | 5,
    ctx: AccountContext,
  ): string[] {
    switch (layer) {
      case 5:
      case 4:
        return [ctx.organization.id];
      case 3:
        // L3 = group level, search ancestors from nearest to root
        return ctx.ancestors.map((a) => a.id);
    }
  }

  private findDimensionalMatch(
    conditions: Array<{ dimensions: unknown; valueNumeric: number | null; valueFormula: unknown; id: string }>,
    reqDims: ResolutionRequest['dimensions'],
  ): { valueNumeric: number | null; valueFormula: unknown; id: string } | null {
    // First try dimensional matches (more specific), then catch-all
    const dimensional: typeof conditions = [];
    const catchAll: typeof conditions = [];

    for (const c of conditions) {
      if (c.dimensions && Object.keys(c.dimensions as object).length > 0) {
        dimensional.push(c);
      } else {
        catchAll.push(c);
      }
    }

    // Try dimensional first
    for (const c of dimensional) {
      if (dimensionsMatch(c.dimensions as ConditionDimensions, reqDims)) {
        return c;
      }
    }

    // Fallback to catch-all
    return catchAll[0] ?? null;
  }
}

// ============================================================================
// Internal types
// ============================================================================

interface LayerHit {
  value: number | null;
  formula: ConditionFormula | null;
  sourceId: string;
  sourceLabel: string;
  validFrom: Date;
  validTo: Date | null;
}

// ============================================================================
// Error
// ============================================================================

export class ResolutionError extends Error {
  constructor(
    message: string,
    public readonly request: ResolutionRequest,
  ) {
    super(message);
    this.name = 'ResolutionError';
  }
}
