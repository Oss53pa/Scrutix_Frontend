// ============================================================================
// ProphetMessage — bulle de message (user ou assistant) avec citations + follow-ups
// ============================================================================

import { Sparkles } from 'lucide-react';
import type { ProphetMessage as ProphetMessageType, ProphetCitation } from '../../statement-detail/types/statement.types';

interface ProphetMessageProps {
  message: ProphetMessageType;
  onCitationClick?: (c: ProphetCitation) => void;
  onFollowUp: (q: string) => void;
}

export function ProphetMessage({ message, onCitationClick, onFollowUp }: ProphetMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] ${isUser ? 'bg-amber-100 text-ink-900' : 'bg-white border border-canvas-200'} rounded-lg p-2.5`}>
        {!isUser && (
          <div className="flex items-center gap-1 mb-1">
            <Sparkles className="w-3 h-3 text-amber-600" />
            <span className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">PROPH3T</span>
          </div>
        )}
        <div className="text-xs text-ink-800 whitespace-pre-wrap leading-relaxed">{message.content}</div>

        {message.citations && message.citations.length > 0 && (
          <div className="mt-2 pt-2 border-t border-canvas-100">
            <div className="text-[10px] uppercase tracking-wider text-ink-500 mb-1">Sources</div>
            <div className="flex flex-wrap gap-1">
              {message.citations.map((c, i) => (
                <button
                  key={i}
                  onClick={() => onCitationClick?.(c)}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-canvas-100 hover:bg-canvas-200 text-ink-700"
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {message.followUps && message.followUps.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            {message.followUps.map((f, i) => (
              <button
                key={i}
                onClick={() => onFollowUp(f)}
                className="text-left text-[10px] px-2 py-1 rounded border border-canvas-200 bg-canvas-50 hover:bg-amber-50 text-ink-700"
              >
                ▸ {f}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
