// ============================================================================
// Edge Function — generate-report (jsPDF + Supabase Storage)
// ============================================================================
// Génère un rapport PDF complet à partir des données du relevé :
//   - synthese       : 3-5 pages, synthèse + KPIs + liste anomalies
//   - valeur_probante: 12-18 pages, version juridique avec signature
//   - export         : Excel + JSON (ici on stocke un JSON; un worker peut
//                      ensuite produire l'Excel)
//
// Architecture :
//   1. Charge statement + transactions + anomalies + convention via REST
//   2. Construit le PDF côté Edge avec jsPDF (deno-compatible via npm:)
//   3. Upload dans le bucket "reports" sur Supabase Storage
//   4. Calcule SHA-256 du fichier final
//   5. Insert atlasbanx.generated_reports + atlasbanx.signed_reports (draft)
//   6. Renvoie l'ID + URL signée au client
// ============================================================================

import { jsPDF } from 'npm:jspdf@3.0.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
};

interface GenerateRequest {
  statementId: string;
  template: 'synthese' | 'valeur_probante' | 'export';
  options?: {
    includeComplaint?: boolean;
    includeSourcePdf?: boolean;
    customLogo?: boolean;
    detailLevel?: 'synthese' | 'standard' | 'exhaustif';
  };
}

interface AuthUser { id: string }

// ============================================================================
// Auth + helpers
// ============================================================================

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

async function authenticate(req: Request): Promise<AuthUser | null> {
  const a = req.headers.get('Authorization');
  if (!a?.startsWith('Bearer ')) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: a, apikey: SUPABASE_ANON_KEY },
  });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.id ? { id: u.id } : null;
}

async function fetchAtlasbanxRow(table: string, id: string): Promise<Record<string, unknown> | null> {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}&limit=1`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        'Accept-Profile': 'atlasbanx',
      },
    },
  );
  if (!r.ok) return null;
  const arr = await r.json();
  return arr?.[0] ?? null;
}

async function fetchAtlasbanxRows(table: string, query: string): Promise<Array<Record<string, unknown>>> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      'Accept-Profile': 'atlasbanx',
    },
  });
  if (!r.ok) return [];
  return await r.json();
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  let h = '';
  const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i++) h += b[i].toString(16).padStart(2, '0');
  return h;
}

function fmtFcfa(amount: number): string {
  let s = String(Math.abs(Math.round(amount)));
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ' ';
    out += s[i];
  }
  return out;
}

// ============================================================================
// PDF builder
// ============================================================================

interface BuildPdfArgs {
  template: 'synthese' | 'valeur_probante' | 'export';
  statement: Record<string, unknown>;
  client: Record<string, unknown> | null;
  account: Record<string, unknown> | null;
  anomalies: Array<Record<string, unknown>>;
  convention: Record<string, unknown> | null;
  hash?: string;
}

function buildPdf(args: BuildPdfArgs): Uint8Array {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, H = 297;
  let y = 20;

  // === Header ===
  doc.setFillColor(13, 27, 51);  // Ink Navy
  doc.rect(0, 0, W, 28, 'F');
  doc.setTextColor(212, 175, 55);  // Champagne Gold
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('ATLASBANX', 14, 12);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text(`Rapport ${args.template} · ${new Date().toLocaleDateString('fr-FR')}`, 14, 19);

  doc.setTextColor(20, 20, 20);
  y = 38;

  // === Section Identité ===
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Identité du relevé', 14, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const lines: Array<[string, string]> = [
    ['Client', String((args.client?.legal_name ?? args.client?.name) ?? '—')],
    ['Compte', String(args.account?.account_number ?? '—')],
    ['Banque', `${args.statement.bank_name ?? '—'} (${args.statement.bank_code ?? '—'})`],
    ['Période', `${args.statement.period_start} → ${args.statement.period_end}`],
    ['Transactions', String(args.statement.transaction_count ?? 0)],
    ['Statut', String(args.statement.status ?? 'imported')],
  ];
  for (const [k, v] of lines) {
    doc.setTextColor(110, 110, 110);
    doc.text(k, 14, y);
    doc.setTextColor(20, 20, 20);
    doc.text(v, 60, y);
    y += 6;
  }
  y += 4;

  // === Section Anomalies ===
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Anomalies détectées (${args.anomalies.length})`, 14, y);
  y += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  for (const a of args.anomalies) {
    if (y > H - 30) { doc.addPage(); y = 20; }
    const sev = String(a.severity ?? '?');
    const sevColor: Record<string, [number, number, number]> = {
      critical: [226, 75, 74],
      high: [216, 90, 48],
      medium: [239, 159, 39],
      low: [120, 120, 120],
    };
    const c = sevColor[sev] ?? [100, 100, 100];
    doc.setFillColor(c[0], c[1], c[2]);
    doc.circle(16, y - 1.5, 2, 'F');

    doc.setTextColor(20, 20, 20);
    doc.setFont('helvetica', 'bold');
    doc.text(String(a.title ?? a.description ?? 'Anomalie'), 22, y, { maxWidth: W - 30 });
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(String(a.description ?? ''), 22, y, { maxWidth: W - 30 });
    y += 5;

    doc.setTextColor(120, 120, 120);
    doc.setFontSize(8);
    doc.text(
      `Type: ${a.type} · Statut: ${a.status} · Confiance: ${Math.round((Number(a.confidence) ?? 0) * 100)}%`,
      22, y,
    );
    if (a.potential_recovery) {
      doc.text(
        `Récupération potentielle: ${fmtFcfa(Number(a.potential_recovery))} FCFA`,
        110, y,
      );
    }
    y += 7;
    doc.setFontSize(9);
  }
  y += 4;

  // === Convention (si valeur_probante) ===
  if (args.template === 'valeur_probante' && args.convention) {
    if (y > H - 40) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text('Convention de référence', 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Signée le : ${args.convention.signed_date}`, 14, y); y += 6;
    if (args.convention.expires_date) {
      doc.text(`Expire le : ${args.convention.expires_date}`, 14, y); y += 6;
    }
    y += 4;
  }

  // === Footer hash + horodatage ===
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `${i}/${totalPages}  ·  Atlas Studio · Confidentiel · OHADA 10 ans`,
      W / 2, H - 8, { align: 'center' },
    );
    if (args.hash) {
      doc.text(`SHA-256 ${args.hash.slice(0, 16)}…${args.hash.slice(-4)}`, W - 14, H - 8, { align: 'right' });
    }
  }

  const arr = doc.output('arraybuffer');
  return new Uint8Array(arr);
}

// ============================================================================
// Storage upload
// ============================================================================

async function uploadPdf(path: string, bytes: Uint8Array): Promise<string> {
  const url = `${SUPABASE_URL}/storage/v1/object/reports/${path}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      'Content-Type': 'application/pdf',
      'x-upsert': 'true',
    },
    body: bytes,
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Storage upload failed: ${r.status} ${txt}`);
  }
  const signed = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/reports/${path}`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 30 }), // 30 jours
    },
  );
  if (signed.ok) {
    const data = await signed.json();
    if (data?.signedURL) return `${SUPABASE_URL}/storage/v1${data.signedURL}`;
  }
  return `${SUPABASE_URL}/storage/v1/object/reports/${path}`;
}

// ============================================================================
// Persist DB rows
// ============================================================================

async function insertGeneratedReport(args: {
  statementId: string;
  clientId: string;
  template: string;
  documentUrl: string;
  hash: string;
  anomalyCount: number;
  totalAmount: number;
}): Promise<{ id: string } | null> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/generated_reports`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      'Content-Profile': 'atlasbanx',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      client_id: args.clientId,
      title: `Rapport ${args.template}`,
      type: args.template,
      format: 'pdf',
      anomaly_count: args.anomalyCount,
      total_amount: args.totalAmount,
      download_url: args.documentUrl,
      integrity_hash: args.hash,
      metadata: { statement_id: args.statementId, template: args.template },
      generated_at: new Date().toISOString(),
    }),
  });
  if (!r.ok) return null;
  const data = await r.json();
  return data?.[0] ?? null;
}

async function insertSignedReportDraft(args: {
  statementId: string;
  generatedReportId: string;
  template: string;
  documentUrl: string;
  hash: string;
}): Promise<{ id: string } | null> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/signed_reports`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      'Content-Profile': 'atlasbanx',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      statement_id: args.statementId,
      generated_report_id: args.generatedReportId,
      template: args.template,
      document_url: args.documentUrl,
      hash: args.hash,
      status: 'draft',
      recipients: [],
    }),
  });
  if (!r.ok) return null;
  const data = await r.json();
  return data?.[0] ?? null;
}

// ============================================================================
// Handler
// ============================================================================

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const user = await authenticate(req);
  if (!user) return json({ error: 'unauthorized' }, 401);

  const body: GenerateRequest = await req.json().catch(() => null) as GenerateRequest;
  if (!body?.statementId || !body?.template) {
    return json({ error: 'statementId + template required' }, 400);
  }

  // Charger les données
  const statement = await fetchAtlasbanxRow('bank_statements', body.statementId);
  if (!statement) return json({ error: 'statement not found' }, 404);

  const client = statement.client_id
    ? await fetchAtlasbanxRow('clients', statement.client_id as string)
    : null;
  const account = statement.account_id
    ? await fetchAtlasbanxRow('bank_accounts', statement.account_id as string)
    : null;
  const anomalies = await fetchAtlasbanxRows(
    'anomalies',
    `statement_id=eq.${body.statementId}&order=detected_at.desc`,
  );
  const conventions = account?.id
    ? await fetchAtlasbanxRows(
        'account_conventions',
        `account_id=eq.${account.id}&order=signed_date.desc&limit=1`,
      )
    : [];

  // Génère le PDF
  const pdfBytes = buildPdf({
    template: body.template,
    statement,
    client,
    account,
    anomalies,
    convention: conventions[0] ?? null,
  });
  const hash = await sha256Hex(pdfBytes);

  // Upload
  const path = `${body.statementId}/${body.template}-${Date.now()}.pdf`;
  let documentUrl: string;
  try {
    documentUrl = await uploadPdf(path, pdfBytes);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'upload failed' }, 500);
  }

  // Persist
  const totalRecovery = anomalies.reduce(
    (s, a) => s + (Number(a.potential_recovery) || 0), 0,
  );
  const generated = await insertGeneratedReport({
    statementId: body.statementId,
    clientId: (statement.client_id as string) ?? '',
    template: body.template,
    documentUrl,
    hash,
    anomalyCount: anomalies.length,
    totalAmount: totalRecovery,
  });
  if (!generated) return json({ error: 'persist generated_reports failed' }, 500);

  const draft = await insertSignedReportDraft({
    statementId: body.statementId,
    generatedReportId: generated.id,
    template: body.template,
    documentUrl,
    hash,
  });

  return json({
    reportId: draft?.id ?? generated.id,
    generatedReportId: generated.id,
    documentUrl,
    hash,
    template: body.template,
    anomalyCount: anomalies.length,
    sizeBytes: pdfBytes.byteLength,
    status: 'draft',
  });
}

Deno.serve(handle);
