// ============================================================================
// formatComplaintLetter — assemble le texte de la lettre de réclamation
// ============================================================================
// Spec onglets 2-5 §3.5 : lettre formelle adressée à la banque, basée sur
// les anomalies tarifaires qualifiées/validées + référence à la convention
// signée + montant total réclamé.
//
// Pure TS, déterministe, testable indépendamment.
// ============================================================================

import type { Anomaly, AccountConvention } from '../types/statement.types';

export type ComplaintAnomalyType =
  | 'commission_excessive'
  | 'agio_errone'
  | 'frais_double'
  | 'convention_violee';

export interface ComplaintLetterInput {
  cabinet: {
    name: string;
    addressLines: string[];
  };
  bank: {
    legalName: string;
    addressLines: string[];
  };
  client: {
    legalName: string;
    accountNumber: string;
  };
  period: { start: string; end: string };
  /** Convention contractuelle de référence (date signature, articles cités). */
  convention: Pick<AccountConvention, 'id' | 'signedDate'>;
  /** Anomalies retenues — uniquement tarifaires qualifiées+. */
  anomalies: Anomaly[];
  /** Date d'émission de la lettre (par défaut: maintenant). */
  emittedOn?: Date;
  /** Signataire DG. */
  signatory: { displayName: string; title: string };
}

export interface FormattedComplaintLetter {
  /** Texte intégral prêt à imprimer. */
  text: string;
  /** Montant total réclamé en centimes. */
  totalClaimedCentimes: number;
  /** Liste détaillée des anomalies incluses. */
  items: Array<{
    anomalyId: string;
    title: string;
    chargedCentimes: number;
    expectedCentimes: number;
    excessCentimes: number;
    period: string;
  }>;
}

const ELIGIBLE_TYPES: ComplaintAnomalyType[] = [
  'commission_excessive',
  'agio_errone',
  'frais_double',
  'convention_violee',
];

/**
 * Filtre + format la lettre. Ne retient que les anomalies tarifaires
 * qualifiées+ (qualified, validated, signed, closed). Les detected ne
 * sont pas incluses (pas encore validées par un humain).
 */
export function formatComplaintLetter(input: ComplaintLetterInput): FormattedComplaintLetter {
  const eligible = input.anomalies.filter(
    (a) =>
      ELIGIBLE_TYPES.includes(a.type as ComplaintAnomalyType) &&
      ['qualified', 'validated', 'signed', 'closed'].includes(a.status),
  );

  const items = eligible.map((a) => {
    const charged = Math.abs(a.transaction.amountCentimes);
    const recovery = a.potentialRecoveryCentimes ?? 0;
    return {
      anomalyId: a.id,
      title: a.title,
      chargedCentimes: charged,
      expectedCentimes: charged - recovery,
      excessCentimes: recovery,
      period: a.transaction.date.slice(0, 7),
    };
  });

  const totalClaimedCentimes = items.reduce((s, it) => s + it.excessCentimes, 0);
  const emittedOn = input.emittedOn ?? new Date();
  const dateFr = formatFrenchDate(emittedOn);

  const lines: string[] = [];
  lines.push(input.cabinet.name);
  for (const l of input.cabinet.addressLines) lines.push(l);
  lines.push('');
  lines.push(`${input.cabinet.addressLines[0] ?? ''}, le ${dateFr}`);
  lines.push('');
  lines.push(input.bank.legalName);
  for (const l of input.bank.addressLines) lines.push(l);
  lines.push('');
  lines.push(`Objet : Réclamation tarifaire — compte n° ${input.client.accountNumber}`);
  lines.push(`Référence : convention signée le ${formatFrenchDate(new Date(input.convention.signedDate))}`);
  lines.push('');
  lines.push('Madame, Monsieur,');
  lines.push('');
  lines.push(
    `Suite à l'audit du relevé de la période du ${formatFrenchDate(new Date(input.period.start))} ` +
    `au ${formatFrenchDate(new Date(input.period.end))} effectué sur le compte de référence, ` +
    `nous avons relevé les anomalies tarifaires suivantes en violation de la convention de compte ` +
    `signée le ${formatFrenchDate(new Date(input.convention.signedDate))} :`,
  );
  lines.push('');

  items.forEach((it, i) => {
    lines.push(`${i + 1}. ${it.title}`);
    lines.push(`   Montant facturé    : ${formatFcfa(it.chargedCentimes)} FCFA`);
    lines.push(`   Plafond conventionnel : ${formatFcfa(it.expectedCentimes)} FCFA`);
    lines.push(`   Excédent à rétrocéder : ${formatFcfa(it.excessCentimes)} FCFA`);
    lines.push('');
  });

  lines.push(
    `Conformément à l'article 7.3 de notre convention, nous sollicitons la rétrocession sous ` +
    `30 jours d'un montant total de ${formatFcfa(totalClaimedCentimes)} FCFA sur le compte référencé.`,
  );
  lines.push('');
  lines.push('Nous restons à votre disposition pour tout échange complémentaire.');
  lines.push('');
  lines.push('Cordialement,');
  lines.push('');
  lines.push(input.signatory.displayName);
  lines.push(input.signatory.title);

  return {
    text: lines.join('\n'),
    totalClaimedCentimes,
    items,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function formatFcfa(centimes: number): string {
  const units = Math.round(centimes / 100);
  let s = String(Math.abs(units));
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ' ';
    out += s[i];
  }
  return out;
}

function formatFrenchDate(d: Date): string {
  const months = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
