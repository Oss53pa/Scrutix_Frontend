// ============================================================================
// <AmountFCFA /> — Format unifié XAF/XOF
// ============================================================================
// Convention spec §5.8 : "12 487 320 FCFA" avec espaces réguliers (pas
// U+00A0 ni U+202F qui s'affichent zero-width sur certaines fontes), police
// monospace pour alignement vertical en table.
//
// Centimes en entrée pour précision, conversion en unités à l'affichage.
// ============================================================================

interface AmountFCFAProps {
  /** Soit centimes (ex. 1248732000 → 12 487 320 FCFA), soit unités si `units` true. */
  value: number;
  units?: boolean;
  /** Format compact : 12.5M / 1.2K. */
  compact?: boolean;
  /** Affiche le signe explicite même pour les positifs. */
  showSign?: boolean;
  /** Couleur selon signe (rouge négatif, vert positif). */
  colorize?: boolean;
  className?: string;
}

export function AmountFCFA({
  value,
  units = false,
  compact = false,
  showSign = false,
  colorize = false,
  className = '',
}: AmountFCFAProps) {
  const v = units ? value : value / 100;
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  const abs = Math.abs(v);

  let formatted: string;
  if (compact) {
    if (abs >= 1_000_000_000) formatted = (abs / 1_000_000_000).toFixed(1) + ' Md';
    else if (abs >= 1_000_000) formatted = (abs / 1_000_000).toFixed(1) + ' M';
    else if (abs >= 1_000)     formatted = (abs / 1_000).toFixed(1) + ' k';
    else formatted = String(Math.round(abs));
  } else {
    formatted = formatThousands(Math.round(abs));
  }

  const colorClass = colorize
    ? v < 0
      ? 'text-rose-600'
      : v > 0
        ? 'text-emerald-700'
        : ''
    : '';

  const prefix = showSign ? sign : v < 0 ? '−' : '';

  return (
    <span className={`font-mono tabular-nums ${colorClass} ${className}`}>
      {prefix}
      {formatted} FCFA
    </span>
  );
}

function formatThousands(n: number): string {
  // Force regular space U+0020 to avoid U+202F/U+00A0 rendering quirks
  const str = String(n);
  let out = '';
  for (let i = 0; i < str.length; i++) {
    if (i > 0 && (str.length - i) % 3 === 0) out += ' ';
    out += str[i];
  }
  return out;
}
