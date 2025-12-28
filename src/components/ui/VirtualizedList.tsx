import { useRef, ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface VirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  estimateSize: number;
  className?: string;
  overscan?: number;
  getItemKey?: (item: T, index: number) => string | number;
}

export function VirtualizedList<T>({
  items,
  renderItem,
  estimateSize,
  className = '',
  overscan = 5,
  getItemKey,
}: VirtualizedListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    getItemKey: getItemKey ? (index) => getItemKey(items[index], index) : undefined,
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className={`overflow-auto ${className}`}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  );
}

// Table variant for virtualized tables
interface VirtualizedTableProps<T> {
  items: T[];
  columns: {
    key: string;
    header: ReactNode;
    width?: string;
    className?: string;
    render: (item: T, index: number) => ReactNode;
  }[];
  rowHeight: number;
  className?: string;
  headerClassName?: string;
  rowClassName?: (item: T, index: number) => string;
  onRowClick?: (item: T, index: number) => void;
  getRowKey?: (item: T, index: number) => string | number;
}

export function VirtualizedTable<T>({
  items,
  columns,
  rowHeight,
  className = '',
  headerClassName = '',
  rowClassName,
  onRowClick,
  getRowKey,
}: VirtualizedTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
    getItemKey: getRowKey ? (index) => getRowKey(items[index], index) : undefined,
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Fixed Header */}
      <div className={`flex-shrink-0 ${headerClassName}`}>
        <table className="w-full table-fixed">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={col.className}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
        </table>
      </div>

      {/* Virtualized Body */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          <table className="w-full table-fixed">
            <tbody>
              {virtualItems.map((virtualItem) => {
                const item = items[virtualItem.index];
                const rowClasses = rowClassName ? rowClassName(item, virtualItem.index) : '';

                return (
                  <tr
                    key={virtualItem.key}
                    onClick={onRowClick ? () => onRowClick(item, virtualItem.index) : undefined}
                    className={rowClasses}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                      display: 'table',
                      tableLayout: 'fixed',
                    }}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        style={{ width: col.width }}
                        className={col.className}
                      >
                        {col.render(item, virtualItem.index)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
