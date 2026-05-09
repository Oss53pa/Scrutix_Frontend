// ============================================================================
// CDC — Split-Screen Validation UI (PDF ↔ Form bidirectional)
// ============================================================================
// CDC §7.2 étape 4 :
//   « Panneau gauche (60%) : le PDF source, navigable, avec surbrillance
//     dynamique de la zone correspondant au champ actuellement édité.
//     Panneau droit (40%) : le formulaire structuré pré-rempli par PROPH3T,
//     organisé par rubriques. »
//
// Interactions implémentées :
//   - Clic sur un champ → zone PDF correspondante centrée + surlignée
//   - Clic sur une zone du PDF → champ correspondant en focus
//   - Indicateur de confiance par champ (high/medium/low)
//   - Marquer un champ "non applicable" avec justification
//   - Sélection manuelle d'une zone PDF pour l'associer à un champ
//
// Le composant est headless côté logique : il prend des props bbox + champs
// et émet des callbacks. La couche d'extraction PROPH3T fournit les valeurs
// initiales et les confidences.
// ============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { CheckCircle2, AlertTriangle, XCircle, Info, MousePointer2, ZoomIn, ZoomOut } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface ExtractedField {
  id: string;
  rubricCode: string;
  label: string;
  /** La valeur pré-remplie par PROPH3T. */
  value: string | number | null;
  unit?: string;
  /** Bbox dans le PDF (coordonnées PDF natives — x bottom-left). */
  bbox: { page: number; x: number; y: number; w: number; h: number } | null;
  /** Confiance d'extraction, 0-1 ou catégorie. */
  confidence: 'high' | 'medium' | 'low' | null;
  /** L'utilisateur a-t-il marqué ce champ comme N/A ? */
  notApplicable?: { reason: string };
  /** Le champ a-t-il été validé par l'utilisateur ? */
  validated?: boolean;
}

export interface SplitScreenValidatorProps {
  /** URL du PDF (peut être Blob URL). */
  pdfUrl: string;
  /** Champs extraits par PROPH3T. */
  fields: ExtractedField[];
  /** Modifications locales remontées au parent. */
  onFieldChange: (fieldId: string, patch: Partial<ExtractedField>) => void;
  /** Champ actuellement focus (driven par parent). */
  activeFieldId?: string;
  onActivateField?: (fieldId: string) => void;
  /** Callback quand l'utilisateur sélectionne une zone PDF pour ajouter un champ. */
  onAddFieldFromBbox?: (bbox: { page: number; x: number; y: number; w: number; h: number }) => void;
  /** Tout est validé → bouton publication actif. */
  onValidateAll?: () => void;
}

// ============================================================================
// Constantes UI
// ============================================================================

const CONFIDENCE_TONE: Record<'high' | 'medium' | 'low', string> = {
  high: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  medium: 'text-amber-700 bg-amber-50 border-amber-200',
  low: 'text-rose-700 bg-rose-50 border-rose-200',
};

const CONFIDENCE_ICON = {
  high: CheckCircle2,
  medium: AlertTriangle,
  low: XCircle,
};

// ============================================================================
// Composant principal
// ============================================================================

export function SplitScreenValidator(props: SplitScreenValidatorProps) {
  const { pdfUrl, fields, onFieldChange, activeFieldId, onActivateField, onAddFieldFromBbox } = props;
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.4);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selStart, setSelStart] = useState<{ x: number; y: number } | null>(null);
  const [selRect, setSelRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Charger le PDF
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loadingTask = pdfjsLib.getDocument(pdfUrl);
      const doc = await loadingTask.promise;
      if (!cancelled) setPdf(doc);
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  // Si activeField change, naviguer à la page de son bbox
  useEffect(() => {
    if (!activeFieldId) return;
    const f = fields.find((x) => x.id === activeFieldId);
    if (f?.bbox) {
      setCurrentPage(f.bbox.page);
    }
  }, [activeFieldId, fields]);

  // Rendu de la page courante
  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let cancelled = false;
    (async () => {
      const page: PDFPageProxy = await pdf.getPage(currentPage);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const renderTask = page.render({ canvasContext: ctx, viewport, canvas });
      try {
        await renderTask.promise;
      } catch {
        /* cancelled on rerender */
      }
      if (cancelled) return;

      // Center on active field bbox if any
      if (activeFieldId && containerRef.current) {
        const f = fields.find((x) => x.id === activeFieldId);
        if (f?.bbox && f.bbox.page === currentPage) {
          // pdf.js viewport: y axis is flipped vs PDF coords
          const yScreen = viewport.height - (f.bbox.y + f.bbox.h) * scale;
          const xScreen = f.bbox.x * scale;
          const c = containerRef.current;
          c.scrollTo({
            top: Math.max(0, yScreen - c.clientHeight / 3),
            left: Math.max(0, xScreen - c.clientWidth / 3),
            behavior: 'smooth',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdf, currentPage, scale, activeFieldId, fields]);

  // Convertit bbox PDF (origine bottom-left) en pixels overlay (origine top-left)
  const overlayRects = useMemo(() => {
    if (!canvasRef.current) return [];
    const canvas = canvasRef.current;
    return fields
      .filter((f) => f.bbox && f.bbox.page === currentPage)
      .map((f) => {
        const b = f.bbox!;
        const x = b.x * scale;
        // y inverted
        const y = canvas.height - (b.y + b.h) * scale;
        const w = b.w * scale;
        const h = b.h * scale;
        return { id: f.id, label: f.label, confidence: f.confidence, isActive: f.id === activeFieldId, x, y, w, h };
      });
  }, [fields, currentPage, scale, activeFieldId]);

  // ============================================================================
  // Handlers de sélection manuelle
  // ============================================================================

  function startSelection(e: React.MouseEvent) {
    if (!selecting || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    setSelStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setSelRect(null);
  }

  function updateSelection(e: React.MouseEvent) {
    if (!selStart || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    setSelRect({
      x: Math.min(selStart.x, cx),
      y: Math.min(selStart.y, cy),
      w: Math.abs(cx - selStart.x),
      h: Math.abs(cy - selStart.y),
    });
  }

  function endSelection() {
    if (selRect && canvasRef.current && onAddFieldFromBbox) {
      const canvas = canvasRef.current;
      // Reconvertir en coordonnées PDF (origine bottom-left)
      const x = selRect.x / scale;
      const yPdf = (canvas.height - (selRect.y + selRect.h)) / scale;
      onAddFieldFromBbox({
        page: currentPage,
        x,
        y: yPdf,
        w: selRect.w / scale,
        h: selRect.h / scale,
      });
    }
    setSelecting(false);
    setSelStart(null);
    setSelRect(null);
  }

  // ============================================================================
  // Render
  // ============================================================================

  const groupedFields = useMemo(() => {
    const groups = new Map<string, ExtractedField[]>();
    for (const f of fields) {
      const cat = f.rubricCode.split('.')[0];
      const arr = groups.get(cat) ?? [];
      arr.push(f);
      groups.set(cat, arr);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [fields]);

  const validatedCount = fields.filter((f) => f.validated || f.notApplicable).length;
  const totalCount = fields.length;
  const allDone = validatedCount === totalCount && totalCount > 0;

  return (
    <div className="flex h-full w-full bg-canvas-50">
      {/* === Panneau gauche : PDF (60%) === */}
      <div className="flex flex-col w-3/5 border-r border-canvas-200">
        <div className="flex items-center justify-between px-4 py-2 border-b border-canvas-200 bg-white">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 text-sm rounded hover:bg-canvas-100 disabled:opacity-40"
            >
              ← Préc.
            </button>
            <span className="text-sm text-ink-600">
              Page {currentPage} / {pdf?.numPages ?? '…'}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(pdf?.numPages ?? 1, p + 1))}
              disabled={!pdf || currentPage === pdf.numPages}
              className="px-2 py-1 text-sm rounded hover:bg-canvas-100 disabled:opacity-40"
            >
              Suiv. →
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setScale((s) => Math.max(0.5, s - 0.2))} className="p-1 rounded hover:bg-canvas-100" title="Zoom -">
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs text-ink-500 w-10 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale((s) => Math.min(3, s + 0.2))} className="p-1 rounded hover:bg-canvas-100" title="Zoom +">
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSelecting((v) => !v)}
              className={`ml-2 px-2 py-1 rounded text-xs flex items-center gap-1 ${
                selecting ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'hover:bg-canvas-100'
              }`}
              title="Sélectionner une zone pour créer un champ"
            >
              <MousePointer2 className="w-3 h-3" />
              Sélectionner zone
            </button>
          </div>
        </div>
        <div ref={containerRef} className="relative overflow-auto flex-1">
          <div
            ref={overlayRef}
            className="relative inline-block"
            onMouseDown={startSelection}
            onMouseMove={updateSelection}
            onMouseUp={endSelection}
            style={{ cursor: selecting ? 'crosshair' : 'default' }}
          >
            <canvas ref={canvasRef} />
            {/* bbox overlays */}
            {overlayRects.map((r) => (
              <button
                key={r.id}
                onClick={() => onActivateField?.(r.id)}
                title={r.label}
                style={{
                  position: 'absolute',
                  left: r.x,
                  top: r.y,
                  width: r.w,
                  height: r.h,
                }}
                className={`block transition-all ${
                  r.isActive
                    ? 'ring-2 ring-amber-500 bg-amber-200/40'
                    : r.confidence === 'low'
                      ? 'ring-1 ring-rose-400 bg-rose-200/20 hover:bg-rose-200/40'
                      : r.confidence === 'medium'
                        ? 'ring-1 ring-amber-400 bg-amber-200/15 hover:bg-amber-200/30'
                        : 'ring-1 ring-emerald-400 bg-emerald-200/10 hover:bg-emerald-200/30'
                }`}
              />
            ))}
            {/* sélection en cours */}
            {selRect && (
              <div
                style={{
                  position: 'absolute',
                  left: selRect.x,
                  top: selRect.y,
                  width: selRect.w,
                  height: selRect.h,
                }}
                className="ring-2 ring-amber-500 border border-amber-600 bg-amber-200/30 pointer-events-none"
              />
            )}
          </div>
        </div>
      </div>

      {/* === Panneau droit : Formulaire (40%) === */}
      <div className="flex flex-col w-2/5 bg-white">
        <div className="flex items-center justify-between px-4 py-2 border-b border-canvas-200">
          <div>
            <div className="text-sm font-semibold text-ink-900">Validation des conditions</div>
            <div className="text-xs text-ink-500">
              {validatedCount} / {totalCount} champs validés
            </div>
          </div>
          <button
            onClick={props.onValidateAll}
            disabled={!allDone}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
              allDone
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-canvas-100 text-ink-400 cursor-not-allowed'
            }`}
          >
            Publier la convention
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 py-3">
          {groupedFields.map(([category, fs]) => (
            <div key={category} className="mb-4">
              <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-2">
                {category}
              </div>
              <div className="space-y-2">
                {fs.map((f) => (
                  <FieldRow
                    key={f.id}
                    field={f}
                    isActive={f.id === activeFieldId}
                    onActivate={() => onActivateField?.(f.id)}
                    onChange={(patch) => onFieldChange(f.id, patch)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// FieldRow — une rangée de champ avec contrôles
// ============================================================================

interface FieldRowProps {
  field: ExtractedField;
  isActive: boolean;
  onActivate: () => void;
  onChange: (patch: Partial<ExtractedField>) => void;
}

function FieldRow({ field, isActive, onActivate, onChange }: FieldRowProps) {
  const [showNa, setShowNa] = useState(false);
  const [naReason, setNaReason] = useState(field.notApplicable?.reason ?? '');
  const Icon = field.confidence ? CONFIDENCE_ICON[field.confidence] : Info;
  const tone = field.confidence ? CONFIDENCE_TONE[field.confidence] : 'text-ink-500 bg-canvas-50 border-canvas-200';

  return (
    <div
      onClick={onActivate}
      className={`p-2.5 border rounded-lg cursor-pointer transition-all ${
        isActive
          ? 'ring-2 ring-amber-500 bg-amber-50/50 border-amber-400'
          : field.notApplicable
            ? 'bg-canvas-50 border-canvas-200 opacity-60'
            : field.validated
              ? 'bg-emerald-50/30 border-emerald-200'
              : 'border-canvas-200 hover:border-canvas-400'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-ink-900 truncate">{field.label}</div>
          <div className="text-[10px] text-ink-500 font-mono">{field.rubricCode}</div>
        </div>
        {field.confidence && (
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-pill text-[10px] border ${tone}`}>
            <Icon className="w-3 h-3" />
            {field.confidence}
          </span>
        )}
      </div>

      {!field.notApplicable && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={field.value !== null && field.value !== undefined ? String(field.value) : ''}
            onChange={(e) => onChange({ value: e.target.value, validated: false })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Valeur"
            className="flex-1 px-2 py-1 text-xs border border-canvas-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          {field.unit && <span className="text-[10px] text-ink-500">{field.unit}</span>}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChange({ validated: !field.validated });
            }}
            className={`px-2 py-1 text-[10px] rounded ${
              field.validated
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-canvas-100 text-ink-700 hover:bg-canvas-200'
            }`}
          >
            {field.validated ? '✓' : 'Valider'}
          </button>
        </div>
      )}

      <div className="mt-1.5 flex items-center justify-between text-[10px]">
        {field.bbox ? (
          <span className="text-ink-500">📄 page {field.bbox.page}</span>
        ) : (
          <span className="text-rose-600">⚠ Pas de zone source</span>
        )}
        {!showNa && !field.notApplicable && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowNa(true);
            }}
            className="text-ink-500 hover:text-ink-900 underline"
          >
            Marquer N/A
          </button>
        )}
        {field.notApplicable && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChange({ notApplicable: undefined });
            }}
            className="text-ink-500 hover:text-ink-900 underline"
          >
            Annuler N/A
          </button>
        )}
      </div>

      {showNa && !field.notApplicable && (
        <div className="mt-2 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            value={naReason}
            onChange={(e) => setNaReason(e.target.value)}
            placeholder="Justification N/A…"
            className="flex-1 px-2 py-1 text-xs border border-canvas-300 rounded"
          />
          <button
            onClick={() => {
              if (naReason.trim()) {
                onChange({ notApplicable: { reason: naReason.trim() } });
                setShowNa(false);
              }
            }}
            className="px-2 py-1 text-[10px] bg-amber-600 text-white rounded hover:bg-amber-700"
          >
            OK
          </button>
        </div>
      )}

      {field.notApplicable && (
        <div className="mt-1 text-[10px] text-ink-500 italic">
          N/A : {field.notApplicable.reason}
        </div>
      )}
    </div>
  );
}
