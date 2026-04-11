/**
 * @module AtlasBanx
 * @file src/components/scoring/RiskScoreBadge.tsx
 * @description Badge compact affichant le score + libellé du niveau de
 *              risque. Utilisé dans la liste clients, le dashboard et
 *              les rapports.
 */

import { ShieldAlert, ShieldCheck, ShieldQuestion, AlertTriangle } from 'lucide-react';
import {
  RISK_LEVEL_LABELS,
  RISK_LEVEL_COLORS,
  type RiskLevel,
} from '../../scoring';

interface RiskScoreBadgeProps {
  score: number;
  level: RiskLevel;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<RiskScoreBadgeProps['size']>, string> = {
  sm: 'text-xs px-2 py-0.5 gap-1',
  md: 'text-sm px-2.5 py-1 gap-1.5',
  lg: 'text-base px-3 py-1.5 gap-2',
};

const ICON_SIZE: Record<NonNullable<RiskScoreBadgeProps['size']>, string> = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

export function RiskScoreBadge({
  score,
  level,
  showLabel = true,
  size = 'md',
  className = '',
}: RiskScoreBadgeProps) {
  const colors = RISK_LEVEL_COLORS[level];
  const Icon =
    level === 'low' ? ShieldCheck
    : level === 'moderate' ? ShieldQuestion
    : level === 'high' ? ShieldAlert
    : AlertTriangle;

  return (
    <span
      className={`
        inline-flex items-center rounded-full font-semibold ring-1
        ${colors.bg} ${colors.text} ${colors.ring}
        ${SIZE_CLASSES[size]}
        ${className}
      `}
      title={`Score de risque : ${score}/100 — ${RISK_LEVEL_LABELS[level]}`}
    >
      <Icon className={ICON_SIZE[size]} />
      <span className="font-mono">{score}</span>
      {showLabel && <span className="font-normal">/{RISK_LEVEL_LABELS[level]}</span>}
    </span>
  );
}
