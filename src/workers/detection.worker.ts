// ============================================================================
// SCRUTIX - Detection Web Worker
// Execution parallele des modules de detection algorithmique
// ============================================================================

import { DuplicateDetector } from '../algorithms/DuplicateDetector';
import { GhostFeeDetector } from '../algorithms/GhostFeeDetector';
import { OverchargeAnalyzer } from '../algorithms/OverchargeAnalyzer';
import { InterestCalculator } from '../algorithms/InterestCalculator';
import { ValueDateAudit } from '../algorithms/ValueDateAudit';
import { SuspiciousAudit } from '../algorithms/SuspiciousAudit';
import { ComplianceAudit } from '../algorithms/ComplianceAudit';
import { CashflowAudit } from '../algorithms/CashflowAudit';
import { ReconciliationAudit } from '../algorithms/ReconciliationAudit';
import { MultiBankAudit } from '../algorithms/MultiBankAudit';
import { OhadaAudit } from '../algorithms/OhadaAudit';
import { AmlAudit } from '../algorithms/AmlAudit';
import { AccountFeesAudit } from '../algorithms/AccountFeesAudit';
import { CardFeesAudit } from '../algorithms/CardFeesAudit';
import { PaymentMethodsAudit } from '../algorithms/PaymentMethodsAudit';
import { InternationalAudit } from '../algorithms/InternationalAudit';
import { AncillaryServicesAudit } from '../algorithms/AncillaryServicesAudit';
import { PackagesAudit } from '../algorithms/PackagesAudit';
import type { Transaction, Anomaly, BankConditions, DailyBalance, DetectionThresholds } from '../types';

// ----------------------------------------------------------------------------
// Message Protocol
// ----------------------------------------------------------------------------

export interface WorkerMessage {
  type: 'RUN_DETECTION';
  id: string;
  detectorType: string;
  transactions: Transaction[];
  bankConditions?: BankConditions;
  thresholds?: DetectionThresholds;
  accountBalances?: DailyBalance[];
}

export interface WorkerResponse {
  type: 'RESULT' | 'ERROR';
  id: string;
  detectorType: string;
  anomalies?: Anomaly[];
  error?: string;
  processingTime: number;
}

// ----------------------------------------------------------------------------
// Worker Entry Point
// ----------------------------------------------------------------------------

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const msg = event.data;

  if (msg.type !== 'RUN_DETECTION') return;

  const startTime = performance.now();

  try {
    const anomalies = runDetector(
      msg.detectorType,
      msg.transactions,
      msg.bankConditions,
      msg.thresholds,
      msg.accountBalances
    );

    const response: WorkerResponse = {
      type: 'RESULT',
      id: msg.id,
      detectorType: msg.detectorType,
      anomalies,
      processingTime: performance.now() - startTime,
    };

    self.postMessage(response);
  } catch (err) {
    const response: WorkerResponse = {
      type: 'ERROR',
      id: msg.id,
      detectorType: msg.detectorType,
      error: err instanceof Error ? err.message : 'Erreur inconnue',
      processingTime: performance.now() - startTime,
    };

    self.postMessage(response);
  }
};

// ----------------------------------------------------------------------------
// Detector Routing
// ----------------------------------------------------------------------------

function runDetector(
  detectorType: string,
  transactions: Transaction[],
  bankConditions?: BankConditions,
  thresholds?: DetectionThresholds,
  accountBalances?: DailyBalance[]
): Anomaly[] {
  switch (detectorType) {
    case 'DUPLICATE_FEE': {
      const detector = new DuplicateDetector(thresholds?.duplicateDetection);
      return detector.detectDuplicates(transactions, bankConditions);
    }

    case 'GHOST_FEE': {
      const detector = new GhostFeeDetector(thresholds?.ghostFeeDetection);
      return detector.detectGhostFees(transactions, bankConditions);
    }

    case 'OVERCHARGE': {
      const detector = new OverchargeAnalyzer(thresholds?.overchargeDetection);
      return bankConditions
        ? detector.detectOvercharges(transactions, bankConditions)
        : [];
    }

    case 'INTEREST_ERROR': {
      if (!bankConditions || !accountBalances) return [];
      const detector = new InterestCalculator(thresholds?.interestCalculation);
      return detector.verifyInterestCharges(transactions, bankConditions, accountBalances);
    }

    case 'VALUE_DATE_ERROR': {
      const audit = bankConditions
        ? new ValueDateAudit({}, bankConditions)
        : new ValueDateAudit();
      return audit.analyze(transactions);
    }

    case 'SUSPICIOUS_TRANSACTION': {
      const audit = new SuspiciousAudit();
      return audit.analyze(transactions);
    }

    case 'COMPLIANCE_VIOLATION': {
      if (!bankConditions) return [];
      const audit = new ComplianceAudit(bankConditions);
      return audit.analyze(transactions);
    }

    case 'CASHFLOW_ANOMALY': {
      const audit = new CashflowAudit();
      return audit.analyze(transactions);
    }

    case 'RECONCILIATION_GAP': {
      const audit = new ReconciliationAudit();
      return audit.analyze(transactions);
    }

    case 'MULTI_BANK_ISSUE': {
      const audit = bankConditions
        ? new MultiBankAudit([bankConditions])
        : new MultiBankAudit([]);
      return audit.analyze(transactions);
    }

    case 'OHADA_NON_COMPLIANCE': {
      const audit = new OhadaAudit();
      return audit.analyze(transactions);
    }

    case 'AML_ALERT': {
      const audit = new AmlAudit();
      return audit.analyze(transactions);
    }

    // Fee category audits
    case 'FEE_ANOMALY_ACCOUNT': {
      const audit = bankConditions
        ? new AccountFeesAudit({}, bankConditions)
        : new AccountFeesAudit();
      return audit.analyze(transactions);
    }

    case 'FEE_ANOMALY_CARD': {
      const audit = bankConditions
        ? new CardFeesAudit({}, bankConditions)
        : new CardFeesAudit();
      return audit.analyze(transactions);
    }

    case 'FEE_ANOMALY_PAYMENT': {
      const audit = bankConditions
        ? new PaymentMethodsAudit({}, bankConditions)
        : new PaymentMethodsAudit();
      return audit.analyze(transactions);
    }

    case 'FEE_ANOMALY_INTERNATIONAL': {
      const audit = bankConditions
        ? new InternationalAudit({}, bankConditions)
        : new InternationalAudit();
      return audit.analyze(transactions);
    }

    case 'FEE_ANOMALY_ANCILLARY': {
      const audit = bankConditions
        ? new AncillaryServicesAudit({}, bankConditions)
        : new AncillaryServicesAudit();
      return audit.analyze(transactions);
    }

    case 'FEE_ANOMALY_PACKAGES': {
      const audit = bankConditions
        ? new PackagesAudit({}, bankConditions)
        : new PackagesAudit();
      return audit.analyze(transactions);
    }

    default:
      throw new Error(`Detecteur inconnu: ${detectorType}`);
  }
}
