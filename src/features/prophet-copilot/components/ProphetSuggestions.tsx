// ============================================================================
// ProphetSuggestions — liste des questions suggérées (état initial)
// ============================================================================

interface ProphetSuggestionsProps {
  suggestions: string[];
  onSelect: (s: string) => void;
}

export function ProphetSuggestions({ suggestions, onSelect }: ProphetSuggestionsProps) {
  return (
    <div>
      <p className="text-xs text-ink-700 mb-2">Que voulez-vous savoir sur ce relevé ?</p>
      <div className="flex flex-col gap-1.5">
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => onSelect(s)}
            className="text-left text-xs px-2 py-1.5 rounded border border-canvas-200 bg-white hover:bg-amber-50 hover:border-amber-300 transition-colors"
          >
            ▸ {s}
          </button>
        ))}
      </div>
    </div>
  );
}
