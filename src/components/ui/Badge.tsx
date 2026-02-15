import { HTMLAttributes, ReactNode } from 'react';
import { Severity, AnomalyType, SEVERITY_LABELS, ANOMALY_TYPE_LABELS } from '../../types';

type BadgeVariant = 'default' | 'secondary' | 'low' | 'medium' | 'high' | 'critical' | 'success' | 'info' | 'warning' | 'error';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: ReactNode;
  dot?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-primary-100 text-primary-700',
  secondary: 'bg-primary-100 text-primary-600',
  low: 'bg-primary-100 text-primary-700',
  medium: 'bg-primary-200 text-primary-800',
  high: 'bg-primary-300 text-primary-900',
  critical: 'bg-primary-900 text-white',
  success: 'bg-primary-100 text-primary-800',
  info: 'bg-primary-100 text-primary-800',
  warning: 'bg-primary-200 text-primary-800',
  error: 'bg-primary-300 text-primary-900',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-primary-500',
  secondary: 'bg-primary-400',
  low: 'bg-primary-500',
  medium: 'bg-primary-600',
  high: 'bg-primary-700',
  critical: 'bg-primary-100',
  success: 'bg-primary-500',
  info: 'bg-primary-500',
  warning: 'bg-primary-600',
  error: 'bg-primary-700',
};

export function Badge({ variant = 'default', children, dot = false, className = '', ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}
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
