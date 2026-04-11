/**
 * @module AtlasBanx
 * @file src/components/billing/InvoiceStatusBadge.tsx
 * @description Badge coloré affichant le statut d'une facture.
 */

import { FileText, Send, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { INVOICE_STATUS_LABELS, type InvoiceStatus } from '../../billing';

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
  size?: 'sm' | 'md';
}

const STATUS_STYLES: Record<InvoiceStatus, { bg: string; text: string; ring: string }> = {
  draft:     { bg: 'bg-primary-100', text: 'text-primary-700', ring: 'ring-primary-300' },
  sent:      { bg: 'bg-blue-100',    text: 'text-blue-700',    ring: 'ring-blue-300' },
  paid:      { bg: 'bg-green-100',   text: 'text-green-700',   ring: 'ring-green-300' },
  overdue:   { bg: 'bg-red-100',     text: 'text-red-700',     ring: 'ring-red-300' },
  cancelled: { bg: 'bg-primary-200', text: 'text-primary-500', ring: 'ring-primary-300' },
};

const STATUS_ICONS: Record<InvoiceStatus, typeof FileText> = {
  draft: FileText,
  sent: Send,
  paid: CheckCircle2,
  overdue: AlertCircle,
  cancelled: XCircle,
};

export function InvoiceStatusBadge({ status, size = 'md' }: InvoiceStatusBadgeProps) {
  const styles = STATUS_STYLES[status];
  const Icon = STATUS_ICONS[status];
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5 gap-1' : 'text-sm px-2.5 py-1 gap-1.5';
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ring-1 ${styles.bg} ${styles.text} ${styles.ring} ${sizeClasses}`}
    >
      <Icon className={iconSize} />
      {INVOICE_STATUS_LABELS[status]}
    </span>
  );
}
