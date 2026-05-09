// ============================================================================
// CDC — Orchestrateur d'audit complet
// Coordonne résolution + calculs + détection d'écarts sur un compte
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { ResolutionEngine, type CdcDataAccess } from '../resolution/ResolutionEngine';
import { AgiosCalculator, type AgiosConfig } from '../calculations/AgiosCalculator';
import { CommissionCalculator, type OperationDebitrice } from '../calculations/CommissionCalculator';
import { CpfdCalculator } from '../calculations/CpfdCalculator';
import { ValueDateAuditor, type ValueDateOperation } from '../calculations/ValueDateAuditor';
import type {
  CdcAuditSession,
  DailyPosition,
  Ecart,
  EcartCode,
  EcartScoring,
  ResolutionResult,
} from '../types';

export interface AuditInput {
  tenantId: string;
  organizationId: string;
  accountId: string;
  periodStart: Date;
  periodEnd: Date;
  // Pre-loaded data
  dailyPositions: DailyPosition[];
  operationsDebitrices: OperationDebitrice[];
  valueDateOperations: ValueDateOperation[];
  // Amounts actually charged by the bank (in centimes)
  agiosFacturesCentimes: bigint;
  commissionFactureeCentimes: bigint;
  cpfdFactureeCentimes: bigint;
}

export interface AuditOutput {
  session: CdcAuditSession;
  ecarts: Ecart[];
  resolutions: Map<string, ResolutionResult>;
}

export class CdcAuditOrchestrator {
  private resolver: ResolutionEngine;
  private agiosCalc = new AgiosCalculator();
  private commissionCalc = new CommissionCalculator();
  private cpfdCalc = new CpfdCalculator();
  private dvAuditor = new ValueDateAuditor();
  private supabase: SupabaseClient;

  constructor(dao: CdcDataAccess, supabase: SupabaseClient) {
    this.resolver = new ResolutionEngine(dao);
    this.supabase = supabase;
  }

  async runAudit(input: AuditInput): Promise<AuditOutput> {
    const ecarts: Ecart[] = [];
    const resolutions = new Map<string, ResolutionResult>();
    const refDate = input.periodStart;

    // 1. Create audit session
    const session = await this.createSession(input);

    try {
      // 2. Resolve all needed conditions
      const resolvedConditions = await this.resolveConditions(
        input.accountId,
        refDate,
      );
      resolvedConditions.forEach((val, key) => {
        resolutions.set(key, val);
      });

      // 3. Run agios audit
      const agiosEcarts = this.auditAgios(input, resolvedConditions);
      ecarts.push(...agiosEcarts);

      // 4. Run commission de mouvement audit
      const commEcarts = this.auditCommission(input, resolvedConditions);
      ecarts.push(...commEcarts);

      // 5. Run CPFD audit
      const cpfdEcarts = this.auditCpfd(input, resolvedConditions);
      ecarts.push(...cpfdEcarts);

      // 6. Run value date audit
      const dvEcarts = await this.auditValueDates(input, resolvedConditions);
      ecarts.push(...dvEcarts);

      // 7. Check for regulatory violations from resolution receipts
      resolvedConditions.forEach((resolution) => {
        for (const violation of resolution.receipt.regulatoryViolations) {
          ecarts.push(this.createEcart(
            session.id,
            violation.code as EcartCode,
            'credits.taux_usure',
            null,
            BigInt(Math.round(violation.capValue * 100)),
            BigInt(Math.round(violation.resolvedValue * 100)),
            violation.message,
            { ruleId: violation.ruleId },
          ));
        }
      });

      // 8. Update session with results
      await this.completeSession(session.id, ecarts);

      return {
        session: { ...session, status: 'completed', totalEcarts: ecarts.length },
        ecarts,
        resolutions,
      };
    } catch (error) {
      await this.failSession(session.id, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  // ==========================================================================
  // Resolution
  // ==========================================================================

  private async resolveConditions(
    accountId: string,
    refDate: Date,
  ): Promise<Map<string, ResolutionResult>> {
    const results = new Map<string, ResolutionResult>();
    const rubrics = [
      'decouverts.taux_autorise',
      'decouverts.taux_non_autorise',
      'decouverts.plafond_autorise',
      'decouverts.commission_mouvement',
      'decouverts.commission_mouvement_assiette',
      'decouverts.cpfd',
      'decouverts.cpfd_plafond',
      'decouverts.base_calcul',
      'dv.versement_especes',
      'dv.retrait_especes',
      'dv.cheque_sur_place',
      'dv.cheque_hors_place',
      'dv.virement_recu',
      'dv.virement_emis',
    ];

    for (const rubric of rubrics) {
      try {
        const result = await this.resolver.resolve({
          accountId,
          rubricCode: rubric,
          referenceDate: refDate,
        });
        results.set(rubric, result);
      } catch {
        // Missing condition is not fatal — logged in session
      }
    }

    return results;
  }

  // ==========================================================================
  // Agios audit
  // ==========================================================================

  private auditAgios(
    input: AuditInput,
    resolved: Map<string, ResolutionResult>,
  ): Ecart[] {
    const ecarts: Ecart[] = [];
    const tauxAutorise = resolved.get('decouverts.taux_autorise');
    const tauxNonAutorise = resolved.get('decouverts.taux_non_autorise');
    const plafondAutorise = resolved.get('decouverts.plafond_autorise');
    const baseCalc = resolved.get('decouverts.base_calcul');

    if (!tauxAutorise) return ecarts;

    const config: Partial<AgiosConfig> = {};
    if (baseCalc?.value) config.base = baseCalc.value === 365 ? 365 : 360;
    if (plafondAutorise?.value) {
      config.plafondAutoriseCentimes = BigInt(Math.round(plafondAutorise.value * 100));
    }

    const verification = this.agiosCalc.verifyAgios(
      input.agiosFacturesCentimes,
      input.dailyPositions,
      tauxAutorise,
      tauxNonAutorise ?? tauxAutorise,
      config,
    );

    if (verification.isOvercharge && verification.ecartCentimes > 0n) {
      const code: EcartCode = verification.ecartCentimes > 0n ? 'E01' : 'E07';
      ecarts.push(this.createEcart(
        '', // will be filled when session ID is known
        code,
        'decouverts.taux_autorise',
        null,
        verification.result.totalAgiosCentimes,
        input.agiosFacturesCentimes,
        `Agios facturés (${this.centimesToFcfa(input.agiosFacturesCentimes)}) > ` +
        `théoriques (${this.centimesToFcfa(verification.result.totalAgiosCentimes)})`,
        {
          tauxApplique: verification.result.tauxApplique,
          tauxConvenu: verification.result.tauxConvenu,
          joursDebiteurs: verification.result.nombreJoursDebiteurs,
        },
      ));
    }

    return ecarts;
  }

  // ==========================================================================
  // Commission audit
  // ==========================================================================

  private auditCommission(
    input: AuditInput,
    resolved: Map<string, ResolutionResult>,
  ): Ecart[] {
    const ecarts: Ecart[] = [];
    const tauxCM = resolved.get('decouverts.commission_mouvement');
    if (!tauxCM) return ecarts;

    const assietteCM = resolved.get('decouverts.commission_mouvement_assiette') ?? null;

    const verification = this.commissionCalc.verify(
      input.commissionFactureeCentimes,
      input.operationsDebitrices,
      tauxCM,
      assietteCM,
    );

    if (verification.isOvercharge && verification.ecartCentimes > 0n) {
      ecarts.push(this.createEcart(
        '',
        'E01',
        'decouverts.commission_mouvement',
        null,
        verification.result.totalCommissionCentimes,
        input.commissionFactureeCentimes,
        `Commission mouvement facturée (${this.centimesToFcfa(input.commissionFactureeCentimes)}) > ` +
        `théorique (${this.centimesToFcfa(verification.result.totalCommissionCentimes)})`,
        {
          assiette: verification.result.assiette,
          taux: verification.result.tauxApplique,
          opEligibles: verification.result.operationsEligibles,
        },
      ));
    }

    return ecarts;
  }

  // ==========================================================================
  // CPFD audit
  // ==========================================================================

  private auditCpfd(
    input: AuditInput,
    resolved: Map<string, ResolutionResult>,
  ): Ecart[] {
    const ecarts: Ecart[] = [];
    const tauxCpfd = resolved.get('decouverts.cpfd');
    if (!tauxCpfd) return ecarts;

    const plafondCpfd = resolved.get('decouverts.cpfd_plafond') ?? null;

    // Estimate interets debiteurs for CPFD cap check
    const interetsDebiteurs = input.agiosFacturesCentimes;

    const verification = this.cpfdCalc.verify(
      input.cpfdFactureeCentimes,
      input.dailyPositions,
      tauxCpfd,
      plafondCpfd,
      interetsDebiteurs,
    );

    if (verification.isOvercharge && verification.ecartCentimes > 0n) {
      ecarts.push(this.createEcart(
        '',
        verification.result.isViolation ? 'E02' : 'E01',
        'decouverts.cpfd',
        null,
        verification.result.cpfdCentimes,
        input.cpfdFactureeCentimes,
        `CPFD facturée (${this.centimesToFcfa(input.cpfdFactureeCentimes)}) > ` +
        `théorique (${this.centimesToFcfa(verification.result.cpfdCentimes)})` +
        (verification.result.isViolation ? ' — VIOLATION RÉGLEMENTAIRE' : ''),
        {
          plusFortDecouvert: Number(verification.result.plusFortDecouvertCentimes) / 100,
          tauxCpfd: verification.result.tauxCpfd,
          plafondReglementaire: verification.result.plafondReglementaireCentimes
            ? Number(verification.result.plafondReglementaireCentimes) / 100
            : null,
        },
      ));
    }

    return ecarts;
  }

  // ==========================================================================
  // Value date audit
  // ==========================================================================

  private async auditValueDates(
    input: AuditInput,
    resolved: Map<string, ResolutionResult>,
  ): Promise<Ecart[]> {
    const ecarts: Ecart[] = [];
    const tauxDecouvert = resolved.get('decouverts.taux_autorise')?.value ?? 12;

    // Build DV resolution map
    const dvResolutions = new Map<string, ResolutionResult>();
    resolved.forEach((val, key) => {
      if (key.startsWith('dv.')) dvResolutions.set(key, val);
    });

    const results = this.dvAuditor.auditBatch(
      input.valueDateOperations,
      dvResolutions,
      tauxDecouvert,
    );

    for (const result of results) {
      ecarts.push(this.createEcart(
        '',
        'E03',
        this.dvAuditor.getRubricCode(result.typeOperation as any),
        result.operationDate,
        result.impactCentimes,
        0n,
        `Date de valeur abusive: appliquée ${result.valueDateApplied.toISOString().slice(0, 10)} ` +
        `vs attendue ${result.valueDateExpected.toISOString().slice(0, 10)} ` +
        `(écart ${result.ecartJours}j, max autorisé ${result.ecartMaxAutorise}j)`,
        {
          operationDate: result.operationDate.toISOString().slice(0, 10),
          valueDateApplied: result.valueDateApplied.toISOString().slice(0, 10),
          valueDateExpected: result.valueDateExpected.toISOString().slice(0, 10),
        },
      ));
    }

    return ecarts;
  }

  // ==========================================================================
  // Session management
  // ==========================================================================

  private async createSession(input: AuditInput): Promise<CdcAuditSession> {
    const { data, error } = await this.supabase
      .schema('atlasbanx')
      .from('cdc_audit_sessions')
      .insert({
        tenant_id: input.tenantId,
        organization_id: input.organizationId,
        account_id: input.accountId,
        period_start: input.periodStart.toISOString().slice(0, 10),
        period_end: input.periodEnd.toISOString().slice(0, 10),
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(`Erreur création session: ${error.message}`);

    return {
      id: data.id,
      tenantId: data.tenant_id,
      organizationId: data.organization_id,
      accountId: data.account_id,
      periodStart: new Date(data.period_start),
      periodEnd: new Date(data.period_end),
      status: 'running',
      totalOperations: 0,
      totalEcarts: 0,
      totalImpactCentimes: 0n,
      ecartsByCode: {} as any,
      startedAt: new Date(),
      completedAt: null,
      startedBy: null,
      error: null,
      createdAt: new Date(),
    };
  }

  private async completeSession(sessionId: string, ecarts: Ecart[]): Promise<void> {
    const ecartsByCode: Record<string, number> = {};
    let totalImpact = 0n;

    for (const e of ecarts) {
      ecartsByCode[e.code] = (ecartsByCode[e.code] ?? 0) + 1;
      totalImpact += e.ecartCentimes >= 0n ? e.ecartCentimes : -e.ecartCentimes;
    }

    // Persist ecarts
    if (ecarts.length > 0) {
      const rows = ecarts.map((e) => ({
        audit_session_id: sessionId,
        code: e.code,
        rubric_code: e.rubricCode,
        resolution_id: e.resolutionId,
        expected_centimes: Number(e.expectedCentimes),
        actual_centimes: Number(e.actualCentimes),
        ecart_centimes: Number(e.ecartCentimes),
        materialite_centimes: Number(e.scoring.materialiteCentimes),
        confiance: e.scoring.confiance,
        recuperabilite: e.scoring.recuperabilite,
        operation_date: e.operationDate?.toISOString().slice(0, 10) ?? null,
        operation_ref: e.operationRef,
        description: e.description,
        details: e.details,
      }));

      await this.supabase
        .schema('atlasbanx')
        .from('cdc_ecarts')
        .insert(rows);
    }

    await this.supabase
      .schema('atlasbanx')
      .from('cdc_audit_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        total_ecarts: ecarts.length,
        total_impact_centimes: Number(totalImpact),
        ecarts_by_code: ecartsByCode,
      })
      .eq('id', sessionId);
  }

  private async failSession(sessionId: string, errorMsg: string): Promise<void> {
    await this.supabase
      .schema('atlasbanx')
      .from('cdc_audit_sessions')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error: errorMsg,
      })
      .eq('id', sessionId);
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private createEcart(
    sessionId: string,
    code: EcartCode,
    rubricCode: string,
    operationDate: Date | null,
    expectedCentimes: bigint,
    actualCentimes: bigint,
    description: string,
    details: Record<string, unknown>,
  ): Ecart {
    const ecartCentimes = actualCentimes - expectedCentimes;
    const absEcart = ecartCentimes >= 0n ? ecartCentimes : -ecartCentimes;

    return {
      id: crypto.randomUUID(),
      auditSessionId: sessionId,
      code,
      rubricCode,
      resolutionId: null,
      expectedCentimes,
      actualCentimes,
      ecartCentimes,
      scoring: this.scoreEcart(code, absEcart),
      operationDate,
      operationRef: null,
      description,
      details,
    };
  }

  private scoreEcart(code: EcartCode, absEcartCentimes: bigint): EcartScoring {
    // Confiance heuristics
    const confianceMap: Record<EcartCode, number> = {
      E01: 90,  // Taux excessif = high confidence
      E02: 95,  // Regulatory violation = very high
      E03: 85,  // Date valeur = high
      E04: 70,  // Assiette = moderate (needs manual check)
      E05: 95,  // Double prélèvement = very high
      E06: 60,  // Non conventionné = lower (may be legitimate)
      E07: 95,  // Erreur calcul = very high
      E08: 50,  // Transparence = low (subjective)
    };

    // Récupérabilité based on code + amount
    let recuperabilite: 'forte' | 'moyenne' | 'faible';
    if (code === 'E02' || code === 'E05' || code === 'E07') {
      recuperabilite = 'forte';
    } else if (code === 'E01' || code === 'E03') {
      recuperabilite = absEcartCentimes > 100_000n ? 'forte' : 'moyenne';
    } else {
      recuperabilite = 'faible';
    }

    return {
      materialiteCentimes: absEcartCentimes,
      confiance: confianceMap[code],
      recuperabilite,
    };
  }

  private centimesToFcfa(centimes: bigint): string {
    const n = Number(centimes);
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
    }).format(n / 100);
  }
}
