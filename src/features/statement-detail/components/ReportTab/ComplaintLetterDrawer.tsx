// ============================================================================
// ComplaintLetterDrawer — drawer aperçu de la lettre de réclamation
// ============================================================================

import { X } from 'lucide-react';

interface ComplaintLetterDrawerProps {
  text: string;
  onClose: () => void;
}

export function ComplaintLetterDrawer({ text, onClose }: ComplaintLetterDrawerProps) {
  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[600px] bg-white shadow-2xl border-l border-canvas-200 flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-canvas-200">
        <h3 className="text-sm font-semibold">Aperçu de la lettre</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-canvas-100">
          <X className="w-4 h-4" />
        </button>
      </div>
      <pre className="flex-1 overflow-auto p-4 text-[11px] font-mono whitespace-pre-wrap text-ink-800">
        {text}
      </pre>
    </div>
  );
}
