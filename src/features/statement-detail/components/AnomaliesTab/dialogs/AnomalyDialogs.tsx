// ============================================================================
// AnomalyDialogs — router des 6 dialogs spécialisés
// ============================================================================
// Chaque dialog vit dans son propre fichier (spec §7).
// ============================================================================

import type { Anomaly, DialogKind } from '../../../types/statement.types';
import { QualifyDialog } from './QualifyDialog';
import { ValidateDialog } from './ValidateDialog';
import { SignDialog } from './SignDialog';
import { RejectDialog } from './RejectDialog';
import { FalsePositiveDialog } from './FalsePositiveDialog';
import { CloseDialog } from './CloseDialog';

interface AnomalyDialogsProps {
  anomaly: Anomaly | null;
  openDialog: DialogKind | null;
  futureHash?: string;
  onClose: () => void;
  onConfirm: (kind: DialogKind, anomaly: Anomaly, comment: string) => Promise<void> | void;
}

export function AnomalyDialogs({ anomaly, openDialog, futureHash, onClose, onConfirm }: AnomalyDialogsProps) {
  if (!anomaly || !openDialog) return null;
  const handle = (comment: string) => onConfirm(openDialog, anomaly, comment);

  switch (openDialog) {
    case 'qualifyDialog':
      return <QualifyDialog anomaly={anomaly} futureHash={futureHash} onClose={onClose} onConfirm={handle} />;
    case 'validateDialog':
      return <ValidateDialog anomaly={anomaly} futureHash={futureHash} onClose={onClose} onConfirm={handle} />;
    case 'signDialog':
      return <SignDialog anomaly={anomaly} futureHash={futureHash} onClose={onClose} onConfirm={handle} />;
    case 'rejectDialog':
      return <RejectDialog anomaly={anomaly} futureHash={futureHash} onClose={onClose} onConfirm={handle} />;
    case 'falsePositiveDialog':
      return <FalsePositiveDialog anomaly={anomaly} futureHash={futureHash} onClose={onClose} onConfirm={handle} />;
    case 'closeDialog':
      return <CloseDialog anomaly={anomaly} futureHash={futureHash} onClose={onClose} onConfirm={handle} />;
    default:
      return null;
  }
}
