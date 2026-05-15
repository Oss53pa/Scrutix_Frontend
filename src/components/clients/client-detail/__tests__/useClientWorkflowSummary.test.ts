// ============================================================================
// Tests — useClientWorkflowSummary helpers
// ============================================================================
// Couvre la logique métier pure (agrégation des statuts, mapping vers le
// format legacy, calcul du montant XAF). Le hook lui-même n'est pas testé via
// renderHook ici — la couverture des helpers exportés suffit pour valider la
// règle métier critique : "validated/signed/closed = économie réalisée".
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  amountXAF,
  summarizeWorkflowAnomalies,
  toLegacyAnomaly,
} from '../useClientWorkflowSummary';
import type { Anomaly as WorkflowAnomaly } from '../../../../features/statement-detail/types/statement.types';
import type { BankStatement } from '../../../../types';
import { AnomalyType, Severity } from '../../../../types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeWorkflowAnomaly(over: Partial<WorkflowAnomaly> = {}): WorkflowAnomaly {
  return {
    id: 'wf-1',
    statementId: 'stmt-1',
    type: 'commission_excessive',
    severity: 'high',
    status: 'detected',
    title: 'Commission abusive',
    description: 'Commission au-dessus du plafond conventionnel',
    transaction: {
      id: 'tx-1',
      date: '2026-03-15',
      label: 'COM MVT',
      amountCentimes: -1_500_000, // 15 000 XAF débit
    },
    detection: { algorithm: 'overcharge_v3', confidence: 0.92, rule: 'r' },
    potentialRecoveryCentimes: 600_000, // 6 000 XAF récupérables
    createdAt: '2026-03-15T10:00:00Z',
    ...over,
  };
}

// ---------------------------------------------------------------------------
// amountXAF
// ---------------------------------------------------------------------------

describe('amountXAF', () => {
  it('utilise potentialRecoveryCentimes en priorité quand renseigné', () => {
    const a = makeWorkflowAnomaly({
      potentialRecoveryCentimes: 750_000,
      transaction: { ...makeWorkflowAnomaly().transaction, amountCentimes: -5_000_000 },
    });
    expect(amountXAF(a)).toBe(7_500); // 750 000 / 100
  });

  it('retombe sur abs(transaction.amountCentimes) quand recovery est absent', () => {
    const a = makeWorkflowAnomaly({
      potentialRecoveryCentimes: undefined,
      transaction: { ...makeWorkflowAnomaly().transaction, amountCentimes: -8_760_000 },
    });
    expect(amountXAF(a)).toBe(87_600); // |8 760 000| / 100
  });

  it('retombe sur abs(transaction) si recovery vaut 0 (pas de récupération estimée)', () => {
    const a = makeWorkflowAnomaly({
      potentialRecoveryCentimes: 0,
      transaction: { ...makeWorkflowAnomaly().transaction, amountCentimes: -2_000_000 },
    });
    expect(amountXAF(a)).toBe(20_000);
  });

  it('prend la valeur absolue quand la transaction est un crédit positif', () => {
    const a = makeWorkflowAnomaly({
      potentialRecoveryCentimes: undefined,
      transaction: { ...makeWorkflowAnomaly().transaction, amountCentimes: 3_000_000 },
    });
    expect(amountXAF(a)).toBe(30_000);
  });
});

// ---------------------------------------------------------------------------
// summarizeWorkflowAnomalies
// ---------------------------------------------------------------------------

describe('summarizeWorkflowAnomalies', () => {
  it('retourne un summary vide quand aucune anomalie', () => {
    const s = summarizeWorkflowAnomalies([]);
    expect(s).toEqual({
      realizedCount: 0,
      realizedAmount: 0,
      potentialCount: 0,
      potentialAmount: 0,
      pendingCount: 0,
      realizedAnomalies: [],
    });
  });

  it('compte validated/signed/closed comme économies réalisées', () => {
    const s = summarizeWorkflowAnomalies([
      makeWorkflowAnomaly({ id: 'a1', status: 'validated', potentialRecoveryCentimes: 100_000 }),
      makeWorkflowAnomaly({ id: 'a2', status: 'signed', potentialRecoveryCentimes: 200_000 }),
      makeWorkflowAnomaly({ id: 'a3', status: 'closed', potentialRecoveryCentimes: 300_000 }),
    ]);
    expect(s.realizedCount).toBe(3);
    expect(s.realizedAmount).toBe(6_000); // (100k + 200k + 300k) / 100
    expect(s.realizedAnomalies.map((a) => a.id)).toEqual(['a1', 'a2', 'a3']);
  });

  it('compte qualified comme économie potentielle', () => {
    const s = summarizeWorkflowAnomalies([
      makeWorkflowAnomaly({ id: 'q1', status: 'qualified', potentialRecoveryCentimes: 500_000 }),
      makeWorkflowAnomaly({ id: 'q2', status: 'qualified', potentialRecoveryCentimes: 500_000 }),
    ]);
    expect(s.potentialCount).toBe(2);
    expect(s.potentialAmount).toBe(10_000);
    expect(s.realizedCount).toBe(0);
  });

  it('compte detected comme en attente (pas une économie)', () => {
    const s = summarizeWorkflowAnomalies([
      makeWorkflowAnomaly({ id: 'd1', status: 'detected' }),
      makeWorkflowAnomaly({ id: 'd2', status: 'detected' }),
    ]);
    expect(s.pendingCount).toBe(2);
    expect(s.realizedCount).toBe(0);
    expect(s.potentialCount).toBe(0);
  });

  it('ignore false_positive (ni économie, ni en attente)', () => {
    const s = summarizeWorkflowAnomalies([
      makeWorkflowAnomaly({ id: 'fp', status: 'false_positive', potentialRecoveryCentimes: 999_999 }),
    ]);
    expect(s.realizedCount).toBe(0);
    expect(s.realizedAmount).toBe(0);
    expect(s.potentialCount).toBe(0);
    expect(s.pendingCount).toBe(0);
  });

  it('mélange tous les statuts dans le bon bucket — cas réel', () => {
    const s = summarizeWorkflowAnomalies([
      makeWorkflowAnomaly({ id: '1', status: 'validated', potentialRecoveryCentimes: 6_000_000 }), // 60 000 XAF
      makeWorkflowAnomaly({ id: '2', status: 'qualified', potentialRecoveryCentimes: 1_500_000 }), // 15 000 XAF
      makeWorkflowAnomaly({ id: '3', status: 'detected' }),
      makeWorkflowAnomaly({ id: '4', status: 'detected' }),
      makeWorkflowAnomaly({ id: '5', status: 'false_positive' }),
    ]);
    expect(s.realizedCount).toBe(1);
    expect(s.realizedAmount).toBe(60_000);
    expect(s.potentialCount).toBe(1);
    expect(s.potentialAmount).toBe(15_000);
    expect(s.pendingCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// toLegacyAnomaly — adapter workflow → legacy
// ---------------------------------------------------------------------------

describe('toLegacyAnomaly', () => {
  const CLIENT_ID = 'client-pamela';

  function bankMap(entries: Array<[string, string, string?]> = []) {
    const m = new Map<string, { bankCode: string; bankName?: string }>();
    for (const [stmtId, code, name] of entries) {
      m.set(stmtId, { bankCode: code, bankName: name });
    }
    return m;
  }

  it('mappe les statuts workflow vers les statuts legacy', () => {
    const cases: Array<[WorkflowAnomaly['status'], 'pending' | 'confirmed' | 'dismissed' | 'contested']> = [
      ['detected', 'pending'],
      ['qualified', 'pending'],
      ['validated', 'confirmed'],
      ['signed', 'confirmed'],
      ['closed', 'confirmed'],
      ['false_positive', 'dismissed'],
    ];
    for (const [wf, legacy] of cases) {
      const a = toLegacyAnomaly(makeWorkflowAnomaly({ status: wf }), CLIENT_ID, bankMap());
      expect(a.status).toBe(legacy);
    }
  });

  it('mappe les types workflow vers le bon AnomalyType legacy', () => {
    const cases: Array<[WorkflowAnomaly['type'], AnomalyType]> = [
      ['commission_excessive', AnomalyType.OVERCHARGE],
      ['agio_errone', AnomalyType.INTEREST_ERROR],
      ['frais_double', AnomalyType.DUPLICATE_FEE],
      ['convention_violee', AnomalyType.COMPLIANCE_VIOLATION],
      ['date_valeur_abusive', AnomalyType.VALUE_DATE_ERROR],
      ['frais_non_justifie', AnomalyType.GHOST_FEE],
      ['lcb_ft', AnomalyType.AML_ALERT],
      ['pays_gafi_risque', AnomalyType.AML_ALERT],
      ['beneficiaire_inedit', AnomalyType.SUSPICIOUS_TRANSACTION],
      ['montant_anormal', AnomalyType.SUSPICIOUS_TRANSACTION],
      ['doublon_transaction', AnomalyType.DUPLICATE_FEE],
      ['autre', AnomalyType.FEE_ANOMALY],
    ];
    for (const [wf, legacy] of cases) {
      const a = toLegacyAnomaly(makeWorkflowAnomaly({ type: wf }), CLIENT_ID, bankMap());
      expect(a.type).toBe(legacy);
    }
  });

  it('mappe les sévérités workflow vers Severity enum', () => {
    const cases: Array<[WorkflowAnomaly['severity'], Severity]> = [
      ['low', Severity.LOW],
      ['medium', Severity.MEDIUM],
      ['high', Severity.HIGH],
      ['critical', Severity.CRITICAL],
    ];
    for (const [wf, legacy] of cases) {
      const a = toLegacyAnomaly(makeWorkflowAnomaly({ severity: wf }), CLIENT_ID, bankMap());
      expect(a.severity).toBe(legacy);
    }
  });

  it('synthétise une Transaction stub avec le bankCode du statement', () => {
    const a = toLegacyAnomaly(
      makeWorkflowAnomaly({ statementId: 'stmt-42' }),
      CLIENT_ID,
      bankMap([['stmt-42', 'NSIA-CI', 'NSIA Banque CI']]),
    );
    expect(a.transactions).toHaveLength(1);
    expect(a.transactions[0].clientId).toBe(CLIENT_ID);
    expect(a.transactions[0].bankCode).toBe('NSIA-CI');
    expect(a.transactions[0].bankName).toBe('NSIA Banque CI');
  });

  it('met bankCode vide si le statement n\'est pas trouvé (orphelin)', () => {
    const a = toLegacyAnomaly(
      makeWorkflowAnomaly({ statementId: 'unknown-stmt' }),
      CLIENT_ID,
      bankMap(),
    );
    expect(a.transactions[0].bankCode).toBe('');
  });

  it('utilise le montant XAF récupérable comme amount legacy', () => {
    const a = toLegacyAnomaly(
      makeWorkflowAnomaly({ potentialRecoveryCentimes: 6_000_000 }),
      CLIENT_ID,
      bankMap(),
    );
    expect(a.amount).toBe(60_000);
  });

  it('mappe createdAt vers detectedAt en Date', () => {
    const a = toLegacyAnomaly(
      makeWorkflowAnomaly({ createdAt: '2026-04-12T08:30:00Z' }),
      CLIENT_ID,
      bankMap(),
    );
    expect(a.detectedAt).toBeInstanceOf(Date);
    expect(a.detectedAt.toISOString()).toBe('2026-04-12T08:30:00.000Z');
  });

  it('renseigne reviewedAt depuis validatedBy quand l\'anomalie est validée', () => {
    const a = toLegacyAnomaly(
      makeWorkflowAnomaly({
        status: 'validated',
        validatedBy: { userId: 'u1', userHandle: 'pam', at: '2026-05-01T12:00:00Z' },
      }),
      CLIENT_ID,
      bankMap(),
    );
    expect(a.reviewedAt?.toISOString()).toBe('2026-05-01T12:00:00.000Z');
  });

  it('utilise description en recommendation, ou title en fallback', () => {
    const a1 = toLegacyAnomaly(
      makeWorkflowAnomaly({ description: 'Détail de la reco', title: 'Titre' }),
      CLIENT_ID,
      bankMap(),
    );
    expect(a1.recommendation).toBe('Détail de la reco');

    const a2 = toLegacyAnomaly(
      makeWorkflowAnomaly({ description: '', title: 'Titre seulement' }),
      CLIENT_ID,
      bankMap(),
    );
    expect(a2.recommendation).toBe('Titre seulement');
  });

  it('classe la transaction en DEBIT si amountCentimes < 0', () => {
    const a = toLegacyAnomaly(
      makeWorkflowAnomaly({
        transaction: { ...makeWorkflowAnomaly().transaction, amountCentimes: -1_000_000 },
      }),
      CLIENT_ID,
      bankMap(),
    );
    expect(a.transactions[0].type).toBe('DEBIT');
    expect(a.transactions[0].amount).toBe(-10_000);
  });

  it('classe la transaction en CREDIT si amountCentimes >= 0', () => {
    const a = toLegacyAnomaly(
      makeWorkflowAnomaly({
        transaction: { ...makeWorkflowAnomaly().transaction, amountCentimes: 5_000_000 },
      }),
      CLIENT_ID,
      bankMap(),
    );
    expect(a.transactions[0].type).toBe('CREDIT');
    expect(a.transactions[0].amount).toBe(50_000);
  });
});

// ---------------------------------------------------------------------------
// Régression — cas Pamela 60K (le bug d'origine)
// ---------------------------------------------------------------------------

describe('régression — bug économies non comptées (Pamela 60K)', () => {
  it('une commission validée de 60K XAF apparaît bien comme économie réalisée', () => {
    const stmts: BankStatement[] = [];
    void stmts;

    const validated = makeWorkflowAnomaly({
      id: 'pamela-comm',
      status: 'validated',
      potentialRecoveryCentimes: 6_000_000,
      validatedBy: { userId: 'u', userHandle: 'cabinet', at: '2026-05-10T10:00:00Z' },
    });

    const summary = summarizeWorkflowAnomalies([validated]);
    expect(summary.realizedCount).toBe(1);
    expect(summary.realizedAmount).toBe(60_000);

    // Et le legacy adapter doit la flagger 'confirmed' pour que l'analytics
    // legacy compte aussi 60K en totalSavings.
    const legacy = toLegacyAnomaly(
      validated,
      'client-pamela',
      new Map([['stmt-1', { bankCode: 'NSIA-CI' }]]),
    );
    expect(legacy.status).toBe('confirmed');
    expect(legacy.amount).toBe(60_000);
  });
});
