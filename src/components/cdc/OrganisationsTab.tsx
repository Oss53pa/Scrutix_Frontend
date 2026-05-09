import { useEffect, useState } from 'react';
import { ChevronRight, Building, Loader2 } from 'lucide-react';
import { useCdcStore } from '../../cdc/store/cdcStore';
import type { CdcOrganization } from '../../cdc/types';

const ORG_TYPE_LABELS: Record<string, string> = {
  cabinet: 'Cabinet',
  group: 'Groupe',
  subsidiary: 'Filiale',
  client: 'Client',
};

const ORG_TYPE_COLORS: Record<string, string> = {
  cabinet: 'bg-indigo-100 text-indigo-800',
  group: 'bg-blue-100 text-blue-800',
  subsidiary: 'bg-teal-100 text-teal-800',
  client: 'bg-gray-100 text-gray-800',
};

export function OrganisationsTab() {
  const {
    organizations,
    accounts,
    isLoading,
    error,
    loadOrganizations,
    loadAccounts,
    selectedOrgId,
    selectOrganization,
  } = useCdcStore();

  // TODO: get tenantId from auth context
  const tenantId = null;

  useEffect(() => {
    if (tenantId) loadOrganizations(tenantId);
  }, [tenantId]);

  useEffect(() => {
    if (selectedOrgId) loadAccounts(selectedOrgId);
  }, [selectedOrgId]);

  // Build tree from flat list
  const rootOrgs = organizations.filter((o) => !o.parentId);
  const childrenOf = (parentId: string) =>
    organizations.filter((o) => o.parentId === parentId);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
        {error}
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-700 text-sm">
        Connectez-vous avec un compte Supabase pour accéder aux organisations.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Tree */}
      <div className="col-span-1 bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Hiérarchie</h3>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-blue-500" size={20} />
          </div>
        ) : rootOrgs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            Aucune organisation
          </p>
        ) : (
          <div className="space-y-1">
            {rootOrgs.map((org) => (
              <OrgTreeNode
                key={org.id}
                org={org}
                childrenOf={childrenOf}
                selectedId={selectedOrgId}
                onSelect={selectOrganization}
                depth={0}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail */}
      <div className="col-span-2 space-y-4">
        {selectedOrgId ? (
          <OrgDetail
            org={organizations.find((o) => o.id === selectedOrgId)!}
            accounts={accounts}
          />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
            Sélectionnez une organisation
          </div>
        )}
      </div>
    </div>
  );
}

function OrgTreeNode({
  org,
  childrenOf,
  selectedId,
  onSelect,
  depth,
}: {
  org: CdcOrganization;
  childrenOf: (id: string) => CdcOrganization[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const children = childrenOf(org.id);
  const isSelected = selectedId === org.id;

  return (
    <div>
      <button
        onClick={() => {
          onSelect(org.id);
          if (children.length > 0) setExpanded(!expanded);
        }}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left ${
          isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {children.length > 0 ? (
          <ChevronRight
            size={14}
            className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
        ) : (
          <span className="w-3.5" />
        )}
        <Building size={14} className="text-gray-400" />
        <span className="truncate">{org.legalName}</span>
        <span
          className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium ${
            ORG_TYPE_COLORS[org.orgType]
          }`}
        >
          {ORG_TYPE_LABELS[org.orgType]}
        </span>
      </button>
      {expanded &&
        children.map((child) => (
          <OrgTreeNode
            key={child.id}
            org={child}
            childrenOf={childrenOf}
            selectedId={selectedId}
            onSelect={onSelect}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}

function OrgDetail({
  org,
  accounts,
}: {
  org: CdcOrganization;
  accounts: Array<{ id: string; accountNumber: string; accountLabel: string | null; accountType: string; currency: string; bankId: string }>;
}) {
  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-gray-900">{org.legalName}</h3>
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${
              ORG_TYPE_COLORS[org.orgType]
            }`}
          >
            {ORG_TYPE_LABELS[org.orgType]}
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {org.tradeName && (
            <>
              <dt className="text-gray-500">Nom commercial</dt>
              <dd className="text-gray-900">{org.tradeName}</dd>
            </>
          )}
          <dt className="text-gray-500">Pays</dt>
          <dd className="text-gray-900">{org.countryIso}</dd>
          {org.rccm && (
            <>
              <dt className="text-gray-500">RCCM</dt>
              <dd className="font-mono text-xs text-gray-900">{org.rccm}</dd>
            </>
          )}
          {org.taxId && (
            <>
              <dt className="text-gray-500">NIF</dt>
              <dd className="font-mono text-xs text-gray-900">{org.taxId}</dd>
            </>
          )}
        </dl>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-5 py-3 border-b border-gray-100">
          <h4 className="text-sm font-medium text-gray-700">
            Comptes bancaires ({accounts.length})
          </h4>
        </div>
        {accounts.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">N° Compte</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Libellé</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Type</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Devise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {accounts.map((acc) => (
                <tr key={acc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs">{acc.accountNumber}</td>
                  <td className="px-4 py-2">{acc.accountLabel ?? '—'}</td>
                  <td className="px-4 py-2 capitalize">{acc.accountType}</td>
                  <td className="px-4 py-2">{acc.currency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-5 py-6 text-center text-sm text-gray-400">
            Aucun compte bancaire
          </p>
        )}
      </div>
    </>
  );
}
