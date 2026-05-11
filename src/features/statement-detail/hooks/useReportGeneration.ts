// ============================================================================
// useReportGeneration — génération + signature des rapports
// ============================================================================
// Flow réel :
//   1. invoke Edge Function `generate-report` (jsPDF + Storage upload)
//   2. l'Edge Function persiste atlasbanx.generated_reports + signed_reports
//   3. retourne { reportId, generatedReportId, documentUrl, hash }
//   4. on hydrate generatedReport en local pour faire apparaître la preview
//
// Fallback si Supabase pas configuré OU si l'Edge Function timeout/échoue :
//   on garde un draft local (MOCK_SIGNED_REPORT_DRAFT) pour que l'UI ne reste
//   pas vide — avec un message d'erreur lisible dans la card.
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
import { getSupabaseClient, isSupabaseConfigured } from '../../../lib/supabase';
import {
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
  // generateReport — appelle l'Edge Function generate-report (jsPDF + Storage)
  // ============================================================================

  const generateReport = useCallback<UseReportGenerationResult['generateReport']>(
    async (template) => {
      setLoading(true);
      setError(null);

      // Mock fallback si Supabase pas configuré (dev offline)
      if (!isSupabaseConfigured()) {
        await new Promise((r) => setTimeout(r, 200));
        const next: SignedReport = { ...MOCK_SIGNED_REPORT_DRAFT, template };
        setGeneratedReport(next);
        setLoading(false);
        return next;
      }

      const sb = getSupabaseClient();
      if (!sb) {
        // ne devrait jamais arriver vu isSupabaseConfigured() mais safe
        const fallback: SignedReport = { ...MOCK_SIGNED_REPORT_DRAFT, template };
        setGeneratedReport(fallback);
        setLoading(false);
        return fallback;
      }

      try {
        // Invoke l'Edge Function generate-report qui :
        //   - charge statement + transactions + anomalies + convention
        //   - construit le PDF avec jsPDF
        //   - upload dans bucket `reports/` sur Storage
        //   - INSERT atlasbanx.generated_reports (avec user_id = auth.uid())
        //   - INSERT atlasbanx.signed_reports en status='draft'
        //   - retourne { reportId, generatedReportId, documentUrl, hash, ... }
        const { data, error: fnErr } = await sb.functions.invoke('generate-report', {
          body: { statementId, template },
        });

        if (fnErr) {
          throw new Error(`Edge Function: ${fnErr.message ?? 'invocation failed'}`);
        }
        if (!data?.documentUrl) {
          throw new Error(data?.error ?? 'generate-report: réponse incomplète');
        }

        const signed: SignedReport = {
          id: data.reportId,
          statementId,
          template,
          signerId: null,
          signerHandle: null,
          signatureType: null,
          documentUrl: data.documentUrl,
          proofBundleUrl: null,
          hash: data.hash ?? '',
          timestampRfc3161: null,
          recipients: [],
          status: 'draft',
          signedAt: null,
          createdAt: new Date().toISOString(),
        };
        setGeneratedReport(signed);
        setLoading(false);
        return signed;
      } catch (err) {
        // Important : on ne throw PAS — on dégrade pour que l'UI affiche au
        // moins une card (avec message d'erreur dans la preview) au lieu de
        // laisser le user devant un écran qui n'évolue pas.
        const msg = err instanceof Error ? err.message : 'Erreur génération rapport';
        console.error('[useReportGeneration] generateReport failed:', err);
        setError(msg);
        const fallback: SignedReport = {
          ...MOCK_SIGNED_REPORT_DRAFT,
          template,
          documentUrl: '',  // signale la card que le PDF n'est pas dispo
          hash: '—',
        };
        setGeneratedReport(fallback);
        setLoading(false);
        return fallback;
      }
    },
    [statementId],
  );

  // ============================================================================
  // signAndSend — invoke Edge Function sign-and-send (ADVIST + Resend)
  // ============================================================================

  const signAndSend = useCallback<UseReportGenerationResult['signAndSend']>(
    async (args) => {
      setLoading(true);
      setError(null);

      if (!isSupabaseConfigured()) {
        await new Promise((r) => setTimeout(r, 250));
        const signed: SignedReport = {
          ...(generatedReport ?? MOCK_SIGNED_REPORT_DRAFT),
          status: 'sent',
          signatureType: args.signatureType,
          signedAt: new Date().toISOString(),
          recipients: args.recipients,
        };
        setGeneratedReport(signed);
        setLoading(false);
        return signed;
      }

      const sb = getSupabaseClient();
      if (!sb) {
        setLoading(false);
        throw new Error('Supabase client indisponible');
      }

      try {
        // Invoke l'Edge Function sign-and-send qui :
        //   - récupère le rapport, demande timestamp ADVIST si signature_type='advist'
        //   - UPDATE signed_reports.status='sent' + recipients + signed_at
        //   - INSERT audit_trail (signature, hash chaîné)
        //   - envoie les emails via Resend (PDF en pièce jointe)
        //   - émet l'event atlasbanx.report.signed
        const { data, error: fnErr } = await sb.functions.invoke('sign-and-send', {
          body: {
            reportId: args.reportId,
            signatureType: args.signatureType,
            recipients: args.recipients,
            message: args.message,
          },
        });
        if (fnErr) throw new Error(`Edge Function: ${fnErr.message ?? 'invocation failed'}`);

        // Fallback côté client : si on a l'objet generatedReport, le mettre à jour.
        // Sinon recharge depuis BDD.
        if (context?.signerId) {
          const signed = await signReport({
            reportId: args.reportId,
            signerId: context.signerId,
            signatureType: args.signatureType,
            recipients: args.recipients,
            proofBundleUrl: data?.proofBundleUrl ?? null,
            timestampRfc3161: data?.timestampRfc3161 ?? null,
          }).catch(() => null);
          if (signed) {
            setGeneratedReport(signed);
            setLoading(false);
            return signed;
          }
        }

        // Refallback : on update le state local seulement
        const next: SignedReport = {
          ...(generatedReport ?? MOCK_SIGNED_REPORT_DRAFT),
          status: 'sent',
          signatureType: args.signatureType,
          signedAt: new Date().toISOString(),
          recipients: args.recipients,
          timestampRfc3161: data?.timestampRfc3161 ?? null,
          proofBundleUrl: data?.proofBundleUrl ?? null,
        };
        setGeneratedReport(next);
        setLoading(false);
        return next;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur signature';
        console.error('[useReportGeneration] signAndSend failed:', err);
        setError(msg);
        setLoading(false);
        throw err;
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
      setError(null);
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
          setLoading(false);
          return letter;
        }

        // Fallback mock
        await new Promise((r) => setTimeout(r, 200));
        const letter: BankComplaintLetter = {
          ...MOCK_COMPLAINT_LETTER,
          anomaliesIncluded: anomalyIds,
        };
        setComplaintLetter(letter);
        setLoading(false);
        return letter;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur génération lettre';
        console.error('[useReportGeneration] generateComplaintLetter failed:', err);
        setError(msg);
        setLoading(false);
        // Fallback local pour ne pas bloquer l'UI
        const fallback: BankComplaintLetter = {
          ...MOCK_COMPLAINT_LETTER,
          anomaliesIncluded: anomalyIds,
        };
        setComplaintLetter(fallback);
        return fallback;
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
