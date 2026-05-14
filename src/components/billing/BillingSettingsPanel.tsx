// ============================================================================
// BillingSettingsPanel — UI de configuration cabinet (paramètres facturation)
// ============================================================================
// Permet d'éditer toutes les informations légales et bancaires utilisées
// dans les factures générées :
//   - Identité légale : raison sociale, NIF, RCCM, adresse, contact
//   - Coordonnées bancaires : nom banque, IBAN, RIB
//   - Paramètres de facturation : préfixe N°, TVA par défaut, délai paiement
//   - Mentions légales OHADA + footer personnalisé
//   - Logo cabinet (upload local — URL Supabase Storage en production)
//
// Sans cette UI, les factures s'imprimaient avec « Cabinet (à configurer) »
// faute de moyen d'éditer les settings depuis l'app. BillingService.getSettings
// + updateSettings existent depuis longtemps — il manquait juste l'UI.
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  Save, Building2, Landmark, Receipt, FileText, Loader2,
  CheckCircle2, AlertCircle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody, Button, Input } from '../ui';
import { BillingService, type BillingSettings } from '../../billing';

interface BillingSettingsPanelProps {
  /** Callback optionnel appelé après sauvegarde réussie. */
  onSaved?: (settings: BillingSettings) => void;
}

export function BillingSettingsPanel({ onSaved }: BillingSettingsPanelProps) {
  const [settings, setSettings] = useState<BillingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state — séparé pour gérer le dirty tracking
  const [form, setForm] = useState<Partial<BillingSettings>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await BillingService.getSettings();
      if (s) {
        setSettings(s);
        setForm(s);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function update<K extends keyof BillingSettings>(field: K, value: BillingSettings[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSavedAt(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await BillingService.updateSettings(form);
      const updated = await BillingService.getSettings();
      if (updated) {
        setSettings(updated);
        setForm(updated);
        setSavedAt(new Date().toLocaleTimeString('fr-FR'));
        onSaved?.(updated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-ink-600">
        <Loader2 className="w-4 h-4 animate-spin" />
        Chargement des paramètres…
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-4 text-sm text-ink-600">
        <AlertCircle className="w-4 h-4 inline mr-2" />
        Paramètres indisponibles (Supabase non configuré ?).
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header avec status sauvegarde */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink-900">Paramètres de facturation</h2>
          <p className="text-sm text-ink-500">Identité légale, coordonnées bancaires, mentions OHADA.</p>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && (
            <span className="text-xs text-emerald-600 inline-flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Enregistré · {savedAt}
            </span>
          )}
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            Enregistrer
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-md p-3 text-sm text-rose-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Section 1 : Identité légale */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-ink-700" />
            Identité légale (vendeur)
          </CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Raison sociale *">
              <Input
                value={form.legalName ?? ''}
                onChange={(e) => update('legalName', e.target.value)}
                placeholder="Cabinet d'expertise comptable"
              />
            </Field>
            <Field label="NIF (Numéro d'Identification Fiscale)">
              <Input
                value={form.nif ?? ''}
                onChange={(e) => update('nif', e.target.value)}
                placeholder="ex. 1234567A"
              />
            </Field>
            <Field label="RCCM (Registre du Commerce)">
              <Input
                value={form.rccm ?? ''}
                onChange={(e) => update('rccm', e.target.value)}
                placeholder="ex. CI-ABJ-2024-B-12345"
              />
            </Field>
            <Field label="Téléphone">
              <Input
                value={form.phone ?? ''}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="+225 …"
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={form.email ?? ''}
                onChange={(e) => update('email', e.target.value)}
                placeholder="contact@cabinet.tld"
              />
            </Field>
            <Field label="Pays">
              <Input
                value={form.country ?? ''}
                onChange={(e) => update('country', e.target.value)}
                placeholder="Côte d'Ivoire"
              />
            </Field>
            <Field label="Adresse">
              <Input
                value={form.address ?? ''}
                onChange={(e) => update('address', e.target.value)}
                placeholder="Avenue X, Cocody"
              />
            </Field>
            <Field label="Ville">
              <Input
                value={form.city ?? ''}
                onChange={(e) => update('city', e.target.value)}
                placeholder="Abidjan"
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* Section 2 : Coordonnées bancaires */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-ink-700" />
            Coordonnées bancaires
          </CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Banque">
              <Input
                value={form.bankName ?? ''}
                onChange={(e) => update('bankName', e.target.value)}
                placeholder="ex. NSIA Banque CI"
              />
            </Field>
            <Field label="N° de compte">
              <Input
                value={form.bankAccount ?? ''}
                onChange={(e) => update('bankAccount', e.target.value)}
                placeholder="ex. CI93 CI001 …"
              />
            </Field>
            <Field label="RIB / IBAN">
              <Input
                value={form.bankRib ?? ''}
                onChange={(e) => update('bankRib', e.target.value)}
                placeholder="ex. 01281-86315802001-03"
              />
            </Field>
          </div>
          <p className="mt-2 text-[11px] text-ink-500 italic">
            Ces informations apparaissent en pied de facture pour faciliter le paiement.
          </p>
        </CardBody>
      </Card>

      {/* Section 3 : Paramètres de facturation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-ink-700" />
            Paramètres de facturation
          </CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Préfixe numéro de facture">
              <Input
                value={form.invoicePrefix ?? 'FAC'}
                onChange={(e) => update('invoicePrefix', e.target.value)}
                placeholder="FAC"
              />
            </Field>
            <Field label="Taux TVA par défaut (%)">
              <Input
                type="number"
                step="0.01"
                value={form.defaultTaxRate ?? 18}
                onChange={(e) => update('defaultTaxRate', parseFloat(e.target.value) || 0)}
              />
            </Field>
            <Field label="Délai de paiement (jours)">
              <Input
                type="number"
                value={form.defaultPaymentTermsDays ?? 30}
                onChange={(e) => update('defaultPaymentTermsDays', parseInt(e.target.value) || 30)}
              />
            </Field>
          </div>
          <p className="mt-2 text-[11px] text-ink-500 italic">
            Numérotation automatique : <strong>{form.invoicePrefix ?? 'FAC'}-{new Date().getFullYear()}-NNNN</strong>.
            Dernier numéro utilisé : {settings.lastSequenceNumber} ({settings.lastSequenceYear ?? '—'}).
          </p>
        </CardBody>
      </Card>

      {/* Section 4 : Mentions légales OHADA + Footer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-ink-700" />
            Mentions légales OHADA & footer
          </CardTitle>
        </CardHeader>
        <CardBody>
          <Field label="Mentions légales OHADA (apparaissent en pied de page)">
            <textarea
              value={form.legalMentions ?? ''}
              onChange={(e) => update('legalMentions', e.target.value)}
              rows={3}
              placeholder="Facture émise conformément à l'Acte Uniforme OHADA portant organisation et harmonisation des comptabilités…"
              className="w-full px-3 py-2 border border-canvas-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </Field>
          <Field label="Footer personnalisé">
            <Input
              value={form.footerText ?? ''}
              onChange={(e) => update('footerText', e.target.value)}
              placeholder="ex. Merci pour votre confiance — AtlasBanx"
            />
          </Field>
          <Field label="URL logo cabinet (Supabase Storage ou CDN)">
            <Input
              value={form.logoUrl ?? ''}
              onChange={(e) => update('logoUrl', e.target.value)}
              placeholder="https://…"
            />
            {form.logoUrl && (
              <img
                src={form.logoUrl}
                alt="Logo"
                className="mt-2 h-12 w-auto object-contain border border-canvas-200 rounded"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
          </Field>
        </CardBody>
      </Card>

      {/* Footer action — sticky */}
      <div className="sticky bottom-0 bg-white border-t border-canvas-200 -mx-4 px-4 py-3 flex items-center justify-end gap-2">
        <span className="text-xs text-ink-500 mr-auto">
          Toutes les factures futures utiliseront ces paramètres.
        </span>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
          Enregistrer les modifications
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-ink-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
