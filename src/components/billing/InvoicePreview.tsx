/**
 * @module AtlasBanx
 * @file src/components/billing/InvoicePreview.tsx
 * @description Prévisualisation A4 d'une facture avant export PDF.
 *              Rendu HTML fidèle au PDF OHADA produit par BillingService.
 */

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Invoice, BillingSettings } from '../../billing';
import { INVOICE_LINE_TYPE_LABELS } from '../../billing';

interface InvoicePreviewProps {
  invoice: Invoice;
  clientName: string;
  settings: BillingSettings | null;
}

export function InvoicePreview({ invoice, clientName, settings }: InvoicePreviewProps) {
  const lines = invoice.lines ?? [];

  return (
    <div
      className="bg-white shadow-lg mx-auto"
      style={{ width: '210mm', minHeight: '297mm', padding: '15mm' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-primary-900 pb-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-primary-900">FACTURE</h1>
          <div className="text-sm text-primary-600 mt-1">N° {invoice.invoiceNumber}</div>
        </div>
        {settings?.logoUrl ? (
          <img src={settings.logoUrl} alt="Logo" className="h-16 object-contain" />
        ) : (
          <div className="text-right">
            <div className="text-xl font-display text-primary-900">
              {settings?.legalName ?? 'Cabinet'}
            </div>
          </div>
        )}
      </div>

      {/* Parties */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <div className="text-xs font-semibold text-primary-500 uppercase mb-1">Émetteur</div>
          <div className="text-sm text-primary-900 space-y-0.5">
            <div className="font-semibold">{settings?.legalName ?? '—'}</div>
            {settings?.address && <div>{settings.address}</div>}
            {(settings?.city || settings?.country) && (
              <div>{[settings?.city, settings?.country].filter(Boolean).join(', ')}</div>
            )}
            {settings?.phone && <div>Tél : {settings.phone}</div>}
            {settings?.email && <div>Email : {settings.email}</div>}
            {settings?.nif && <div>NIF : {settings.nif}</div>}
            {settings?.rccm && <div>RCCM : {settings.rccm}</div>}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-primary-500 uppercase mb-1">Destinataire</div>
          <div className="text-sm text-primary-900">
            <div className="font-semibold">{clientName}</div>
          </div>
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
        <div>
          <span className="text-primary-500">Date d'émission : </span>
          <span className="font-medium">
            {format(invoice.issueDate, 'dd MMMM yyyy', { locale: fr })}
          </span>
        </div>
        <div>
          <span className="text-primary-500">Date d'échéance : </span>
          <span className="font-medium">
            {format(invoice.dueDate, 'dd MMMM yyyy', { locale: fr })}
          </span>
        </div>
      </div>

      {/* Table des lignes */}
      <table className="w-full text-sm border-collapse mb-6">
        <thead>
          <tr className="bg-primary-900 text-white">
            <th className="py-2 px-2 text-left w-8">#</th>
            <th className="py-2 px-2 text-left w-24">Type</th>
            <th className="py-2 px-2 text-left">Désignation</th>
            <th className="py-2 px-2 text-right w-12">Qté</th>
            <th className="py-2 px-2 text-right w-28">PU (FCFA)</th>
            <th className="py-2 px-2 text-right w-28">Total (FCFA)</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => (
            <tr key={line.id || idx} className="border-b border-primary-100">
              <td className="py-2 px-2">{idx + 1}</td>
              <td className="py-2 px-2 text-primary-600">{INVOICE_LINE_TYPE_LABELS[line.lineType]}</td>
              <td className="py-2 px-2">{line.description}</td>
              <td className="py-2 px-2 text-right">{line.quantity}</td>
              <td className="py-2 px-2 text-right font-mono">
                {line.unitPriceFcfa.toLocaleString('fr-FR')}
              </td>
              <td className="py-2 px-2 text-right font-mono">
                {line.lineTotalFcfa.toLocaleString('fr-FR')}
              </td>
            </tr>
          ))}
          {lines.length === 0 && (
            <tr>
              <td colSpan={6} className="py-4 text-center text-primary-400">
                Aucune ligne de facturation
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Totaux */}
      <div className="flex justify-end mb-6">
        <div className="w-72">
          <div className="flex justify-between text-sm py-1">
            <span className="text-primary-600">Sous-total HT</span>
            <span className="font-mono">{invoice.subtotalFcfa.toLocaleString('fr-FR')} FCFA</span>
          </div>
          <div className="flex justify-between text-sm py-1 border-b border-primary-200">
            <span className="text-primary-600">TVA ({invoice.taxRate.toFixed(2)}%)</span>
            <span className="font-mono">{invoice.taxAmountFcfa.toLocaleString('fr-FR')} FCFA</span>
          </div>
          <div className="flex justify-between items-center py-2 bg-primary-900 text-white px-3 rounded mt-1">
            <span className="font-bold">TOTAL TTC</span>
            <span className="font-mono font-bold">{invoice.totalFcfa.toLocaleString('fr-FR')} FCFA</span>
          </div>
        </div>
      </div>

      {/* Coordonnées bancaires */}
      {(settings?.bankName || settings?.bankAccount || settings?.bankRib) && (
        <div className="mb-4 p-3 bg-primary-50 rounded border border-primary-200">
          <div className="text-xs font-semibold text-primary-700 mb-1">
            Coordonnées bancaires pour règlement
          </div>
          <div className="text-xs text-primary-600 space-y-0.5">
            {settings?.bankName && <div>Banque : {settings.bankName}</div>}
            {settings?.bankAccount && <div>N° compte : {settings.bankAccount}</div>}
            {settings?.bankRib && <div>RIB : {settings.bankRib}</div>}
          </div>
        </div>
      )}

      {/* Notes */}
      {invoice.notes && (
        <div className="mb-4 text-sm">
          <div className="font-semibold text-primary-700 mb-1">Notes</div>
          <div className="text-primary-600 whitespace-pre-wrap">{invoice.notes}</div>
        </div>
      )}

      {/* Mentions légales */}
      <div className="mt-auto pt-6 border-t border-primary-200 text-xs text-primary-500">
        {settings?.legalMentions ||
          `Facture émise conformément à l'Acte Uniforme OHADA portant organisation et harmonisation des comptabilités. ${
            settings?.nif ? `NIF ${settings.nif}. ` : ''
          }${settings?.rccm ? `RCCM ${settings.rccm}.` : ''}`}
      </div>
    </div>
  );
}
