/**
 * @module AtlasBanx
 * @file src/components/settings/AuditTrailPanel.tsx
 * @description Panneau "Journal d'activité" dans Settings — affiche l'historique
 *              audit trail filtré, vérifie l'intégrité de la chaîne. Accessible
 *              uniquement aux comptes de type cabinet (admin).
 * @author Atlas Studio
 * @version 1.0.0
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Shield, ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardHeader, CardTitle, CardBody, Badge, Button, Alert, Select } from '../ui';
import { getAuditTrailService } from '../../services/auditTrail';
import type { AuditEntry, IntegrityReport } from '../../services/auditTrail';
import { AuditEventType } from '../../services/auditTrail';
import { useAuthStore } from '../../store/authStore';

const EVENT_TYPE_OPTIONS = [
  { value: '', label: 'Tous les types' },
  ...Object.values(AuditEventType).map((v) => ({ value: v, label: v })),
];

const RESOURCE_TYPE_OPTIONS = [
  { value: '', label: 'Toutes les ressources' },
  { value: 'analysis', label: 'Analyses' },
  { value: 'report', label: 'Rapports' },
  { value: 'client', label: 'Clients' },
  { value: 'invoice', label: 'Factures' },
  { value: 'import', label: 'Imports' },
  { value: 'user', label: 'Authentification' },
  { value: 'statement', label: 'Relevés' },
  { value: 'anomaly', label: 'Anomalies' },
  { value: 'ai_call', label: 'Appels IA' },
  { value: 'system', label: 'Système' },
];

export function AuditTrailPanel() {
  const profile = useAuthStore((s) => s.profile);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterEventType, setFilterEventType] = useState<string>('');
  const [filterResourceType, setFilterResourceType] = useState<string>('');
  const [integrity, setIntegrity] = useState<IntegrityReport | null>(null);
  const [verifying, setVerifying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const service = getAuditTrailService();
      const rows = await service.listRecent({
        limit: 200,
        eventType: filterEventType ? (filterEventType as AuditEventType) : undefined,
        resourceType: filterResourceType
          ? (filterResourceType as AuditEntry['resourceType'])
          : undefined,
      });
      setEntries(rows);
    } finally {
      setLoading(false);
    }
  }, [filterEventType, filterResourceType]);

  useEffect(() => {
    void load();
  }, [load]);

  const verifyChain = async () => {
    setVerifying(true);
    try {
      const report = await getAuditTrailService().verifyChainIntegrity();
      setIntegrity(report);
    } finally {
      setVerifying(false);
    }
  };

  const integrityBadge = useMemo(() => {
    if (!integrity) return null;
    if (integrity.isValid) {
      return (
        <Badge variant="success" dot>
          <ShieldCheck className="w-3 h-3 inline mr-1" />
          Chaîne valide ({integrity.totalEvents} événements)
        </Badge>
      );
    }
    return (
      <Badge variant="critical" dot>
        <ShieldAlert className="w-3 h-3 inline mr-1" />
        Chaîne altérée
      </Badge>
    );
  }, [integrity]);

  if (profile?.account_type !== 'cabinet' && profile?.role !== 'admin') {
    return (
      <Alert variant="info" title="Accès restreint">
        Le journal d'activité est réservé aux comptes de type cabinet et aux administrateurs.
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Journal d'activité (audit trail)
            </CardTitle>
            <div className="flex items-center gap-3">
              {integrityBadge}
              <Button
                variant="secondary"
                size="sm"
                onClick={verifyChain}
                disabled={verifying}
              >
                {verifying ? (
                  <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4 mr-1" />
                )}
                Vérifier l'intégrité
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px]">
                <Select
                  label="Type d'événement"
                  value={filterEventType}
                  onChange={(e) => setFilterEventType(e.target.value)}
                  options={EVENT_TYPE_OPTIONS}
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <Select
                  label="Ressource"
                  value={filterResourceType}
                  onChange={(e) => setFilterResourceType(e.target.value)}
                  options={RESOURCE_TYPE_OPTIONS}
                />
              </div>
              <div className="flex items-end">
                <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
                  <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                  Rafraîchir
                </Button>
              </div>
            </div>

            <div className="border border-primary-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-primary-50 text-primary-700">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Date</th>
                    <th className="px-3 py-2 text-left font-medium">Type</th>
                    <th className="px-3 py-2 text-left font-medium">Action</th>
                    <th className="px-3 py-2 text-left font-medium">Ressource</th>
                    <th className="px-3 py-2 text-left font-medium">Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-primary-500">
                        Aucun événement enregistré pour les filtres actuels.
                      </td>
                    </tr>
                  )}
                  {entries.map((e) => (
                    <tr key={e.id} className="border-t border-primary-100 hover:bg-primary-50">
                      <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">
                        {format(e.createdAt, 'dd/MM/yyyy HH:mm:ss', { locale: fr })}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary">{e.eventType}</Badge>
                      </td>
                      <td className="px-3 py-2 text-primary-700">{e.action}</td>
                      <td className="px-3 py-2 text-primary-700">
                        {e.resourceType}
                        {e.resourceId && (
                          <span className="ml-1 text-xs text-primary-400">
                            ({e.resourceId.slice(0, 8)}…)
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-primary-500" title={e.integrityHash}>
                        {e.integrityHash.slice(0, 12)}…
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {integrity && !integrity.isValid && (
              <Alert variant="warning" title="Intégrité de la chaîne compromise">
                Un événement altéré a été détecté à{' '}
                {integrity.firstBrokenAt
                  ? format(integrity.firstBrokenAt, 'dd/MM/yyyy HH:mm:ss', { locale: fr })
                  : 'date inconnue'}
                . Contactez l'administrateur système.
              </Alert>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
