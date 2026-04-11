/**
 * @module AtlasBanx
 * @file src/components/settings/MfaSetupPanel.tsx
 * @description Panneau de configuration MFA TOTP.
 *              Affiche le QR code à scanner + input code de vérification.
 *              Utilise `MfaService` qui encapsule `supabase.auth.mfa.*`.
 */

import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Shield, ShieldOff, Smartphone, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody, Button, Input, Alert, Badge } from '../ui';
import { MfaService, type MfaEnrollment, type MfaFactor } from '../../security';

export function MfaSetupPanel() {
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [loading, setLoading] = useState(false);
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await MfaService.listFactors();
      setFactors(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasVerifiedFactor = factors.some((f) => f.status === 'verified');

  const handleEnroll = async () => {
    setError(null);
    setSuccess(null);
    try {
      const result = await MfaService.enrollTotp();
      setEnrollment(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  };

  const handleVerify = async () => {
    if (!enrollment || !verificationCode) return;
    setError(null);
    setSuccess(null);
    try {
      await MfaService.verifyEnrollment(enrollment.factorId, verificationCode.trim());
      setSuccess('Authentification à deux facteurs activée avec succès.');
      setEnrollment(null);
      setVerificationCode('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code invalide');
    }
  };

  const handleUnenroll = async (factorId: string) => {
    if (!window.confirm('Désactiver l\'authentification à deux facteurs ?')) return;
    setError(null);
    setSuccess(null);
    try {
      await MfaService.unenroll(factorId);
      setSuccess('Facteur MFA désactivé.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Authentification à deux facteurs (MFA)
        </CardTitle>
      </CardHeader>
      <CardBody>
        <div className="space-y-4">
          <p className="text-sm text-primary-600">
            Ajoutez une couche de sécurité supplémentaire en exigeant un code
            à usage unique depuis votre smartphone. Recommandé pour les comptes
            de cabinet.
          </p>

          {error && <Alert variant="error" title="Erreur">{error}</Alert>}
          {success && <Alert variant="success" title="Succès">{success}</Alert>}

          {/* Statut actuel */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-primary-50 border border-primary-200">
            <div className="flex items-center gap-2">
              {hasVerifiedFactor ? (
                <>
                  <ShieldCheck className="w-5 h-5 text-green-600" />
                  <span className="font-medium">MFA activé</span>
                  <Badge variant="success">Vérifié</Badge>
                </>
              ) : (
                <>
                  <ShieldOff className="w-5 h-5 text-primary-500" />
                  <span className="font-medium">MFA non activé</span>
                </>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={refresh}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Liste des facteurs existants */}
          {factors.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-primary-800">Facteurs enregistrés</h4>
              {factors.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-primary-200"
                >
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-4 h-4 text-primary-500" />
                    <div>
                      <div className="text-sm font-medium">{f.friendlyName}</div>
                      <div className="text-xs text-primary-500">
                        Créé le {f.createdAt.toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={f.status === 'verified' ? 'success' : 'warning'}>
                      {f.status === 'verified' ? 'Vérifié' : 'En attente'}
                    </Badge>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleUnenroll(f.id)}
                    >
                      Retirer
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Flow d'enrôlement */}
          {enrollment ? (
            <div className="space-y-4 p-4 border border-primary-300 rounded-lg bg-white">
              <h4 className="text-sm font-semibold text-primary-900">
                Étape 1 — Scannez le QR code
              </h4>
              <p className="text-xs text-primary-500">
                Ouvrez votre application d'authentification (Google Authenticator,
                Authy, 1Password…) et scannez le code ci-dessous.
              </p>
              <div
                className="flex justify-center bg-white p-4 rounded border border-primary-200"
                dangerouslySetInnerHTML={{ __html: enrollment.qrCodeSvg }}
              />
              <div className="text-xs text-primary-500">
                Ou saisissez manuellement ce secret :
                <code className="block mt-1 p-2 bg-primary-50 rounded font-mono break-all">
                  {enrollment.secret}
                </code>
              </div>

              <h4 className="text-sm font-semibold text-primary-900 pt-2">
                Étape 2 — Entrez le code à 6 chiffres
              </h4>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="123456"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                className="tracking-widest text-center text-lg font-mono"
              />
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  onClick={handleVerify}
                  disabled={verificationCode.length !== 6}
                >
                  Vérifier et activer
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEnrollment(null);
                    setVerificationCode('');
                  }}
                >
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            !hasVerifiedFactor && (
              <Button variant="primary" onClick={handleEnroll}>
                <Shield className="w-4 h-4 mr-2" />
                Activer l'authentification à deux facteurs
              </Button>
            )
          )}
        </div>
      </CardBody>
    </Card>
  );
}
