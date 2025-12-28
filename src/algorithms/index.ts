// Scrutix Detection Algorithms

// Modules existants
export { DuplicateDetector } from './DuplicateDetector';
export { GhostFeeDetector } from './GhostFeeDetector';
export { OverchargeAnalyzer } from './OverchargeAnalyzer';
export { InterestCalculator } from './InterestCalculator';

// Nouveaux modules d'audit
export { ValueDateAudit } from './ValueDateAudit';
export { SuspiciousAudit } from './SuspiciousAudit';
export { ComplianceAudit } from './ComplianceAudit';
export { CashflowAudit } from './CashflowAudit';
export { ReconciliationAudit, type AccountingEntry } from './ReconciliationAudit';
export { MultiBankAudit } from './MultiBankAudit';
export { OhadaAudit } from './OhadaAudit';
export { AmlAudit } from './AmlAudit';

// Modules d'audit par catégorie de frais
export { AccountFeesAudit } from './AccountFeesAudit';
export { CardFeesAudit } from './CardFeesAudit';
export { PaymentMethodsAudit } from './PaymentMethodsAudit';
export { InternationalAudit } from './InternationalAudit';
export { AncillaryServicesAudit } from './AncillaryServicesAudit';
export { PackagesAudit } from './PackagesAudit';

// Utility functions
export * from './utils';
