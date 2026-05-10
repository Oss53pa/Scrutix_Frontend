// ============================================================================
// AnomaliesList — liste virtualisée d'anomalies
// ============================================================================

import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AnomalyRow } from './AnomalyRow';
import type { Anomaly, DialogAction } from '../../types/statement.types';

interface AnomaliesListProps {
  anomalies: Anomaly[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAction: (action: DialogAction, anomaly: Anomaly) => void;
}

export function AnomaliesList({ anomalies, activeId, onSelect, onAction }: AnomaliesListProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: anomalies.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 168,
    overscan: 6,
  });

  if (anomalies.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-ink-500">
        Aucune anomalie ne correspond aux filtres actifs.
      </div>
    );
  }

  return (
    <div ref={parentRef} className="flex-1 overflow-y-auto px-4 py-3">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((vi) => {
          const a = anomalies[vi.index];
          return (
            <div
              key={a.id}
              style={{
                position: 'absolute',
                top: 0, left: 0, right: 0,
                transform: `translateY(${vi.start}px)`,
                paddingBottom: 12,
              }}
            >
              <AnomalyRow
                anomaly={a}
                isActive={a.id === activeId}
                onSelect={() => onSelect(a.id)}
                onAction={onAction}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
