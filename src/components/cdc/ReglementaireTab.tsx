import { useEffect } from 'react';
import { Shield, Loader2, Globe } from 'lucide-react';
import { useCdcStore } from '../../cdc/store/cdcStore';

export function ReglementaireTab() {
  const { jurisdictions, isLoading, error, loadJurisdictions } = useCdcStore();

  useEffect(() => {
    if (jurisdictions.length === 0) loadJurisdictions();
  }, []);

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
            Cadre réglementaire (L1)
          </h2>
          <p className="text-sm text-gray-500">
            Plafonds absolus BCEAO / COBAC / OHADA — jamais surchargés
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-blue-500" size={24} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {jurisdictions.map((j) => (
            <div
              key={j.id}
              className="bg-white rounded-lg border border-gray-200 p-5"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                  <Shield size={16} className="text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 text-sm">{j.code}</h3>
                  <p className="text-xs text-gray-500">{j.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <Globe size={12} className="text-gray-400" />
                {j.scopeCountries.map((c) => (
                  <span
                    key={c}
                    className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono text-gray-600"
                  >
                    {c}
                  </span>
                ))}
              </div>
              {j.parentId && (
                <p className="text-xs text-gray-400 mt-2">
                  Sous-juridiction de{' '}
                  {jurisdictions.find((p) => p.id === j.parentId)?.code ?? '...'}
                </p>
              )}
            </div>
          ))}
          {jurisdictions.length === 0 && (
            <p className="col-span-2 text-center text-gray-400 py-8">
              Aucune juridiction configurée
            </p>
          )}
        </div>
      )}
    </div>
  );
}
