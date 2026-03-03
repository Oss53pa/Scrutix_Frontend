// ============================================================================
// SCRUTIX - Banque Atlantique Template
// Layout du releve de compte Banque Atlantique
// ============================================================================

import type { BankTemplate } from './BankTemplateTypes';

export const ATLANTIQUE_TEMPLATE: BankTemplate = {
  code: 'atlantique',
  bankCode: 'ATLANTIQUE',
  bankName: 'Banque Atlantique',
  country: 'CI',
  region: 'UEMOA',
  headerZones: [
    { name: 'bankLogo', type: 'header', x: 2, y: 1, width: 25, height: 8 },
    { name: 'accountNumber', type: 'account', x: 50, y: 3, width: 45, height: 4 },
    { name: 'accountHolder', type: 'text', x: 50, y: 7, width: 45, height: 4 },
    { name: 'period', type: 'text', x: 30, y: 12, width: 40, height: 3 },
    { name: 'openingBalance', type: 'amount', x: 65, y: 16, width: 30, height: 3 },
  ],
  tableColumns: {
    date: { name: 'date', type: 'date', x: 2, y: 0, width: 10, height: 100 },
    valueDate: { name: 'valueDate', type: 'date', x: 12, y: 0, width: 10, height: 100 },
    description: { name: 'description', type: 'text', x: 22, y: 0, width: 38, height: 100 },
    debit: { name: 'debit', type: 'amount', x: 60, y: 0, width: 14, height: 100 },
    credit: { name: 'credit', type: 'amount', x: 74, y: 0, width: 14, height: 100 },
    balance: { name: 'balance', type: 'balance', x: 86, y: 0, width: 13, height: 100 },
  },
  tableArea: { y: 21, height: 71 },
  dateFormat: 'dd/MM/yyyy',
  numberFormat: {
    decimalSeparator: ',',
    thousandsSeparator: ' ',
  },
  currency: 'XOF',
  headerPattern: /BANQUE\s+ATLANTIQUE|ATLANTIQUE\s+CI|BA[\s-]*CI/i,
  version: 1,
};
