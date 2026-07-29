import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { RevenueGrowthPoint } from '../../src/services/revenueService';
import { formatCurrency } from '../../src/utils/currencyUtils';

interface DailyRevenueChartProps {
  data: RevenueGrowthPoint[];
  year: number;
}

const formatCompactCurrency = (value: number) => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} tỷ`;
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)} tr`;
  if (value >= 1_000) return `${Math.round(value / 1_000)} k`;
  return String(value);
};

export const DailyRevenueChart: React.FC<DailyRevenueChartProps> = ({ data, year }) => {
  const currentMonth = new Date().getMonth() + 1;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const chartData = useMemo(() => {
    const daysInMonth = new Date(year, selectedMonth, 0).getDate();
    const prefix = `${year}-${String(selectedMonth).padStart(2, '0')}-`;
    const revenueByDay = new Map(
      data
        .filter((item) => item.key.startsWith(prefix))
        .map((item) => [Number(item.key.slice(-2)), item.revenue])
    );

    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      return {
        day,
        label: String(day).padStart(2, '0'),
        revenue: revenueByDay.get(day) || 0,
      };
    });
  }, [data, selectedMonth, year]);

  const total = chartData.reduce((sum, item) => sum + item.revenue, 0);
  const activeDays = chartData.filter((item) => item.revenue > 0).length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-gray-800">Doanh thu từng ngày theo tháng</h3>
          <p className="text-xs text-gray-500 mt-1">{activeDays} ngày phát sinh doanh thu</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            aria-label="Chọn tháng xem doanh thu"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(Number(event.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
          >
            {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
              <option key={month} value={month}>Tháng {month}</option>
            ))}
          </select>
          <div className="text-right">
            <p className="text-xs text-gray-500">Tổng tháng</p>
            <p className="font-bold text-green-600">{formatCurrency(total)}</p>
          </div>
        </div>
      </div>

      <div className="h-80 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="dailyRevenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval={2}
            />
            <YAxis
              tickFormatter={formatCompactCurrency}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip
              formatter={(value) => [formatCurrency(Number(value)), 'Doanh thu']}
              labelFormatter={(label) => `Ngày ${label}/${selectedMonth}/${year}`}
              contentStyle={{ borderRadius: 10, borderColor: '#e5e7eb' }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#059669"
              strokeWidth={2.5}
              fill="url(#dailyRevenueFill)"
              activeDot={{ r: 5, fill: '#059669' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
