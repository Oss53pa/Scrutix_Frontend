import { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { ReportTableData } from '../../types';
import { formatCurrency } from '../../utils';

interface ReportTableProps {
  data: ReportTableData;
  currency: string;
}

export function ReportTable({ data, currency }: ReportTableProps) {
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Handle sorting
  const handleSort = (columnIndex: number) => {
    if (!data.sortable) return;

    if (sortColumn === columnIndex) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnIndex);
      setSortDirection('asc');
    }
  };

  // Sort rows
  const sortedRows = [...data.rows];
  if (sortColumn !== null && data.sortable) {
    sortedRows.sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortDirection === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }

  // Format cell value
  const formatValue = (value: string | number, columnIndex: number): string => {
    if (typeof value === 'number') {
      // Check if header suggests it's a currency column
      const header = data.headers[columnIndex]?.toLowerCase() || '';
      if (
        header.includes('montant') ||
        header.includes('total') ||
        header.includes('somme') ||
        header.includes('frais') ||
        header.includes('amount')
      ) {
        return formatCurrency(value, currency);
      }
      // Check if it's a percentage
      if (header.includes('%') || header.includes('taux') || header.includes('pourcentage')) {
        return `${value.toFixed(2)}%`;
      }
      // Default number formatting
      return value.toLocaleString('fr-FR');
    }
    return value;
  };

  return (
    <div className="border border-primary-200 rounded-lg overflow-hidden">
      {/* Title */}
      {data.title && (
        <div className="px-4 py-3 bg-primary-50 border-b border-primary-200">
          <h4 className="font-semibold text-primary-900">{data.title}</h4>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-primary-100">
              {data.headers.map((header, index) => (
                <th
                  key={index}
                  onClick={() => handleSort(index)}
                  className={`px-4 py-3 text-left text-xs font-semibold text-primary-600 uppercase tracking-wider ${
                    data.sortable ? 'cursor-pointer hover:bg-primary-200' : ''
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span>{header}</span>
                    {data.sortable && sortColumn === index && (
                      sortDirection === 'asc' ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-primary-100">
            {sortedRows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={`${
                  data.striped && rowIndex % 2 === 1 ? 'bg-primary-50' : ''
                } hover:bg-primary-50 transition-colors`}
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={`px-4 py-3 text-sm text-primary-700 ${
                      typeof cell === 'number' ? 'text-right font-mono' : ''
                    }`}
                  >
                    {formatValue(cell, cellIndex)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {data.totals && (
            <tfoot>
              <tr className="bg-primary-900 text-white font-semibold">
                {data.totals.map((total, index) => (
                  <td
                    key={index}
                    className={`px-4 py-3 text-sm ${
                      typeof total === 'number' ? 'text-right font-mono' : ''
                    }`}
                  >
                    {formatValue(total, index)}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Row count */}
      <div className="px-4 py-2 bg-primary-50 border-t border-primary-200 text-xs text-primary-500">
        {data.rows.length} ligne{data.rows.length > 1 ? 's' : ''}
      </div>
    </div>
  );
}
