import { useState } from 'react';
import {
  Palette,
  Type,
  User,
  Building2,
  Lock,
  Upload,
  ChevronDown,
  ChevronUp,
  LucideIcon,
} from 'lucide-react';
import { } from '../ui';
import type { ReportCoverConfig, ReportBackCoverConfig } from '../../types';

interface ReportCoverEditorProps {
  coverConfig: ReportCoverConfig;
  backCoverConfig: ReportBackCoverConfig;
  onUpdateCover: (config: Partial<ReportCoverConfig>) => void;
  onUpdateBackCover: (config: Partial<ReportBackCoverConfig>) => void;
  readOnly?: boolean;
}

type Section = 'colors' | 'cover-text' | 'cover-contact' | 'back-company' | 'back-legal';

export function ReportCoverEditor({
  coverConfig,
  backCoverConfig,
  onUpdateCover,
  onUpdateBackCover,
  readOnly = false,
}: ReportCoverEditorProps) {
  const [expandedSections, setExpandedSections] = useState<Record<Section, boolean>>({
    colors: true,
    'cover-text': true,
    'cover-contact': false,
    'back-company': false,
    'back-legal': false,
  });

  const toggleSection = (section: Section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const ColorPicker = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (color: string) => void;
  }) => (
    <div className="flex items-center justify-between">
      <span className="text-sm text-primary-700">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={readOnly}
          className="w-8 h-8 rounded cursor-pointer border border-primary-200"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={readOnly}
          className="w-20 px-2 py-1 text-xs font-mono border border-primary-200 rounded"
        />
      </div>
    </div>
  );

  const SectionHeader = ({
    title,
    icon: Icon,
    section,
  }: {
    title: string;
    icon: LucideIcon;
    section: Section;
  }) => (
    <button
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between p-3 bg-primary-50 hover:bg-primary-100 transition-colors"
    >
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary-600" />
        <span className="font-medium text-primary-900">{title}</span>
      </div>
      {expandedSections[section] ? (
        <ChevronUp className="w-4 h-4 text-primary-500" />
      ) : (
        <ChevronDown className="w-4 h-4 text-primary-500" />
      )}
    </button>
  );

  return (
    <div className="divide-y divide-primary-200">
      {/* Colors Section */}
      <div>
        <SectionHeader title="Couleurs" icon={Palette} section="colors" />
        {expandedSections.colors && (
          <div className="p-4 space-y-4">
            <ColorPicker
              label="Couleur principale"
              value={coverConfig.primaryColor}
              onChange={(color) => onUpdateCover({ primaryColor: color })}
            />
            <ColorPicker
              label="Couleur secondaire"
              value={coverConfig.secondaryColor}
              onChange={(color) => onUpdateCover({ secondaryColor: color })}
            />
            <ColorPicker
              label="Couleur d'accent"
              value={coverConfig.accentColor}
              onChange={(color) => onUpdateCover({ accentColor: color })}
            />

            {/* Preset themes */}
            <div className="pt-2">
              <p className="text-xs text-primary-500 mb-2">Thèmes prédéfinis</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { primary: '#1e3a5f', secondary: '#0f2744', accent: '#3b82f6', name: 'Bleu Pro' },
                  { primary: '#064e3b', secondary: '#022c22', accent: '#10b981', name: 'Vert' },
                  { primary: '#7c2d12', secondary: '#431407', accent: '#f97316', name: 'Orange' },
                  { primary: '#581c87', secondary: '#3b0764', accent: '#a855f7', name: 'Violet' },
                  { primary: '#1f2937', secondary: '#111827', accent: '#6b7280', name: 'Gris' },
                  { primary: '#991b1b', secondary: '#7f1d1d', accent: '#ef4444', name: 'Rouge' },
                  { primary: '#0c4a6e', secondary: '#082f49', accent: '#0ea5e9', name: 'Cyan' },
                  { primary: '#713f12', secondary: '#422006', accent: '#eab308', name: 'Or' },
                ].map((theme, index) => (
                  <button
                    key={index}
                    onClick={() =>
                      onUpdateCover({
                        primaryColor: theme.primary,
                        secondaryColor: theme.secondary,
                        accentColor: theme.accent,
                      })
                    }
                    className="aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-primary-400 transition-colors"
                    title={theme.name}
                    style={{
                      background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
                    }}
                  >
                    <div
                      className="w-full h-1/4"
                      style={{ backgroundColor: theme.accent }}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cover Text Section */}
      <div>
        <SectionHeader title="Texte de couverture" icon={Type} section="cover-text" />
        {expandedSections['cover-text'] && (
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-primary-700 mb-1">
                Titre principal
              </label>
              <input
                type="text"
                value={coverConfig.title}
                onChange={(e) => onUpdateCover({ title: e.target.value })}
                disabled={readOnly}
                className="w-full px-3 py-2 text-sm border border-primary-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="Rapport d'Audit Bancaire"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-700 mb-1">
                Sous-titre
              </label>
              <input
                type="text"
                value={coverConfig.subtitle || ''}
                onChange={(e) => onUpdateCover({ subtitle: e.target.value })}
                disabled={readOnly}
                className="w-full px-3 py-2 text-sm border border-primary-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="Analyse des frais bancaires"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-700 mb-1">
                Nom du client
              </label>
              <input
                type="text"
                value={coverConfig.clientName}
                onChange={(e) => onUpdateCover({ clientName: e.target.value })}
                disabled={readOnly}
                className="w-full px-3 py-2 text-sm border border-primary-200 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-700 mb-1">
                Référence
              </label>
              <input
                type="text"
                value={coverConfig.reference || ''}
                onChange={(e) => onUpdateCover({ reference: e.target.value })}
                disabled={readOnly}
                className="w-full px-3 py-2 text-sm border border-primary-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="REF-2024-001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-700 mb-1">
                Niveau de confidentialité
              </label>
              <select
                value={coverConfig.confidentialityLevel}
                onChange={(e) =>
                  onUpdateCover({
                    confidentialityLevel: e.target.value as any,
                  })
                }
                disabled={readOnly}
                className="w-full px-3 py-2 text-sm border border-primary-200 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="public">Public</option>
                <option value="internal">Usage interne</option>
                <option value="confidential">Confidentiel</option>
                <option value="secret">Secret</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-700 mb-1">
                Version
              </label>
              <input
                type="text"
                value={coverConfig.version || ''}
                onChange={(e) => onUpdateCover({ version: e.target.value })}
                disabled={readOnly}
                className="w-full px-3 py-2 text-sm border border-primary-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="1.0"
              />
            </div>
          </div>
        )}
      </div>

      {/* Cover Contact Section */}
      <div>
        <SectionHeader title="Contact couverture" icon={User} section="cover-contact" />
        {expandedSections['cover-contact'] && (
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-primary-700 mb-1">
                Nom de l'auteur
              </label>
              <input
                type="text"
                value={coverConfig.authorName || ''}
                onChange={(e) => onUpdateCover({ authorName: e.target.value })}
                disabled={readOnly}
                className="w-full px-3 py-2 text-sm border border-primary-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-700 mb-1">
                Titre / Fonction
              </label>
              <input
                type="text"
                value={coverConfig.authorTitle || ''}
                onChange={(e) => onUpdateCover({ authorTitle: e.target.value })}
                disabled={readOnly}
                className="w-full px-3 py-2 text-sm border border-primary-200 rounded-lg"
                placeholder="Expert-Comptable"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={coverConfig.contactEmail || ''}
                onChange={(e) => onUpdateCover({ contactEmail: e.target.value })}
                disabled={readOnly}
                className="w-full px-3 py-2 text-sm border border-primary-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-700 mb-1">
                Téléphone
              </label>
              <input
                type="tel"
                value={coverConfig.contactPhone || ''}
                onChange={(e) => onUpdateCover({ contactPhone: e.target.value })}
                disabled={readOnly}
                className="w-full px-3 py-2 text-sm border border-primary-200 rounded-lg"
              />
            </div>

            {/* Logo upload */}
            <div>
              <label className="block text-sm font-medium text-primary-700 mb-1">
                Logo
              </label>
              <div className="border-2 border-dashed border-primary-200 rounded-lg p-4 text-center hover:border-primary-400 transition-colors cursor-pointer">
                <Upload className="w-8 h-8 text-primary-400 mx-auto mb-2" />
                <p className="text-sm text-primary-500">Cliquez pour uploader</p>
                <p className="text-xs text-primary-400">PNG, JPG jusqu'à 2MB</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Back Cover Company Section */}
      <div>
        <SectionHeader title="Entreprise (4e de couv.)" icon={Building2} section="back-company" />
        {expandedSections['back-company'] && (
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-primary-700 mb-1">
                Nom de l'entreprise
              </label>
              <input
                type="text"
                value={backCoverConfig.companyName}
                onChange={(e) => onUpdateBackCover({ companyName: e.target.value })}
                disabled={readOnly}
                className="w-full px-3 py-2 text-sm border border-primary-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-700 mb-1">
                Adresse
              </label>
              <textarea
                value={backCoverConfig.address}
                onChange={(e) => onUpdateBackCover({ address: e.target.value })}
                disabled={readOnly}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-primary-200 rounded-lg resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-primary-700 mb-1">
                  Téléphone
                </label>
                <input
                  type="tel"
                  value={backCoverConfig.phone || ''}
                  onChange={(e) => onUpdateBackCover({ phone: e.target.value })}
                  disabled={readOnly}
                  className="w-full px-3 py-2 text-sm border border-primary-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={backCoverConfig.email || ''}
                  onChange={(e) => onUpdateBackCover({ email: e.target.value })}
                  disabled={readOnly}
                  className="w-full px-3 py-2 text-sm border border-primary-200 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-700 mb-1">
                Site web
              </label>
              <input
                type="url"
                value={backCoverConfig.website || ''}
                onChange={(e) => onUpdateBackCover({ website: e.target.value })}
                disabled={readOnly}
                className="w-full px-3 py-2 text-sm border border-primary-200 rounded-lg"
              />
            </div>

            {/* Options */}
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={backCoverConfig.showLogo}
                  onChange={(e) => onUpdateBackCover({ showLogo: e.target.checked })}
                  disabled={readOnly}
                  className="rounded"
                />
                <span className="text-sm text-primary-700">Afficher le logo</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={backCoverConfig.showQRCode}
                  onChange={(e) => onUpdateBackCover({ showQRCode: e.target.checked })}
                  disabled={readOnly}
                  className="rounded"
                />
                <span className="text-sm text-primary-700">Afficher un QR code</span>
              </label>
            </div>

            {/* Background color */}
            <ColorPicker
              label="Couleur de fond"
              value={backCoverConfig.backgroundColor}
              onChange={(color) => onUpdateBackCover({ backgroundColor: color })}
            />
            <ColorPicker
              label="Couleur du texte"
              value={backCoverConfig.textColor}
              onChange={(color) => onUpdateBackCover({ textColor: color })}
            />
          </div>
        )}
      </div>

      {/* Back Cover Legal Section */}
      <div>
        <SectionHeader title="Mentions légales" icon={Lock} section="back-legal" />
        {expandedSections['back-legal'] && (
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-primary-700 mb-1">
                Mention légale
              </label>
              <input
                type="text"
                value={backCoverConfig.legalMention || ''}
                onChange={(e) => onUpdateBackCover({ legalMention: e.target.value })}
                disabled={readOnly}
                className="w-full px-3 py-2 text-sm border border-primary-200 rounded-lg"
                placeholder="Document confidentiel"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-700 mb-1">
                Avertissement
              </label>
              <textarea
                value={backCoverConfig.disclaimer || ''}
                onChange={(e) => onUpdateBackCover({ disclaimer: e.target.value })}
                disabled={readOnly}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-primary-200 rounded-lg resize-none"
                placeholder="Ce document est la propriété exclusive de..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-700 mb-1">
                Copyright
              </label>
              <input
                type="text"
                value={backCoverConfig.copyright || ''}
                onChange={(e) => onUpdateBackCover({ copyright: e.target.value })}
                disabled={readOnly}
                className="w-full px-3 py-2 text-sm border border-primary-200 rounded-lg"
                placeholder={`© ${new Date().getFullYear()} Votre Entreprise`}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
