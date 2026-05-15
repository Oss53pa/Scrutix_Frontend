import { memo } from 'react';
import { ImportPage } from '../../import/ImportPage';

interface ImportTabProps {
  clientId: string;
  /** Called after import completes — typically switches to the statements tab. */
  onAfterImport?: () => void;
}

/**
 * Reusable Import step embedded in the client detail page.
 * Sits between the "Fiche client" tab and the "Journal relevés" tab:
 * this is the action that brings statements into the client's folder.
 *
 * Note: the "Journal relevés" tab is a different concern — it lists
 * already-imported statements, classified by bank and period.
 */
export const ImportTab = memo(function ImportTab({ clientId, onAfterImport }: ImportTabProps) {
  return <ImportPage pinnedClientId={clientId} embedded onAfterImport={onAfterImport} />;
});
