// ============================================================================
// ProphetDrawer — copilote PROPH3T disponible depuis tous les écrans
// ============================================================================
// Spec onglets 2-5 §4 : drawer 420px desktop, plein écran mobile.
// Header + suggestions + conversation + input bar.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { X, Send, Sparkles, History, Settings } from 'lucide-react';
import type { ProphetMessage, ProphetCitation } from '../../statement-detail/types/statement.types';

interface ProphetDrawerProps {
  open: boolean;
  onClose: () => void;
  contextLabel: string;          // ex. "relevé NSIA · fév-mai 2026"
  suggestions: string[];
  messages: ProphetMessage[];
  /** Callback : envoie une question au LLM, retourne un Promise<msg>. */
  onAsk: (question: string) => Promise<ProphetMessage>;
  onCitationClick?: (c: ProphetCitation) => void;
  onOpenHistory?: () => void;
  onOpenSettings?: () => void;
}

export function ProphetDrawer(props: ProphetDrawerProps) {
  const { open, onClose, contextLabel, suggestions, messages } = props;
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [localMessages, setLocalMessages] = useState<ProphetMessage[]>(messages);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLocalMessages(messages);
  }, [messages]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'smooth' });
  }, [localMessages]);

  if (!open) return null;

  async function ask(question: string) {
    const userMsg: ProphetMessage = {
      id: 'user-' + Date.now(),
      role: 'user',
      content: question,
      createdAt: new Date().toISOString(),
    };
    setLocalMessages((m) => [...m, userMsg]);
    setDraft('');
    setPending(true);
    try {
      const reply = await props.onAsk(question);
      setLocalMessages((m) => [...m, reply]);
    } catch (e) {
      setLocalMessages((m) => [
        ...m,
        {
          id: 'err-' + Date.now(),
          role: 'assistant',
          content: 'Désolé, je n\'ai pas pu traiter cette question. Réessaie ou reformule.',
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  const empty = localMessages.length === 0;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-white shadow-2xl border-l border-canvas-200 flex flex-col">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-canvas-200 bg-gradient-to-r from-amber-50 to-canvas-50">
        <div className="flex items-center justify-between mb-1">
          <button onClick={onClose} className="p-1 rounded hover:bg-white">
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1">
            <button onClick={props.onOpenHistory} className="p-1 rounded hover:bg-white" title="Historique">
              <History className="w-4 h-4 text-ink-500" />
            </button>
            <button onClick={props.onOpenSettings} className="p-1 rounded hover:bg-white" title="Paramètres">
              <Settings className="w-4 h-4 text-ink-500" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-semibold text-ink-900">PROPH3T</span>
          <span className="text-xs text-ink-500">· copilote</span>
        </div>
        <div className="text-[10px] text-ink-500 mt-0.5">Contexte : {contextLabel}</div>
      </div>

      {/* Conversation / suggestions */}
      <div ref={scrollerRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {empty ? (
          <div>
            <p className="text-xs text-ink-700 mb-2">Que voulez-vous savoir sur ce relevé ?</p>
            <div className="flex flex-col gap-1.5">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => ask(s)}
                  className="text-left text-xs px-2 py-1.5 rounded border border-canvas-200 bg-white hover:bg-amber-50 hover:border-amber-300 transition-colors"
                >
                  ▸ {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          localMessages.map((m) => (
            <ProphetMessageBubble
              key={m.id}
              message={m}
              onCitationClick={props.onCitationClick}
              onFollowUp={ask}
            />
          ))
        )}
        {pending && (
          <div className="text-xs text-ink-500 italic">PROPH3T réfléchit…</div>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t border-canvas-200 p-2 bg-canvas-50">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (draft.trim() && !pending) ask(draft.trim());
              }
            }}
            rows={2}
            placeholder="Posez votre question sur ce relevé…"
            className="flex-1 px-2 py-1.5 text-xs border border-canvas-300 rounded resize-none focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <button
            disabled={!draft.trim() || pending}
            onClick={() => draft.trim() && !pending && ask(draft.trim())}
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
    </div>
  );
}

// ============================================================================
// ProphetMessageBubble
// ============================================================================

function ProphetMessageBubble({
  message,
  onCitationClick,
  onFollowUp,
}: {
  message: ProphetMessage;
  onCitationClick?: (c: ProphetCitation) => void;
  onFollowUp: (q: string) => void;
}) {
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
