// ============================================================================
// ATLASBANX - Category → Rubric Code Mapping
// Maps DeterministicPreFilter broad categories to taxonomy rubric codes
// ============================================================================

/**
 * Maps broad category names (from DeterministicPreFilter) to their most
 * common rubric_code equivalent. Used as fallback when fine-grained
 * label matching doesn't produce a specific rubric.
 */
export const RUBRICS_CATEGORY_MAP: Record<string, string> = {
  'Frais bancaires': 'compte.tenue_mensuelle',
  'Commissions': 'decouverts.commission_mouvement',
  'Agios/Interets': 'decouverts.taux_autorise',
  'Virement entrant': 'virements.intra_banque',
  'Virement sortant': 'virements.national',
  'Virement interne': 'virements.intra_banque',
  'Virement international': 'virements.international',
  'Retrait DAB': 'cartes.retrait_dab_national',
  'Retrait especes': 'especes.retrait_guichet',
  'Versement especes': 'especes.versement',
  'Carte bancaire': 'cartes.paiement_tpe_national',
  'Cheques': 'cheques.remise_cheque',
  'Operations internationales': 'virements.international',
  'Impots/Taxes': 'divers.tva_services',
  'Salaires': 'virements.intra_banque',
  'Prelevements': 'virements.national',
  'Mobile Money': 'virements.mobile_money',
  'Telecom': 'divers.abonnement_telecom',
  'Assurances': 'divers.assurance',
  'Loyer': 'divers.loyer',
};
