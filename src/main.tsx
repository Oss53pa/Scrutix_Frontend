// Legacy storage migration — MUST run before any store module is imported.
// This side-effect import rewrites `scrutix-*` localStorage keys to `atlasbanx-*`.
import './lib/migrateLegacyStorage';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
