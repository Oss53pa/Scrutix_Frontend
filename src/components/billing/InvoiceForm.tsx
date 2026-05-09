import { formatNumber } from '../../utils';
/**
 * @module AtlasBanx
 * @file src/components/billing/InvoiceForm.tsx
 * @description Formulaire de création/édition d'une facture.
 *              Lignes dynamiques, calcul HT/TVA/TTC en temps réel,
 *              import automatique des missions d'un client sur une période.
 */

import { useState, useMemo, useCallback } from 'react';
import { Plus, Trash2, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody, Button, Input, Select, Alert } from '../ui';
import {
  BillingService,
  type CreateInvoiceDTO,
  type CreateInvoiceLineDTO,
  type InvoiceLineType,
  INVOICE_LINE_TYPE_LABELS,
} from '../../billing';
import type { Client } from '../../types';

interface InvoiceFormProps {
  clients: Client[];
  defaultTaxRate?: number;
  defaultPaymentTermsDays?: number;
  onCreated?: (invoiceId: string) => void;
  onCancel?: () => void;
}

interface LineState extends CreateInvoiceLineDTO {
  localKey: string;
}

function makeEmptyLine(): LineState {
  return {
    localKey: `line-${Math.random().toString(36).slice(2, 10)}`,
    description: '',
    quantity: 1,
    unitPriceFcfa: 0,
    lineType: 'service',
  };
}

export function InvoiceForm({
  clients,
  defaultTaxRate = 18,
  defaultPaymentTermsDays = 30,
  onCreated,
  onCancel,
}: InvoiceFormProps) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [taxRate, setTaxRate] = useState(defaultTaxRate);
  const [termsDays, setTermsDays] = useState(defaultPaymentTermsDays);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineState[]>([makeEmptyLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(
    () => BillingService.computeTotals(lines, taxRate),
    [lines, taxRate],
  );

  const addLine = useCallback(() => {
    setLines((prev) => [...prev, makeEmptyLine()]);
  }, []);

  const removeLine = useCallback((localKey: string) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.localKey !== localKey) : prev));
  }, []);

  const updateLine = useCallback((localKey: string, patch: Partial<LineState>) => {
    setLines((prev) => prev.map((l) => (l.localKey === localKey ? { ...l, ...patch } : l)));
  }, []);

  const handleImportMissions = async () => {
    if (!clientId) return;
    setError(null);
    try {
      const period = {
        start: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
        end: new Date(),
      };
      const imported = await BillingService.importMissionsFromAnalyses(clientId, period);
      if (imported.length === 0) {
        setError("Aucune mission trouvée pour ce client sur la période courante.");
        return;
      }
      setLines((prev) => [
        ...prev.filter((l) => l.description.trim() !== ''),
        ...imported.map((l) => ({ ...l, localKey: `line-${Math.random().toString(36).slice(2, 10)}` })),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'import');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!clientId) {
      setError('Client requis');
      return;
    }
    const validLines = lines.filter((l) => l.description.trim() !== '' && l.quantity > 0 && l.unitPriceFcfa >= 0);
    if (validLines.length === 0) {
      setError('Au moins une ligne de facturation est requise');
      return;
    }

    setSubmitting(true);
    try {
      const dto: CreateInvoiceDTO = {
        clientId,
        issueDate: new Date(issueDate),
        paymentTermsDays: termsDays,
        taxRate,
        notes: notes.trim() || undefined,
        lines: validLines.map(({ localKey: _localKey, ...rest }) => {
          void _localKey;
          return rest;
        }),
      };
      const invoice = await BillingService.createInvoice(dto);
      onCreated?.(invoice.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de création');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nouvelle facture</CardTitle>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert variant="error" title="Erreur">{error}</Alert>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
              required
            />
            <Input
              type="date"
              label="Date d'émission"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              type="number"
              label="Délai de paiement (jours)"
              value={termsDays}
              onChange={(e) => setTermsDays(Math.max(0, Number(e.target.value)))}
              min={0}
            />
            <Input
              type="number"
              label="Taux TVA (%)"
              value={taxRate}
              onChange={(e) => setTaxRate(Math.max(0, Math.min(100, Number(e.target.value))))}
              min={0}
              max={100}
              step={0.01}
            />
          </div>

          {/* Lignes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-primary-800">Lignes de facturation</h4>
              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={handleImportMissions}>
                  <Sparkles className="w-4 h-4 mr-1" />
                  Importer les missions
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={addLine}>
                  <Plus className="w-4 h-4 mr-1" />
                  Ajouter
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {lines.map((line) => (
                <div
                  key={line.localKey}
                  className="grid grid-cols-12 gap-2 items-start p-2 border border-primary-200 rounded-lg"
                >
                  <div className="col-span-2">
                    <Select
                      value={line.lineType}
                      onChange={(e) =>
                        updateLine(line.localKey, { lineType: e.target.value as InvoiceLineType })
                      }
                      options={(Object.keys(INVOICE_LINE_TYPE_LABELS) as InvoiceLineType[]).map((t) => ({
                        value: t,
                        label: INVOICE_LINE_TYPE_LABELS[t],
                      }))}
                    />
                  </div>
                  <div className="col-span-5">
                    <Input
                      placeholder="Description"
                      value={line.description}
                      onChange={(e) => updateLine(line.localKey, { description: e.target.value })}
                    />
                  </div>
                  <div className="col-span-1">
                    <Input
                      type="number"
                      placeholder="Qté"
                      value={line.quantity}
                      min={0.01}
                      step={0.01}
                      onChange={(e) =>
                        updateLine(line.localKey, { quantity: Math.max(0.01, Number(e.target.value)) })
                      }
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      placeholder="PU (FCFA)"
                      value={line.unitPriceFcfa}
                      min={0}
                      onChange={(e) =>
                        updateLine(line.localKey, { unitPriceFcfa: Math.max(0, Number(e.target.value)) })
                      }
                    />
                  </div>
                  <div className="col-span-1 flex items-center justify-center h-full">
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => removeLine(line.localKey)}
                      disabled={lines.length === 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totaux live */}
          <div className="border-t border-primary-200 pt-4">
            <div className="flex justify-end">
              <div className="w-72 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-primary-600">Sous-total HT</span>
                  <span className="font-mono">{formatNumber(totals.subtotal)} FCFA</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-primary-600">TVA ({taxRate.toFixed(2)}%)</span>
                  <span className="font-mono">{formatNumber(totals.tax)} FCFA</span>
                </div>
                <div className="flex justify-between py-2 border-t border-primary-300 font-bold">
                  <span>Total TTC</span>
                  <span className="font-mono">{formatNumber(totals.total)} FCFA</span>
                </div>
              </div>
            </div>
          </div>

          <Input
            label="Notes (optionnel)"
            placeholder="Ex: Règlement par virement bancaire..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2 pt-2">
            {onCancel && (
              <Button type="button" variant="secondary" onClick={onCancel}>
                Annuler
              </Button>
            )}
            <Button type="submit" variant="primary" isLoading={submitting}>
              Créer la facture
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
