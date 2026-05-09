import { useEffect } from 'react';
import { BarChart3, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useCdcStore } from '../../cdc/store/cdcStore';
import type { Ecart, CdcAuditSession } from '../../cdc/types';

const ECART_COLORS: Record<string, string> = {
  E01: 'bg-red-100 text-red-800',
  E02: 'bg-red-100 text-red-800',
  E03: 'bg-orange-100 text-orange-800',
  E04: 'bg-orange-100 text-orange-800',
  E05: 'bg-yellow-100 text-yellow-800',
  E06: 'bg-yellow-100 text-yellow-800',
  E07: 'bg-gray-100 text-gray-800',
  E08: 'bg-gray-100 text-gray-800',
};

const STATUS_ICONS: Record<string, typeof CheckCircle2> = {
  completed: CheckCircle2,
  failed: XCircle,
  running: Loader2,
  pending: BarChart3,
};

const STATUS_COLORS: Record<string, string> = {
  completed: 'text-green-600',
  failed: 'text-red-600',
  running: 'text-blue-600 animate-spin',
  pending: 'text-gray-400',
};

const RECUP_STYLES: Record<string, string> = {
  forte: 'bg-green-100 text-green-700',
  moyenne: 'bg-amber-100 text-amber-700',
  faible: 'bg-red-100 text-red-700',
};

function formatFcfa(centimes: bigint | number): string {
  const n = typeof centimes === 'bigint' ? Number(centimes) : centimes;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XAF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(n / 100));
}

export function AuditCdcTab() {
  const {
    auditSessions,
    selectedSessionId,
    ecarts,
    isLoading,
    error,
    loadAuditSessions,
    selectAuditSession,
  } = useCdcStore();

  // TODO: get tenantId from auth context
  const tenantId = null;

  useEffect(() => {
    if (tenantId) loadAuditSessions(tenantId);
  }, [tenantId]);

  if (!tenantId) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-700 text-sm">
        Connectez-vous avec un compte Supabase pour accéder aux audits CDC.
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
    <div className="grid grid-cols-5 gap-6">
      {/* Sessions list */}
      <div className="col-span-2 bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="text-sm font-medium text-gray-700">Sessions d'audit</h3>
        </div>
        {isLoading && auditSessions.length === 0 ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-blue-500" size={20} />
          </div>
        ) : auditSessions.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">
            Aucune session d'audit
          </p>
        ) : (
          <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
            {auditSessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                isSelected={selectedSessionId === session.id}
                onSelect={() => selectAuditSession(session.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Ecarts detail */}
      <div className="col-span-3 space-y-4">
        {selectedSessionId && ecarts.length > 0 ? (
          <>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Ecarts detectes ({ecarts.length})
              </h3>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(
                  ecarts.reduce((acc, e) => {
                    acc[e.code] = (acc[e.code] ?? 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([code, count]) => (
                  <span
                    key={code}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      ECART_COLORS[code] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {code}: {count}
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {ecarts.map((ecart) => (
                <EcartCard key={ecart.id} ecart={ecart} />
              ))}
            </div>
          </>
        ) : selectedSessionId ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
            {isLoading ? (
              <Loader2 className="animate-spin mx-auto text-blue-500" size={24} />
            ) : (
              'Aucun écart détecté pour cette session'
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
            Sélectionnez une session d'audit
          </div>
        )}
      </div>
    </div>
  );
}

function SessionRow({
  session,
  isSelected,
  onSelect,
}: {
  session: CdcAuditSession;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const Icon = STATUS_ICONS[session.status] ?? BarChart3;
  const formatDate = (d: Date) =>
    new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-4 py-3 flex items-center gap-3 text-sm hover:bg-gray-50 ${
        isSelected ? 'bg-blue-50 border-l-2 border-blue-600' : ''
      }`}
    >
      <Icon size={16} className={STATUS_COLORS[session.status]} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate text-xs">
          {formatDate(session.periodStart)} — {formatDate(session.periodEnd)}
        </p>
        <p className="text-xs text-gray-500">
          {session.totalEcarts} écart{session.totalEcarts !== 1 ? 's' : ''}
        </p>
      </div>
      {session.totalImpactCentimes > 0n && (
        <span className="text-xs font-medium text-red-600">
          {formatFcfa(session.totalImpactCentimes)}
        </span>
      )}
    </button>
  );
}

function EcartCard({ ecart }: { ecart: Ecart }) {
  const colorClass = ECART_COLORS[ecart.code] ?? 'bg-gray-100 text-gray-600';
  const recupClass = RECUP_STYLES[ecart.scoring.recuperabilite] ?? '';

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-start gap-3">
        <span className={`px-2 py-0.5 rounded text-xs font-bold ${colorClass}`}>
          {ecart.code}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900">{ecart.description}</p>
          <p className="text-xs text-gray-500 mt-1 font-mono">{ecart.rubricCode}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-red-600">
            {formatFcfa(ecart.ecartCentimes)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs">
        <div>
          <span className="text-gray-500">Attendu: </span>
          <span className="font-medium">{formatFcfa(ecart.expectedCentimes)}</span>
        </div>
        <div>
          <span className="text-gray-500">Facturé: </span>
          <span className="font-medium">{formatFcfa(ecart.actualCentimes)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500">Confiance: </span>
          <span className="font-medium">{ecart.scoring.confiance}%</span>
        </div>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${recupClass}`}>
          {ecart.scoring.recuperabilite}
        </span>
      </div>
    </div>
  );
}
