// ============================================================================
// SCRUTIX - Bank Template Types
// Types pour les templates de releves bancaires
// ============================================================================

/**
 * Definition d'une zone d'extraction (coordonnees en pourcentage)
 * Resolution-independant: fonctionne avec tout format de scan
 */
export interface ZoneDefinition {
  /** Nom de la zone */
  name: string;
  /** Type de donnee attendue */
  type: 'date' | 'text' | 'amount' | 'balance' | 'reference' | 'account' | 'header';
  /** Position X en % (0-100) du bord gauche */
  x: number;
  /** Position Y en % (0-100) du bord haut */
  y: number;
  /** Largeur en % */
  width: number;
  /** Hauteur en % */
  height: number;
}

/**
 * Template complet d'un releve bancaire
 */
export interface BankTemplate {
  /** Code unique du template */
  code: string;
  /** Code(s) banque associe(s) */
  bankCode: string;
  /** Nom complet de la banque */
  bankName: string;
  /** Pays */
  country: string;
  /** Region (CEMAC/UEMOA) */
  region: 'CEMAC' | 'UEMOA';
  /** Zones d'en-tete (metadonnees) */
  headerZones: ZoneDefinition[];
  /** Zones des colonnes du tableau de transactions */
  tableColumns: {
    date: ZoneDefinition;
    valueDate?: ZoneDefinition;
    description: ZoneDefinition;
    debit: ZoneDefinition;
    credit: ZoneDefinition;
    balance?: ZoneDefinition;
    reference?: ZoneDefinition;
  };
  /** Zone du tableau complet */
  tableArea: {
    /** Position Y du debut du tableau en % */
    y: number;
    /** Hauteur du tableau en % */
    height: number;
  };
  /** Format de date utilise */
  dateFormat: string;
  /** Format de nombre */
  numberFormat: {
    decimalSeparator: ',' | '.';
    thousandsSeparator: '.' | ' ' | '';
  };
  /** Devise par defaut */
  currency: string;
  /** Pattern regex pour reconnaitre l'en-tete du releve */
  headerPattern: RegExp;
  /** Version du template */
  version: number;
}

/**
 * Template personnalise cree par l'utilisateur
 */
export interface CustomBankTemplate extends BankTemplate {
  /** ID unique */
  id: string;
  /** Cree par l'utilisateur */
  isCustom: true;
  /** Date de creation */
  createdAt: number;
  /** Date de derniere modification */
  updatedAt: number;
}
