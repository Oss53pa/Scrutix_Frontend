// ============================================================================
// ATLASBANX - PDF.js worker setup (centralized)
// ============================================================================
// Why this module exists
// ──────────────────────
// pdfjs-dist v5+ ships only `.mjs` worker files. Setting workerSrc to a
// CDN URL (the historic approach) breaks because:
//   1. The CDN no longer hosts `.min.js` for v5 — only `.min.mjs`.
//   2. This app uses `vite-plugin-singlefile` which inlines every asset
//      as a base64 data: URL. Browsers can't spawn a Worker from a data
//      URL (CSP blocks it), so pdfjs falls back to "fake worker mode"
//      which then dynamically imports workerSrc — silently re-introducing
//      the broken CDN dependency.
//
// Solution: Vite's `?worker` query type produces a real Worker constructor
// regardless of singleFile's inlining behavior. We instantiate it once
// and hand the resulting MessagePort to pdfjs via `workerPort`. This
// bypasses workerSrc entirely — pdfjs uses the port we provided and
// never tries to fetch anything from a URL.
//
// Import this module FOR ITS SIDE EFFECTS in any service that uses pdfjs:
//     import { pdfjsLib } from './pdfjsWorker';
// ============================================================================

import * as pdfjsLib from 'pdfjs-dist';
// Vite ?worker = treat as a Web Worker. Returns a constructor.
// Works with vite-plugin-singlefile (worker is bundled as a Blob URL).
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Vite's ?worker query is a build-time virtual module
import PdfJsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';

// Instantiate once — pdfjs supports a single shared workerPort across
// all getDocument() calls. Using a port (instead of workerSrc) means
// pdfjs never falls back to URL fetching.
let _workerInitialized = false;
function ensureWorker(): void {
  if (_workerInitialized) return;
  try {
    const worker = new PdfJsWorker();
    pdfjsLib.GlobalWorkerOptions.workerPort = worker;
    _workerInitialized = true;
  } catch (err) {
    // If Worker construction fails (very rare — only if Vite's transform
    // didn't apply), set workerSrc to '' so pdfjs runs on the main thread.
    // Slower than a real worker, but still functional.
    console.warn('[pdfjsWorker] Worker init failed, falling back to main-thread mode:', err);
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
  }
}

ensureWorker();

export { pdfjsLib };
