// ============================================================================
// SCRUTIX - BOA CI Template (Bank of Africa Cote d'Ivoire)
// Layout du releve de compte BOA CI
// ============================================================================

import type { BankTemplate } from './BankTemplateTypes';

export const BOA_CI_TEMPLATE: BankTemplate = {
  code: 'boa-ci',
  bankCode: 'BOA_CI',
  bankName: 'Bank of Africa Cote d\'Ivoire',
  country: 'CI',
  region: 'UEMOA',
  headerZones: [
    { name: 'bankLogo', type: 'header', x: 2, y: 1, width: 20, height: 7 },
    { name: 'accountNumber', type: 'account', x: 60, y: 2, width: 35, height: 4 },
    { name: 'accountHolder', type: 'text', x: 60, y: 6, width: 35, height: 4 },
    { name: 'period', type: 'text', x: 30, y: 12, width: 40, height: 3 },
    { name: 'openingBalance', type: 'amount', x: 70, y: 15, width: 25, height: 3 },
  ],
  tableColumns: {
    date: { name: 'date', type: 'date', x: 2, y: 0, width: 10, height: 100 },
    valueDate: { name: 'valueDate', type: 'date', x: 12, y: 0, width: 10, height: 100 },
    description: { name: 'description', type: 'text', x: 22, y: 0, width: 35, height: 100 },
    debit: { name: 'debit', type: 'amount', x: 57, y: 0, width: 15, height: 100 },
    credit: { name: 'credit', type: 'amount', x: 72, y: 0, width: 15, height: 100 },
    balance: { name: 'balance', type: 'balance', x: 87, y: 0, width: 12, height: 100 },
  },
  tableArea: { y: 20, height: 72 },
  dateFormat: 'dd/MM/yyyy',
  numberFormat: {
    decimalSeparator: ',',
    thousandsSeparator: '.',
  },
  currency: 'XOF',
  headerPattern: /BOA[\s-]*CI|BANK\s+OF\s+AFRICA.*?COTE\s+D.?IVOIRE/i,
  version: 1,
};
