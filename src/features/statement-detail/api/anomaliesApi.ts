// ============================================================================
// anomaliesApi — Supabase data access pour les anomalies + workflow + audit
// ============================================================================
// Schéma cible :
//   atlasbanx.anomalies            (avec colonnes workflow ajoutées migration 023)
//   atlasbanx.anomaly_comments
//   atlasbanx.audit_trail           (hash chain immuable, déjà en prod)
// ============================================================================

import { getSupabaseClient } from '../../../lib/supabase';
import type { Anomaly, AnomalyComment, AuditEntry, DialogKind } from '../types/statement.types';

// ============================================================================
// Loaders
// ============================================================================

export async function loadAnomalies(statementId: string): Promise<Anomaly[]> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Supabase non configuré');

  const { data, error } = await sb
    .schema('atlasbanx' as never)
    .from('anomalies' as never)
    .select('*')
    .eq('statement_id', statementId)
    .order('detected_at', { ascending: false });
  if (error) throw new Error(`Erreur anomalies: ${error.message}`);
  return (data ?? []).map(mapAnomalyRow);
}

export async function loadAnomalyComments(anomalyIds: string[]): Promise<AnomalyComment[]> {
  if (anomalyIds.length === 0) return [];
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Supabase non configuré');

  const { data, error } = await sb
    .schema('atlasbanx' as never)
    .from('anomaly_comments' as never)
    .select('*')
    .in('anomaly_id', anomalyIds)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Erreur comments: ${error.message}`);
  return (data ?? []).map(mapCommentRow);
}

export async function loadAuditTrail(entityIds: string[]): Promise<AuditEntry[]> {
  if (entityIds.length === 0) return [];
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Supabase non configuré');

  const { data, error } = await sb
    .schema('atlasbanx' as never)
    .from('audit_trail' as never)
    .select('*')
    .in('resource_id', entityIds)
    .eq('resource_type', 'anomaly')
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Erreur audit: ${error.message}`);
  return (data ?? []).map(mapAuditRow);
}

// ============================================================================
// Mutations
// ============================================================================

interface ActorRef {
  userId: string;
  userHandle: string;
}

/**
 * Applique la transition de statut + persiste la trace audit.
 * NOTE : la persistance en base de l'audit_trail nécessite normalement le hash
 * chaîné côté serveur (Edge Function). En attendant, on insère sans hash strict
 * — le trigger anti-mutation interdit déjà UPDATE/DELETE.
 */
export async function performTransition(
  kind: DialogKind,
  anomalyId: string,
  actor: ActorRef,
  comment: string,
): Promise<{ status: string; entry: AuditEntry }> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Supabase non configuré');

  // Charger l'anomalie courante pour connaître le statut précédent
  const { data: current, error: errLoad } = await sb
    .schema('atlasbanx' as never)
    .from('anomalies' as never)
    .select('id, status, severity, statement_id')
    .eq('id', anomalyId)
    .single();
  if (errLoad || !current) throw new Error('Anomalie introuvable');
  const oldStatus = (current as { status: string }).status;

  // Calcul des patches selon le kind
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };
  let newStatus = oldStatus;
  switch (kind) {
    case 'qualifyDialog':
      newStatus = 'qualified';
      patch.status = 'qualified';
      patch.qualified_by = actor.userId;
      patch.qualified_at = now;
      break;
    case 'validateDialog':
      newStatus = 'validated';
      patch.status = 'validated';
      patch.validated_by = actor.userId;
      patch.validated_at = now;
      break;
    case 'signDialog':
      newStatus = 'signed';
      patch.status = 'signed';
      patch.signed_by = actor.userId;
      patch.signed_at = now;
      break;
    case 'closeDialog':
      newStatus = 'closed';
      patch.status = 'closed';
      patch.closed_by = actor.userId;
      patch.closed_at = now;
      patch.closed_reason = comment || null;
      break;
    case 'falsePositiveDialog':
      newStatus = 'false_positive';
      patch.status = 'false_positive';
      patch.decided_at = now;
      patch.notes = comment || null;
      break;
    case 'rejectDialog':
      // renvoie au statut précédent
      if (oldStatus === 'qualified') {
        newStatus = 'detected';
        patch.status = 'detected';
        patch.qualified_by = null;
        patch.qualified_at = null;
      } else if (oldStatus === 'validated') {
        newStatus = 'qualified';
        patch.status = 'qualified';
        patch.validated_by = null;
        patch.validated_at = null;
      }
      break;
  }

  const { error: errUp } = await sb
    .schema('atlasbanx' as never)
    .from('anomalies' as never)
    .update(patch)
    .eq('id', anomalyId);
  if (errUp) throw new Error(`Update anomalie: ${errUp.message}`);

  // Insertion audit_trail
  const auditEntry = await persistAudit({
    eventType: 'anomaly.transition',
    resourceType: 'anomaly',
    resourceId: anomalyId,
    action: actionFromKind(kind),
    actorUserId: actor.userId,
    payload: { old_status: oldStatus, new_status: newStatus, comment },
  });

  return { status: newStatus, entry: auditEntry };
}

export async function addComment(
  anomalyId: string,
  authorId: string,
  content: string,
  mentions: string[],
): Promise<AnomalyComment> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Supabase non configuré');

  const { data, error } = await sb
    .schema('atlasbanx' as never)
    .from('anomaly_comments' as never)
    .insert({
      anomaly_id: anomalyId,
      author_id: authorId,
      content,
      mentions,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(`Insert comment: ${error?.message}`);

  await persistAudit({
    eventType: 'anomaly.commented',
    resourceType: 'anomaly',
    resourceId: anomalyId,
    action: 'commented',
    actorUserId: authorId,
    payload: { content_preview: content.slice(0, 200), mentions },
  });

  return mapCommentRow(data);
}

// ============================================================================
// Audit helper — fait son mieux pour calculer un hash chainé localement
// (l'Edge Function de signature serveur reste à câbler en prod)
// ============================================================================

interface PersistAuditArgs {
  eventType: string;
  resourceType: string;
  resourceId: string;
  action: string;
  actorUserId: string;
  payload: Record<string, unknown>;
}

async function persistAudit(args: PersistAuditArgs): Promise<AuditEntry> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Supabase non configuré');

  // Récupère le previous_hash (dernière entrée pour la même ressource)
  const { data: last } = await sb
    .schema('atlasbanx' as never)
    .from('audit_trail' as never)
    .select('integrity_hash')
    .eq('resource_id', args.resourceId)
    .eq('resource_type', args.resourceType)
    .order('created_at', { ascending: false })
    .limit(1);
  const prevHash = ((last?.[0] as { integrity_hash?: string } | undefined)?.integrity_hash) ?? null;

  // Hash local (best-effort) — en prod câbler Edge Function HMAC server-side
  const payload = JSON.stringify({
    eventType: args.eventType,
    resourceId: args.resourceId,
    action: args.action,
    actorUserId: args.actorUserId,
    prev: prevHash,
    payload: args.payload,
  });
  const hash = await sha256Hex(payload);
  const eventId = crypto.randomUUID();

  const { data, error } = await sb
    .schema('atlasbanx' as never)
    .from('audit_trail' as never)
    .insert({
      event_id: eventId,
      user_id: args.actorUserId,
      event_type: args.eventType,
      resource_type: args.resourceType,
      resource_id: args.resourceId,
      action: args.action,
      payload: args.payload,
      integrity_hash: hash,
      previous_hash: prevHash,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(`Insert audit: ${error?.message}`);

  return mapAuditRow(data);
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  let h = '';
  const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i++) h += b[i].toString(16).padStart(2, '0');
  return h;
}

// ============================================================================
// Mappers
// ============================================================================

function mapAnomalyRow(row: unknown): Anomaly {
  const r = row as Record<string, unknown>;
  const txData = (r.transactions as Array<Record<string, unknown>> | null) ?? [];
  const firstTx = txData[0] ?? {};
  const reasoning = (r.reasoning as Record<string, unknown>) ?? {};
  const meta = (r.metadata as Record<string, unknown>) ?? {};

  return {
    id: r.id as string,
    statementId: (r.statement_id as string) ?? '',
    type: ((r.type as string) ?? 'autre') as Anomaly['type'],
    severity: ((r.severity as string) ?? 'medium') as Anomaly['severity'],
    status: ((r.status as string) ?? 'detected') as Anomaly['status'],
    title: (r.title as string) ?? (r.description as string) ?? 'Anomalie',
    description: (r.description as string) ?? '',
    transaction: {
      id: (firstTx.id as string) ?? (firstTx.transaction_id as string) ?? '',
      date: (firstTx.date as string) ?? '',
      label: (firstTx.label as string) ?? (firstTx.description as string) ?? '',
      amountCentimes: Math.round((Number(firstTx.amount ?? r.amount ?? 0)) * 100),
      balanceAfterCentimes:
        firstTx.balance !== undefined ? Math.round(Number(firstTx.balance) * 100) : undefined,
      pdfPage: (firstTx.pdf_page as number | undefined) ?? (meta.pdf_page as number | undefined),
    },
    detection: {
      algorithm: (reasoning.algorithm as string) ?? (meta.algorithm as string) ?? 'unknown',
      confidence: Number(r.confidence ?? 0),
      rule: (reasoning.rule as string) ?? (reasoning.explanation as string) ?? '',
    },
    conventionId: ((r.convention_id as string | null) ?? null) as string | null,
    conventionLabel: (meta.convention_label as string) ?? null,
    // Preuve tarifaire : si l'algorithme a confronté convention vs facturé,
    // elle est sérialisée dans metadata.convention_evidence (jsonb).
    conventionEvidence: (() => {
      const ev = meta.convention_evidence as Record<string, unknown> | undefined;
      if (!ev || typeof ev !== 'object') return null;
      const convention = Number(ev.convention_amount ?? ev.conventionAmount ?? 0);
      const actual = Number(ev.actual_amount ?? ev.actualAmount ?? 0);
      return {
        tierAppliedLabel: (ev.tier_label as string) ?? (ev.tierAppliedLabel as string) ?? 'Tarif non précisé',
        tierAppliedKey:   (ev.tier_key as string) ?? (ev.tierAppliedKey as string) ?? undefined,
        conventionAmount: convention,
        actualAmount:     actual,
        excessAmount:     Number(ev.excess_amount ?? ev.excessAmount ?? Math.max(0, actual - convention)),
        conventionDocId:  (ev.convention_doc_id as string | null) ?? (ev.conventionDocId as string | null) ?? null,
        note:             (ev.note as string) ?? undefined,
      };
    })(),
    qualifiedBy: r.qualified_by ? {
      userId: r.qualified_by as string,
      userHandle: (meta.qualified_by_handle as string) ?? (r.qualified_by as string).slice(0, 6),
      at: r.qualified_at as string,
    } : null,
    validatedBy: r.validated_by ? {
      userId: r.validated_by as string,
      userHandle: (meta.validated_by_handle as string) ?? (r.validated_by as string).slice(0, 6),
      at: r.validated_at as string,
    } : null,
    signedBy: r.signed_by ? {
      userId: r.signed_by as string,
      userHandle: (meta.signed_by_handle as string) ?? (r.signed_by as string).slice(0, 6),
      at: r.signed_at as string,
    } : null,
    closedBy: r.closed_by ? {
      userId: r.closed_by as string,
      userHandle: (meta.closed_by_handle as string) ?? (r.closed_by as string).slice(0, 6),
      at: r.closed_at as string,
      reason: (r.closed_reason as string) ?? undefined,
    } : null,
    assignedTo: (r.assigned_to as string | null) ?? null,
    potentialRecoveryCentimes:
      r.potential_recovery !== null && r.potential_recovery !== undefined
        ? Math.round(Number(r.potential_recovery) * 100)
        : undefined,
    createdAt: (r.created_at as string) ?? new Date().toISOString(),
  };
}

function mapCommentRow(row: unknown): AnomalyComment {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    anomalyId: r.anomaly_id as string,
    author: {
      userId: r.author_id as string,
      handle: (r.author_id as string).slice(0, 8),
      role: 'junior',
    },
    content: r.content as string,
    mentions: (r.mentions as string[]) ?? [],
    createdAt: r.created_at as string,
  };
}

function mapAuditRow(row: unknown): AuditEntry {
  const r = row as Record<string, unknown>;
  const action = (r.action as string) ?? 'created';
  return {
    id: r.id as string,
    entityType: (r.resource_type as AuditEntry['entityType']) ?? 'anomaly',
    entityId: (r.resource_id as string) ?? '',
    action: action as AuditEntry['action'],
    actor: {
      userId: (r.user_id as string) ?? 'system',
      handle: ((r.user_id as string) ?? 'system').slice(0, 8),
      role: 'junior',
    },
    payload: ((r.payload as Record<string, unknown>) ?? {}),
    hash: (r.integrity_hash as string) ?? '',
    prevHash: (r.previous_hash as string) ?? null,
    createdAt: (r.created_at as string) ?? new Date().toISOString(),
  };
}

function actionFromKind(kind: DialogKind): string {
  switch (kind) {
    case 'qualifyDialog':       return 'qualified';
    case 'validateDialog':      return 'validated';
    case 'signDialog':          return 'signed';
    case 'closeDialog':         return 'closed';
    case 'falsePositiveDialog': return 'false_positive_marked';
    case 'rejectDialog':        return 'reopened';
  }
}
