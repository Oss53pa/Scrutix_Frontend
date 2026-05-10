// ============================================================================
// SignAndSendCard — signature + envoi par email Resend
// ============================================================================

import { useState } from 'react';
import { Send, Mail, ShieldCheck, X } from 'lucide-react';
import { ConfirmDialog, RoleGuard, UserPill } from '../../../../components/shared';
import type {
  SignatureType, SignedReport, ReportRecipient,
} from '../../types/statement.types';

interface SignAndSendCardProps {
  report: SignedReport;
  currentUser: { handle: string; displayName: string; role: 'dg' | 'senior' | 'junior' | 'consultation' };
  onSignAndSend?: (args: {
    reportId: string;
    signatureType: SignatureType;
    recipients: ReportRecipient[];
    message: string;
  }) => Promise<void>;
}

export function SignAndSendCard({ report, currentUser, onSignAndSend }: SignAndSendCardProps) {
  const [signatureType, setSignatureType] = useState<SignatureType>('advist');
  const [recipients, setRecipients] = useState<ReportRecipient[]>([
    { email: 'pamela@example.com', displayName: 'Pamela ATOKOUNA (client)', audience: 'client' },
    { email: 'kadi@cabinet.com',   displayName: '@KadiL (interne)',         audience: 'internal' },
  ]);
  const [message, setMessage] = useState(
    'Bonjour,\n\nVeuillez trouver ci-joint le rapport d\'audit signé pour le relevé de la période concernée.\n\nCordialement,',
  );
  const [openConfirm, setOpenConfirm] = useState(false);
  const canSign = currentUser.role === 'dg' || currentUser.role === 'senior';

  return (
    <div className="bg-white border border-canvas-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3">Signature et envoi</h3>

      <div className="text-xs space-y-3">
        <div>
          <div className="text-ink-500 mb-1">Signataire (selon vos permissions) :</div>
          <UserPill user={currentUser} />
        </div>

        <div>
          <div className="text-ink-500 mb-1">Type de signature :</div>
          <label className="flex items-center gap-2 py-0.5">
            <input type="radio" name="sig" checked={signatureType === 'simple'} onChange={() => setSignatureType('simple')} className="accent-amber-600" />
            Signature simple (PDF avec hash + horodatage)
          </label>
          <label className="flex items-center gap-2 py-0.5">
            <input type="radio" name="sig" checked={signatureType === 'advist'} onChange={() => setSignatureType('advist')} className="accent-amber-600" />
            <ShieldCheck className="w-3 h-3 inline text-emerald-600" />
            Signature ADVIST légalement opposable (recommandé)
          </label>
        </div>

        <div>
          <div className="text-ink-500 mb-1">Destinataires :</div>
          {recipients.map((r, i) => (
            <div key={i} className="flex items-center gap-2 py-0.5">
              <Mail className="w-3 h-3 text-ink-400" />
              <span className="font-mono text-[11px]">{r.email}</span>
              <span className="text-ink-500">· {r.displayName}</span>
              <button
                onClick={() => setRecipients((rs) => rs.filter((_, j) => j !== i))}
                className="ml-auto text-ink-400 hover:text-rose-600"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            onClick={() => setRecipients((rs) => [...rs, { email: '', displayName: '', audience: 'internal' }])}
            className="mt-1 text-[11px] text-amber-700 hover:underline"
          >
            + Ajouter un destinataire
          </button>
        </div>

        <div>
          <div className="text-ink-500 mb-1">Message d'accompagnement :</div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="w-full px-2 py-1.5 text-xs border border-canvas-300 rounded font-mono"
          />
        </div>
      </div>

      <RoleGuard role={['senior', 'dg']}>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button className="px-3 py-1.5 text-xs border border-canvas-300 rounded hover:bg-canvas-50">
            Aperçu email
          </button>
          <button
            disabled={!canSign}
            onClick={() => setOpenConfirm(true)}
            className="px-3 py-1.5 text-xs font-semibold rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
          >
            <Send className="inline w-3 h-3 mr-1" />
            Signer et envoyer
          </button>
        </div>
      </RoleGuard>

      <ConfirmDialog
        open={openConfirm}
        onClose={() => setOpenConfirm(false)}
        title="Confirmer la signature"
        variant="success"
        confirmLabel="Confirmer la signature"
        commentLabel="Commentaire (optionnel)"
        futureHash={report.hash.slice(0, 16) + '…' + report.hash.slice(-4)}
        description={
          <span>
            Vous allez signer ce rapport au nom de <b>{currentUser.displayName}</b>.
            Cette signature est légalement opposable et ne pourra être révoquée.
          </span>
        }
        onConfirm={async () => {
          if (onSignAndSend) {
            await onSignAndSend({ reportId: report.id, signatureType, recipients, message });
          }
        }}
      />
    </div>
  );
}
