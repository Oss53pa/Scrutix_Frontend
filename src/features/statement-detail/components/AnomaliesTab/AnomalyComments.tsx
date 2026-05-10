// ============================================================================
// AnomalyComments — fil de commentaires + input avec mentions
// ============================================================================

import { useState } from 'react';
import { UserPill, MentionInput, RelativeDate } from '../../../../components/shared';
import type { MentionableUser } from '../../../../components/shared';
import type { AnomalyComment } from '../../types/statement.types';

interface AnomalyCommentsProps {
  anomalyId: string;
  comments: AnomalyComment[];
  team: MentionableUser[];
  onSubmit: (text: string, mentions: string[]) => void;
}

export function AnomalyComments({ anomalyId, comments, team, onSubmit }: AnomalyCommentsProps) {
  const [draft, setDraft] = useState('');
  const filtered = comments.filter((c) => c.anomalyId === anomalyId);

  function extractMentions(text: string): string[] {
    const handles = Array.from(text.matchAll(/@(\w+)/g)).map((m) => m[1]);
    return team.filter((u) => handles.includes(u.handle)).map((u) => u.userId);
  }

  function handleSubmit(text: string) {
    if (!text.trim()) return;
    onSubmit(text.trim(), extractMentions(text));
    setDraft('');
  }

  return (
    <div className="space-y-3">
      {filtered.map((c) => (
        <div key={c.id} className="text-xs">
          <div className="flex items-center gap-2 mb-0.5">
            <UserPill user={{ userId: c.author.userId, handle: c.author.handle, role: c.author.role, displayName: c.author.handle }} />
            <span className="text-ink-400">·</span>
            <RelativeDate date={c.createdAt} className="text-ink-500" />
          </div>
          <div className="pl-7 text-ink-700 whitespace-pre-wrap">{c.content}</div>
        </div>
      ))}
      <MentionInput
        value={draft}
        onChange={setDraft}
        candidates={team}
        onSubmit={(text) => handleSubmit(text)}
        placeholder="Ajouter un commentaire… @mention possible (Ctrl+Enter)"
      />
      <div className="flex justify-end">
        <button
          onClick={() => handleSubmit(draft)}
          disabled={!draft.trim()}
          className="px-2.5 py-1 text-[11px] bg-amber-600 text-white rounded disabled:opacity-50"
        >
          Envoyer
        </button>
      </div>
    </div>
  );
}
