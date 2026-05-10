// ============================================================================
// ProphetInputBar — input bar du drawer copilote (toujours en bas)
// ============================================================================

import { Send } from 'lucide-react';

interface ProphetInputBarProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit: (text: string) => void;
  pending?: boolean;
}

export function ProphetInputBar({ value, onChange, onSubmit, pending }: ProphetInputBarProps) {
  return (
    <div className="border-t border-canvas-200 p-2 bg-canvas-50">
      <div className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (value.trim() && !pending) onSubmit(value.trim());
            }
          }}
          rows={2}
          placeholder="Posez votre question sur ce relevé…"
          className="flex-1 px-2 py-1.5 text-xs border border-canvas-300 rounded resize-none focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
        <button
          disabled={!value.trim() || pending}
          onClick={() => value.trim() && !pending && onSubmit(value.trim())}
          className="p-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-40"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="mt-1 text-[10px] text-ink-500">
        Réponses générées par PROPH3T (Ollama local). Calculs en TypeScript pur.
        Source : ce relevé uniquement (pas d'autres données client).
      </p>
    </div>
  );
}
