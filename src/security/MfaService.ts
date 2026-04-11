/**
 * @module AtlasBanx
 * @file src/security/MfaService.ts
 * @description Wrapper autour de l'API MFA Supabase (TOTP).
 *              Supabase gère nativement l'enrôlement TOTP, la génération
 *              du secret, la vérification du code à 6 chiffres et le statut
 *              "AAL2" (Authentication Assurance Level 2). On expose une API
 *              simple pour les composants React.
 *
 *              Activation **soft** : jamais imposée au login, mais
 *              recommandée dans Settings pour les comptes cabinet.
 * @author Atlas Studio
 * @version 1.0.0
 */

import { getSupabaseClient } from '../lib/supabase';

export interface MfaFactor {
  id: string;
  friendlyName: string;
  factorType: 'totp';
  status: 'verified' | 'unverified';
  createdAt: Date;
}

export interface MfaEnrollment {
  factorId: string;
  qrCodeSvg: string;    // SVG du QR code (fourni par Supabase)
  secret: string;       // secret TOTP (pour saisie manuelle dans l'app authenticator)
  uri: string;          // otpauth:// URI
}

export class MfaService {
  /**
   * Liste les facteurs MFA déjà enrôlés pour l'utilisateur courant.
   */
  static async listFactors(): Promise<MfaFactor[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error || !data) return [];

    const totp = data.totp ?? [];
    return totp.map((f) => ({
      id: f.id,
      friendlyName: f.friendly_name ?? 'Authenticator',
      factorType: 'totp' as const,
      status: f.status as 'verified' | 'unverified',
      createdAt: new Date(f.created_at),
    }));
  }

  /**
   * Démarre l'enrôlement d'un facteur TOTP. Retourne le QR code et le secret
   * à afficher à l'utilisateur pour qu'il puisse scanner depuis son app.
   */
  static async enrollTotp(friendlyName = 'AtlasBanx TOTP'): Promise<MfaEnrollment> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase non configuré');

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName,
    });

    if (error || !data) {
      throw new Error(`Enrôlement MFA impossible: ${error?.message ?? 'erreur inconnue'}`);
    }

    return {
      factorId: data.id,
      qrCodeSvg: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    };
  }

  /**
   * Vérifie le code à 6 chiffres de l'app authenticator pour finaliser
   * l'enrôlement. Côté Supabase, crée un challenge puis le vérifie.
   */
  static async verifyEnrollment(factorId: string, code: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase non configuré');

    // Étape 1 : créer un challenge
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr || !challenge) {
      throw new Error(`Challenge MFA impossible: ${chErr?.message ?? 'erreur inconnue'}`);
    }

    // Étape 2 : vérifier le code
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });

    if (vErr) {
      throw new Error(`Code MFA invalide: ${vErr.message}`);
    }

    return true;
  }

  /**
   * Désenroule un facteur MFA existant.
   */
  static async unenroll(factorId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase non configuré');

    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) throw new Error(`Désenrôlement MFA impossible: ${error.message}`);
  }

  /**
   * Vérifie si l'utilisateur courant a au moins un facteur vérifié.
   * Utilisé pour afficher le badge "MFA activé" dans Settings.
   */
  static async isMfaEnabled(): Promise<boolean> {
    const factors = await this.listFactors();
    return factors.some((f) => f.status === 'verified');
  }

  /**
   * Retourne le niveau d'assurance d'authentification actuel.
   *   • aal1 = mot de passe uniquement
   *   • aal2 = mot de passe + facteur MFA vérifié
   */
  static async getAssuranceLevel(): Promise<'aal1' | 'aal2' | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) return null;

    return (data.currentLevel as 'aal1' | 'aal2') ?? null;
  }
}
