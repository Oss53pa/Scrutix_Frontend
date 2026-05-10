// ============================================================================
// PROPH3T tools — barrel + registry
// ============================================================================
// Chaque tool vit dans son propre fichier (spec §7).
// Calculs déterministes en TypeScript pur — le LLM ne calcule jamais,
// il sélectionne le tool et formule la réponse à partir du résultat.
// ============================================================================

export { searchTransactions, type SearchTransactionsArgs, type SearchTransactionsResult } from './searchTransactions';
export { aggregateAmount, type AggregateAmountArgs, type AggregateAmountResult } from './aggregateAmount';
export { compareStatements, type CompareStatementsArgs, type CompareStatementsResult } from './compareStatements';
export { findAnomalies, type FindAnomaliesArgs, type FindAnomaliesResult } from './findAnomalies';
export { draftEmail, type DraftEmailArgs, type DraftEmailResult } from './draftEmail';

import { searchTransactions } from './searchTransactions';
import { aggregateAmount } from './aggregateAmount';
import { compareStatements } from './compareStatements';
import { findAnomalies } from './findAnomalies';
import { draftEmail } from './draftEmail';

export const PROPHET_TOOLS = {
  searchTransactions,
  aggregateAmount,
  compareStatements,
  findAnomalies,
  draftEmail,
} as const;

export type ProphetToolName = keyof typeof PROPHET_TOOLS;
