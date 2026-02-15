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
    icon: 'bg-primary-100 text-primary-700',
    value: 'text-primary-900',
    label: 'text-primary-500',
  },
  primary: {
    card: 'bg-primary-900 text-white',
    icon: 'bg-primary-800 text-white',
    value: 'text-white',
    label: 'text-primary-200',
  },
  success: {
    card: 'bg-primary-50',
    icon: 'bg-primary-100 text-primary-700',
    value: 'text-primary-900',
    label: 'text-primary-600',
  },
  warning: {
    card: 'bg-primary-50',
    icon: 'bg-primary-100 text-primary-700',
    value: 'text-primary-900',
    label: 'text-primary-600',
  },
  danger: {
    card: 'bg-primary-50',
    icon: 'bg-primary-100 text-primary-700',
    value: 'text-primary-900',
    label: 'text-primary-600',
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
    <Card className={`${styles.card} ${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className={`text-sm font-medium ${styles.label}`}>{label}</p>
            <p className={`text-2xl font-bold mt-1 ${styles.value}`}>
              {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
            </p>
            {subtitle && (
              <p className={`text-xs mt-1 ${styles.label}`}>{subtitle}</p>
            )}
            {trend && (
              <div className={`flex items-center gap-1 mt-2 text-sm ${
                trend.isPositive !== false ? 'text-green-600' : 'text-red-600'
              }`}>
                <span>{trend.isPositive !== false ? '+' : ''}{trend.value}%</span>
              </div>
            )}
          </div>
          {Icon && (
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${styles.icon}`}>
              <Icon className="w-6 h-6" />
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
