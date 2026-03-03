// ============================================================================
// SCRUTIX - Ecobank CI Template
// Layout du releve de compte Ecobank Cote d'Ivoire
// ============================================================================

import type { BankTemplate } from './BankTemplateTypes';

export const ECOBANK_CI_TEMPLATE: BankTemplate = {
  code: 'ecobank-ci',
  bankCode: 'ECOBANK_CI',
  bankName: 'Ecobank Cote d\'Ivoire',
  country: 'CI',
  region: 'UEMOA',
  headerZones: [
    { name: 'bankLogo', type: 'header', x: 2, y: 1, width: 18, height: 8 },
    { name: 'accountNumber', type: 'account', x: 50, y: 2, width: 45, height: 4 },
    { name: 'accountHolder', type: 'text', x: 50, y: 6, width: 45, height: 4 },
    { name: 'period', type: 'text', x: 50, y: 10, width: 45, height: 3 },
    { name: 'openingBalance', type: 'amount', x: 65, y: 14, width: 30, height: 3 },
  ],
  tableColumns: {
    date: { name: 'date', type: 'date', x: 2, y: 0, width: 9, height: 100 },
    valueDate: { name: 'valueDate', type: 'date', x: 11, y: 0, width: 9, height: 100 },
    reference: { name: 'reference', type: 'reference', x: 20, y: 0, width: 10, height: 100 },
    description: { name: 'description', type: 'text', x: 30, y: 0, width: 30, height: 100 },
    debit: { name: 'debit', type: 'amount', x: 60, y: 0, width: 13, height: 100 },
    credit: { name: 'credit', type: 'amount', x: 73, y: 0, width: 13, height: 100 },
    balance: { name: 'balance', type: 'balance', x: 86, y: 0, width: 13, height: 100 },
  },
  tableArea: { y: 20, height: 72 },
  dateFormat: 'dd/MM/yyyy',
  numberFormat: {
    decimalSeparator: ',',
    thousandsSeparator: ' ',
  },
  currency: 'XOF',
  headerPattern: /ECOBANK.*?CI|ECOBANK.*?IVOIRE|ECOBANK.*?ABIDJAN/i,
  version: 1,
};
