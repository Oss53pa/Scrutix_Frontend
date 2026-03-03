// ============================================================================
// SCRUTIX - Custom Template Support
// Creation de templates personnalises par annotation utilisateur
// ============================================================================

import type { BankTemplate, ZoneDefinition, CustomBankTemplate } from './BankTemplateTypes';

/**
 * Annotations de zones par l'utilisateur
 */
export interface UserAnnotation {
  /** Nom de la zone */
  name: string;
  /** Type de donnee */
  type: ZoneDefinition['type'];
  /** Coordonnees en pixels */
  rect: { x: number; y: number; width: number; height: number };
}

/**
 * Cree un template personnalise a partir d'annotations utilisateur
 */
export function createCustomTemplate(
  annotations: UserAnnotation[],
  imageWidth: number,
  imageHeight: number,
  bankInfo: {
    bankCode: string;
    bankName: string;
    country: string;
    region: 'CEMAC' | 'UEMOA';
    currency: string;
    dateFormat?: string;
    decimalSeparator?: ',' | '.';
  }
): CustomBankTemplate {
  // Convertir les pixels en pourcentages
  const toPercent = (annotation: UserAnnotation): ZoneDefinition => ({
    name: annotation.name,
    type: annotation.type,
    x: (annotation.rect.x / imageWidth) * 100,
    y: (annotation.rect.y / imageHeight) * 100,
    width: (annotation.rect.width / imageWidth) * 100,
    height: (annotation.rect.height / imageHeight) * 100,
  });

  // Separer les zones d'en-tete et les colonnes du tableau
  const headerAnnotations = annotations.filter(a =>
    ['header', 'account'].includes(a.type) || a.name.startsWith('header_')
  );

  const columnAnnotations = annotations.filter(a =>
    !headerAnnotations.includes(a)
  );

  const headerZones = headerAnnotations.map(toPercent);

  // Construire les colonnes du tableau
  const findColumn = (name: string): ZoneDefinition | undefined => {
    const ann = columnAnnotations.find(a => a.name === name);
    return ann ? toPercent(ann) : undefined;
  };

  const dateCol = findColumn('date');
  const descCol = findColumn('description');
  const debitCol = findColumn('debit');
  const creditCol = findColumn('credit');

  if (!dateCol || !descCol || !debitCol || !creditCol) {
    throw new Error(
      'Le template doit contenir au minimum les colonnes: date, description, debit, credit'
    );
  }

  // Estimer la zone du tableau
  const allColumnAnnotations = columnAnnotations.map(toPercent);
  const minY = Math.min(...allColumnAnnotations.map(z => z.y));
  const maxY = Math.max(...allColumnAnnotations.map(z => z.y + z.height));

  const now = Date.now();
  const id = `custom_${bankInfo.bankCode}_${now}`;

  return {
    id,
    code: id,
    bankCode: bankInfo.bankCode,
    bankName: bankInfo.bankName,
    country: bankInfo.country,
    region: bankInfo.region,
    isCustom: true,
    createdAt: now,
    updatedAt: now,
    headerZones,
    tableColumns: {
      date: dateCol,
      valueDate: findColumn('valueDate'),
      description: descCol,
      debit: debitCol,
      credit: creditCol,
      balance: findColumn('balance'),
      reference: findColumn('reference'),
    },
    tableArea: {
      y: minY,
      height: maxY - minY,
    },
    dateFormat: bankInfo.dateFormat || 'dd/MM/yyyy',
    numberFormat: {
      decimalSeparator: bankInfo.decimalSeparator || ',',
      thousandsSeparator: ' ',
    },
    currency: bankInfo.currency,
    headerPattern: new RegExp(bankInfo.bankName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
    version: 1,
  };
}
