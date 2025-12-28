import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { ReportChartData } from '../../types';

interface ReportChartProps {
  data: ReportChartData;
  height?: number;
}

// Default color palette
const DEFAULT_COLORS = [
  '#1e3a5f', // Primary dark blue
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#f97316', // Orange
];

export function ReportChart({ data, height = 300 }: ReportChartProps) {
  const colors = data.colors || DEFAULT_COLORS;

  // Prepare chart data
  const chartData = useMemo(() => {
    return data.data.map((point, index) => ({
      name: point.label,
      value: point.value,
      fill: point.color || colors[index % colors.length],
    }));
  }, [data.data, colors]);

  // Format value for tooltip
  const formatValue = (value: number) => {
    return value.toLocaleString('fr-FR');
  };

  // Custom tooltip
  interface TooltipPayload {
    name: string;
    value: number;
    color: string;
  }

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: TooltipPayload[];
    label?: string;
  }) => {
    if (!active || !payload?.length) return null;

    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-primary-200">
        <p className="font-medium text-primary-900 mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {formatValue(entry.value)}
          </p>
        ))}
      </div>
    );
  };

  // Render chart based on type
  const renderChart = () => {
    switch (data.type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height} minWidth={200} minHeight={200} debounce={50}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: '#737373' }}
                axisLine={{ stroke: '#d4d4d4' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#737373' }}
                axisLine={{ stroke: '#d4d4d4' }}
                tickFormatter={formatValue}
              />
              <Tooltip content={<CustomTooltip />} />
              {data.showLegend && <Legend />}
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={height} minWidth={200} minHeight={200} debounce={50}>
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: '#737373' }}
                axisLine={{ stroke: '#d4d4d4' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#737373' }}
                axisLine={{ stroke: '#d4d4d4' }}
                tickFormatter={formatValue}
              />
              <Tooltip content={<CustomTooltip />} />
              {data.showLegend && <Legend />}
              <Line
                type="monotone"
                dataKey="value"
                stroke={colors[0]}
                strokeWidth={2}
                dot={{ fill: colors[0], strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={height} minWidth={200} minHeight={200} debounce={50}>
            <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: '#737373' }}
                axisLine={{ stroke: '#d4d4d4' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#737373' }}
                axisLine={{ stroke: '#d4d4d4' }}
                tickFormatter={formatValue}
              />
              <Tooltip content={<CustomTooltip />} />
              {data.showLegend && <Legend />}
              <Area
                type="monotone"
                dataKey="value"
                stroke={colors[0]}
                fill={colors[0]}
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'pie':
      case 'donut':
        return (
          <ResponsiveContainer width="100%" height={height} minWidth={200} minHeight={200} debounce={50}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={data.type === 'donut' ? 60 : 0}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                label={data.showValues ? ({ name, value }) => `${name}: ${formatValue(value)}` : undefined}
                labelLine={data.showValues}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              {data.showLegend && (
                <Legend
                  layout="horizontal"
                  verticalAlign="bottom"
                  align="center"
                  formatter={(value) => (
                    <span className="text-sm text-primary-700">{value}</span>
                  )}
                />
              )}
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return (
          <div className="flex items-center justify-center h-full text-primary-500">
            Type de graphique non supporté
          </div>
        );
    }
  };

  return (
    <div className="border border-primary-200 rounded-lg overflow-hidden bg-white">
      {/* Header */}
      {(data.title || data.subtitle) && (
        <div className="px-4 py-3 border-b border-primary-200">
          {data.title && (
            <h4 className="font-semibold text-primary-900">{data.title}</h4>
          )}
          {data.subtitle && (
            <p className="text-sm text-primary-500 mt-0.5">{data.subtitle}</p>
          )}
        </div>
      )}

      {/* Chart */}
      <div className="p-4">{renderChart()}</div>

      {/* Summary values */}
      {data.showValues && data.type !== 'pie' && data.type !== 'donut' && (
        <div className="px-4 py-3 border-t border-primary-200 bg-primary-50">
          <div className="flex flex-wrap gap-4">
            {chartData.map((point, index) => (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: point.fill }}
                />
                <span className="text-sm text-primary-700">
                  {point.name}: <strong>{formatValue(point.value)}</strong>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
