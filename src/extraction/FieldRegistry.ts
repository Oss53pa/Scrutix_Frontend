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

  // -------------------------------------------------------------------------
  // GUICHET — opérations en espèces et change manuel
  // -------------------------------------------------------------------------
  {
    key: 'cashOperations.versementEspeces',
    label: 'Versement espèces (frais fixes)',
    kind: 'amount',
    default: 0,
    range: { min: 0, max: 50000 },
    unitHint: 'FCFA',
    aliases: ['versement espèces', 'versement en espèces', 'dépôt espèces', 'frais versement'],
  },
  {
    key: 'cashOperations.versementEspecesCommission',
    label: 'Versement espèces (commission)',
    kind: 'percentage',
    default: 0,
    range: { min: 0, max: 5 },
    unitHint: '%',
    aliases: ['commission versement espèces', 'taux versement espèces'],
  },
  {
    key: 'cashOperations.retraitEspeces',
    label: 'Retrait espèces (frais fixes)',
    kind: 'amount',
    default: 0,
    range: { min: 0, max: 50000 },
    unitHint: 'FCFA',
    aliases: ['retrait espèces', 'retrait en espèces', 'frais retrait espèces'],
  },
  {
    key: 'cashOperations.retraitEspecesCommission',
    label: 'Retrait espèces (commission)',
    kind: 'percentage',
    default: 0.1,
    range: { min: 0, max: 5 },
    unitHint: '%',
    aliases: ['commission retrait espèces', 'taux retrait espèces'],
  },
  {
    key: 'cashOperations.changeManuel',
    label: 'Frais fixes change manuel',
    kind: 'amount',
    default: 2500,
    range: { min: 0, max: 50000 },
    unitHint: 'FCFA',
    aliases: ['change manuel', 'frais change', 'opération de change', 'frais fixes change'],
  },
  {
    key: 'cashOperations.achatDevises',
    label: 'Commission achat devises',
    kind: 'percentage',
    default: 0.5,
    range: { min: 0, max: 10 },
    unitHint: '%',
    aliases: ['achat devises', 'commission achat de devises', 'change achat'],
  },
  {
    key: 'cashOperations.venteDevises',
    label: 'Commission vente devises',
    kind: 'percentage',
    default: 0.5,
    range: { min: 0, max: 10 },
    unitHint: '%',
    aliases: ['vente devises', 'commission vente de devises', 'change vente'],
  },

  // -------------------------------------------------------------------------
  // CARTES — frais opérationnels (TPE, retraits, services divers)
  // -------------------------------------------------------------------------
  {
    key: 'cardFees.retraitDabPropre',
    label: 'Retrait DAB propre banque',
    kind: 'amount',
    default: 0,
    range: { min: 0, max: 5000 },
    unitHint: 'FCFA',
    aliases: ['retrait dab propre', 'retrait dab même banque', 'retrait gab propre'],
  },
  {
    key: 'cardFees.retraitDabInternational',
    label: 'Retrait DAB international',
    kind: 'amount',
    default: 5000,
    range: { min: 0, max: 50000 },
    unitHint: 'FCFA',
    aliases: ['retrait dab international', 'retrait étranger', 'retrait dab hors zone'],
  },
  {
    key: 'cardFees.paiementTpePropre',
    label: 'Paiement TPE propre',
    kind: 'amount',
    default: 0,
    range: { min: 0, max: 5000 },
    unitHint: 'FCFA',
    aliases: ['paiement tpe propre', 'paiement tpe même banque'],
  },
  {
    key: 'cardFees.paiementTpeInternational',
    label: 'Paiement TPE international',
    kind: 'amount',
    default: 1500,
    range: { min: 0, max: 30000 },
    unitHint: 'FCFA',
    aliases: ['paiement tpe international', 'paiement tpe étranger'],
  },
  {
    key: 'cardFees.paiementInternet',
    label: 'Paiement Internet',
    kind: 'amount',
    default: 0,
    range: { min: 0, max: 10000 },
    unitHint: 'FCFA',
    aliases: ['paiement internet', 'paiement en ligne', 'paiement web'],
  },
  {
    key: 'cardFees.codeOublie',
    label: 'Code oublié (carte)',
    kind: 'amount',
    default: 5000,
    range: { min: 0, max: 50000 },
    unitHint: 'FCFA',
    aliases: ['code oublié', 'régénération code', 'nouveau code carte', 'code pin oublié'],
  },
  {
    key: 'cardFees.consultationSolde',
    label: 'Consultation de solde (DAB)',
    kind: 'amount',
    default: 250,
    range: { min: 0, max: 5000 },
    unitHint: 'FCFA',
    aliases: ['consultation solde dab', 'demande de solde', 'consultation solde'],
  },

  // -------------------------------------------------------------------------
  // VIREMENTS — frais nationaux et instantanés
  // -------------------------------------------------------------------------
  {
    key: 'transferFees.virementNationalAutreBanque',
    label: 'Virement national autre banque',
    kind: 'amount',
    default: 5000,
    range: { min: 0, max: 50000 },
    unitHint: 'FCFA',
    aliases: ['virement national', 'virement autre banque', 'virement domestique'],
  },
  {
    key: 'transferFees.virementInstantane',
    label: 'Virement instantané',
    kind: 'amount',
    default: 1000,
    range: { min: 0, max: 20000 },
    unitHint: 'FCFA',
    aliases: ['virement instantané', 'virement immédiat', 'virement temps réel'],
  },
  {
    key: 'transferFees.virementPermanent',
    label: 'Virement permanent (mise en place)',
    kind: 'amount',
    default: 2500,
    range: { min: 0, max: 30000 },
    unitHint: 'FCFA',
    aliases: ['virement permanent', 'mise en place ordre permanent', 'ordre permanent'],
  },
  {
    key: 'transferFees.rejetVirement',
    label: 'Rejet de virement',
    kind: 'amount',
    default: 5000,
    range: { min: 0, max: 50000 },
    unitHint: 'FCFA',
    aliases: ['rejet virement', 'retour virement', 'virement rejeté'],
  },

  // -------------------------------------------------------------------------
  // CHÈQUES — opérations détaillées
  // -------------------------------------------------------------------------
  {
    key: 'checkFees.chequeCertifie',
    label: 'Chèque certifié',
    kind: 'amount',
    default: 5000,
    range: { min: 0, max: 50000 },
    unitHint: 'FCFA',
    aliases: ['chèque certifié', 'certification chèque'],
  },
  {
    key: 'checkFees.chequeBanque',
    label: 'Chèque de banque',
    kind: 'amount',
    default: 7500,
    range: { min: 0, max: 100000 },
    unitHint: 'FCFA',
    aliases: ['chèque de banque', 'cheque banque', 'cb à émettre'],
  },
  {
    key: 'checkFees.encaissementPlace',
    label: 'Encaissement chèque place',
    kind: 'amount',
    default: 1500,
    range: { min: 0, max: 30000 },
    unitHint: 'FCFA',
    aliases: ['encaissement chèque place', 'remise chèque place'],
  },
  {
    key: 'checkFees.encaissementEtranger',
    label: 'Encaissement chèque étranger',
    kind: 'amount',
    default: 15000,
    range: { min: 0, max: 200000 },
    unitHint: 'FCFA',
    aliases: ['encaissement chèque étranger', 'remise chèque étranger'],
  },

  // -------------------------------------------------------------------------
  // E-BANKING — services additionnels
  // -------------------------------------------------------------------------
  {
    key: 'eBankingFees.virementEnLigne',
    label: 'Virement en ligne (par opération)',
    kind: 'amount',
    default: 500,
    range: { min: 0, max: 10000 },
    unitHint: 'FCFA',
    aliases: ['virement en ligne', 'virement online', 'virement e-banking'],
  },
  {
    key: 'eBankingFees.mobileBanking',
    label: 'Mobile banking abonnement',
    kind: 'amount',
    default: 1500,
    range: { min: 0, max: 30000 },
    unitHint: 'FCFA',
    aliases: ['mobile banking', 'application mobile', 'banque mobile'],
  },
  {
    key: 'eBankingFees.ussd',
    label: 'USSD banking',
    kind: 'amount',
    default: 0,
    range: { min: 0, max: 10000 },
    unitHint: 'FCFA',
    aliases: ['ussd', 'banque ussd', 'sms banking opération'],
  },

  // -------------------------------------------------------------------------
  // DIVERS — assurances, garanties, coffres-forts, succession
  // -------------------------------------------------------------------------
  {
    key: 'miscFees.coffrePetit',
    label: 'Coffre-fort petit',
    kind: 'amount',
    default: 25000,
    range: { min: 0, max: 200000 },
    unitHint: 'FCFA',
    aliases: ['coffre-fort petit', 'coffre petit modèle', 'location coffre petit'],
  },
  {
    key: 'miscFees.garantieBancaire',
    label: 'Garantie bancaire',
    kind: 'percentage',
    default: 1,
    range: { min: 0, max: 10 },
    unitHint: '%',
    aliases: ['garantie bancaire', 'caution bancaire', 'commission garantie'],
  },
  {
    key: 'miscFees.successionFrais',
    label: 'Frais de succession',
    kind: 'amount',
    default: 25000,
    range: { min: 0, max: 500000 },
    unitHint: 'FCFA',
    aliases: ['frais succession', 'frais dossier succession'],
  },
  {
    key: 'miscFees.procurationCompte',
    label: 'Procuration sur compte',
    kind: 'amount',
    default: 5000,
    range: { min: 0, max: 50000 },
    unitHint: 'FCFA',
    aliases: ['procuration', 'mise en place procuration', 'frais procuration'],
  },
  {
    key: 'miscFees.assuranceCompte',
    label: 'Assurance compte',
    kind: 'amount',
    default: 1500,
    range: { min: 0, max: 30000 },
    unitHint: 'FCFA',
    aliases: ['assurance compte', 'assurance perte cb', 'pack assurance'],
  },
  {
    key: 'miscFees.droitTimbre',
    label: 'Droit de timbre',
    kind: 'amount',
    default: 500,
    range: { min: 0, max: 10000 },
    unitHint: 'FCFA',
    aliases: ['droit timbre', 'droits de timbre', 'timbre fiscal'],
  },

  // -------------------------------------------------------------------------
  // ACCOUNT FEES — variantes additionnelles (couverture 100%)
  // -------------------------------------------------------------------------
  {
    key: 'accountFees.tenueCompte.particulierEtranger',
    label: 'Tenue de compte particulier étranger',
    kind: 'amount',
    default: 7500,
    range: { min: 0, max: 200000 },
    unitHint: 'FCFA',
    aliases: ['tenue compte particulier étranger', 'tenue compte non-résident', 'compte étranger particulier'],
  },
  {
    key: 'accountFees.tenueCompte.association',
    label: 'Tenue de compte association/ONG',
    kind: 'amount',
    default: 3000,
    range: { min: 0, max: 100000 },
    unitHint: 'FCFA',
    aliases: ['tenue compte association', 'tenue compte ong', 'tenue compte associatif'],
  },
  {
    key: 'accountFees.tenueCompte.compteEpargne',
    label: 'Tenue de compte épargne',
    kind: 'amount',
    default: 0,
    range: { min: 0, max: 50000 },
    unitHint: 'FCFA',
    aliases: ['tenue compte épargne', 'tenue compte d\'épargne', 'frais compte épargne'],
  },
  {
    key: 'accountFees.tenueCompte.compteDevises',
    label: 'Tenue de compte en devises',
    kind: 'amount',
    default: 10000,
    range: { min: 0, max: 200000 },
    unitHint: 'FCFA',
    aliases: ['tenue compte devises', 'tenue compte en devises', 'compte usd', 'compte eur'],
  },
  {
    key: 'accountFees.fraisOuvertureEntreprise',
    label: 'Frais d\'ouverture entreprise',
    kind: 'amount',
    default: 25000,
    range: { min: 0, max: 200000 },
    unitHint: 'FCFA',
    aliases: ['ouverture compte entreprise', 'frais ouverture pme', 'frais ouverture société'],
  },
  {
    key: 'accountFees.minimumDepot',
    label: 'Minimum à l\'ouverture',
    kind: 'amount',
    default: 25000,
    range: { min: 0, max: 1000000 },
    unitHint: 'FCFA',
    aliases: ['minimum dépôt', 'dépôt minimum', 'dépôt initial', 'versement initial'],
  },
  {
    key: 'accountFees.fraisClotureEntreprise',
    label: 'Frais de clôture entreprise',
    kind: 'amount',
    default: 5000,
    range: { min: 0, max: 50000 },
    unitHint: 'FCFA',
    aliases: ['frais clôture entreprise', 'clôture compte société', 'fermeture compte pme'],
  },
  {
    key: 'accountFees.releveCompte.mensuelEmail',
    label: 'Relevé mensuel par email',
    kind: 'amount',
    default: 0,
    range: { min: 0, max: 5000 },
    unitHint: 'FCFA',
    aliases: ['relevé mensuel email', 'relevé numérique', 'relevé électronique'],
  },
  {
    key: 'accountFees.releveCompte.annuel',
    label: 'Relevé annuel',
    kind: 'amount',
    default: 0,
    range: { min: 0, max: 10000 },
    unitHint: 'FCFA',
    aliases: ['relevé annuel', 'relevé fiscal', 'récapitulatif annuel'],
  },
  {
    key: 'accountFees.certificatNonEngagement',
    label: 'Certificat de non engagement',
    kind: 'amount',
    default: 5000,
    range: { min: 0, max: 50000 },
    unitHint: 'FCFA',
    aliases: ['certificat non engagement', 'attestation non engagement', 'certif non engagement'],
  },
  {
    key: 'accountFees.rib',
    label: 'RIB / Relevé d\'identité',
    kind: 'amount',
    default: 0,
    range: { min: 0, max: 5000 },
    unitHint: 'FCFA',
    aliases: ['rib', 'relevé identité bancaire', 'iban', 'demande rib'],
  },

  // -------------------------------------------------------------------------
  // CARTES — variantes restantes (couverture 100%)
  // -------------------------------------------------------------------------
  {
    key: 'cardFees.paiementTpeAutre',
    label: 'Paiement TPE autre banque',
    kind: 'amount',
    default: 500,
    range: { min: 0, max: 10000 },
    unitHint: 'FCFA',
    aliases: ['paiement tpe autre banque', 'tpe confrère', 'tpe interbancaire'],
  },
  {
    key: 'cardFees.renouvellementAnticipe',
    label: 'Renouvellement anticipé carte',
    kind: 'amount',
    default: 5000,
    range: { min: 0, max: 50000 },
    unitHint: 'FCFA',
    aliases: ['renouvellement anticipé', 'remplacement carte', 'duplicata carte'],
  },
  {
    key: 'cardFees.carteCaptee',
    label: 'Carte captée par DAB',
    kind: 'amount',
    default: 5000,
    range: { min: 0, max: 50000 },
    unitHint: 'FCFA',
    aliases: ['carte captée', 'carte avalée', 'récupération carte'],
  },

  // -------------------------------------------------------------------------
  // VIREMENTS — variantes restantes (couverture 100%)
  // -------------------------------------------------------------------------
  {
    key: 'transferFees.virementNationalMemeBank',
    label: 'Virement national même banque',
    kind: 'amount',
    default: 0,
    range: { min: 0, max: 10000 },
    unitHint: 'FCFA',
    aliases: ['virement même banque', 'virement intra-banque', 'virement interne national'],
  },
  {
    key: 'transferFees.virementNationalAutreBanqueCommission',
    label: 'Commission virement national autre banque',
    kind: 'percentage',
    default: 0.1,
    range: { min: 0, max: 5 },
    unitHint: '%',
    aliases: ['commission virement national', 'taux virement domestique', 'commission virement interbancaire'],
  },
  {
    key: 'transferFees.virementZoneMonetaire',
    label: 'Virement zone CEMAC/UEMOA (frais fixes)',
    kind: 'amount',
    default: 7500,
    range: { min: 0, max: 100000 },
    unitHint: 'FCFA',
    aliases: ['virement zone monétaire', 'virement cemac', 'virement uemoa', 'virement sous-régional'],
  },
  {
    key: 'transferFees.virementInternationalFraisFixes',
    label: 'Virement international (frais fixes)',
    kind: 'amount',
    default: 25000,
    range: { min: 0, max: 200000 },
    unitHint: 'FCFA',
    aliases: ['virement international frais fixes', 'frais virement international', 'virement étranger frais'],
  },
  {
    key: 'transferFees.recuVirement',
    label: 'Reçu de virement',
    kind: 'amount',
    default: 1000,
    range: { min: 0, max: 10000 },
    unitHint: 'FCFA',
    aliases: ['reçu virement', 'avis virement', 'duplicata virement'],
  },

  // -------------------------------------------------------------------------
  // CHÈQUES — variantes restantes (couverture 100%)
  // -------------------------------------------------------------------------
  {
    key: 'checkFees.carnet50',
    label: 'Chéquier 50 formules',
    kind: 'amount',
    default: 5000,
    range: { min: 0, max: 100000 },
    unitHint: 'FCFA',
    aliases: ['chéquier 50', 'carnet 50 chèques', 'chéquier 50 formules'],
  },
  {
    key: 'checkFees.carnet100',
    label: 'Chéquier 100 formules',
    kind: 'amount',
    default: 10000,
    range: { min: 0, max: 200000 },
    unitHint: 'FCFA',
    aliases: ['chéquier 100', 'carnet 100 chèques', 'chéquier 100 formules'],
  },
  {
    key: 'checkFees.chequeGuichet',
    label: 'Encaissement chèque guichet',
    kind: 'amount',
    default: 0,
    range: { min: 0, max: 10000 },
    unitHint: 'FCFA',
    aliases: ['chèque guichet', 'paiement chèque guichet', 'retrait chèque guichet'],
  },
  {
    key: 'checkFees.chequeRetourne',
    label: 'Chèque retourné impayé',
    kind: 'amount',
    default: 15000,
    range: { min: 0, max: 100000 },
    unitHint: 'FCFA',
    aliases: ['chèque retourné', 'chèque non payé', 'rejet chèque retour'],
  },
  {
    key: 'checkFees.encaissementDeplacement',
    label: 'Encaissement chèque déplacement',
    kind: 'amount',
    default: 3500,
    range: { min: 0, max: 50000 },
    unitHint: 'FCFA',
    aliases: ['encaissement chèque déplacement', 'remise chèque déplacé', 'chèque hors place'],
  },
  {
    key: 'checkFees.encaissementEtrangerCommission',
    label: 'Commission encaissement chèque étranger',
    kind: 'percentage',
    default: 0.5,
    range: { min: 0, max: 5 },
    unitHint: '%',
    aliases: ['commission chèque étranger', 'commission encaissement étranger'],
  },

  // -------------------------------------------------------------------------
  // CRÉDITS — variantes restantes (couverture 100%)
  // -------------------------------------------------------------------------
  {
    key: 'creditFees.creditPME',
    label: 'Crédit PME (taux)',
    kind: 'percentage',
    default: 11,
    range: { min: 0, max: 25 },
    unitHint: '%',
    aliases: ['crédit pme', 'taux crédit pme', 'taux pme', 'crédit entreprise pme'],
  },
  {
    key: 'creditFees.penaliteRetard',
    label: 'Pénalité de retard sur crédit',
    kind: 'percentage',
    default: 5,
    range: { min: 0, max: 20 },
    unitHint: '%',
    aliases: ['pénalité retard', 'majoration retard', 'taux pénalité', 'intérêts retard'],
  },

  // -------------------------------------------------------------------------
  // E-BANKING — variantes restantes (couverture 100%)
  // -------------------------------------------------------------------------
  {
    key: 'eBankingFees.abonnementAnnuel',
    label: 'E-Banking abonnement annuel',
    kind: 'amount',
    default: 20000,
    range: { min: 0, max: 200000 },
    unitHint: 'FCFA',
    aliases: ['e-banking abonnement annuel', 'banque en ligne annuel', 'abonnement annuel internet banking'],
  },
  {
    key: 'eBankingFees.parOperation',
    label: 'E-Banking par opération',
    kind: 'amount',
    default: 100,
    range: { min: 0, max: 5000 },
    unitHint: 'FCFA',
    aliases: ['par opération', 'frais par transaction', 'tarif unitaire e-banking'],
  },
  {
    key: 'eBankingFees.smsAlerteAbonnement',
    label: 'SMS alerte abonnement',
    kind: 'amount',
    default: 500,
    range: { min: 0, max: 10000 },
    unitHint: 'FCFA',
    aliases: ['sms alerte abonnement', 'pack sms', 'forfait sms banking'],
  },

  // -------------------------------------------------------------------------
  // DIVERS — variantes restantes (couverture 100%)
  // -------------------------------------------------------------------------
  {
    key: 'miscFees.coffreMoyen',
    label: 'Coffre-fort moyen',
    kind: 'amount',
    default: 50000,
    range: { min: 0, max: 500000 },
    unitHint: 'FCFA',
    aliases: ['coffre-fort moyen', 'coffre moyen modèle', 'location coffre moyen'],
  },
  {
    key: 'miscFees.coffreGrand',
    label: 'Coffre-fort grand',
    kind: 'amount',
    default: 100000,
    range: { min: 0, max: 1000000 },
    unitHint: 'FCFA',
    aliases: ['coffre-fort grand', 'coffre grand modèle', 'location coffre grand'],
  },
  {
    key: 'miscFees.garantieLocative',
    label: 'Garantie locative',
    kind: 'percentage',
    default: 1,
    range: { min: 0, max: 10 },
    unitHint: '%',
    aliases: ['garantie locative', 'caution location', 'caution loyer'],
  },
  {
    key: 'miscFees.cautionMarche',
    label: 'Caution marché public',
    kind: 'percentage',
    default: 1.5,
    range: { min: 0, max: 10 },
    unitHint: '%',
    aliases: ['caution marché', 'caution marché public', 'caution adjudication'],
  },
  {
    key: 'miscFees.saisieAttribution',
    label: 'Saisie-attribution',
    kind: 'amount',
    default: 25000,
    range: { min: 0, max: 200000 },
    unitHint: 'FCFA',
    aliases: ['saisie attribution', 'saisie compte', 'frais saisie'],
  },
  {
    key: 'miscFees.mainLevee',
    label: 'Mainlevée',
    kind: 'amount',
    default: 10000,
    range: { min: 0, max: 100000 },
    unitHint: 'FCFA',
    aliases: ['mainlevée', 'main levée', 'levée hypothèque', 'levée nantissement'],
  },
  {
    key: 'miscFees.successionCommission',
    label: 'Commission de succession',
    kind: 'percentage',
    default: 1,
    range: { min: 0, max: 10 },
    unitHint: '%',
    aliases: ['commission succession', 'frais succession proportionnels', 'taux succession'],
  },
  {
    key: 'miscFees.avoirInactif',
    label: 'Frais avoir inactif',
    kind: 'amount',
    default: 10000,
    range: { min: 0, max: 100000 },
    unitHint: 'FCFA',
    aliases: ['avoir inactif', 'compte dormant', 'compte non utilisé'],
  },
  {
    key: 'miscFees.tvaServices',
    label: 'TVA sur services',
    kind: 'percentage',
    default: 18,
    range: { min: 0, max: 25 },
    unitHint: '%',
    aliases: ['tva services', 'taxe services bancaires', 'taux tva'],
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
