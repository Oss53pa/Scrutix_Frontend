// ============================================================================
// StatementDetailRoute — wrapper pour react-router (extrait :id de l'URL)
// ============================================================================

import { useParams } from 'react-router-dom';
import { StatementDetailPage } from './StatementDetailPage';

export default function StatementDetailRoute() {
  const { id } = useParams<{ id: string }>();
  if (!id) {
    return (
      <div className="flex items-center justify-center h-screen text-sm text-ink-500">
        Identifiant de relevé manquant.
      </div>
    );
  }
  return <StatementDetailPage statementId={id} />;
}
