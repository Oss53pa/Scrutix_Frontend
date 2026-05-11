// ============================================================================
// <RelativeDate /> — "il y a 2j", "il y a 3 mois" en français
// ============================================================================

import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { parseAnyDate } from '../../lib/dateFormat';

interface RelativeDateProps {
  date: string | Date | number | null | undefined;
  /** Affiche aussi la date absolue en tooltip. */
  absolute?: boolean;
  className?: string;
}

export function RelativeDate({ date, absolute = true, className = '' }: RelativeDateProps) {
  const d = parseAnyDate(date);
  if (!d) return <span className={className}>—</span>;

  const rel = formatDistanceToNow(d, { addSuffix: true, locale: fr });
  // date-fns français produit "il y a 2 jours" — on compacte
  const compact = rel
    .replace(' jours', 'j')
    .replace(' jour', 'j')
    .replace(' heures', 'h')
    .replace(' heure', 'h')
    .replace(' minutes', 'min')
    .replace(' minute', 'min')
    .replace(' secondes', 's')
    .replace(' seconde', 's')
    .replace(' mois', ' mois')
    .replace(' années', ' ans')
    .replace(' année', ' an');

  const absoluteStr = d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <time
      dateTime={d.toISOString()}
      title={absolute ? absoluteStr : undefined}
      className={className}
    >
      {compact}
    </time>
  );
}
