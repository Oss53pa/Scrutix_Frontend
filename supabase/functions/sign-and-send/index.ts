// ============================================================================
// Edge Function — sign-and-send (ADVIST OAuth + RFC3161 + Atlas Mail)
// ============================================================================
// Flow :
//   1. Récupère le rapport (atlasbanx.signed_reports + generated_reports)
//   2. Si signature_type='advist' :
//      a. OAuth client_credentials sur ADVIST
//      b. Demande timestamp RFC 3161 sur le hash du PDF
//      c. Stocke le bundle de preuve (TSR + cert) dans le bucket signed-reports
//   3. Update signed_reports avec signature_type, signed_at, recipients,
//      proof_bundle_url, timestamp_rfc3161, status='sent'
//   4. Insert audit_trail (signature event, hash chaîné)
//   5. Émet l'événement atlasbanx.report.signed (Realtime broadcast)
//   6. Envoie les emails via Atlas Mail API
//
// Variables d'environnement :
//   - ADVIST_CLIENT_ID, ADVIST_CLIENT_SECRET, ADVIST_TOKEN_URL, ADVIST_TSA_URL
//   - ATLAS_MAIL_URL, ATLAS_MAIL_API_KEY  (ou SMTP — fallback console.log)
//
// Si ADVIST n'est pas configuré, on dégrade en signature simple (hash seul).
// ============================================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const ADVIST_CLIENT_ID = Deno.env.get('ADVIST_CLIENT_ID') ?? '';
const ADVIST_CLIENT_SECRET = Deno.env.get('ADVIST_CLIENT_SECRET') ?? '';
const ADVIST_TOKEN_URL = Deno.env.get('ADVIST_TOKEN_URL') ?? '';
const ADVIST_TSA_URL = Deno.env.get('ADVIST_TSA_URL') ?? '';

// Resend — service mail Atlas Studio. La clé est déjà provisionnée côté
// Supabase Vault. Le `from` doit être un domaine vérifié sur Resend.
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const RESEND_FROM = Deno.env.get('RESEND_FROM_EMAIL') ?? 'AtlasBanx <noreply@atlasstudio.app>';
const RESEND_REPLY_TO = Deno.env.get('RESEND_REPLY_TO') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
};

interface SignRequest {
  reportId: string;
  signatureType: 'simple' | 'advist';
  recipients: Array<{ email: string; displayName: string; audience: string }>;
  message?: string;
}

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });
}

async function authUser(req: Request): Promise<{ id: string } | null> {
  const a = req.headers.get('Authorization');
  if (!a?.startsWith('Bearer ')) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: a, apikey: SUPABASE_ANON_KEY } });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.id ? { id: u.id } : null;
}

async function fetchReport(id: string): Promise<Record<string, unknown> | null> {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/signed_reports?id=eq.${id}&limit=1`,
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

async function updateReport(id: string, patch: Record<string, unknown>): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/signed_reports?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      'Content-Profile': 'atlasbanx',
    },
    body: JSON.stringify(patch),
  });
}

// ============================================================================
// ADVIST integration (RFC 3161)
// ============================================================================

async function getAdvistToken(): Promise<string | null> {
  if (!ADVIST_TOKEN_URL || !ADVIST_CLIENT_ID || !ADVIST_CLIENT_SECRET) return null;
  const r = await fetch(ADVIST_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: ADVIST_CLIENT_ID,
      client_secret: ADVIST_CLIENT_SECRET,
    }),
  });
  if (!r.ok) return null;
  const data = await r.json();
  return (data?.access_token as string) ?? null;
}

async function requestAdvistTimestamp(hashHex: string, token: string): Promise<{
  timestamp: string;
  bundleBytes: Uint8Array;
} | null> {
  if (!ADVIST_TSA_URL) return null;
  // RFC 3161 : on envoie le hash, l'autorité retourne un TimeStampToken (TSR) signé
  const r = await fetch(ADVIST_TSA_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ hash: hashHex, hash_algorithm: 'SHA-256' }),
  });
  if (!r.ok) return null;
  const data = await r.json();
  // ADVIST renvoie typiquement { timestamp: 'rfc3339', tsr_b64: '...' }
  const tsB64 = data.tsr_b64 as string;
  const bundleBytes = tsB64
    ? Uint8Array.from(atob(tsB64), (c) => c.charCodeAt(0))
    : new TextEncoder().encode(JSON.stringify(data));
  return {
    timestamp: (data.timestamp as string) ?? new Date().toISOString(),
    bundleBytes,
  };
}

async function uploadProofBundle(reportId: string, bundle: Uint8Array): Promise<string | null> {
  const path = `${reportId}/proof-${Date.now()}.tsr`;
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/signed-reports/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      'Content-Type': 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: bundle,
  });
  if (!r.ok) return null;
  const signed = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/signed-reports/${path}`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 365 }),
    },
  );
  if (!signed.ok) return null;
  const data = await signed.json();
  return data?.signedURL ? `${SUPABASE_URL}/storage/v1${data.signedURL}` : null;
}

// ============================================================================
// Resend mail provider
// ============================================================================
// Doc : https://resend.com/docs/api-reference/emails/send-email
// Le PDF est attaché en binaire (téléchargé depuis Storage signed URL).
// Une URL de vérification publique du hash est ajoutée au footer pour la
// défendabilité juridique.

interface MailContext {
  reportId: string;
  template: string;
  subject: string;
  message: string;
  pdfUrl: string;
  pdfHash: string;
  signerName?: string;
  timestampRfc3161?: string | null;
  proofBundleUrl?: string | null;
}

async function fetchPdfBase64(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    let binary = '';
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
    return btoa(binary);
  } catch (err) {
    console.warn('[sign-and-send] pdf fetch failed', err);
    return null;
  }
}

function buildEmailHtml(rec: SignRequest['recipients'][number], ctx: MailContext): string {
  const verifyUrl = `https://atlasbanx.app/verify?hash=${ctx.pdfHash}`;
  const advistBlock = ctx.timestampRfc3161
    ? `<tr><td style="padding:6px 0;color:#6e6e6e;font-size:11px;">Horodatage ADVIST RFC 3161</td><td style="padding:6px 0;font-family:monospace;font-size:11px;color:#0d1b33;">${ctx.timestampRfc3161}</td></tr>`
    : '';
  const proofBlock = ctx.proofBundleUrl
    ? `<tr><td style="padding:6px 0;color:#6e6e6e;font-size:11px;">Bundle de preuve</td><td style="padding:6px 0;font-size:11px;"><a href="${ctx.proofBundleUrl}" style="color:#d4af37;">Télécharger</a></td></tr>`
    : '';

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${escape(ctx.subject)}</title></head>
<body style="margin:0;background:#f6f6f4;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f4;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr><td style="background:#0d1b33;padding:18px 24px;">
          <div style="color:#d4af37;font-weight:bold;font-size:18px;letter-spacing:1.5px;">ATLASBANX</div>
          <div style="color:#ffffff;font-size:13px;margin-top:4px;">${escape(ctx.subject)}</div>
        </td></tr>
        <tr><td style="padding:24px;">
          <p style="font-size:14px;margin:0 0 8px 0;">Bonjour ${escape(rec.displayName)},</p>
          <p style="font-size:14px;line-height:1.55;color:#3a3a3a;white-space:pre-wrap;margin:0 0 18px 0;">${escape(ctx.message)}</p>

          <a href="${ctx.pdfUrl}" style="display:inline-block;padding:10px 18px;background:#d4af37;color:#1a1a1a;text-decoration:none;border-radius:6px;font-weight:600;font-size:13px;">Consulter le rapport (PDF)</a>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-top:1px solid #e7e6e2;padding-top:14px;">
            <tr><td style="padding:6px 0;color:#6e6e6e;font-size:11px;">Hash SHA-256 du document</td><td style="padding:6px 0;font-family:monospace;font-size:11px;color:#0d1b33;word-break:break-all;">${ctx.pdfHash.slice(0, 16)}…${ctx.pdfHash.slice(-4)}</td></tr>
            ${advistBlock}${proofBlock}
            <tr><td style="padding:6px 0;color:#6e6e6e;font-size:11px;">Vérification publique</td><td style="padding:6px 0;font-size:11px;"><a href="${verifyUrl}" style="color:#d4af37;">${escape(verifyUrl)}</a></td></tr>
          </table>
        </td></tr>
        <tr><td style="background:#f6f6f4;padding:14px 24px;border-top:1px solid #e7e6e2;">
          <p style="margin:0;font-size:11px;color:#6e6e6e;">Atlas Studio — AtlasBanx · audit de relevés bancaires UEMOA / CEMAC<br>Conservation OHADA 10 ans · CGU et politique de confidentialité disponibles sur demande.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function sendMails(
  recipients: SignRequest['recipients'],
  ctx: MailContext,
): Promise<{ sent: number; failed: number; errors: string[] }> {
  if (!RESEND_API_KEY) {
    console.log('[sign-and-send] RESEND_API_KEY missing — skipping');
    return { sent: 0, failed: recipients.length, errors: ['RESEND_API_KEY not configured'] };
  }

  // Télécharge le PDF UNE fois pour l'attacher à tous les emails
  const pdfBase64 = await fetchPdfBase64(ctx.pdfUrl);

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const rec of recipients) {
    try {
      const body: Record<string, unknown> = {
        from: RESEND_FROM,
        to: [rec.email],
        subject: ctx.subject,
        html: buildEmailHtml(rec, ctx),
      };
      if (RESEND_REPLY_TO) body.reply_to = RESEND_REPLY_TO;
      if (pdfBase64) {
        body.attachments = [{
          filename: `rapport-${ctx.reportId.slice(0, 8)}.pdf`,
          content: pdfBase64,
        }];
      }

      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        sent++;
      } else {
        failed++;
        const txt = await r.text();
        errors.push(`${rec.email}: ${r.status} ${txt.slice(0, 200)}`);
      }
    } catch (err) {
      failed++;
      errors.push(`${rec.email}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  return { sent, failed, errors };
}

// ============================================================================
// Audit trail
// ============================================================================

async function appendAudit(args: {
  reportId: string;
  userId: string;
  action: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  // Récupère prev hash
  const prevR = await fetch(
    `${SUPABASE_URL}/rest/v1/audit_trail?resource_id=eq.${args.reportId}&resource_type=eq.report&order=created_at.desc&limit=1`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        'Accept-Profile': 'atlasbanx',
      },
    },
  );
  const prev = prevR.ok ? (await prevR.json())[0] : null;
  const prevHash = prev?.integrity_hash ?? null;

  const canon = JSON.stringify({
    eventType: 'report.' + args.action,
    resourceId: args.reportId,
    userId: args.userId,
    payload: args.payload,
    prev: prevHash,
  });
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canon));
  let hash = '';
  const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i++) hash += b[i].toString(16).padStart(2, '0');

  await fetch(`${SUPABASE_URL}/rest/v1/audit_trail`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      'Content-Profile': 'atlasbanx',
    },
    body: JSON.stringify({
      event_id: crypto.randomUUID(),
      user_id: args.userId,
      event_type: 'report.' + args.action,
      resource_type: 'report',
      resource_id: args.reportId,
      action: args.action,
      payload: args.payload,
      integrity_hash: hash,
      previous_hash: prevHash,
    }),
  });
}

// ============================================================================
// Handler
// ============================================================================

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const user = await authUser(req);
  if (!user) return json({ error: 'unauthorized' }, 401);

  const body: SignRequest = await req.json().catch(() => null) as SignRequest;
  if (!body?.reportId || !body?.signatureType) {
    return json({ error: 'reportId + signatureType required' }, 400);
  }

  const report = await fetchReport(body.reportId);
  if (!report) return json({ error: 'report not found' }, 404);

  let proofBundleUrl: string | null = null;
  let timestampRfc3161: string | null = null;
  const advistConfigured = Boolean(ADVIST_TOKEN_URL && ADVIST_TSA_URL);

  if (body.signatureType === 'advist' && advistConfigured) {
    try {
      const token = await getAdvistToken();
      if (token) {
        const ts = await requestAdvistTimestamp(report.hash as string, token);
        if (ts) {
          timestampRfc3161 = ts.timestamp;
          proofBundleUrl = await uploadProofBundle(body.reportId, ts.bundleBytes);
        }
      }
    } catch (err) {
      console.warn('[sign-and-send] ADVIST flow failed', err);
    }
  }

  // Update signed_reports
  await updateReport(body.reportId, {
    signer_id: user.id,
    signature_type: body.signatureType,
    proof_bundle_url: proofBundleUrl,
    timestamp_rfc3161: timestampRfc3161,
    recipients: body.recipients,
    signed_at: new Date().toISOString(),
    status: 'sent',
  });

  // Audit
  await appendAudit({
    reportId: body.reportId,
    userId: user.id,
    action: 'signed',
    payload: {
      signature_type: body.signatureType,
      recipients_count: body.recipients.length,
      advist_used: advistConfigured && body.signatureType === 'advist',
    },
  });

  // Send mails via Resend (best-effort)
  const subject = `Rapport AtlasBanx signé — ${report.template}`;
  const mailResult = await sendMails(body.recipients, {
    reportId: body.reportId,
    template: report.template as string,
    subject,
    message: body.message ?? '',
    pdfUrl: report.document_url as string,
    pdfHash: report.hash as string,
    timestampRfc3161,
    proofBundleUrl,
  });

  // Realtime event
  await fetch(`${SUPABASE_URL}/rest/v1/atlasbanx_events`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'atlasbanx.report.signed',
      occurred_at: new Date().toISOString(),
      payload: {
        reportId: body.reportId,
        signedBy: user.id,
        signatureType: body.signatureType,
        proofBundleUrl,
        timestampRfc3161,
      },
    }),
  }).catch(() => {});

  return json({
    reportId: body.reportId,
    signatureType: body.signatureType,
    signedAt: new Date().toISOString(),
    timestampRfc3161,
    proofBundleUrl,
    advistUsed: advistConfigured && body.signatureType === 'advist',
    mails: {
      sent: mailResult.sent,
      failed: mailResult.failed,
      errors: mailResult.errors,
      provider: 'resend',
    },
    status: 'sent',
  });
}

Deno.serve(handle);
