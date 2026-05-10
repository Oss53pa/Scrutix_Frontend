// ============================================================================
// prophet-copilot — exports publics
// ============================================================================

export { ProphetDrawer } from './components/ProphetDrawer';
export { useProphet, type UseProphetResult, type UseProphetArgs } from './hooks/useProphet';

export {
  searchTransactions,
  aggregateAmount,
  findAnomalies,
  draftEmail,
  PROPHET_TOOLS,
  type ProphetToolName,
  type SearchTransactionsArgs,
  type SearchTransactionsResult,
  type AggregateAmountArgs,
  type AggregateAmountResult,
  type FindAnomaliesArgs,
  type DraftEmailArgs,
  type DraftEmailResult,
} from './tools';
