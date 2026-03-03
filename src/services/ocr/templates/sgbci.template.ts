// ============================================================================
// SCRUTIX - SGBCI Template (Societe Generale Cote d'Ivoire)
// Layout du releve de compte SGBCI
// ============================================================================

import type { BankTemplate } from './BankTemplateTypes';

export const SGBCI_TEMPLATE: BankTemplate = {
  code: 'sgbci',
  bankCode: 'SGBCI',
  bankName: 'Societe Generale Cote d\'Ivoire',
  country: 'CI',
  region: 'UEMOA',
  headerZones: [
    { name: 'bankLogo', type: 'header', x: 2, y: 1, width: 25, height: 8 },
    { name: 'accountNumber', type: 'account', x: 55, y: 3, width: 40, height: 4 },
    { name: 'accountHolder', type: 'text', x: 55, y: 7, width: 40, height: 4 },
    { name: 'period', type: 'text', x: 55, y: 12, width: 40, height: 3 },
    { name: 'openingBalance', type: 'amount', x: 65, y: 16, width: 30, height: 3 },
  ],
  tableColumns: {
    date: { name: 'date', type: 'date', x: 2, y: 0, width: 10, height: 100 },
    valueDate: { name: 'valueDate', type: 'date', x: 12, y: 0, width: 10, height: 100 },
    description: { name: 'description', type: 'text', x: 22, y: 0, width: 38, height: 100 },
    debit: { name: 'debit', type: 'amount', x: 60, y: 0, width: 15, height: 100 },
    credit: { name: 'credit', type: 'amount', x: 75, y: 0, width: 15, height: 100 },
    balance: { name: 'balance', type: 'balance', x: 85, y: 0, width: 14, height: 100 },
  },
  tableArea: { y: 22, height: 70 },
  dateFormat: 'dd/MM/yyyy',
  numberFormat: {
    decimalSeparator: ',',
    thousandsSeparator: ' ',
  },
  currency: 'XOF',
  headerPattern: /SGBCI|SOCIETE\s+GENERALE.*?COTE\s+D.?IVOIRE/i,
  version: 1,
};
