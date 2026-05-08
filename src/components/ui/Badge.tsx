import { HTMLAttributes, ReactNode } from 'react';
import { Severity, AnomalyType, SEVERITY_LABELS, ANOMALY_TYPE_LABELS } from '../../types';

type BadgeVariant = 'default' | 'secondary' | 'low' | 'medium' | 'high' | 'critical' | 'success' | 'info' | 'warning' | 'error' | 'accent';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: ReactNode;
  dot?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-canvas-100 text-ink-700 border border-primary-200/70',
  secondary: 'bg-canvas-200/60 text-ink-600 border border-primary-200/60',
  low: 'bg-canvas-100 text-ink-600 border border-primary-200/70',
  medium: 'bg-amber-50 text-amber-800 border border-amber-200/80',
  high: 'bg-red-50 text-red-800 border border-red-200/80',
  critical: 'bg-gradient-to-b from-red-700 to-red-900 text-white border border-red-900',
  success: 'bg-emerald-50 text-emerald-800 border border-emerald-200/80',
  info: 'bg-blue-50 text-blue-800 border border-blue-200/80',
  warning: 'bg-amber-50 text-amber-800 border border-amber-200/80',
  error: 'bg-red-50 text-red-800 border border-red-200/80',
  accent: 'bg-accent-50 text-accent-800 border border-accent-200/80',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-ink-400',
  secondary: 'bg-ink-300',
  low: 'bg-ink-400',
  medium: 'bg-amber-500',
  high: 'bg-red-500',
  critical: 'bg-white',
  success: 'bg-emerald-500',
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  accent: 'bg-accent-500',
};

export function Badge({ variant = 'default', children, dot = false, className = '', ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill text-xs font-medium tracking-tight ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
}

// Convenience component for Severity badges
interface SeverityBadgeProps extends Omit<BadgeProps, 'variant' | 'children'> {
  severity: Severity;
  showLabel?: boolean;
}

const severityToVariant: Record<Severity, BadgeVariant> = {
  [Severity.LOW]: 'low',
  [Severity.MEDIUM]: 'medium',
  [Severity.HIGH]: 'high',
  [Severity.CRITICAL]: 'critical',
};

export function SeverityBadge({ severity, showLabel = true, ...props }: SeverityBadgeProps) {
  return (
    <Badge variant={severityToVariant[severity]} dot {...props}>
      {showLabel ? SEVERITY_LABELS[severity] : severity}
    </Badge>
  );
}

// Convenience component for AnomalyType badges
interface AnomalyTypeBadgeProps extends Omit<BadgeProps, 'variant' | 'children'> {
  type: AnomalyType;
}

const anomalyTypeToVariant: Record<AnomalyType, BadgeVariant> = {
  [AnomalyType.DUPLICATE_FEE]: 'warning',
  [AnomalyType.GHOST_FEE]: 'high',
  [AnomalyType.OVERCHARGE]: 'medium',
  [AnomalyType.INTEREST_ERROR]: 'info',
  [AnomalyType.UNAUTHORIZED]: 'critical',
  [AnomalyType.ROUNDING_ABUSE]: 'low',
};

export function AnomalyTypeBadge({ type, ...props }: AnomalyTypeBadgeProps) {
  return (
    <Badge variant={anomalyTypeToVariant[type]} {...props}>
      {ANOMALY_TYPE_LABELS[type]}
    </Badge>
  );
}
