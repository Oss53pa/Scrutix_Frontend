/**
 * @module AtlasBanx
 * @file src/components/auth/ConsentModal.tsx
 * @description Modal de consentement bloquante affichée au premier login
 *              tant que toutes les politiques courantes ne sont pas acceptées.
 *              L'utilisateur ne peut pas accéder à l'application sans cocher
 *              les cases requises et cliquer sur "J'accepte".
 */

import { useState, useEffect } from 'react';
import { FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button, Alert } from '../ui';
import { ConsentService, type PolicyVersion, type PolicyType } from '../../security';

interface ConsentModalProps {
  onAccepted: () => void;
}

const POLICY_LABELS: Record<PolicyType, string> = {
  cgu: "Conditions générales d'utilisation",
  privacy: 'Politique de confidentialité',
  legal: 'Mentions légales',
  cookies: 'Politique cookies',
};

export function ConsentModal({ onAccepted }: ConsentModalProps) {
  const [pending, setPending] = useState<PolicyVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await ConsentService.getPendingConsents();
        if (cancelled) return;
        setPending(list);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Erreur de chargement');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleAccept = (id: string) => {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allAccepted = pending.every((p) => accepted.has(p.id));

  const handleSubmit = async () => {
    if (!allAccepted) return;
    setSubmitting(true);
    setError(null);
    try {
      for (const policy of pending) {
        await ConsentService.recordConsent(policy.id);
      }
      onAccepted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d\'enregistrer le consentement');
    } finally {
      setSubmitting(false);
    }
  };

  // Si aucune politique en attente (déjà tout consenti) → pass-through immédiat
  useEffect(() => {
    if (!loading && pending.length === 0) {
      onAccepted();
    }
  }, [loading, pending.length, onAccepted]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-primary-950/80 backdrop-blur-sm">
        <div className="bg-white rounded-2xl p-8 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-primary-900 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-primary-700">Chargement des conditions...</span>
        </div>
      </div>
    );
  }

  if (pending.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-primary-950/80 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-primary-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-700" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-primary-900">
                Acceptation des conditions
              </h2>
              <p className="text-sm text-primary-600">
                Avant de continuer, merci de lire et d'accepter les documents suivants.
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && <Alert variant="error" title="Erreur">{error}</Alert>}

          {pending.map((policy) => {
            const isAccepted = accepted.has(policy.id);
            const isExpanded = expandedId === policy.id;
            return (
              <div
                key={policy.id}
                className={`border rounded-lg overflow-hidden transition-colors ${
                  isAccepted ? 'border-green-300 bg-green-50' : 'border-primary-200'
                }`}
              >
                <div className="flex items-start gap-3 p-4">
                  <button
                    type="button"
                    onClick={() => toggleAccept(policy.id)}
                    aria-pressed={isAccepted}
                    className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                      isAccepted
                        ? 'bg-green-600 border-green-600'
                        : 'border-primary-300 hover:border-primary-500'
                    }`}
                  >
                    {isAccepted && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-primary-900">
                          {POLICY_LABELS[policy.policyType]}
                        </div>
                        <div className="text-xs text-primary-500">
                          Version {policy.version}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : policy.id)}
                        className="text-sm text-primary-700 hover:underline"
                      >
                        {isExpanded ? 'Masquer' : 'Lire'}
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="mt-3 p-3 bg-white border border-primary-200 rounded text-sm text-primary-700 max-h-40 overflow-y-auto whitespace-pre-wrap">
                        {policy.content}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              En cochant ces cases et en cliquant sur "J'accepte", vous indiquez
              avoir lu et accepté les conditions. Votre consentement est horodaté
              et enregistré de manière immuable.
            </span>
          </div>
        </div>

        <div className="p-6 border-t border-primary-200 flex items-center justify-between">
          <span className="text-sm text-primary-600">
            {accepted.size} / {pending.length} acceptés
          </span>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!allAccepted || submitting}
            isLoading={submitting}
          >
            J'accepte les conditions
          </Button>
        </div>
      </div>
    </div>
  );
}
