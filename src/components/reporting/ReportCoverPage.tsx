import { Edit3, Shield, Lock, Eye, Users } from 'lucide-react';
import type { ReportCoverConfig } from '../../types';
import { formatDate } from '../../utils';

interface ReportCoverPageProps {
  config: ReportCoverConfig;
  onEdit?: () => void;
}

const confidentialityIcons = {
  public: Eye,
  internal: Users,
  confidential: Lock,
  secret: Shield,
};

const confidentialityLabels = {
  public: 'Public',
  internal: 'Usage interne',
  confidential: 'Confidentiel',
  secret: 'Secret',
};

export function ReportCoverPage({ config, onEdit }: ReportCoverPageProps) {
  const ConfidentialityIcon = confidentialityIcons[config.confidentialityLevel];

  return (
    <div
      className="relative w-full min-h-[297mm] flex flex-col"
      style={{
        background: config.backgroundImage
          ? `url(${config.backgroundImage}) center/cover`
          : `linear-gradient(135deg, ${config.primaryColor} 0%, ${config.secondaryColor} 100%)`,
      }}
    >
      {/* Edit button */}
      {onEdit && (
        <button
          onClick={onEdit}
          className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors z-10"
          title="Modifier la page de garde"
        >
          <Edit3 className="w-5 h-5 text-white" />
        </button>
      )}

      {/* Watermark */}
      {config.watermark && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
          <img src={config.watermark} alt="" className="max-w-[60%] max-h-[60%]" />
        </div>
      )}

      {/* Header section */}
      <div className="flex-shrink-0 p-12 flex items-start justify-between">
        {/* Logo */}
        {config.logo && (
          <img
            src={config.logo}
            alt="Logo"
            className="h-16 object-contain"
          />
        )}

        {/* Confidentiality badge */}
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-full ${
            config.confidentialityLevel === 'secret'
              ? 'bg-red-500 text-white'
              : config.confidentialityLevel === 'confidential'
              ? 'bg-orange-500 text-white'
              : 'bg-white/20 text-white'
          }`}
        >
          <ConfidentialityIcon className="w-4 h-4" />
          <span className="text-sm font-medium">
            {confidentialityLabels[config.confidentialityLevel]}
          </span>
        </div>
      </div>

      {/* Main content - centered */}
      <div className="flex-1 flex flex-col items-center justify-center px-12 text-center text-white">
        {/* Decorative element */}
        <div
          className="w-24 h-1 mb-8 rounded-full"
          style={{ backgroundColor: config.accentColor }}
        />

        {/* Title */}
        <h1 className="text-5xl font-bold mb-4 max-w-3xl leading-tight">
          {config.title}
        </h1>

        {/* Subtitle */}
        {config.subtitle && (
          <p className="text-2xl opacity-80 mb-8 max-w-2xl">
            {config.subtitle}
          </p>
        )}

        {/* Decorative line */}
        <div
          className="w-32 h-0.5 my-8 opacity-50"
          style={{ backgroundColor: config.accentColor }}
        />

        {/* Client name */}
        <div className="mb-8">
          <p className="text-sm uppercase tracking-widest opacity-60 mb-2">
            Client
          </p>
          <p className="text-3xl font-semibold">{config.clientName}</p>
        </div>

        {/* Reference */}
        {config.reference && (
          <p className="text-sm opacity-60 mb-4">
            Référence: {config.reference}
          </p>
        )}

        {/* Period */}
        {config.period && (
          <p className="text-lg opacity-80">
            Période: {formatDate(config.period.start)} - {formatDate(config.period.end)}
          </p>
        )}
      </div>

      {/* Footer section */}
      <div className="flex-shrink-0 p-12">
        <div className="flex items-end justify-between text-white">
          {/* Author info */}
          <div>
            {config.authorName && (
              <>
                <p className="text-sm opacity-60 mb-1">Préparé par</p>
                <p className="font-semibold text-lg">{config.authorName}</p>
                {config.authorTitle && (
                  <p className="text-sm opacity-80">{config.authorTitle}</p>
                )}
              </>
            )}
          </div>

          {/* Date and version */}
          <div className="text-right">
            <p className="text-2xl font-light">
              {formatDate(config.date)}
            </p>
            {config.version && (
              <p className="text-sm opacity-60 mt-1">
                Version {config.version}
              </p>
            )}
          </div>
        </div>

        {/* Contact info */}
        {(config.contactEmail || config.contactPhone) && (
          <div className="mt-6 pt-6 border-t border-white/20 flex items-center gap-8 text-sm text-white/70">
            {config.contactEmail && <span>{config.contactEmail}</span>}
            {config.contactPhone && <span>{config.contactPhone}</span>}
          </div>
        )}
      </div>

      {/* Bottom accent bar */}
      <div
        className="h-2 w-full"
        style={{ backgroundColor: config.accentColor }}
      />
    </div>
  );
}
