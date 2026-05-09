// ============================================================================
// CDC — Taxonomie des rubriques bancaires (~180 rubriques)
// 9 catégories couvrant l'intégralité des conditions tarifaires CEMAC/UEMOA
// ============================================================================
// Conformité CDC v1.0 §11.1 — annexe rubriques tarifaires
// Évolution 174 rubriques (118 v1 + 56 nouvelles couvrant cat. 8/9 complètes,
// granularité crédits/cartes/incidents, DV étendues).
// ============================================================================

import type { RubricCategory, ConditionUnit } from '../types';

export interface RubricSeed {
  code: string;
  parentCode: string | null;
  category: RubricCategory;
  displayLabelFr: string;
  unit: ConditionUnit;
  isDimensional: boolean;
  description: string | null;
}

export const RUBRICS_TAXONOMY: RubricSeed[] = [
  // ========================================================================
  // 1. COMPTE — Tenue et gestion (26 rubriques)
  // ========================================================================
  { code: 'compte', parentCode: null, category: 'compte', displayLabelFr: 'Compte', unit: 'fcfa', isDimensional: false, description: 'Catégorie racine compte' },
  { code: 'compte.tenue_mensuelle', parentCode: 'compte', category: 'compte', displayLabelFr: 'Tenue de compte mensuelle', unit: 'fcfa', isDimensional: true, description: 'Frais mensuels de tenue de compte (profil: particulier/PME/corporate)' },
  { code: 'compte.tenue_annuelle', parentCode: 'compte', category: 'compte', displayLabelFr: 'Tenue de compte annuelle', unit: 'fcfa', isDimensional: true, description: null },
  { code: 'compte.tenue_jeune', parentCode: 'compte', category: 'compte', displayLabelFr: 'Tenue compte jeune/étudiant', unit: 'fcfa', isDimensional: false, description: 'Tarif réduit jeune/étudiant' },
  { code: 'compte.tenue_senior', parentCode: 'compte', category: 'compte', displayLabelFr: 'Tenue compte senior', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'compte.tenue_pro', parentCode: 'compte', category: 'compte', displayLabelFr: 'Tenue compte professionnel', unit: 'fcfa', isDimensional: false, description: 'Indépendants, professions libérales' },
  { code: 'compte.tenue_corporate', parentCode: 'compte', category: 'compte', displayLabelFr: 'Tenue compte corporate', unit: 'fcfa', isDimensional: true, description: 'Dimension: profil entreprise' },
  { code: 'compte.ouverture', parentCode: 'compte', category: 'compte', displayLabelFr: 'Frais d\'ouverture', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'compte.cloture', parentCode: 'compte', category: 'compte', displayLabelFr: 'Frais de clôture', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'compte.fermeture_anticipee', parentCode: 'compte', category: 'compte', displayLabelFr: 'Fermeture anticipée', unit: 'fcfa', isDimensional: false, description: 'Avant 12 mois' },
  { code: 'compte.inactivite', parentCode: 'compte', category: 'compte', displayLabelFr: 'Frais d\'inactivité', unit: 'fcfa', isDimensional: false, description: 'Frais appliqués sur compte sans mouvement' },
  { code: 'compte.opposition_compte', parentCode: 'compte', category: 'compte', displayLabelFr: 'Opposition compte', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'compte.rib', parentCode: 'compte', category: 'compte', displayLabelFr: 'Délivrance RIB', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'compte.rib_international', parentCode: 'compte', category: 'compte', displayLabelFr: 'RIB international (IBAN)', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'compte.releve_mensuel', parentCode: 'compte', category: 'compte', displayLabelFr: 'Relevé de compte mensuel', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'compte.releve_duplicata', parentCode: 'compte', category: 'compte', displayLabelFr: 'Duplicata de relevé', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'compte.releve_papier', parentCode: 'compte', category: 'compte', displayLabelFr: 'Relevé papier (supplément)', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'compte.attestation_solde', parentCode: 'compte', category: 'compte', displayLabelFr: 'Attestation de solde', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'compte.attestation_bancaire', parentCode: 'compte', category: 'compte', displayLabelFr: 'Attestation bancaire', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'compte.lettre_injonction', parentCode: 'compte', category: 'compte', displayLabelFr: 'Lettre d\'injonction', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'compte.droit_timbre', parentCode: 'compte', category: 'compte', displayLabelFr: 'Droit de timbre', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'compte.procuration', parentCode: 'compte', category: 'compte', displayLabelFr: 'Mise en place procuration', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'compte.changement_signature', parentCode: 'compte', category: 'compte', displayLabelFr: 'Changement de signature', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'compte.changement_adresse', parentCode: 'compte', category: 'compte', displayLabelFr: 'Changement d\'adresse', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'compte.duplicata_carte_compte', parentCode: 'compte', category: 'compte', displayLabelFr: 'Duplicata fiche compte', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'compte.frais_dossier_ouverture', parentCode: 'compte', category: 'compte', displayLabelFr: 'Frais dossier d\'ouverture', unit: 'fcfa', isDimensional: true, description: 'Pour comptes corporate' },

  // ========================================================================
  // 2. DÉCOUVERTS & AGIOS (17 rubriques)
  // ========================================================================
  { code: 'decouverts', parentCode: null, category: 'decouverts', displayLabelFr: 'Découverts & Agios', unit: 'percent', isDimensional: false, description: 'Catégorie racine découverts' },
  { code: 'decouverts.taux_autorise', parentCode: 'decouverts', category: 'decouverts', displayLabelFr: 'Taux découvert autorisé (TEG)', unit: 'percent', isDimensional: true, description: 'Taux annuel découvert dans la limite autorisée' },
  { code: 'decouverts.taux_non_autorise', parentCode: 'decouverts', category: 'decouverts', displayLabelFr: 'Taux découvert non autorisé', unit: 'percent', isDimensional: false, description: 'Taux majoré hors limite autorisée' },
  { code: 'decouverts.taux_usure_applicable', parentCode: 'decouverts', category: 'decouverts', displayLabelFr: 'Taux d\'usure applicable', unit: 'percent', isDimensional: true, description: 'Plafond L1 BCEAO' },
  { code: 'decouverts.plafond_autorise', parentCode: 'decouverts', category: 'decouverts', displayLabelFr: 'Plafond découvert autorisé', unit: 'fcfa', isDimensional: true, description: 'Montant maximum de découvert autorisé' },
  { code: 'decouverts.commission_mouvement', parentCode: 'decouverts', category: 'decouverts', displayLabelFr: 'Commission de mouvement', unit: 'percent', isDimensional: true, description: 'Commission sur mouvements débiteurs' },
  { code: 'decouverts.commission_mouvement_assiette', parentCode: 'decouverts', category: 'decouverts', displayLabelFr: 'Assiette commission de mouvement', unit: 'count', isDimensional: false, description: 'Type d\'assiette: tous_debits, hors_retraits, etc.' },
  { code: 'decouverts.cpfd', parentCode: 'decouverts', category: 'decouverts', displayLabelFr: 'Commission du Plus Fort Découvert', unit: 'percent', isDimensional: false, description: 'CPFD: % du plus fort solde débiteur' },
  { code: 'decouverts.cpfd_plafond', parentCode: 'decouverts', category: 'decouverts', displayLabelFr: 'Plafond CPFD', unit: 'percent', isDimensional: false, description: 'Plafond CPFD en % des intérêts débiteurs' },
  { code: 'decouverts.commission_depassement', parentCode: 'decouverts', category: 'decouverts', displayLabelFr: 'Commission de dépassement', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'decouverts.penalite_non_autorise', parentCode: 'decouverts', category: 'decouverts', displayLabelFr: 'Pénalité découvert non autorisé', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'decouverts.base_calcul', parentCode: 'decouverts', category: 'decouverts', displayLabelFr: 'Base de calcul agios', unit: 'days', isDimensional: false, description: '360 ou 365 jours' },
  { code: 'decouverts.commission_intervention', parentCode: 'decouverts', category: 'decouverts', displayLabelFr: 'Commission d\'intervention', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'decouverts.frais_etude_dossier', parentCode: 'decouverts', category: 'decouverts', displayLabelFr: 'Frais d\'étude dossier découvert', unit: 'fcfa', isDimensional: true, description: null },
  { code: 'decouverts.commission_engagement', parentCode: 'decouverts', category: 'decouverts', displayLabelFr: 'Commission d\'engagement', unit: 'percent', isDimensional: false, description: 'Sur ligne autorisée non utilisée' },
  { code: 'decouverts.frais_lettre_information', parentCode: 'decouverts', category: 'decouverts', displayLabelFr: 'Lettre d\'information préalable', unit: 'fcfa', isDimensional: false, description: 'Lettre préalable au prélèvement de frais (BCEAO)' },
  { code: 'decouverts.frais_renouvellement', parentCode: 'decouverts', category: 'decouverts', displayLabelFr: 'Renouvellement facilité', unit: 'fcfa', isDimensional: false, description: 'Renouvellement annuel autorisation' },

  // ========================================================================
  // 3. CARTES BANCAIRES (22 rubriques)
  // ========================================================================
  { code: 'cartes', parentCode: null, category: 'cartes', displayLabelFr: 'Cartes bancaires', unit: 'fcfa', isDimensional: false, description: 'Catégorie racine cartes' },
  { code: 'cartes.cotisation_debit', parentCode: 'cartes', category: 'cartes', displayLabelFr: 'Cotisation annuelle carte débit', unit: 'fcfa', isDimensional: true, description: 'Dimension: réseau (VISA/MC/GIM)' },
  { code: 'cartes.cotisation_credit', parentCode: 'cartes', category: 'cartes', displayLabelFr: 'Cotisation annuelle carte crédit', unit: 'fcfa', isDimensional: true, description: null },
  { code: 'cartes.cotisation_premium', parentCode: 'cartes', category: 'cartes', displayLabelFr: 'Cotisation carte premium (Gold/Platinum)', unit: 'fcfa', isDimensional: true, description: null },
  { code: 'cartes.cotisation_business', parentCode: 'cartes', category: 'cartes', displayLabelFr: 'Cotisation carte business', unit: 'fcfa', isDimensional: true, description: null },
  { code: 'cartes.cotisation_prepaid', parentCode: 'cartes', category: 'cartes', displayLabelFr: 'Cotisation carte prépayée', unit: 'fcfa', isDimensional: true, description: null },
  { code: 'cartes.cotisation_virtuelle', parentCode: 'cartes', category: 'cartes', displayLabelFr: 'Cotisation carte virtuelle', unit: 'fcfa', isDimensional: false, description: 'Carte e-commerce dématérialisée' },
  { code: 'cartes.retrait_dab_national', parentCode: 'cartes', category: 'cartes', displayLabelFr: 'Retrait DAB national (même banque)', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'cartes.retrait_dab_autre', parentCode: 'cartes', category: 'cartes', displayLabelFr: 'Retrait DAB autre banque', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'cartes.retrait_dab_zone', parentCode: 'cartes', category: 'cartes', displayLabelFr: 'Retrait DAB zone UEMOA/CEMAC', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'cartes.retrait_dab_international', parentCode: 'cartes', category: 'cartes', displayLabelFr: 'Retrait DAB international', unit: 'fcfa', isDimensional: true, description: null },
  { code: 'cartes.paiement_tpe_national', parentCode: 'cartes', category: 'cartes', displayLabelFr: 'Paiement TPE national', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'cartes.paiement_etranger', parentCode: 'cartes', category: 'cartes', displayLabelFr: 'Paiement à l\'étranger', unit: 'percent', isDimensional: false, description: 'Commission change incluse' },
  { code: 'cartes.frais_change_etranger', parentCode: 'cartes', category: 'cartes', displayLabelFr: 'Frais de change carte', unit: 'percent', isDimensional: true, description: 'Sur opérations en devise hors XOF/XAF' },
  { code: 'cartes.opposition', parentCode: 'cartes', category: 'cartes', displayLabelFr: 'Opposition carte', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'cartes.reedition_pin', parentCode: 'cartes', category: 'cartes', displayLabelFr: 'Réédition code PIN', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'cartes.renouvellement_anticipe', parentCode: 'cartes', category: 'cartes', displayLabelFr: 'Renouvellement anticipé', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'cartes.envoi_recommande', parentCode: 'cartes', category: 'cartes', displayLabelFr: 'Envoi recommandé carte', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'cartes.consultation_solde', parentCode: 'cartes', category: 'cartes', displayLabelFr: 'Consultation solde DAB', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'cartes.frais_chargeback', parentCode: 'cartes', category: 'cartes', displayLabelFr: 'Frais de chargeback', unit: 'fcfa', isDimensional: false, description: 'Contestation paiement' },
  { code: 'cartes.plafond_retrait', parentCode: 'cartes', category: 'cartes', displayLabelFr: 'Plafond retrait journalier', unit: 'fcfa', isDimensional: true, description: null },
  { code: 'cartes.plafond_paiement', parentCode: 'cartes', category: 'cartes', displayLabelFr: 'Plafond paiement mensuel', unit: 'fcfa', isDimensional: true, description: null },

  // ========================================================================
  // 4. VIREMENTS (19 rubriques)
  // ========================================================================
  { code: 'virements', parentCode: null, category: 'virements', displayLabelFr: 'Virements', unit: 'fcfa', isDimensional: false, description: 'Catégorie racine virements' },
  { code: 'virements.intra_banque', parentCode: 'virements', category: 'virements', displayLabelFr: 'Virement intra-banque', unit: 'fcfa', isDimensional: true, description: 'Dimension: montant' },
  { code: 'virements.intra_banque_commission', parentCode: 'virements', category: 'virements', displayLabelFr: 'Commission virement intra-banque', unit: 'percent', isDimensional: true, description: null },
  { code: 'virements.inter_banques', parentCode: 'virements', category: 'virements', displayLabelFr: 'Virement inter-banques national', unit: 'fcfa', isDimensional: true, description: null },
  { code: 'virements.zone_uemoa', parentCode: 'virements', category: 'virements', displayLabelFr: 'Virement UEMOA', unit: 'fcfa', isDimensional: true, description: null },
  { code: 'virements.zone_cemac', parentCode: 'virements', category: 'virements', displayLabelFr: 'Virement CEMAC', unit: 'fcfa', isDimensional: true, description: null },
  { code: 'virements.swift_international', parentCode: 'virements', category: 'virements', displayLabelFr: 'Virement SWIFT international', unit: 'fcfa', isDimensional: true, description: 'Dimensions: montant, devise' },
  { code: 'virements.swift_commission', parentCode: 'virements', category: 'virements', displayLabelFr: 'Commission SWIFT', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'virements.frais_correspondant', parentCode: 'virements', category: 'virements', displayLabelFr: 'Frais de correspondant', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'virements.commission_emission', parentCode: 'virements', category: 'virements', displayLabelFr: 'Commission émission virement', unit: 'percent', isDimensional: true, description: null },
  { code: 'virements.commission_reception', parentCode: 'virements', category: 'virements', displayLabelFr: 'Commission réception virement', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'virements.frais_devise', parentCode: 'virements', category: 'virements', displayLabelFr: 'Frais conversion devise', unit: 'percent', isDimensional: true, description: null },
  { code: 'virements.permanent', parentCode: 'virements', category: 'virements', displayLabelFr: 'Ordre de virement permanent', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'virements.modification', parentCode: 'virements', category: 'virements', displayLabelFr: 'Modification virement', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'virements.annulation', parentCode: 'virements', category: 'virements', displayLabelFr: 'Annulation virement', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'virements.instantane', parentCode: 'virements', category: 'virements', displayLabelFr: 'Virement instantané', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'virements.rejet', parentCode: 'virements', category: 'virements', displayLabelFr: 'Rejet de virement', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'virements.frais_recherche', parentCode: 'virements', category: 'virements', displayLabelFr: 'Frais de recherche virement', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'virements.frais_documentation', parentCode: 'virements', category: 'virements', displayLabelFr: 'Frais documentation virement', unit: 'fcfa', isDimensional: false, description: 'Justificatifs change/transfert' },

  // ========================================================================
  // 5. CHÈQUES (14 rubriques)
  // ========================================================================
  { code: 'cheques', parentCode: null, category: 'cheques', displayLabelFr: 'Chèques', unit: 'fcfa', isDimensional: false, description: 'Catégorie racine chèques' },
  { code: 'cheques.carnet_25', parentCode: 'cheques', category: 'cheques', displayLabelFr: 'Carnet 25 feuilles', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'cheques.carnet_50', parentCode: 'cheques', category: 'cheques', displayLabelFr: 'Carnet 50 feuilles', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'cheques.carnet_personnalise', parentCode: 'cheques', category: 'cheques', displayLabelFr: 'Carnet personnalisé', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'cheques.cheque_guichet', parentCode: 'cheques', category: 'cheques', displayLabelFr: 'Chèque de guichet', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'cheques.cheque_voyage', parentCode: 'cheques', category: 'cheques', displayLabelFr: 'Chèque de voyage', unit: 'percent', isDimensional: false, description: null },
  { code: 'cheques.remise_sur_place', parentCode: 'cheques', category: 'cheques', displayLabelFr: 'Remise chèque sur place', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'cheques.remise_hors_place', parentCode: 'cheques', category: 'cheques', displayLabelFr: 'Remise chèque hors place', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'cheques.certification', parentCode: 'cheques', category: 'cheques', displayLabelFr: 'Certification de chèque', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'cheques.opposition', parentCode: 'cheques', category: 'cheques', displayLabelFr: 'Opposition sur chèque', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'cheques.rejet_emis', parentCode: 'cheques', category: 'cheques', displayLabelFr: 'Rejet chèque émis', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'cheques.rejet_recu', parentCode: 'cheques', category: 'cheques', displayLabelFr: 'Rejet chèque reçu', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'cheques.cheque_certifie', parentCode: 'cheques', category: 'cheques', displayLabelFr: 'Chèque certifié', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'cheques.envoi_recommande', parentCode: 'cheques', category: 'cheques', displayLabelFr: 'Envoi chéquier recommandé', unit: 'fcfa', isDimensional: false, description: null },

  // ========================================================================
  // 6. CRÉDITS (17 rubriques)
  // ========================================================================
  { code: 'credits', parentCode: null, category: 'credits', displayLabelFr: 'Crédits', unit: 'percent', isDimensional: false, description: 'Catégorie racine crédits' },
  { code: 'credits.frais_dossier_conso', parentCode: 'credits', category: 'credits', displayLabelFr: 'Frais de dossier crédit conso', unit: 'fcfa', isDimensional: true, description: null },
  { code: 'credits.frais_dossier_immo', parentCode: 'credits', category: 'credits', displayLabelFr: 'Frais de dossier crédit immo', unit: 'fcfa', isDimensional: true, description: null },
  { code: 'credits.frais_dossier_equipement', parentCode: 'credits', category: 'credits', displayLabelFr: 'Frais de dossier crédit équipement', unit: 'fcfa', isDimensional: true, description: null },
  { code: 'credits.taux_conso', parentCode: 'credits', category: 'credits', displayLabelFr: 'Taux crédit consommation', unit: 'percent', isDimensional: true, description: 'Dimensions: montant, durée, garantie' },
  { code: 'credits.taux_immo', parentCode: 'credits', category: 'credits', displayLabelFr: 'Taux crédit immobilier', unit: 'percent', isDimensional: true, description: null },
  { code: 'credits.taux_equipement', parentCode: 'credits', category: 'credits', displayLabelFr: 'Taux crédit équipement', unit: 'percent', isDimensional: true, description: null },
  { code: 'credits.taux_revolving', parentCode: 'credits', category: 'credits', displayLabelFr: 'Taux crédit revolving', unit: 'percent', isDimensional: false, description: null },
  { code: 'credits.ira', parentCode: 'credits', category: 'credits', displayLabelFr: 'Indemnité de remboursement anticipé', unit: 'percent', isDimensional: false, description: null },
  { code: 'credits.mainlevee', parentCode: 'credits', category: 'credits', displayLabelFr: 'Mainlevée hypothèque', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'credits.taux_usure', parentCode: 'credits', category: 'credits', displayLabelFr: 'Taux d\'usure applicable', unit: 'percent', isDimensional: true, description: 'Plafond L1 réglementaire' },
  { code: 'credits.frais_avenant', parentCode: 'credits', category: 'credits', displayLabelFr: 'Frais avenant crédit', unit: 'fcfa', isDimensional: false, description: 'Modification durée/montant' },
  { code: 'credits.frais_renegociation', parentCode: 'credits', category: 'credits', displayLabelFr: 'Frais renégociation', unit: 'percent', isDimensional: false, description: null },
  { code: 'credits.frais_releve_credit', parentCode: 'credits', category: 'credits', displayLabelFr: 'Relevé compte crédit', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'credits.cout_assurance', parentCode: 'credits', category: 'credits', displayLabelFr: 'Coût assurance emprunteur', unit: 'percent', isDimensional: true, description: null },
  { code: 'credits.frais_relance', parentCode: 'credits', category: 'credits', displayLabelFr: 'Frais relance impayé', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'credits.frais_lettre_relance', parentCode: 'credits', category: 'credits', displayLabelFr: 'Lettre de relance', unit: 'fcfa', isDimensional: false, description: null },

  // ========================================================================
  // 7. E-BANKING (12 rubriques)
  // ========================================================================
  { code: 'ebanking', parentCode: null, category: 'ebanking', displayLabelFr: 'Services électroniques', unit: 'fcfa', isDimensional: false, description: 'Catégorie racine e-banking' },
  { code: 'ebanking.abonnement_web', parentCode: 'ebanking', category: 'ebanking', displayLabelFr: 'Abonnement e-banking web', unit: 'fcfa', isDimensional: false, description: 'Mensuel ou annuel' },
  { code: 'ebanking.abonnement_mobile', parentCode: 'ebanking', category: 'ebanking', displayLabelFr: 'Abonnement mobile banking', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'ebanking.app_premium', parentCode: 'ebanking', category: 'ebanking', displayLabelFr: 'App mobile premium', unit: 'fcfa', isDimensional: false, description: 'Niveau premium avec services additionnels' },
  { code: 'ebanking.sms_alerte', parentCode: 'ebanking', category: 'ebanking', displayLabelFr: 'SMS alerte (par opération)', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'ebanking.sms_abonnement', parentCode: 'ebanking', category: 'ebanking', displayLabelFr: 'SMS alerte (abonnement mensuel)', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'ebanking.token_securite', parentCode: 'ebanking', category: 'ebanking', displayLabelFr: 'Token de sécurité', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'ebanking.virement_en_ligne', parentCode: 'ebanking', category: 'ebanking', displayLabelFr: 'Virement via e-banking', unit: 'fcfa', isDimensional: true, description: 'Dimension: canal' },
  { code: 'ebanking.consultation_compte', parentCode: 'ebanking', category: 'ebanking', displayLabelFr: 'Consultation compte (au-delà forfait)', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'ebanking.opposition_acces', parentCode: 'ebanking', category: 'ebanking', displayLabelFr: 'Opposition accès e-banking', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'ebanking.recuperation_acces', parentCode: 'ebanking', category: 'ebanking', displayLabelFr: 'Récupération accès / déblocage', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'ebanking.changement_password', parentCode: 'ebanking', category: 'ebanking', displayLabelFr: 'Changement mot de passe assisté', unit: 'fcfa', isDimensional: false, description: null },

  // ========================================================================
  // 8. OPÉRATIONS SPÉCIALES (15 rubriques)
  // ========================================================================
  { code: 'operations_speciales', parentCode: null, category: 'operations_speciales', displayLabelFr: 'Opérations spéciales', unit: 'fcfa', isDimensional: false, description: 'Catégorie racine opérations spéciales' },
  { code: 'operations_speciales.change_manuel_achat', parentCode: 'operations_speciales', category: 'operations_speciales', displayLabelFr: 'Change manuel achat', unit: 'percent', isDimensional: true, description: 'Dimension: devise' },
  { code: 'operations_speciales.change_manuel_vente', parentCode: 'operations_speciales', category: 'operations_speciales', displayLabelFr: 'Change manuel vente', unit: 'percent', isDimensional: true, description: null },
  { code: 'operations_speciales.change_scriptural', parentCode: 'operations_speciales', category: 'operations_speciales', displayLabelFr: 'Change scriptural', unit: 'percent', isDimensional: true, description: null },
  { code: 'operations_speciales.cotation_devise', parentCode: 'operations_speciales', category: 'operations_speciales', displayLabelFr: 'Cotation devise (forward/spot)', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'operations_speciales.attestation_devise', parentCode: 'operations_speciales', category: 'operations_speciales', displayLabelFr: 'Attestation devise', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'operations_speciales.remise_documentaire', parentCode: 'operations_speciales', category: 'operations_speciales', displayLabelFr: 'Remise documentaire', unit: 'percent', isDimensional: true, description: null },
  { code: 'operations_speciales.credit_documentaire', parentCode: 'operations_speciales', category: 'operations_speciales', displayLabelFr: 'Crédit documentaire', unit: 'percent', isDimensional: true, description: null },
  { code: 'operations_speciales.garantie_internationale', parentCode: 'operations_speciales', category: 'operations_speciales', displayLabelFr: 'Garantie internationale', unit: 'percent', isDimensional: true, description: null },
  { code: 'operations_speciales.caution_marche', parentCode: 'operations_speciales', category: 'operations_speciales', displayLabelFr: 'Caution de marché', unit: 'percent', isDimensional: true, description: null },
  { code: 'operations_speciales.versement_especes', parentCode: 'operations_speciales', category: 'operations_speciales', displayLabelFr: 'Versement espèces', unit: 'percent', isDimensional: true, description: null },
  { code: 'operations_speciales.retrait_especes', parentCode: 'operations_speciales', category: 'operations_speciales', displayLabelFr: 'Retrait espèces guichet', unit: 'percent', isDimensional: true, description: null },
  { code: 'operations_speciales.encaissement_traite', parentCode: 'operations_speciales', category: 'operations_speciales', displayLabelFr: 'Encaissement de traite', unit: 'percent', isDimensional: false, description: null },
  { code: 'operations_speciales.escompte_traite', parentCode: 'operations_speciales', category: 'operations_speciales', displayLabelFr: 'Escompte de traite', unit: 'percent', isDimensional: true, description: null },
  { code: 'operations_speciales.frais_swift_message', parentCode: 'operations_speciales', category: 'operations_speciales', displayLabelFr: 'Frais message SWIFT (MT)', unit: 'fcfa', isDimensional: false, description: 'Hors virement (renseignement)' },

  // ========================================================================
  // 9. INCIDENTS & DIVERS (20 rubriques)
  // ========================================================================
  { code: 'incidents', parentCode: null, category: 'incidents', displayLabelFr: 'Incidents & divers', unit: 'fcfa', isDimensional: false, description: 'Catégorie racine incidents' },
  { code: 'incidents.cheque_rejete', parentCode: 'incidents', category: 'incidents', displayLabelFr: 'Chèque rejeté (pénalité)', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'incidents.incident_paiement', parentCode: 'incidents', category: 'incidents', displayLabelFr: 'Incident de paiement', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'incidents.retard_remboursement', parentCode: 'incidents', category: 'incidents', displayLabelFr: 'Retard de remboursement', unit: 'percent', isDimensional: false, description: 'Pénalité en % du retard' },
  { code: 'incidents.contentieux', parentCode: 'incidents', category: 'incidents', displayLabelFr: 'Frais de contentieux', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'incidents.saisie_attribution', parentCode: 'incidents', category: 'incidents', displayLabelFr: 'Saisie-attribution', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'incidents.declaration_ficoba', parentCode: 'incidents', category: 'incidents', displayLabelFr: 'Déclaration FICOBA', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'incidents.recherche_operation', parentCode: 'incidents', category: 'incidents', displayLabelFr: 'Recherche opération antérieure', unit: 'fcfa', isDimensional: false, description: 'Par opération recherchée' },
  { code: 'incidents.attestation_diverse', parentCode: 'incidents', category: 'incidents', displayLabelFr: 'Attestation diverse', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'incidents.certification_signature', parentCode: 'incidents', category: 'incidents', displayLabelFr: 'Certification de signature', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'incidents.coffre_petit', parentCode: 'incidents', category: 'incidents', displayLabelFr: 'Location coffre petit', unit: 'fcfa', isDimensional: false, description: 'Annuel' },
  { code: 'incidents.coffre_moyen', parentCode: 'incidents', category: 'incidents', displayLabelFr: 'Location coffre moyen', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'incidents.coffre_grand', parentCode: 'incidents', category: 'incidents', displayLabelFr: 'Location coffre grand', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'incidents.assurance_compte', parentCode: 'incidents', category: 'incidents', displayLabelFr: 'Assurance compte', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'incidents.contestation_operation', parentCode: 'incidents', category: 'incidents', displayLabelFr: 'Contestation d\'opération', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'incidents.recherche_origine_fonds', parentCode: 'incidents', category: 'incidents', displayLabelFr: 'Recherche origine des fonds', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'incidents.frais_lcb_ft', parentCode: 'incidents', category: 'incidents', displayLabelFr: 'Frais investigation LCB-FT', unit: 'fcfa', isDimensional: false, description: 'Lutte contre blanchiment' },
  { code: 'incidents.notification_evenement', parentCode: 'incidents', category: 'incidents', displayLabelFr: 'Notification événement compte', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'incidents.frais_huissier', parentCode: 'incidents', category: 'incidents', displayLabelFr: 'Frais huissier (refacturé)', unit: 'fcfa', isDimensional: false, description: null },
  { code: 'incidents.frais_avocat', parentCode: 'incidents', category: 'incidents', displayLabelFr: 'Frais avocat régularisation', unit: 'fcfa', isDimensional: false, description: null },

  // ========================================================================
  // DATES DE VALEUR (12 rubriques) — référence réglementaire BCEAO
  // ========================================================================
  { code: 'dv', parentCode: null, category: 'compte', displayLabelFr: 'Dates de valeur', unit: 'days', isDimensional: false, description: 'Catégorie dates de valeur' },
  { code: 'dv.versement_especes', parentCode: 'dv', category: 'compte', displayLabelFr: 'DV versement espèces', unit: 'days', isDimensional: false, description: 'Max J+1 (BCEAO)' },
  { code: 'dv.retrait_especes', parentCode: 'dv', category: 'compte', displayLabelFr: 'DV retrait espèces', unit: 'days', isDimensional: false, description: 'Min J (BCEAO)' },
  { code: 'dv.cheque_sur_place', parentCode: 'dv', category: 'compte', displayLabelFr: 'DV chèque sur place', unit: 'days', isDimensional: false, description: 'Max J+3 ouvré (BCEAO)' },
  { code: 'dv.cheque_hors_place', parentCode: 'dv', category: 'compte', displayLabelFr: 'DV chèque hors place', unit: 'days', isDimensional: false, description: 'Variable selon zone' },
  { code: 'dv.cheque_voyage', parentCode: 'dv', category: 'compte', displayLabelFr: 'DV chèque de voyage', unit: 'days', isDimensional: false, description: null },
  { code: 'dv.virement_recu', parentCode: 'dv', category: 'compte', displayLabelFr: 'DV virement reçu', unit: 'days', isDimensional: false, description: 'Min J (BCEAO)' },
  { code: 'dv.virement_emis', parentCode: 'dv', category: 'compte', displayLabelFr: 'DV virement émis', unit: 'days', isDimensional: false, description: null },
  { code: 'dv.virement_swift', parentCode: 'dv', category: 'compte', displayLabelFr: 'DV virement SWIFT', unit: 'days', isDimensional: true, description: 'Variable selon devise' },
  { code: 'dv.effet_commerce', parentCode: 'dv', category: 'compte', displayLabelFr: 'DV effet de commerce', unit: 'days', isDimensional: false, description: null },
  { code: 'dv.encaissement_carte', parentCode: 'dv', category: 'compte', displayLabelFr: 'DV encaissement TPE', unit: 'days', isDimensional: false, description: null },
  { code: 'dv.versement_especes_etranger', parentCode: 'dv', category: 'compte', displayLabelFr: 'DV versement espèces étranger', unit: 'days', isDimensional: false, description: null },
];

export const RUBRIC_CATEGORIES: Record<RubricCategory, string> = {
  compte: 'Compte',
  decouverts: 'Découverts & agios',
  cartes: 'Cartes bancaires',
  virements: 'Virements',
  cheques: 'Chèques',
  credits: 'Crédits',
  ebanking: 'E-banking',
  operations_speciales: 'Opérations spéciales',
  incidents: 'Incidents & divers',
};
