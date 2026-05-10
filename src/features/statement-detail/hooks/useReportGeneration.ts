// ============================================================================
// useReportGeneration — génération + signature des rapports (Supabase)
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import type {
  ReportTemplate,
  SignatureType,
  SignedReport,
  ReportRecipient,
  BankComplaintLetter,
} from '../types/statement.types';
import { MOCK_SIGNED_REPORT_DRAFT, MOCK_COMPLAINT_LETTER } from '../mock-data';
import { isSupabaseConfigured } from '../../../lib/supabase';
import {
  createGeneratedReport,
  createSignedReportDraft,
  loadLatestSignedReport,
  signReport,
  createComplaintLetter,
  loadLatestComplaintLetter,
} from '../api/reportsApi';

export interface UseReportGenerationResult {
  generatedReport: SignedReport | null;
  complaintLetter: BankComplaintLetter | null;
  loading: boolean;
  error: string | null;

  generateReport: (template: ReportTemplate) => Promise<SignedReport>;
  signAndSend: (args: {
    reportId: string;
    signatureType: SignatureType;
    recipients: ReportRecipient[];
    message: string;
  }) => Promise<SignedReport>;
  generateComplaintLetter: (anomalyIds: string[]) => Promise<BankComplaintLetter>;
}

export function useReportGeneration(
  statementId: string,
  context?: { clientId?: string; bankCode?: string; signerId?: string },
): UseReportGenerationResult {
  const [generatedReport, setGeneratedReport] = useState<SignedReport | null>(null);
  const [complaintLetter, setComplaintLetter] = useState<BankComplaintLetter | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore les drafts existants au mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isSupabaseConfigured()) return;
      try {
        const [r, l] = await Promise.all([
          loadLatestSignedReport(statementId),
          loadLatestComplaintLetter(statementId),
        ]);
        if (cancelled) return;
        if (r) setGeneratedReport(r);
        if (l) setComplaintLetter(l);
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, [statementId]);

  // ============================================================================
  // generateReport — crée draft signé attaché à un generated_report
  // ============================================================================

  const generateReport = useCallback<UseReportGenerationResult['generateReport']>(
    async (template) => {
      setLoading(true);
      setError(null);
      try {
        if (isSupabaseConfigured() && context?.clientId) {
          // Stub: en prod, on appellerait Edge Function generate-report.
          // En attendant : on crée le generated_report en BDD avec un URL placeholder.
          const documentUrl = `/storage/reports/${statementId}-${template}-${Date.now()}.pdf`;
          const hash = await fakeHash(`${statementId}-${template}-${Date.now()}`);
          const gen = await createGeneratedReport({
            statementId,
            clientId: context.clientId,
            template,
            documentUrl,
            hash,
            anomalyCount: 0,
            totalAmountCentimes: 0,
            title: `Rapport ${template}`,
          });
          const draft = await createSignedReportDraft({
            statementId,
            generatedReportId: gen.id,
            template,
            documentUrl,
            hash,
          });
          setGeneratedReport(draft);
          return draft;
        }

        // Fallback mock
        await new Promise((r) => setTimeout(r, 200));
        const next: SignedReport = { ...MOCK_SIGNED_REPORT_DRAFT, template };
        setGeneratedReport(next);
        return next;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'generate failed';
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [statementId, context?.clientId],
  );

  // ============================================================================
  // signAndSend
  // ============================================================================

  const signAndSend = useCallback<UseReportGenerationResult['signAndSend']>(
    async (args) => {
      setLoading(true);
      try {
        if (isSupabaseConfigured() && context?.signerId) {
          const proofBundleUrl = args.signatureType === 'advist'
            ? `/storage/signed/${args.reportId}.zip`
            : null;
          const timestampRfc3161 = args.signatureType === 'advist'
            ? `${Date.now()}.advist.pending`
            : null;
          const signed = await signReport({
            reportId: args.reportId,
            signerId: context.signerId,
            signatureType: args.signatureType,
            recipients: args.recipients,
            proofBundleUrl,
            timestampRfc3161,
          });
          setGeneratedReport(signed);
          return signed;
        }

        // Fallback mock
        await new Promise((r) => setTimeout(r, 250));
        const signed: SignedReport = {
          ...(generatedReport ?? MOCK_SIGNED_REPORT_DRAFT),
          status: 'sent',
          signatureType: args.signatureType,
          signedAt: new Date().toISOString(),
          recipients: args.recipients,
          timestampRfc3161: args.signatureType === 'advist' ? `${Date.now()}.advist.mock` : null,
          proofBundleUrl: args.signatureType === 'advist'
            ? `/storage/signed/${args.reportId}.zip` : null,
        };
        setGeneratedReport(signed);
        return signed;
      } finally {
        setLoading(false);
      }
    },
    [context?.signerId, generatedReport],
  );

  // ============================================================================
  // generateComplaintLetter
  // ============================================================================

  const generateComplaintLetter = useCallback<UseReportGenerationResult['generateComplaintLetter']>(
    async (anomalyIds) => {
      setLoading(true);
      try {
        if (isSupabaseConfigured() && context?.signerId && context?.bankCode) {
          const letter = await createComplaintLetter({
            statementId,
            bankCode: context.bankCode,
            totalAmountClaimedCentimes: 0,
            anomalyIds,
            createdBy: context.signerId,
          });
          setComplaintLetter(letter);
          return letter;
        }

        // Fallback mock
        await new Promise((r) => setTimeout(r, 200));
        const letter: BankComplaintLetter = {
          ...MOCK_COMPLAINT_LETTER,
          anomaliesIncluded: anomalyIds,
        };
        setComplaintLetter(letter);
        return letter;
      } finally {
        setLoading(false);
      }
    },
    [statementId, context?.signerId, context?.bankCode],
  );

  return {
    generatedReport,
    complaintLetter,
    loading,
    error,
    generateReport,
    signAndSend,
    generateComplaintLetter,
  };
}

// ============================================================================
// Helpers
// ============================================================================

async function fakeHash(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  let h = '';
  const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i++) h += b[i].toString(16).padStart(2, '0');
  return h;
}
