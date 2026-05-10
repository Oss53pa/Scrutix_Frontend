// ============================================================================
// ReconciliationImport — zone d'import du grand livre
// ============================================================================

import { Upload, ExternalLink, FileSpreadsheet } from 'lucide-react';

interface ReconciliationImportProps {
  periodStart: string;
  periodEnd: string;
  onImportFromAtlasFinance?: () => void;
  onImportFromFile?: (file: File) => void;
}

export function ReconciliationImport(props: ReconciliationImportProps) {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="border-2 border-dashed border-canvas-300 rounded-xl p-8 text-center bg-white">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 text-amber-700 mb-4">
          <Upload className="w-7 h-7" />
        </div>
        <h2 className="text-base font-semibold text-ink-900">Importer le grand livre du compte 521</h2>
        <p className="mt-2 text-xs text-ink-600">
          Pour produire l'état de rapprochement, importez le grand livre de la période
          <span className="font-mono"> {props.periodStart} → {props.periodEnd}</span>{' '}
          depuis Atlas Finance ou téléchargez un fichier Excel/CSV.
        </p>
        <div className="mt-5 flex flex-col items-center gap-2">
          <button
            onClick={props.onImportFromAtlasFinance}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700"
          >
            Importer depuis Atlas Finance
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-canvas-300 text-sm cursor-pointer hover:bg-canvas-50">
            <FileSpreadsheet className="w-4 h-4" />
            Téléverser un fichier
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && props.onImportFromFile) props.onImportFromFile(f);
              }}
            />
          </label>
        </div>
        <p className="mt-4 text-[10px] text-ink-500 font-mono">
          Format attendu : Date | Pièce | Libellé | Débit | Crédit | Solde
        </p>
      </div>
    </div>
  );
}
