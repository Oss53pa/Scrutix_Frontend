// ============================================================================
// PROPH3T tool · draftEmail
// ============================================================================

import type { Anomaly } from '../../statement-detail/types/statement.types';

export interface DraftEmailArgs {
  topic: 'anomaly' | 'reconciliation' | 'general';
  anomaly?: Anomaly;
  recipientName: string;
  tone?: 'formel' | 'chaleureux' | 'court';
}

export interface DraftEmailResult {
  subject: string;
  body: string;
}

export function draftEmail(args: DraftEmailArgs): DraftEmailResult {
  const tone = args.tone ?? 'formel';
  const greeting = tone === 'chaleureux'
    ? `Bonjour ${args.recipientName},`
    : `Madame, Monsieur ${args.recipientName},`;
  const closing = tone === 'chaleureux' ? 'Bien à vous,' : 'Cordialement,';

  if (args.topic === 'anomaly' && args.anomaly) {
    const a = args.anomaly;
    const subject = `Anomalie tarifaire identifiée — ${a.title}`;
    const body =
      `${greeting}\n\n` +
      `Suite à l'audit de votre dernier relevé, nous avons identifié l'anomalie suivante :\n\n` +
      `• Type : ${a.title}\n` +
      `• Description : ${a.description}\n` +
      `• Transaction concernée : ${a.transaction.label} (${a.transaction.date})\n` +
      `• Montant : ${formatFcfa(Math.abs(a.transaction.amountCentimes))} FCFA\n\n` +
      (tone === 'court'
        ? `Nous procédons aux démarches nécessaires.\n\n${closing}`
        : `Nous vous tiendrons informé(e) des suites données à cette détection. ` +
          `N'hésitez pas à revenir vers nous pour tout complément d'information.\n\n${closing}`);
    return { subject, body };
  }

  return {
    subject: 'Audit de votre relevé bancaire',
    body: `${greeting}\n\nVeuillez trouver ci-après l'analyse synthétique de votre relevé.\n\n${closing}`,
  };
}

function formatFcfa(centimes: number): string {
  const u = Math.round(centimes / 100);
  let out = '', s = String(Math.abs(u));
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ' ';
    out += s[i];
  }
  return out;
}
