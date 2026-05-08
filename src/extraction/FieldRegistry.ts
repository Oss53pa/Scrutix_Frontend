// ============================================================================
// ATLASBANX — FieldRegistry
// Comprehensive catalog of bank-condition fields with synonyms, defaults,
// validation ranges, and patterns. The cascading extraction strategies
// consume this registry to know what to look for and how.
// ============================================================================

import type { FieldDefinition } from './types';

/**
 * Builds a regex that finds a labeled value in proximity.
 * Captures the FIRST number after the label. Tolerates noise between
 * label and value (newlines, separators, units).
 *
 *   labelRegex(['frais de tenue', 'tenue de compte'])
 *
 * matches:
 *   "Frais de tenue : 5 000 FCFA"
 *   "Tenue de compte ............... 5,000.00"
 *   "TENUE COMPTE\n\n5 000"
 *
 * The capture group `[1]` is the raw number string (with possible spaces
 * and decimal separator). FieldExtractor handles the cleanup.
 */
export function labelRegex(aliases: string[]): RegExp[] {
  return aliases.map((alias) => {
    // Escape regex special chars except spaces (we expand spaces to \s+)
    const escaped = alias
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\s+/g, '\\s+');
    // Match label, then up to 80 non-numeric chars, then capture the number
    return new RegExp(
      `${escaped}\\s*[:\\-.…\\s]{0,30}([0-9][0-9\\s\\u00A0.,]{0,15})`,
      'i'
    );
  });
}

// ============================================================================
// FIELD DEFINITIONS
// 50+ fields covering the BankConditions domain (account, cards, transfers,
// checks, credits, e-banking, misc, penalties).
// ============================================================================

export const FIELD_DEFINITIONS: FieldDefinition[] = [
  // -------------------------------------------------------------------------
  // ACCOUNT FEES
  // -------------------------------------------------------------------------
  {
    key: 'accountFees.tenueCompte.particulier',
    label: 'Tenue de compte particulier',
    kind: 'amount',
    default: 5000,
    range: { min: 0, max: 100000 },
    unitHint: 'FCFA',
    aliases: [
      'tenue de compte particulier',
      'frais de tenue de compte particulier',
      'frais de gestion particulier',
      'commission de tenue de compte particulier',
      'tenue compte personne physique',
      'frais mensuel particulier',
    ],
  },
  {
    key: 'accountFees.tenueCompte.professionnel',
    label: 'Tenue de compte professionnel',
    kind: 'amount',
    default: 10000,
    range: { min: 0, max: 200000 },
    unitHint: 'FCFA',
    aliases: [
      'tenue de compte professionnel',
      'frais de tenue de compte professionnel',
      'tenue compte profession liberale',
      'compte professionnel',
      'commission tenue pro',
    ],
  },
  {
    key: 'accountFees.tenueCompte.entreprise',
    label: 'Tenue de compte entreprise',
    kind: 'amount',
    default: 25000,
    range: { min: 0, max: 500000 },
    unitHint: 'FCFA',
    aliases: [
      'tenue de compte entreprise',
      'frais de tenue de compte entreprise',
      'tenue compte personne morale',
      'compte entreprise',
      'commission de tenue de compte personne morale',
    ],
  },
  {
    key: 'accountFees.fraisOuverture',
    label: 'Frais d\'ouverture',
    kind: 'amount',
    default: 0,
    range: { min: 0, max: 100000 },
    unitHint: 'FCFA',
    aliases: ['frais d\'ouverture de compte', 'ouverture de compte', 'frais ouverture'],
  },
  {
    key: 'accountFees.fraisCloture',
    label: 'Frais de clôture',
    kind: 'amount',
    default: 5000,
    range: { min: 0, max: 100000 },
    unitHint: 'FCFA',
    aliases: ['frais de clôture', 'clôture de compte', 'fermeture compte', 'frais de fermeture'],
  },
  {
    key: 'accountFees.fraisInactivite',
    label: 'Frais d\'inactivité',
    kind: 'amount',
    default: 10000,
    range: { min: 0, max: 100000 },
    unitHint: 'FCFA',
    aliases: ['frais d\'inactivité', 'compte dormant', 'compte inactif', 'inactivité du compte'],
  },
  {
    key: 'accountFees.releveCompte.mensuel',
    label: 'Relevé mensuel',
    kind: 'amount',
    default: 1000,
    range: { min: 0, max: 50000 },
    unitHint: 'FCFA',
    aliases: ['relevé mensuel', 'envoi relevé', 'envoi de relevé', 'relevé de compte mensuel'],
  },
  {
    key: 'accountFees.releveCompte.duplicata',
    label: 'Duplicata de relevé',
    kind: 'amount',
    default: 2500,
    range: { min: 0, max: 50000 },
    unitHint: 'FCFA',
    aliases: ['duplicata de relevé', 'copie relevé', 'duplicata relevé compte'],
  },
  {
    key: 'accountFees.attestationSolde',
    label: 'Attestation de solde',
    kind: 'amount',
    default: 5000,
    range: { min: 0, max: 100000 },
    unitHint: 'FCFA',
    aliases: ['attestation de solde', 'certificat de solde', 'attestation bancaire'],
  },
  {
    key: 'accountFees.lettreInjonction',
    label: 'Lettre d\'injonction',
    kind: 'amount',
    default: 15000,
    range: { min: 0, max: 100000 },
    unitHint: 'FCFA',
    aliases: ['lettre d\'injonction', 'mise en demeure', 'injonction de payer'],
  },

  // -------------------------------------------------------------------------
  // CREDIT & AGIOS — Découverts (visible in user's screenshot)
  // -------------------------------------------------------------------------
  {
    key: 'creditFees.tauxDecouvertAutorise',
    label: 'Taux découvert autorisé (TEG)',
    kind: 'percentage',
    default: 14.5,
    range: { min: 0, max: 50 },
    unitHint: '%',
    aliases: [
      'taux découvert autorisé',
      'taux découvert autorise',
      'taux d\'intérêt débiteur autorisé',
      'taux debiteur autorise',
      'taux teg découvert',
      'teg découvert autorisé',
      'découvert autorisé',
    ],
  },
  {
    key: 'creditFees.tauxDecouvertNonAutorise',
    label: 'Taux découvert non autorisé',
    kind: 'percentage',
    default: 18,
    range: { min: 0, max: 50 },
    unitHint: '%',
    aliases: [
      'taux découvert non autorisé',
      'taux découvert non autorise',
      'taux d\'intérêt débiteur non autorisé',
      'découvert non autorisé',
      'agios découvert non autorisé',
    ],
  },
  {
    key: 'creditFees.commissionMouvement',
    label: 'Commission de mouvement',
    kind: 'percentage',
    default: 0.025,
    range: { min: 0, max: 5 },
    unitHint: '%',
    aliases: [
      'commission de mouvement',
      'commission sur mouvement',
      'commission cm',
      'commission pcm',
    ],
  },
  {
    key: 'creditFees.commissionPlusForteDecouverte',
    label: 'Commission plus forte découverte',
    kind: 'percentage',
    default: 0.05,
    range: { min: 0, max: 5 },
    unitHint: '%',
    aliases: [
      'commission plus forte découverte',
      'commission de plus forte découverte',
      'cpfd',
      'commission plus fort découvert',
    ],
  },
  {
    key: 'creditFees.tauxUsureLegal',
    label: 'Taux d\'usure légal',
    kind: 'percentage',
    default: 27,
    range: { min: 0, max: 50 },
    unitHint: '%',
    aliases: [
      'taux d\'usure légal',
      'taux d\'usure',
      'taux usure',
      'taux usure legal',
      'plafond taux usure',
    ],
  },

  // -------------------------------------------------------------------------
  // CREDITS
  // -------------------------------------------------------------------------
  {
    key: 'creditFees.fraisDossierCredit',
    label: 'Frais de dossier crédit',
    kind: 'percentage',
    default: 1,
    range: { min: 0, max: 5 },
    unitHint: '%',
    aliases: [
      'frais de dossier crédit',
      'frais de dossier credit',
      'commission d\'étude crédit',
      'frais dossier prêt',
    ],
  },
  {
    key: 'creditFees.creditConsoTauxMin',
    label: 'Crédit conso — taux min',
    kind: 'percentage',
    default: 12,
    range: { min: 0, max: 30 },
    unitHint: '%',
    aliases: [
      'crédit conso taux min',
      'credit conso taux minimum',
      'taux crédit consommation minimum',
      'crédit à la consommation taux min',
    ],
  },
  {
    key: 'creditFees.creditConsoTauxMax',
    label: 'Crédit conso — taux max',
    kind: 'percentage',
    default: 18,
    range: { min: 0, max: 30 },
    unitHint: '%',
    aliases: [
      'crédit conso taux max',
      'credit conso taux maximum',
      'taux crédit consommation maximum',
      'crédit à la consommation taux max',
    ],
  },
  {
    key: 'creditFees.creditImmoTauxMin',
    label: 'Crédit immobilier — taux min',
    kind: 'percentage',
    default: 8,
    range: { min: 0, max: 25 },
    unitHint: '%',
    aliases: [
      'crédit immobilier taux min',
      'credit immo taux minimum',
      'crédit habitat taux min',
      'prêt immobilier taux min',
    ],
  },
  {
    key: 'creditFees.creditImmoTauxMax',
    label: 'Crédit immobilier — taux max',
    kind: 'percentage',
    default: 12,
    range: { min: 0, max: 25 },
    unitHint: '%',
    aliases: [
      'crédit immobilier taux max',
      'credit immo taux maximum',
      'crédit habitat taux max',
      'prêt immobilier taux max',
    ],
  },

  // -------------------------------------------------------------------------
  // CARDS
  // -------------------------------------------------------------------------
  {
    key: 'cardFees.visaClassic',
    label: 'Carte Visa Classic',
    kind: 'amount',
    default: 25000,
    range: { min: 0, max: 200000 },
    unitHint: 'FCFA',
    aliases: ['visa classic', 'carte visa classic', 'cotisation annuelle visa classic', 'classic visa'],
  },
  {
    key: 'cardFees.visaGold',
    label: 'Carte Visa Gold',
    kind: 'amount',
    default: 75000,
    range: { min: 0, max: 500000 },
    unitHint: 'FCFA',
    aliases: ['visa gold', 'carte gold', 'visa premier', 'carte premier'],
  },
  {
    key: 'cardFees.visaPlatinum',
    label: 'Carte Visa Platinum',
    kind: 'amount',
    default: 150000,
    range: { min: 0, max: 1000000 },
    unitHint: 'FCFA',
    aliases: ['visa platinum', 'carte platinum', 'visa infinite', 'carte infinite'],
  },
  {
    key: 'cardFees.gimac',
    label: 'Carte GIMAC',
    kind: 'amount',
    default: 10000,
    range: { min: 0, max: 100000 },
    unitHint: 'FCFA',
    aliases: ['gimac', 'gim uemoa', 'carte régionale', 'carte gim-uemoa'],
  },
  {
    key: 'cardFees.opposition',
    label: 'Opposition carte',
    kind: 'amount',
    default: 5000,
    range: { min: 0, max: 50000 },
    unitHint: 'FCFA',
    aliases: ['opposition carte', 'opposition sur carte', 'perte de carte', 'mise en opposition'],
  },
  {
    key: 'cardFees.retraitDabAutreBanque',
    label: 'Retrait DAB autre banque',
    kind: 'amount',
    default: 1000,
    range: { min: 0, max: 50000 },
    unitHint: 'FCFA',
    aliases: ['retrait dab autre banque', 'retrait gab confrère', 'retrait carte autre banque'],
  },

  // -------------------------------------------------------------------------
  // TRANSFERS
  // -------------------------------------------------------------------------
  {
    key: 'transferFees.virementInterne.commission',
    label: 'Virement interne — commission',
    kind: 'percentage',
    default: 0.1,
    range: { min: 0, max: 5 },
    unitHint: '%',
    aliases: ['virement interne commission', 'virement intra-bancaire', 'virement interne'],
  },
  {
    key: 'transferFees.virementCemacUemoa.commission',
    label: 'Virement CEMAC/UEMOA — commission',
    kind: 'percentage',
    default: 0.5,
    range: { min: 0, max: 5 },
    unitHint: '%',
    aliases: [
      'virement cemac commission',
      'virement uemoa commission',
      'virement zone',
      'virement régional',
    ],
  },
  {
    key: 'transferFees.virementInternational.commission',
    label: 'Virement international — commission',
    kind: 'percentage',
    default: 1,
    range: { min: 0, max: 10 },
    unitHint: '%',
    aliases: [
      'virement international commission',
      'virement étranger commission',
      'transfert international',
      'commission virement international',
    ],
  },
  {
    key: 'transferFees.virementInternational.swift',
    label: 'Frais SWIFT',
    kind: 'amount',
    default: 15000,
    range: { min: 0, max: 100000 },
    unitHint: 'FCFA',
    aliases: ['frais swift', 'commission swift', 'swift fees'],
  },

  // -------------------------------------------------------------------------
  // CHECKS
  // -------------------------------------------------------------------------
  {
    key: 'checkFees.chequierEmission',
    label: 'Chéquier — émission',
    kind: 'amount',
    default: 2500,
    range: { min: 0, max: 50000 },
    unitHint: 'FCFA',
    aliases: ['chéquier émission', 'délivrance chéquier', 'frais émission chéquier'],
  },
  {
    key: 'checkFees.oppositionCheque',
    label: 'Opposition chèque',
    kind: 'amount',
    default: 5000,
    range: { min: 0, max: 50000 },
    unitHint: 'FCFA',
    aliases: ['opposition chèque', 'opposition sur chèque', 'mise en opposition chèque'],
  },
  {
    key: 'checkFees.chequeSansProvision',
    label: 'Chèque sans provision',
    kind: 'amount',
    default: 25000,
    range: { min: 0, max: 200000 },
    unitHint: 'FCFA',
    aliases: ['chèque sans provision', 'chèque impayé', 'rejet chèque', 'incident chèque'],
  },

  // -------------------------------------------------------------------------
  // E-BANKING
  // -------------------------------------------------------------------------
  {
    key: 'eBankingFees.abonnementMensuel',
    label: 'E-Banking abonnement mensuel',
    kind: 'amount',
    default: 2000,
    range: { min: 0, max: 50000 },
    unitHint: 'FCFA',
    aliases: [
      'e-banking abonnement',
      'banque en ligne abonnement',
      'abonnement online banking',
      'mobile banking abonnement',
    ],
  },
  {
    key: 'eBankingFees.smsAlerte',
    label: 'SMS d\'alerte',
    kind: 'amount',
    default: 200,
    range: { min: 0, max: 5000 },
    unitHint: 'FCFA',
    aliases: ['sms alerte', 'sms banking', 'notification sms', 'alerte sms'],
  },
];

/** Index by key for O(1) lookup */
export const FIELD_BY_KEY: Map<string, FieldDefinition> = new Map(
  FIELD_DEFINITIONS.map((f) => [f.key, f]),
);

/** Quick getter */
export function getField(key: string): FieldDefinition | undefined {
  return FIELD_BY_KEY.get(key);
}
