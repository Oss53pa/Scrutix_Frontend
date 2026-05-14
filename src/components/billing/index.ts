// Re-export the polished V2 page (BillingService + Supabase) as default,
// keeping the legacy BillingPage available for backward compat if needed.
export { FacturationPageV2 as BillingPage } from './FacturationPageV2';
export { BillingPage as BillingPageLegacy } from './BillingPage';
export { FacturationPage } from './FacturationPage';
export { FacturationPageV2 } from './FacturationPageV2';
export { BillingSettingsPanel } from './BillingSettingsPanel';
export { InvoiceForm } from './InvoiceForm';
export { InvoicePreview } from './InvoicePreview';
export { InvoiceStatusBadge } from './InvoiceStatusBadge';
