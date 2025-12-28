import { Edit3, MapPin, Phone, Mail, Globe, Linkedin, Twitter, Facebook } from 'lucide-react';
import type { ReportBackCoverConfig } from '../../types';

interface ReportBackCoverProps {
  config: ReportBackCoverConfig;
  onEdit?: () => void;
}

export function ReportBackCover({ config, onEdit }: ReportBackCoverProps) {
  return (
    <div
      className="relative w-full min-h-[297mm] flex flex-col"
      style={{
        backgroundColor: config.backgroundColor,
        color: config.textColor,
      }}
    >
      {/* Edit button */}
      {onEdit && (
        <button
          onClick={onEdit}
          className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors z-10"
          title="Modifier la couverture arrière"
        >
          <Edit3 className="w-5 h-5" />
        </button>
      )}

      {/* Main content area - flexible to push footer down */}
      <div className="flex-1 flex flex-col items-center justify-center px-16 py-12">
        {/* Logo */}
        {config.showLogo && (
          <div className="mb-12">
            <div className="w-32 h-32 rounded-full bg-white/10 flex items-center justify-center">
              <span className="text-4xl font-bold opacity-50">
                {config.companyName.charAt(0)}
              </span>
            </div>
          </div>
        )}

        {/* Company name */}
        <h2 className="text-3xl font-bold mb-4 text-center">
          {config.companyName}
        </h2>

        {/* Address */}
        <div className="flex items-start gap-2 mb-8 text-center opacity-80">
          <MapPin className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="whitespace-pre-line">{config.address}</p>
        </div>

        {/* Contact info */}
        <div className="flex flex-wrap justify-center gap-8 mb-12">
          {config.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-5 h-5 opacity-60" />
              <span>{config.phone}</span>
            </div>
          )}
          {config.email && (
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 opacity-60" />
              <span>{config.email}</span>
            </div>
          )}
          {config.website && (
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 opacity-60" />
              <span>{config.website}</span>
            </div>
          )}
        </div>

        {/* Social links */}
        {config.socialLinks && (
          <div className="flex items-center gap-4 mb-12">
            {config.socialLinks.linkedin && (
              <a
                href={config.socialLinks.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <Linkedin className="w-5 h-5" />
              </a>
            )}
            {config.socialLinks.twitter && (
              <a
                href={config.socialLinks.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <Twitter className="w-5 h-5" />
              </a>
            )}
            {config.socialLinks.facebook && (
              <a
                href={config.socialLinks.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <Facebook className="w-5 h-5" />
              </a>
            )}
          </div>
        )}

        {/* QR Code */}
        {config.showQRCode && config.qrCodeUrl && (
          <div className="mb-12">
            <div className="w-32 h-32 bg-white rounded-lg p-2">
              {/* Placeholder for QR code - in production, use a QR library */}
              <div className="w-full h-full bg-primary-100 rounded flex items-center justify-center text-xs text-primary-500">
                QR Code
              </div>
            </div>
            <p className="text-xs opacity-60 text-center mt-2">
              Scannez pour plus d'infos
            </p>
          </div>
        )}
      </div>

      {/* Footer section */}
      <div className="flex-shrink-0 px-16 py-8 border-t border-current/20">
        {/* Legal mention */}
        {config.legalMention && (
          <p className="text-sm opacity-60 mb-4 text-center">
            {config.legalMention}
          </p>
        )}

        {/* Disclaimer */}
        {config.disclaimer && (
          <p className="text-xs opacity-50 mb-6 text-center max-w-2xl mx-auto leading-relaxed">
            {config.disclaimer}
          </p>
        )}

        {/* Copyright */}
        <p className="text-sm opacity-70 text-center">
          {config.copyright || `© ${new Date().getFullYear()} ${config.companyName}. Tous droits réservés.`}
        </p>

        {/* Generated by Scrutix */}
        <p className="text-xs opacity-40 text-center mt-4">
          Rapport généré par <span className="font-display text-base">Scrutix</span> - Solution d'audit bancaire
        </p>
        <p className="text-xs opacity-30 text-center mt-1">
          Développé par <span className="font-display text-sm">Atlas Studio</span>
        </p>
      </div>
    </div>
  );
}
