import { LucideIcon } from 'lucide-react';
import { Card } from './Card';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive?: boolean;
  };
  subtitle?: string;
  className?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
}

const variantStyles = {
  default: {
    card: 'bg-white',
    icon: 'bg-canvas-100 text-ink-700 border border-primary-200/60',
    value: 'text-ink-900',
    label: 'text-ink-500',
  },
  primary: {
    card: 'bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950 text-white border-ink-700',
    icon: 'bg-white/10 backdrop-blur text-accent-200 border border-white/10',
    value: 'text-white',
    label: 'text-accent-300',
  },
  success: {
    card: 'bg-white',
    icon: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60',
    value: 'text-emerald-700',
    label: 'text-ink-500',
  },
  warning: {
    card: 'bg-white',
    icon: 'bg-amber-50 text-amber-700 border border-amber-200/60',
    value: 'text-amber-700',
    label: 'text-ink-500',
  },
  danger: {
    card: 'bg-white',
    icon: 'bg-red-50 text-red-700 border border-red-200/60',
    value: 'text-red-700',
    label: 'text-ink-500',
  },
};

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  subtitle,
  className = '',
  variant = 'default',
}: StatCardProps) {
  const styles = variantStyles[variant];

  return (
    <Card className={`relative overflow-hidden ${styles.card} ${className}`}>
      {variant === 'primary' && (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-400/60 to-transparent" />
      )}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${styles.label}`}>{label}</p>
            <p className={`text-3xl font-bold mt-2 tracking-tight tabular-nums truncate ${styles.value}`}>
              {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
            </p>
            {subtitle && (
              <p className={`text-xs mt-1 ${styles.label}`}>{subtitle}</p>
            )}
            {trend && (
              <div className={`inline-flex items-center gap-1 mt-2 text-xs font-semibold ${
                trend.isPositive !== false ? 'text-emerald-600' : 'text-red-600'
              }`}>
                <span>{trend.isPositive !== false ? '↑' : '↓'} {trend.isPositive !== false ? '+' : ''}{trend.value}%</span>
              </div>
            )}
          </div>
          {Icon && (
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${styles.icon}`}>
              <Icon className="w-5 h-5" />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

interface StatGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

export function StatGrid({ children, columns = 4, className = '' }: StatGridProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-4 ${className}`}>
      {children}
    </div>
  );
}
