// ============================================================================
// Bank directory — adresses postales des banques UEMOA/CEMAC
// ============================================================================
// Source de verite pour les adresses utilisees dans les lettres de reclamation.
// En prod, ces donnees viendront du referentiel CDC (cdc_banks).
// ============================================================================

export interface BankDirectoryEntry {
  code: string;
  legalName: string;
  addressLines: string[];
}

export const BANK_DIRECTORY: Record<string, BankDirectoryEntry> = {
  'NSIA': {
    code: 'NSIA',
    legalName: 'NSIA Banque Cote d\'Ivoire',
    addressLines: ['8-10 Avenue Joseph Anoma', '01 BP 1274 Abidjan 01'],
  },
  'NSIA-CI': {
    code: 'NSIA-CI',
    legalName: 'NSIA Banque Cote d\'Ivoire',
    addressLines: ['8-10 Avenue Joseph Anoma', '01 BP 1274 Abidjan 01'],
  },
  'SGCI': {
    code: 'SGCI',
    legalName: 'Societe Generale Cote d\'Ivoire',
    addressLines: ['5-7 Avenue Joseph Anoma', '01 BP 1355 Abidjan 01'],
  },
  'BICICI': {
    code: 'BICICI',
    legalName: 'Banque Internationale pour le Commerce et l\'Industrie de la Cote d\'Ivoire',
    addressLines: ['Avenue Franchet d\'Esperey', '01 BP 1298 Abidjan 01'],
  },
  'ECOBANK': {
    code: 'ECOBANK',
    legalName: 'Ecobank Cote d\'Ivoire',
    addressLines: ['Immeuble Alliance, Avenue Terrasson de Fougeres', '01 BP 4107 Abidjan 01'],
  },
  'ECOBANK-CI': {
    code: 'ECOBANK-CI',
    legalName: 'Ecobank Cote d\'Ivoire',
    addressLines: ['Immeuble Alliance, Avenue Terrasson de Fougeres', '01 BP 4107 Abidjan 01'],
  },
  'BOA': {
    code: 'BOA',
    legalName: 'Bank of Africa - Cote d\'Ivoire',
    addressLines: ['Angle Bd Botreau Roussel / Av. Delafosse', '01 BP 4132 Abidjan 01'],
  },
  'BOA-CI': {
    code: 'BOA-CI',
    legalName: 'Bank of Africa - Cote d\'Ivoire',
    addressLines: ['Angle Bd Botreau Roussel / Av. Delafosse', '01 BP 4132 Abidjan 01'],
  },
  'BHCI': {
    code: 'BHCI',
    legalName: 'Banque de l\'Habitat de Cote d\'Ivoire',
    addressLines: ['22 Avenue Joseph Anoma', '01 BP 2325 Abidjan 01'],
  },
  'CORIS': {
    code: 'CORIS',
    legalName: 'Coris Bank International - CI',
    addressLines: ['Immeuble CCIA, Plateau', 'Abidjan'],
  },
};

/** Resolve bank address from code. Falls back to a generic entry. */
export function resolveBankAddress(bankCode: string): BankDirectoryEntry {
  const normalized = bankCode.toUpperCase().trim();
  // Try exact match first, then prefix match
  if (BANK_DIRECTORY[normalized]) return BANK_DIRECTORY[normalized];
  const prefix = normalized.split('-')[0];
  if (BANK_DIRECTORY[prefix]) return BANK_DIRECTORY[prefix];
  return {
    code: bankCode,
    legalName: bankCode,
    addressLines: [],
  };
}
