// ============================================================================
// ATLASBANX — PDF Viewer with bounding-box overlay
// ============================================================================
// Renders a PDF page-by-page using pdfjs canvas, with:
//   • Zoom in/out + reset
//   • Page navigation (prev/next + jump to page)
//   • Bounding box overlay for the focused row (highlighted in gold)
//   • Auto-scroll to the focused row's page
//   • Optional click-on-region → callback (for click-to-snap-row)
// ============================================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Loader2,
} from 'lucide-react';
import { pdfjsLib } from '../../services/pdfjsWorker';
import type { BoundingBox } from '../../extraction/bank-statement/types';

interface PdfViewerWithOverlayProps {
  /** PDF file to render */
  file: File | Blob;
  /** Bounding box of the row currently focused in the table (highlighted in gold).
   *  When null, no overlay is shown. */
  focusedBox?: BoundingBox | null;
  /** All bounding boxes for click-to-snap (clicking near a box focuses it).
   *  Optional — disable by omitting. */
  allBoxes?: Array<{ rowId: string; box: BoundingBox }>;
  /** Called when user clicks inside an existing bounding box */
  onBoxClick?: (rowId: string) => void;
  className?: string;
}

interface PageDims {
  /** width × height in CSS pixels at the current zoom */
  width: number;
  height: number;
  /** PDF user-space dimensions */
  pdfWidth: number;
  pdfHeight: number;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.2;

export function PdfViewerWithOverlay({
  file,
  focusedBox,
  allBoxes,
  onBoxClick,
  className = '',
}: PdfViewerWithOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const [pdf, setPdf] = useState<Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']> | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pageDims, setPageDims] = useState<Record<number, PageDims>>({});
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // ─── Load the PDF document ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const buffer = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
      if (cancelled) return;
      setPdf(doc);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  // ─── Render all pages whenever the PDF or zoom changes ────────────────
  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    (async () => {
      const newDims: Record<number, PageDims> = {};
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: zoom * 1.5 }); // 1.5 base for crispness
        const ref = pageRefs.current[p];
        if (!ref) continue;

        // Find or create the canvas for this page
        let canvas = ref.querySelector<HTMLCanvasElement>('canvas');
        if (!canvas) {
          canvas = document.createElement('canvas');
          canvas.className = 'block';
          ref.appendChild(canvas);
        }
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / 1.5}px`;
        canvas.style.height = `${viewport.height / 1.5}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;

        // Get the underlying PDF dimensions for bbox conversion
        const baseViewport = page.getViewport({ scale: 1 });
        newDims[p] = {
          width: viewport.width / 1.5,
          height: viewport.height / 1.5,
          pdfWidth: baseViewport.width,
          pdfHeight: baseViewport.height,
        };
      }
      if (cancelled) return;
      setPageDims(newDims);
    })();
    return () => {
      cancelled = true;
    };
  }, [pdf, zoom]);

  // ─── Auto-scroll to focused box ───────────────────────────────────────
  useEffect(() => {
    if (!focusedBox) return;
    const el = pageRefs.current[focusedBox.page];
    if (!el) return;
    setCurrentPage(focusedBox.page);
    // Scroll the page into view in the container
    const cont = containerRef.current;
    if (!cont) return;
    const dim = pageDims[focusedBox.page];
    if (!dim) return;
    // Compute the Y of the box on the page (PDF Y grows up; canvas Y grows down)
    const pageRect = el.getBoundingClientRect();
    const contRect = cont.getBoundingClientRect();
    const yOnCanvas =
      ((dim.pdfHeight - focusedBox.yTop) / dim.pdfHeight) * dim.height;
    const targetY = pageRect.top - contRect.top + cont.scrollTop + yOnCanvas - 80;
    cont.scrollTo({ top: targetY, behavior: 'smooth' });
  }, [focusedBox, pageDims]);

  // ─── Handlers ─────────────────────────────────────────────────────────
  const zoomIn = useCallback(() => setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2))), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2))), []);
  const resetZoom = useCallback(() => setZoom(1), []);

  const goToPage = useCallback((p: number) => {
    if (!pdf) return;
    const target = Math.max(1, Math.min(pdf.numPages, p));
    setCurrentPage(target);
    pageRefs.current[target]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [pdf]);

  const handlePageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, page: number) => {
      if (!onBoxClick || !allBoxes) return;
      const target = e.currentTarget;
      const rect = target.getBoundingClientRect();
      const dim = pageDims[page];
      if (!dim) return;
      const cssX = e.clientX - rect.left;
      const cssY = e.clientY - rect.top;
      // Convert CSS coords back to PDF user-space
      const pdfX = (cssX / dim.width) * dim.pdfWidth;
      const pdfY = ((dim.height - cssY) / dim.height) * dim.pdfHeight;
      // Find a box that contains the click
      const hit = allBoxes.find(
        ({ box }) =>
          box.page === page &&
          pdfX >= box.xLeft &&
          pdfX <= box.xRight &&
          pdfY >= box.yBottom &&
          pdfY <= box.yTop,
      );
      if (hit) onBoxClick(hit.rowId);
    },
    [allBoxes, onBoxClick, pageDims],
  );

  // Convert a BoundingBox to CSS coords on its page
  const boxToCss = useCallback(
    (box: BoundingBox): { left: number; top: number; width: number; height: number } | null => {
      const dim = pageDims[box.page];
      if (!dim) return null;
      const left = (box.xLeft / dim.pdfWidth) * dim.width;
      const right = (box.xRight / dim.pdfWidth) * dim.width;
      const top = ((dim.pdfHeight - box.yTop) / dim.pdfHeight) * dim.height;
      const bottom = ((dim.pdfHeight - box.yBottom) / dim.pdfHeight) * dim.height;
      return {
        left,
        top,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
      };
    },
    [pageDims],
  );

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="flex flex-col items-center gap-3 text-ink-500">
          <Loader2 className="w-6 h-6 animate-spin text-accent-600" />
          <p className="text-xs uppercase tracking-[0.18em]">Chargement du PDF</p>
        </div>
      </div>
    );
  }

  if (!pdf) {
    return (
      <div className={`flex items-center justify-center h-full text-ink-500 ${className}`}>
        Impossible de charger le PDF
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-primary-200/60 bg-canvas-50/70 backdrop-blur">
        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          className="p-1.5 rounded-md hover:bg-canvas-200 disabled:opacity-40 disabled:cursor-not-allowed text-ink-600"
          aria-label="Page précédente"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-xs font-medium text-ink-700 tabular-nums px-2">
          Page {currentPage} / {pdf.numPages}
        </div>
        <button
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= pdf.numPages}
          className="p-1.5 rounded-md hover:bg-canvas-200 disabled:opacity-40 disabled:cursor-not-allowed text-ink-600"
          aria-label="Page suivante"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="p-1.5 rounded-md hover:bg-canvas-200 disabled:opacity-40 disabled:cursor-not-allowed text-ink-600"
            aria-label="Dézoomer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={resetZoom}
            className="text-xs font-medium px-2 py-1 rounded-md hover:bg-canvas-200 text-ink-700 tabular-nums min-w-[3.5rem]"
            title="Réinitialiser le zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="p-1.5 rounded-md hover:bg-canvas-200 disabled:opacity-40 disabled:cursor-not-allowed text-ink-600"
            aria-label="Zoomer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={resetZoom}
            className="p-1.5 rounded-md hover:bg-canvas-200 text-ink-600"
            aria-label="Adapter à la fenêtre"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto bg-canvas-100 p-4 space-y-4">
        {Array.from({ length: pdf.numPages }, (_, i) => i + 1).map((p) => (
          <div
            key={p}
            ref={(el) => {
              pageRefs.current[p] = el;
            }}
            data-page={p}
            className="relative mx-auto bg-white rounded-card shadow-card border border-primary-200/60 overflow-hidden"
            onClick={(e) => handlePageClick(e, p)}
          >
            {/* Canvas is appended dynamically */}

            {/* Bounding box overlay (focused) */}
            {focusedBox && focusedBox.page === p && (() => {
              const css = boxToCss(focusedBox);
              if (!css) return null;
              return (
                <div
                  className="absolute pointer-events-none rounded-sm"
                  style={{
                    left: css.left - 4,
                    top: css.top - 4,
                    width: css.width + 8,
                    height: css.height + 8,
                    border: '2px solid rgb(201 149 74)',
                    background: 'rgb(201 149 74 / 0.18)',
                    boxShadow: '0 0 0 4px rgb(201 149 74 / 0.15), 0 8px 24px -4px rgb(201 149 74 / 0.4)',
                    transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
              );
            })()}

            {/* Subtle hover targets for all known boxes */}
            {allBoxes
              ?.filter(({ box }) => box.page === p)
              .map(({ rowId, box }) => {
                const css = boxToCss(box);
                if (!css) return null;
                return (
                  <div
                    key={rowId}
                    className="absolute hover:bg-accent-300/15 transition-colors cursor-pointer"
                    style={{
                      left: css.left,
                      top: css.top,
                      width: css.width,
                      height: css.height,
                    }}
                  />
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}
