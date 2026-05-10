// ============================================================================
// ProphetDrawer — copilote PROPH3T disponible depuis tous les écrans
// ============================================================================
// Compose ProphetSuggestions / ProphetMessage / ProphetInputBar (spec §7).
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { X, Sparkles, History, Settings } from 'lucide-react';
import type { ProphetMessage as ProphetMessageType, ProphetCitation } from '../../statement-detail/types/statement.types';
import { ProphetSuggestions } from './ProphetSuggestions';
import { ProphetMessage } from './ProphetMessage';
import { ProphetInputBar } from './ProphetInputBar';

interface ProphetDrawerProps {
  open: boolean;
  onClose: () => void;
  contextLabel: string;
  suggestions: string[];
  messages: ProphetMessageType[];
  onAsk: (question: string) => Promise<ProphetMessageType>;
  onCitationClick?: (c: ProphetCitation) => void;
  onOpenHistory?: () => void;
  onOpenSettings?: () => void;
}

export function ProphetDrawer(props: ProphetDrawerProps) {
  const { open, onClose, contextLabel, suggestions, messages } = props;
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [localMessages, setLocalMessages] = useState<ProphetMessageType[]>(messages);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLocalMessages(messages);
  }, [messages]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'smooth' });
  }, [localMessages]);

  if (!open) return null;

  async function ask(question: string) {
    const userMsg: ProphetMessageType = {
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
    } catch {
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

      <div ref={scrollerRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {empty ? (
          <ProphetSuggestions suggestions={suggestions} onSelect={ask} />
        ) : (
          localMessages.map((m) => (
            <ProphetMessage
              key={m.id}
              message={m}
              onCitationClick={props.onCitationClick}
              onFollowUp={ask}
            />
          ))
        )}
        {pending && <div className="text-xs text-ink-500 italic">PROPH3T réfléchit…</div>}
      </div>

      <ProphetInputBar
        value={draft}
        onChange={setDraft}
        onSubmit={ask}
        pending={pending}
      />
    </div>
  );
}
