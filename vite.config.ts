import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks - split large libraries
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
          'vendor-pdf': ['pdfjs-dist'],
          'vendor-excel': ['exceljs', 'papaparse'],
          'vendor-export': ['jspdf', 'jspdf-autotable'],
          'vendor-ocr': ['tesseract.js'],
          'vendor-utils': ['date-fns', 'uuid', 'zustand'],
        },
      },
    },
    // Increase warning limit since we're now properly chunking
    chunkSizeWarningLimit: 800,
  },
});
