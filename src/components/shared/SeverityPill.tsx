// ============================================================================
// <SeverityPill /> — pastille + label uniforme pour les sévérités
// ============================================================================
// Couleurs strictes selon spec §1.3.1.
// ============================================================================

import type { AnomalySeverity } from '../../features/statement-detail/types/statement.types';

const SEVERITY_LABEL: Record<AnomalySeverity, string> = {
  critical: 'Critique',
  high:     'Haute',
  medium:   'Moyenne',
  low:      'Faible',
};

const SEVERITY_DOT_BG: Record<AnomalySeverity, string> = {
  critical: 'bg-rose-600',
  high:     'bg-orange-600',
  medium:   'bg-amber-500',
  low:      'bg-canvas-400',
};

const SEVERITY_TEXT_COLOR: Record<AnomalySeverity, string> = {
  critical: 'text-rose-700',
  high:     'text-orange-700',
  medium:   'text-amber-800',
  low:      'text-ink-500',
};

interface SeverityPillProps {
  severity: AnomalySeverity;
  /** Mode compact : juste la pastille sans label. */
  compact?: boolean;
  className?: string;
}

export function SeverityPill({ severity, compact = false, className = '' }: SeverityPillProps) {
  const dot = SEVERITY_DOT_BG[severity];
  const txt = SEVERITY_TEXT_COLOR[severity];
  const label = SEVERITY_LABEL[severity];

  if (compact) {
    return (
      <span
        className={`inline-block w-3 h-3 rounded-full ${dot} ${className}`}
        title={label}
        aria-label={`Sévérité ${label}`}
      />
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className={`w-3 h-3 rounded-full ${dot}`} aria-hidden />
      <span className={`text-xs font-semibold ${txt}`}>{label}</span>
    </span>
  );
}
