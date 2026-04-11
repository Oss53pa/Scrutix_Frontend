/**
 * @module AtlasBanx
 * @file src/components/settings/SecuritySettings.tsx
 * @description Onglet "Sécurité" de la page Settings — regroupe MFA,
 *              IP allowlist, droit à l'effacement et accès à la documentation
 *              sécurité.
 */

import { useState, useEffect, useCallback } from 'react';
import { Trash2, Plus, Globe, AlertTriangle, FileText } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Button,
  Input,
  Alert,
  Badge,
} from '../ui';
import { MfaSetupPanel } from './MfaSetupPanel';
import {
  IpAllowlistService,
  type IpAllowlistRule,
  DataDeletionService,
  type DeletionRequest,
} from '../../security';

export function SecuritySettings() {
  return (
    <div className="space-y-6">
      <MfaSetupPanel />
      <IpAllowlistCard />
      <DataErasureCard />
      <SecurityDocumentationCard />
    </div>
  );
}

// ----------------------------------------------------------------------------
// IP ALLOWLIST CARD
// ----------------------------------------------------------------------------

function IpAllowlistCard() {
  const [rules, setRules] = useState<IpAllowlistRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [newCidr, setNewCidr] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRules(await IpAllowlistService.list());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleAdd = async () => {
    setError(null);
    if (!newCidr || !newLabel) {
      setError('CIDR et libellé requis');
      return;
    }
    try {
      await IpAllowlistService.add(newCidr.trim(), newLabel.trim());
      setNewCidr('');
      setNewLabel('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  };

  const handleRemove = async (id: string) => {
    if (!window.confirm('Supprimer cette règle ?')) return;
    try {
      await IpAllowlistService.remove(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  };

  const handleToggle = async (rule: IpAllowlistRule) => {
    try {
      await IpAllowlistService.setActive(rule.id, !rule.active);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Restriction d'accès par IP
        </CardTitle>
      </CardHeader>
      <CardBody>
        <Alert variant="warning" title="Application non bloquante">
          Ces règles sont actuellement <strong>informatives uniquement</strong>.
          L'application effective au login nécessite l'activation d'une Edge
          Function Supabase (en cours de déploiement). Voir{' '}
          <code className="text-xs">supabase/functions/enforce-ip-allowlist/</code>.
        </Alert>

        {error && <Alert variant="error" title="Erreur">{error}</Alert>}

        <div className="mt-4 space-y-2">
          {rules.length === 0 && !loading && (
            <div className="text-sm text-primary-500 text-center py-4">
              Aucune règle configurée — l'accès est ouvert depuis n'importe quelle IP.
            </div>
          )}
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center justify-between p-3 border border-primary-200 rounded-lg"
            >
              <div>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-sm">{rule.cidr}</code>
                  <Badge variant={rule.active ? 'success' : 'secondary'}>
                    {rule.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="text-xs text-primary-500 mt-1">{rule.label}</div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => handleToggle(rule)}>
                  {rule.active ? 'Désactiver' : 'Activer'}
                </Button>
                <Button variant="danger" size="sm" onClick={() => handleRemove(rule.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-primary-200 space-y-3">
          <h4 className="text-sm font-semibold">Ajouter une règle</h4>
          <div className="flex gap-2">
            <Input
              placeholder="192.168.1.0/24"
              value={newCidr}
              onChange={(e) => setNewCidr(e.target.value)}
              className="flex-1 font-mono"
            />
            <Input
              placeholder="Bureau Abidjan"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="flex-1"
            />
            <Button variant="primary" onClick={handleAdd}>
              <Plus className="w-4 h-4 mr-1" />
              Ajouter
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// DATA ERASURE CARD
// ----------------------------------------------------------------------------

function DataErasureCard() {
  const [pending, setPending] = useState<DeletionRequest | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setPending(await DataDeletionService.getPendingRequest());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleRequest = async () => {
    if (
      !window.confirm(
        'Demander la suppression définitive de votre compte ? Cette action sera examinée manuellement par un administrateur. Vos données seront supprimées définitivement après validation.',
      )
    )
      return;
    setSubmitting(true);
    setError(null);
    try {
      await DataDeletionService.requestErasure(reason);
      setSuccess('Demande déposée. Un administrateur la traitera sous 30 jours.');
      setReason('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-700">
          <AlertTriangle className="w-5 h-5" />
          Droit à l'effacement (RGPD)
        </CardTitle>
      </CardHeader>
      <CardBody>
        <div className="space-y-4">
          <p className="text-sm text-primary-700">
            Vous pouvez demander la suppression définitive de votre compte et de
            l'ensemble de vos données. Conformément à l'article 17 du RGPD,
            votre demande sera traitée dans un délai maximum de 30 jours.
          </p>
          <Alert variant="warning" title="Obligation de conservation">
            Certaines données peuvent être conservées au-delà de votre demande
            si la loi l'exige (OHADA Art. 17 — pièces comptables conservées
            10 ans). Un administrateur examinera votre demande et vous
            informera des éventuelles obligations.
          </Alert>

          {error && <Alert variant="error" title="Erreur">{error}</Alert>}
          {success && <Alert variant="success" title="Succès">{success}</Alert>}

          {pending ? (
            <div className="p-4 border border-yellow-300 bg-yellow-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="warning">{pending.status}</Badge>
                <span className="text-sm font-medium">Demande en cours</span>
              </div>
              <div className="text-xs text-primary-600">
                Déposée le {pending.requestedAt.toLocaleDateString('fr-FR')}
              </div>
              {pending.reason && (
                <div className="text-sm mt-2 italic">"{pending.reason}"</div>
              )}
            </div>
          ) : (
            <>
              <Input
                label="Motif (optionnel)"
                placeholder="Ex: changement de cabinet, fin de prestation..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <Button variant="danger" onClick={handleRequest} disabled={submitting}>
                Demander la suppression de mon compte
              </Button>
            </>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// SECURITY DOCUMENTATION CARD
// ----------------------------------------------------------------------------

function SecurityDocumentationCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Documentation de sécurité
        </CardTitle>
      </CardHeader>
      <CardBody>
        <p className="text-sm text-primary-700 mb-3">
          L'architecture de sécurité d'AtlasBanx, la matrice des données
          sensibles et les procédures d'incident sont documentées dans le
          fichier <code className="text-xs">src/security/README_SECURITY.md</code>.
        </p>
        <ul className="text-sm text-primary-600 space-y-1 list-disc pl-5">
          <li>Modèle de menaces et actifs protégés</li>
          <li>Matrice des données sensibles et leur protection</li>
          <li>Contrôles authentification, autorisation, intégrité</li>
          <li>Conformité RGPD / ARTCI / ANPDP / OHADA</li>
          <li>Procédures d'incident</li>
        </ul>
      </CardBody>
    </Card>
  );
}
