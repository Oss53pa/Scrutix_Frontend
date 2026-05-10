// ============================================================================
// ReportOptions — toggles + radio niveau de détail (panneau latéral preview)
// ============================================================================

import { useState } from 'react';

export interface ReportOptionsState {
  includeComplaint: boolean;
  includeSourcePdf: boolean;
  customLogo: boolean;
  detailLevel: 'synthese' | 'standard' | 'exhaustif';
}

interface ReportOptionsProps {
  value?: Partial<ReportOptionsState>;
  onChange?: (next: ReportOptionsState) => void;
}

const DEFAULTS: ReportOptionsState = {
  includeComplaint: true,
  includeSourcePdf: true,
  customLogo: true,
  detailLevel: 'standard',
};

export function ReportOptions({ value, onChange }: ReportOptionsProps) {
  const [state, setState] = useState<ReportOptionsState>({ ...DEFAULTS, ...value });

  function update(patch: Partial<ReportOptionsState>) {
    const next = { ...state, ...patch };
    setState(next);
    onChange?.(next);
  }

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-[11px] uppercase tracking-wider font-semibold text-ink-500 mb-1">Options</h4>
        <Toggle label="Inclure la lettre de réclamation en annexe" checked={state.includeComplaint} onChange={(v) => update({ includeComplaint: v })} />
        <Toggle label="Inclure le PDF source du relevé" checked={state.includeSourcePdf} onChange={(v) => update({ includeSourcePdf: v })} />
        <Toggle label="En-tête personnalisée avec logo cabinet" checked={state.customLogo} onChange={(v) => update({ customLogo: v })} />
      </div>
      <div>
        <h4 className="text-[11px] uppercase tracking-wider font-semibold text-ink-500 mb-1">Niveau de détail</h4>
        {(['synthese', 'standard', 'exhaustif'] as const).map((d) => (
          <label key={d} className="flex items-center gap-2 text-xs py-0.5 cursor-pointer">
            <input
              type="radio"
              name="detail"
              checked={state.detailLevel === d}
              onChange={() => update({ detailLevel: d })}
              className="accent-amber-600"
            />
            <span className="capitalize">{d}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 py-1 text-xs cursor-pointer">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-amber-600" />
    </label>
  );
}
