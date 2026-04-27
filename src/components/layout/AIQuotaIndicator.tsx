import { useState, useEffect, useRef } from 'react';
import { Zap, ChevronDown } from 'lucide-react';
import { rateLimiter } from '../../ai/RateLimiter';
import type { RateLimitStatus } from '../../ai/RateLimiter';

function formatMinutes(ms: number): string {
  const minutes = Math.max(0, Math.ceil(ms / 60_000));
  if (minutes <= 1) return '< 1 min';
  return `${minutes} min`;
}

function getPercentRemaining(status: RateLimitStatus): number {
  if (status.requestsLimit === 0) return 100;
  return Math.round((status.remainingRequests / status.requestsLimit) * 100);
}

function getColorClasses(percent: number): { bg: string; text: string; bar: string } {
  if (percent > 50) return { bg: 'bg-green-100', text: 'text-green-700', bar: 'bg-green-500' };
  if (percent > 20) return { bg: 'bg-amber-100', text: 'text-amber-700', bar: 'bg-amber-500' };
  return { bg: 'bg-red-100', text: 'text-red-700', bar: 'bg-red-500' };
}

function getProviderLabel(provider: string): string {
  const labels: Record<string, string> = {
    claude: 'Claude',
    openai: 'OpenAI',
    mistral: 'Mistral',
    gemini: 'Gemini',
    ollama: 'Ollama',
    custom: 'Personnalisé',
    proph3t: 'PROPH3T',
  };
  return labels[provider] ?? provider;
}

export function AIQuotaIndicator() {
  const [statuses, setStatuses] = useState<RateLimitStatus[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Rafraîchir les quotas toutes les 30 secondes
  useEffect(() => {
    const refresh = () => {
      const all = rateLimiter.getAllStatuses();
      setStatuses(all);
    };

    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Fermer le dropdown au clic extérieur
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Ne rien afficher s'il n'y a aucun usage
  if (statuses.length === 0) return null;

  // Provider le plus contraint
  const worstPercent = statuses.length > 0
    ? Math.min(...statuses.map(getPercentRemaining))
    : 100;

  const totalUsed = statuses.reduce((sum, s) => sum + s.requestsUsed, 0);
  const totalLimit = statuses.reduce((sum, s) => sum + s.requestsLimit, 0);
  const colors = getColorClasses(worstPercent);
  const anyLimited = statuses.some((s) => s.isLimited);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bouton indicateur */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${colors.bg} ${colors.text} hover:opacity-80`}
        title="Quota IA"
      >
        <Zap className={`w-3.5 h-3.5 ${anyLimited ? 'animate-pulse' : ''}`} />
        <span>{totalUsed}/{totalLimit}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown détails */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-primary-200 overflow-hidden z-50">
          <div className="px-4 py-3 bg-primary-50 border-b border-primary-200">
            <p className="text-sm font-semibold text-primary-900">Quotas IA par fournisseur</p>
            <p className="text-xs text-primary-500 mt-0.5">Fenêtre glissante de 1 heure</p>
          </div>

          <div className="p-3 space-y-3 max-h-64 overflow-y-auto">
            {statuses.map((status) => {
              const percent = getPercentRemaining(status);
              const pColors = getColorClasses(percent);
              const resetIn = status.resetsAt.getTime() - Date.now();

              return (
                <div key={status.provider} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-primary-800">
                      {getProviderLabel(status.provider)}
                    </span>
                    {status.isLimited ? (
                      <span className="text-xs font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                        Limité
                      </span>
                    ) : (
                      <span className="text-xs text-primary-500">
                        {status.requestsUsed}/{status.requestsLimit} req
                      </span>
                    )}
                  </div>

                  {/* Barre de progression requêtes */}
                  <div className="w-full h-1.5 bg-primary-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pColors.bar}`}
                      style={{ width: `${Math.min(100, status.requestsLimit > 0 ? (status.requestsUsed / status.requestsLimit) * 100 : 0)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-primary-400">
                    <span>
                      {status.tokensUsed.toLocaleString('fr-FR')} / {status.tokensLimit.toLocaleString('fr-FR')} tokens
                    </span>
                    <span>
                      Réinitialise dans {formatMinutes(resetIn)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {anyLimited && (
            <div className="px-4 py-2.5 bg-red-50 border-t border-red-100">
              <p className="text-xs text-red-600">
                Un ou plusieurs fournisseurs ont atteint leur limite. Les requêtes seront à nouveau disponibles après la réinitialisation.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
