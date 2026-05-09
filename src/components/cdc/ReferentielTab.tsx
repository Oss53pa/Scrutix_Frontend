import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Globe } from 'lucide-react';
import { useCdcStore } from '../../cdc/store/cdcStore';

export function ReferentielTab() {
  const { banks, isLoading, error, loadBanks } = useCdcStore();
  const [expandedBank, setExpandedBank] = useState<string | null>(null);
  const [zoneFilter, setZoneFilter] = useState<string>('');

  useEffect(() => {
    loadBanks(zoneFilter || undefined);
  }, [zoneFilter]);

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
        <h2 className="text-lg font-medium text-gray-900">
          Référentiel des banques (L2)
        </h2>
        <select
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">Toutes les zones</option>
          <option value="UEMOA">UEMOA</option>
          <option value="CEMAC">CEMAC</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-blue-500" size={24} />
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-8"></th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Code</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nom légal</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Pays</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Zone</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">SWIFT</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Groupe</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {banks.map((bank) => (
                <tr
                  key={bank.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() =>
                    setExpandedBank(expandedBank === bank.id ? null : bank.id)
                  }
                >
                  <td className="px-4 py-3 text-gray-400">
                    {expandedBank === bank.id ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-medium text-gray-900">
                    {bank.code}
                  </td>
                  <td className="px-4 py-3 text-gray-900">{bank.legalName}</td>
                  <td className="px-4 py-3 text-gray-600">{bank.countryIso}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                        bank.zone === 'UEMOA'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      <Globe size={10} />
                      {bank.zone}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {bank.swiftBic ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {bank.parentGroup ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        bank.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {bank.isActive ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                </tr>
              ))}
              {banks.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    Aucune banque dans le référentiel
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
