// ============================================================================
// ProphetSuggestionCard — suggestion contextuelle générée par PROPH3T
// ============================================================================

import { Sparkles, ChevronRight } from 'lucide-react';

interface ProphetSuggestionCardProps {
  text: string;
  actions?: Array<{ label: string; onClick?: () => void }>;
  loading?: boolean;
}

export function ProphetSuggestionCard({ text, actions = [], loading }: ProphetSuggestionCardProps) {
  return (
    <section className="bg-white border border-canvas-200 rounded-lg p-3 sm:p-4">
      <div className="flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-full bg-amber-50 inline-flex items-center justify-center text-amber-700 shrink-0">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-semibold text-ink-900 inline-flex items-center gap-1.5">
            PROPH3T · suggestion
          </h3>
          <p className="text-xs text-ink-700 mt-1 leading-relaxed">
            {loading ? 'PROPH3T réfléchit…' : text}
          </p>
          {actions.length > 0 && (
            <div className="mt-2.5 flex items-center gap-2 flex-wrap">
              {actions.map((a, i) => (
                <button
                  key={i}
                  onClick={a.onClick}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-canvas-300 bg-white text-[11px] font-medium hover:bg-canvas-50"
                >
                  {a.label}
                  <ChevronRight className="w-3 h-3" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
