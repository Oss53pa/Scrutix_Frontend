// ============================================================================
// ReportOptions — toggles + radio niveau de détail (panneau latéral preview)
// ============================================================================
// COMPOSANT CONTROLE : le parent (ReportPreview) détient le state et passe
// `value` + `onChange`. Indispensable pour que les changements de detailLevel
// et des toggles soient effectivement répercutés dans le rendu du document.
// ============================================================================

export interface ReportOptionsState {
  includeComplaint: boolean;
  includeSourcePdf: boolean;
  customLogo: boolean;
  detailLevel: 'synthese' | 'standard' | 'exhaustif';
}

interface ReportOptionsProps {
  value: ReportOptionsState;
  onChange: (next: ReportOptionsState) => void;
}

export const REPORT_OPTIONS_DEFAULTS: ReportOptionsState = {
  includeComplaint: true,
  includeSourcePdf: true,
  customLogo: true,
  detailLevel: 'standard',
};

const DETAIL_LABEL: Record<ReportOptionsState['detailLevel'], string> = {
  synthese:  'Synthèse — 1 page, top 3 anomalies',
  standard:  'Standard — sections complètes',
  exhaustif: 'Exhaustif — détails par anomalie + annexes',
};

export function ReportOptions({ value, onChange }: ReportOptionsProps) {
  function update(patch: Partial<ReportOptionsState>) {
    onChange({ ...value, ...patch });
  }

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-[11px] uppercase tracking-wider font-semibold text-ink-500 mb-1">Options</h4>
        <Toggle label="Inclure la lettre de réclamation en annexe" checked={value.includeComplaint} onChange={(v) => update({ includeComplaint: v })} />
        <Toggle label="Inclure le PDF source du relevé"            checked={value.includeSourcePdf} onChange={(v) => update({ includeSourcePdf: v })} />
        <Toggle label="En-tête personnalisée avec logo cabinet"     checked={value.customLogo}      onChange={(v) => update({ customLogo: v })} />
      </div>
      <div>
        <h4 className="text-[11px] uppercase tracking-wider font-semibold text-ink-500 mb-1">Niveau de détail</h4>
        {(['synthese', 'standard', 'exhaustif'] as const).map((d) => (
          <label key={d} className="flex items-start gap-2 text-xs py-1 cursor-pointer hover:bg-canvas-50 rounded px-1">
            <input
              type="radio"
              name="detail"
              checked={value.detailLevel === d}
              onChange={() => update({ detailLevel: d })}
              className="accent-amber-600 mt-0.5"
            />
            <span>
              <span className="capitalize font-medium text-ink-800">{d}</span>
              <span className="block text-[10px] text-ink-500">{DETAIL_LABEL[d].replace(/^[^—]+—\s*/, '')}</span>
            </span>
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
