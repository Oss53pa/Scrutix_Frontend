// ============================================================================
// SCRUTIX - Template Registry
// Registre des templates de releves bancaires
// ============================================================================

import type { BankTemplate } from './BankTemplateTypes';
import { SGBCI_TEMPLATE } from './sgbci.template';
import { BOA_CI_TEMPLATE } from './boa-ci.template';
import { ECOBANK_CI_TEMPLATE } from './ecobank-ci.template';
import { NSIA_TEMPLATE } from './nsia.template';
import { ATLANTIQUE_TEMPLATE } from './atlantique.template';

/**
 * Tous les templates pre-configures
 */
const BUILT_IN_TEMPLATES: BankTemplate[] = [
  SGBCI_TEMPLATE,
  BOA_CI_TEMPLATE,
  ECOBANK_CI_TEMPLATE,
  NSIA_TEMPLATE,
  ATLANTIQUE_TEMPLATE,
];

/**
 * Templates personnalises (runtime)
 */
const customTemplates: BankTemplate[] = [];

/**
 * Retourne le template pour un code banque
 */
export function getTemplateForBank(bankCode: string): BankTemplate | null {
  // Chercher d'abord dans les custom (priorite)
  const custom = customTemplates.find(t => t.bankCode === bankCode);
  if (custom) return custom;

  // Puis dans les built-in
  return BUILT_IN_TEMPLATES.find(t => t.bankCode === bankCode) || null;
}

/**
 * Retourne tous les templates disponibles
 */
export function getAllTemplates(): BankTemplate[] {
  return [...BUILT_IN_TEMPLATES, ...customTemplates];
}

/**
 * Auto-detecte le template a partir du texte d'en-tete
 */
export function matchTemplate(headerText: string): BankTemplate | null {
  // Chercher dans les custom d'abord
  for (const template of customTemplates) {
    if (template.headerPattern.test(headerText)) {
      return template;
    }
  }

  // Puis dans les built-in
  for (const template of BUILT_IN_TEMPLATES) {
    if (template.headerPattern.test(headerText)) {
      return template;
    }
  }

  return null;
}

/**
 * Enregistre un template personnalise
 */
export function registerCustomTemplate(template: BankTemplate): void {
  // Remplacer si existe deja
  const existingIndex = customTemplates.findIndex(t => t.code === template.code);
  if (existingIndex >= 0) {
    customTemplates[existingIndex] = template;
  } else {
    customTemplates.push(template);
  }
}

/**
 * Supprime un template personnalise
 */
export function removeCustomTemplate(code: string): boolean {
  const index = customTemplates.findIndex(t => t.code === code);
  if (index >= 0) {
    customTemplates.splice(index, 1);
    return true;
  }
  return false;
}

// Re-exports
export type { BankTemplate, ZoneDefinition, CustomBankTemplate } from './BankTemplateTypes';
export { SGBCI_TEMPLATE } from './sgbci.template';
export { BOA_CI_TEMPLATE } from './boa-ci.template';
export { ECOBANK_CI_TEMPLATE } from './ecobank-ci.template';
export { NSIA_TEMPLATE } from './nsia.template';
export { ATLANTIQUE_TEMPLATE } from './atlantique.template';
export { createCustomTemplate } from './custom.template';
