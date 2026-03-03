// ============================================================================
// SCRUTIX - NSIA Banque Template
// Layout du releve de compte NSIA Banque
// ============================================================================

import type { BankTemplate } from './BankTemplateTypes';

export const NSIA_TEMPLATE: BankTemplate = {
  code: 'nsia',
  bankCode: 'NSIA',
  bankName: 'NSIA Banque',
  country: 'CI',
  region: 'UEMOA',
  headerZones: [
    { name: 'bankLogo', type: 'header', x: 2, y: 1, width: 22, height: 9 },
    { name: 'accountNumber', type: 'account', x: 55, y: 3, width: 40, height: 4 },
    { name: 'accountHolder', type: 'text', x: 55, y: 7, width: 40, height: 4 },
    { name: 'period', type: 'text', x: 30, y: 13, width: 40, height: 3 },
    { name: 'openingBalance', type: 'amount', x: 68, y: 17, width: 27, height: 3 },
  ],
  tableColumns: {
    date: { name: 'date', type: 'date', x: 2, y: 0, width: 10, height: 100 },
    valueDate: { name: 'valueDate', type: 'date', x: 12, y: 0, width: 10, height: 100 },
    description: { name: 'description', type: 'text', x: 22, y: 0, width: 36, height: 100 },
    debit: { name: 'debit', type: 'amount', x: 58, y: 0, width: 14, height: 100 },
    credit: { name: 'credit', type: 'amount', x: 72, y: 0, width: 14, height: 100 },
    balance: { name: 'balance', type: 'balance', x: 86, y: 0, width: 13, height: 100 },
  },
  tableArea: { y: 22, height: 70 },
  dateFormat: 'dd/MM/yyyy',
  numberFormat: {
    decimalSeparator: ',',
    thousandsSeparator: ' ',
  },
  currency: 'XOF',
  headerPattern: /NSIA\s+BANQUE/i,
  version: 1,
};
