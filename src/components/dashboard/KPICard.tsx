import { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card } from '../ui';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    label: string;
  };
  variant?: 'default' | 'success' | 'warning' | 'error';
}

const variantStyles = {
  default: 'text-primary-900',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
};

const iconBgStyles = {
  default: 'bg-primary-100',
  success: 'bg-green-100',
  warning: 'bg-amber-100',
  error: 'bg-red-100',
};

export function KPICard({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = 'default',
}: KPICardProps) {
  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend.value > 0) return <TrendingUp className="w-4 h-4" />;
    if (trend.value < 0) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getTrendColor = () => {
    if (!trend) return '';
    if (trend.value > 0) return 'text-success';
    if (trend.value < 0) return 'text-error';
    return 'text-primary-500';
  };

  return (
    <Card className="p-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-primary-500 uppercase tracking-wide">{title}</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${variantStyles[variant]}`}>{value}</p>
          {subtitle && <p className="text-xs text-primary-500">{subtitle}</p>}
          {trend && (
            <div className={`mt-1 flex items-center gap-1 text-xs ${getTrendColor()}`}>
              {getTrendIcon()}
              <span className="font-medium">{trend.value > 0 ? '+' : ''}{trend.value}%</span>
              <span className="text-primary-400">{trend.label}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className={`p-2 rounded-lg ${iconBgStyles[variant]}`}>
            <div className={variantStyles[variant]}>{icon}</div>
          </div>
        )}
      </div>
    </Card>
  );
}
