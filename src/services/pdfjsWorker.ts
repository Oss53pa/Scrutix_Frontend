// ============================================================================
// ATLASBANX - PDF.js worker setup (centralized)
// ============================================================================
// pdfjs-dist v5+ ships only `.mjs` worker files (no more `.min.js`). The old
// CDN URL `//cdnjs.cloudflare.com/.../pdf.worker.min.js` returns 404 for v5,
// which silently breaks every PDF parse / OCR pre-extraction.
//
// We bundle the worker locally via Vite's `?url` query so:
//   • No CDN round-trip (works offline / behind firewall)
//   • No version-mismatch risk (worker always matches the API bundle)
//   • Single import everywhere — no copy/paste drift
//
// Import this module FOR ITS SIDE EFFECTS in any service that uses pdfjs:
//     import './pdfjsWorker';
// ============================================================================

import * as pdfjsLib from 'pdfjs-dist';
// Vite resolves this to a hashed asset URL at build time
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Set once at module load — pdfjs-dist supports re-assigning workerSrc but
// it's cleanest to lock it in early.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// Re-export the configured pdfjs namespace for callers that prefer a single
// import line. Functionally identical to `import * as pdfjsLib from 'pdfjs-dist'`.
export { pdfjsLib };
