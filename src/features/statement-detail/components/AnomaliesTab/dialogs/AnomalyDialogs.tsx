// ============================================================================
// AnomalyDialogs — wrappers ConfirmDialog spécialisés pour chaque action
// ============================================================================
// Spec §1.5 : récap action en langage naturel, hash futur, anti-double-clic.
// Tous les dialogs réutilisent <ConfirmDialog />.
// ============================================================================

import { ConfirmDialog, AmountFCFA } from '../../../../../components/shared';
import type { Anomaly, DialogKind } from '../../../types/statement.types';

interface AnomalyDialogsProps {
  anomaly: Anomaly | null;
  openDialog: DialogKind | null;
  futureHash?: string;
  onClose: () => void;
  onConfirm: (kind: DialogKind, anomaly: Anomaly, comment: string) => Promise<void> | void;
}

export function AnomalyDialogs({ anomaly, openDialog, futureHash, onClose, onConfirm }: AnomalyDialogsProps) {
  if (!anomaly || !openDialog) return null;

  const props = {
    open: true,
    onClose,
    futureHash,
    onConfirm: (comment: string) => onConfirm(openDialog, anomaly, comment),
  };

  switch (openDialog) {
    case 'qualifyDialog':
      return (
        <ConfirmDialog
          {...props}
          title="Qualifier cette anomalie"
          variant="default"
          confirmLabel="Qualifier"
          description={
            <span>
              Vous confirmez que l'anomalie <b>{anomaly.title}</b> est <b>réelle</b> et nécessite traitement
              {anomaly.severity === 'high' || anomaly.severity === 'critical' ? (
                <> (passera en attente de validation par un senior).</>
              ) : (
                <> (sera prête à clôturer).</>
              )}
            </span>
          }
          commentHelp="Optionnel — précisez les éléments vérifiés."
        />
      );

    case 'validateDialog':
      return (
        <ConfirmDialog
          {...props}
          title="Valider cette anomalie"
          variant="default"
          confirmLabel="Valider"
          description={
            <span>
              Vous validez la qualification de <b>{anomaly.title}</b>
              {anomaly.severity === 'critical' ? (
                <>. Cette anomalie passera en attente de signature DG.</>
              ) : (
                <> et la rendez prête à clôturer.</>
              )}
            </span>
          }
        />
      );

    case 'signDialog':
      return (
        <ConfirmDialog
          {...props}
          title="Signer et clôturer cette anomalie"
          variant="success"
          confirmLabel="Signer et clôturer"
          requireComment
          commentLabel="Commentaire de signature"
          description={
            <span>
              Vous allez signer électroniquement la clôture de <b>{anomaly.title}</b>
              {' '}(montant <AmountFCFA value={Math.abs(anomaly.transaction.amountCentimes)} />).
              {' '}Cette signature sera transmise à ADVIST et incluse dans le rapport final
              du relevé. Elle est légalement opposable.
            </span>
          }
        />
      );

    case 'rejectDialog':
      return (
        <ConfirmDialog
          {...props}
          title="Rejeter / renvoyer pour revue"
          variant="danger"
          confirmLabel="Rejeter"
          requireComment
          commentLabel="Motif du rejet"
          description={
            <span>
              L'anomalie <b>{anomaly.title}</b> sera renvoyée à l'étape précédente avec ce motif.
            </span>
          }
        />
      );

    case 'falsePositiveDialog':
      return (
        <ConfirmDialog
          {...props}
          title="Marquer comme faux positif"
          variant="danger"
          confirmLabel="Marquer faux positif"
          requireComment
          commentLabel="Justification"
          description={
            <span>
              Vous indiquez que <b>{anomaly.title}</b> n'est <b>pas</b> une anomalie réelle.
              Elle sera retirée des indicateurs et des rapports.
            </span>
          }
        />
      );

    case 'closeDialog':
      return (
        <ConfirmDialog
          {...props}
          title="Clôturer cette anomalie"
          variant="success"
          confirmLabel="Clôturer"
          description={
            <span>
              <b>{anomaly.title}</b> sera marquée comme clôturée. Cette action est traçable
              mais peut être réouverte ultérieurement par un senior+.
            </span>
          }
        />
      );

    default:
      return null;
  }
}
