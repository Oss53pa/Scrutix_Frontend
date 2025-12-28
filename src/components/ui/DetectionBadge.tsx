import { Cpu, Bot, Sparkles } from 'lucide-react';
import type { DetectionSource } from '../../types';

interface DetectionBadgeProps {
  source?: DetectionSource;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

const sourceConfig = {
  algorithm: {
    icon: Cpu,
    label: 'Algorithme',
    shortLabel: 'Algo',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    iconColor: 'text-blue-600',
    description: 'Detecte par regles mathematiques',
  },
  ai: {
    icon: Bot,
    label: 'Intelligence Artificielle',
    shortLabel: 'IA',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    iconColor: 'text-purple-600',
    description: 'Detecte par analyse IA (Claude)',
  },
  hybrid: {
    icon: Sparkles,
    label: 'Hybride',
    shortLabel: 'Hybride',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    iconColor: 'text-amber-600',
    description: 'Detecte par algorithme + confirme par IA',
  },
};

export function DetectionBadge({
  source = 'algorithm',
  size = 'sm',
  showLabel = true,
  className = ''
}: DetectionBadgeProps) {
  const config = sourceConfig[source];
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-sm gap-1.5',
  };

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${config.color} ${sizeClasses[size]} ${className}`}
      title={config.description}
    >
      <Icon className={`${iconSize} ${config.iconColor}`} />
      {showLabel && (
        <span>{size === 'sm' ? config.shortLabel : config.label}</span>
      )}
    </span>
  );
}

// Version pour afficher dans une liste ou tableau
export function DetectionSourceInfo({ source = 'algorithm' }: { source?: DetectionSource }) {
  const config = sourceConfig[source];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
        source === 'algorithm' ? 'bg-blue-100' :
        source === 'ai' ? 'bg-purple-100' : 'bg-amber-100'
      }`}>
        <Icon className={`w-4 h-4 ${config.iconColor}`} />
      </div>
      <div>
        <p className="text-sm font-medium text-primary-900">{config.label}</p>
        <p className="text-xs text-primary-500">{config.description}</p>
      </div>
    </div>
  );
}
