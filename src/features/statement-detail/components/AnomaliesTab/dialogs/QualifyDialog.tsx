// ============================================================================
// QualifyDialog — confirmation qualification d'une anomalie
// ============================================================================

import { ConfirmDialog } from '../../../../../components/shared';
import type { Anomaly } from '../../../types/statement.types';

interface QualifyDialogProps {
  anomaly: Anomaly;
  futureHash?: string;
  onClose: () => void;
  onConfirm: (comment: string) => Promise<void> | void;
}

export function QualifyDialog({ anomaly, futureHash, onClose, onConfirm }: QualifyDialogProps) {
  const willEscalate = anomaly.severity === 'high' || anomaly.severity === 'critical';
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title="Qualifier cette anomalie"
      variant="default"
      confirmLabel="Qualifier"
      futureHash={futureHash}
      commentHelp="Optionnel — précisez les éléments vérifiés."
      description={
        <span>
          Vous confirmez que l'anomalie <b>{anomaly.title}</b> est <b>réelle</b> et nécessite traitement
          {willEscalate
            ? <> (passera en attente de validation par un senior).</>
            : <> (sera prête à clôturer).</>}
        </span>
      }
      onConfirm={onConfirm}
    />
  );
}
