// ============================================================================
// StatementBreadcrumb — fil d'Ariane + UserPill
// ============================================================================
// Cabinet > {client} > {account} > Relevé {period}    [PA Pame · Senior]
// Mode entreprise : {account} > Relevé {period}
// ============================================================================

import { ChevronRight } from 'lucide-react';
import { UserPill } from '../../../components/shared';
import type { CabinetRole, WorkspaceType } from '../../../workspace/types';

interface StatementBreadcrumbProps {
  workspaceType: WorkspaceType;
  cabinetName?: string;
  clientName: string;
  accountLabel: string;
  accountNumber: string;
  periodLabel: string;
  currentUser: { handle: string; displayName: string; role: CabinetRole };
}

export function StatementBreadcrumb(props: StatementBreadcrumbProps) {
  const isCabinet = props.workspaceType === 'cabinet';
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <nav className="flex items-center gap-1.5 text-ink-500 min-w-0 overflow-hidden">
        {isCabinet && (
          <>
            <a href="/cabinet" className="hover:text-ink-900 truncate">{props.cabinetName ?? 'Cabinet'}</a>
            <ChevronRight className="w-3 h-3 shrink-0 text-ink-400" />
            <a href={`/clients`} className="hover:text-ink-900 truncate">{props.clientName}</a>
            <ChevronRight className="w-3 h-3 shrink-0 text-ink-400" />
          </>
        )}
        <span className="hover:text-ink-900 truncate">
          {props.accountLabel} <span className="text-ink-400">·</span> <span className="font-mono">{props.accountNumber}</span>
        </span>
        <ChevronRight className="w-3 h-3 shrink-0 text-ink-400" />
        <span className="text-ink-900 font-semibold whitespace-nowrap">Relevé {props.periodLabel}</span>
      </nav>
      <UserPill user={props.currentUser} />
    </div>
  );
}
