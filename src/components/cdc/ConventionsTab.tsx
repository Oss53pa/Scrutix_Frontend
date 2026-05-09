import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { useCdcStore } from '../../cdc/store/cdcStore';
import type { Agreement } from '../../cdc/types';

const LAYER_STYLES: Record<number, { bg: string; label: string }> = {
  3: { bg: 'bg-blue-100 text-blue-800', label: 'L3 Groupe' },
  4: { bg: 'bg-green-100 text-green-800', label: 'L4 Client' },
  5: { bg: 'bg-amber-100 text-amber-800', label: 'L5 Avenant' },
};

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  validated: 'bg-green-100 text-green-700',
};

export function ConventionsTab() {
  const {
    organizations,
    agreements,
    isLoading,
    error,
    loadAgreements,
    selectedOrgId,
  } = useCdcStore();

  const [expandedAgreement, setExpandedAgreement] = useState<string | null>(null);

  useEffect(() => {
    if (selectedOrgId) loadAgreements(selectedOrgId);
  }, [selectedOrgId]);

  const selectedOrg = organizations.find((o) => o.id === selectedOrgId);

  if (!selectedOrgId || !selectedOrg) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
        Sélectionnez une organisation dans l'onglet Organisations pour voir ses conventions
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-gray-900">
            Conventions — {selectedOrg.legalName}
          </h2>
          <p className="text-sm text-gray-500">
            Couches L3 (groupe), L4 (client), L5 (avenants)
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-blue-500" size={24} />
        </div>
      ) : agreements.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
          Aucune convention enregistrée
        </div>
      ) : (
        <div className="space-y-2">
          {agreements.map((agr) => (
            <AgreementCard
              key={agr.id}
              agreement={agr}
              isExpanded={expandedAgreement === agr.id}
              onToggle={() =>
                setExpandedAgreement(
                  expandedAgreement === agr.id ? null : agr.id
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AgreementCard({
  agreement,
  isExpanded,
  onToggle,
}: {
  agreement: Agreement;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const layer = LAYER_STYLES[agreement.layer] ?? LAYER_STYLES[4];
  const status = STATUS_STYLES[agreement.validationStatus] ?? STATUS_STYLES.draft;

  const formatDate = (d: Date) =>
    new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
      >
        {isExpanded ? (
          <ChevronDown size={16} className="text-gray-400" />
        ) : (
          <ChevronRight size={16} className="text-gray-400" />
        )}
        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${layer.bg}`}>
          {layer.label}
        </span>
        <span className="font-medium text-gray-900 text-sm flex-1">
          {agreement.agreementLabel}
        </span>
        <span className="text-xs text-gray-500">
          {formatDate(agreement.validFrom)}
          {agreement.validTo ? ` → ${formatDate(agreement.validTo)}` : ' → en cours'}
        </span>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${status}`}>
          {agreement.validationStatus === 'validated' ? 'Validée' : 'Brouillon'}
        </span>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
          <dl className="grid grid-cols-4 gap-4 text-xs">
            <div>
              <dt className="text-gray-500">Signée le</dt>
              <dd className="font-medium text-gray-900 mt-0.5">
                {formatDate(agreement.signedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Scope compte</dt>
              <dd className="font-medium text-gray-900 mt-0.5">
                {agreement.accountId ? 'Compte spécifique' : 'Tous les comptes'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">PDF source</dt>
              <dd className="font-medium text-gray-900 mt-0.5">
                {agreement.sourcePdfUrl ? (
                  <a
                    href={agreement.sourcePdfUrl}
                    className="text-blue-600 hover:underline"
                    target="_blank"
                    rel="noopener"
                  >
                    Voir document
                  </a>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Hash SHA-256</dt>
              <dd className="font-mono text-[10px] text-gray-500 mt-0.5 truncate">
                {agreement.sourceHashSha256 ?? '—'}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-gray-400 mt-3 italic">
            Les conditions détaillées seront affichées ici (rubrique, valeur, dimensions)
          </p>
        </div>
      )}
    </div>
  );
}
