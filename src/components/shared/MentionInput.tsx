// ============================================================================
// <MentionInput /> — textarea avec dropdown @mentions
// ============================================================================
// Spec §1.4 : taper @ ouvre un dropdown des collaborateurs assignés au
// client. Sélection insère @PrenomI (ex @PameA pour Pamela ATOKOUNA).
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import type { CabinetRole } from '../../workspace/types';

export interface MentionableUser {
  userId: string;
  handle: string;        // 'PameA'
  displayName: string;   // 'Pamela ATOKOUNA'
  role?: CabinetRole | null;
}

interface MentionInputProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit?: (text: string, mentions: string[]) => void;
  candidates: MentionableUser[];
  placeholder?: string;
  rows?: number;
  className?: string;
}

export function MentionInput(props: MentionInputProps) {
  const { value, onChange, onSubmit, candidates, placeholder, rows = 3, className = '' } = props;
  const [showMenu, setShowMenu] = useState(false);
  const [query, setQuery] = useState('');
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLTextAreaElement | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    onChange(next);
    // Détecte @xxx en cours de frappe
    const cursor = e.target.selectionStart;
    const before = next.slice(0, cursor);
    const m = before.match(/@(\w*)$/);
    if (m) {
      setQuery(m[1].toLowerCase());
      setShowMenu(true);
      // Position approximative du menu
      const ta = ref.current;
      if (ta) {
        const rect = ta.getBoundingClientRect();
        setMenuPos({ top: rect.bottom + 4, left: rect.left });
      }
    } else {
      setShowMenu(false);
    }
  }

  function pickMention(u: MentionableUser) {
    const cursor = ref.current?.selectionStart ?? value.length;
    const before = value.slice(0, cursor).replace(/@\w*$/, `@${u.handle} `);
    const after = value.slice(cursor);
    onChange(before + after);
    setShowMenu(false);
    ref.current?.focus();
  }

  function extractMentions(text: string): string[] {
    const handles = Array.from(text.matchAll(/@(\w+)/g)).map((m) => m[1]);
    const ids: string[] = [];
    for (const h of handles) {
      const u = candidates.find((c) => c.handle === h);
      if (u) ids.push(u.userId);
    }
    return Array.from(new Set(ids));
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && onSubmit) {
      e.preventDefault();
      onSubmit(value, extractMentions(value));
    }
    if (e.key === 'Escape') {
      setShowMenu(false);
    }
  }

  const filtered = candidates.filter(
    (u) =>
      !query ||
      u.handle.toLowerCase().includes(query) ||
      u.displayName.toLowerCase().includes(query),
  );

  // Hide menu on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setShowMenu(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div className={`relative ${className}`}>
      <textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKey}
        placeholder={placeholder ?? 'Ajouter un commentaire… @mention possible'}
        rows={rows}
        className="w-full px-2 py-1.5 text-sm border border-canvas-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
      />
      {showMenu && filtered.length > 0 && (
        <div
          className="fixed z-50 w-64 max-h-48 overflow-auto bg-white border border-canvas-300 rounded-md shadow-lg"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          {filtered.slice(0, 8).map((u) => (
            <button
              key={u.userId}
              onClick={() => pickMention(u)}
              className="w-full text-left px-2 py-1.5 hover:bg-amber-50 text-xs flex items-center gap-2"
            >
              <span className="font-mono text-ink-700">@{u.handle}</span>
              <span className="text-ink-500">{u.displayName}</span>
              {u.role && <span className="ml-auto text-[10px] text-ink-400">{u.role}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
