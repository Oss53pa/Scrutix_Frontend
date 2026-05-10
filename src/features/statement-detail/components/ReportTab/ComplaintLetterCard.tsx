// ============================================================================
// ComplaintLetterCard — carte lettre de réclamation banque
// ============================================================================

import { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { AmountFCFA, RoleGuard } from '../../../../components/shared';
import type { Anomaly, AccountConvention } from '../../types/statement.types';
import { formatComplaintLetter } from '../../reports/formatComplaintLetter';
import { ComplaintLetterDrawer } from './ComplaintLetterDrawer';
import { resolveBankAddress } from '../../data/bankDirectory';

interface ComplaintLetterCardProps {
  statement: {
    accountNumber: string;
    bankCode: string;
    bankLegalName: string;
    period: { start: string; end: string };
    clientLegalName: string;
  };
  anomalies: Anomaly[];
  convention: AccountConvention | null;
  cabinet: { name: string; addressLines: string[] };
  signatory: { displayName: string; role: 'dg' | 'senior' | 'junior' | 'consultation' };
  onGenerate?: (anomalyIds: string[]) => void;
}

export function ComplaintLetterCard(props: ComplaintLetterCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);

  const eligible = useMemo(() => {
    const tariffaires = ['commission_excessive', 'agio_errone', 'frais_double', 'convention_violee'];
    return props.anomalies.filter(
      (a) => tariffaires.includes(a.type) && ['qualified', 'validated', 'signed', 'closed'].includes(a.status),
    );
  }, [props.anomalies]);

  const totalRecovery = eligible.reduce((s, a) => s + (a.potentialRecoveryCentimes ?? 0), 0);

  if (eligible.length === 0) return null;

  const bankAddr = useMemo(() => resolveBankAddress(props.statement.bankCode), [props.statement.bankCode]);

  const formatted = props.convention ? formatComplaintLetter({
    cabinet: props.cabinet,
    bank: {
      legalName: bankAddr.legalName || props.statement.bankLegalName,
      addressLines: bankAddr.addressLines.length > 0 ? bankAddr.addressLines : [props.statement.bankLegalName],
    },
    client: { legalName: props.statement.clientLegalName, accountNumber: props.statement.accountNumber },
    period: props.statement.period,
    convention: { id: props.convention.id, signedDate: props.convention.signedDate },
    anomalies: eligible,
    signatory: { displayName: props.signatory.displayName, title: props.signatory.role.toUpperCase() },
  }) : null;

  return (
    <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-amber-700" />
        <h3 className="text-sm font-semibold text-amber-900">Lettre de réclamation à {props.statement.bankCode}</h3>
      </div>
      <p className="text-xs text-amber-900">
        Sur la base de <b>{eligible.length}</b> anomalie{eligible.length > 1 ? 's' : ''} tarifaire{eligible.length > 1 ? 's' : ''} qualifiée{eligible.length > 1 ? 's' : ''},
        {' '}AtlasBanx peut générer une lettre de réclamation formelle adressée à {props.statement.bankLegalName}{' '}
        pour un montant à rétrocéder estimé à <b><AmountFCFA value={totalRecovery} /></b>.
      </p>
      <ul className="mt-2 space-y-0.5">
        {eligible.map((a) => (
          <li key={a.id} className="text-xs text-amber-900">✓ {a.title}</li>
        ))}
      </ul>
      {props.convention && (
        <div className="mt-2 text-[11px] text-amber-800">
          Référence convention : signée le {props.convention.signedDate}
        </div>
      )}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => setPreviewOpen(true)}
          disabled={!formatted}
          className="px-3 py-1.5 text-xs border border-amber-400 rounded hover:bg-amber-100 disabled:opacity-50"
        >
          Aperçu de la lettre
        </button>
        <RoleGuard role={['senior', 'dg']}>
          <button
            onClick={() => props.onGenerate?.(eligible.map((a) => a.id))}
            className="px-3 py-1.5 text-xs font-semibold rounded bg-amber-600 text-white hover:bg-amber-700"
          >
            Générer la lettre
          </button>
        </RoleGuard>
      </div>
      {previewOpen && formatted && (
        <ComplaintLetterDrawer text={formatted.text} onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  );
}
