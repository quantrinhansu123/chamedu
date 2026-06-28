/**
 * RevenueChart Widget
 * Displays revenue pie chart
 */

import React from 'react';
import { PieChart as PieChartIcon } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '../../src/utils/currencyUtils';
import { RevenueDataPoint } from './types';

const PIE_COLORS = ['#0D9488', '#FF6B5A', '#F59E0B', '#10B981', '#6366F1'];

interface RevenueChartProps {
  data: RevenueDataPoint[];
  currentMonth?: string;
}

export const RevenueChart: React.FC<RevenueChartProps> = ({
  data,
  currentMonth = 'Tháng hiện tại',
}) => {
  const totalValue = data.reduce((sum, item) => sum + item.value, 0);
  const hasData = data.length > 0 && totalValue > 0;
  const chartData = hasData ? data : [{ name: 'Chưa có', value: 1, color: '#e5e7eb' }];

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg shadow-slate-200/50 border border-white/60 hover:shadow-xl hover:shadow-[#FF6B5A]/10 transition-all duration-300">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-[#FF6B5A] to-[#FF8F7A] rounded-xl shadow-lg shadow-[#FF6B5A]/30">
            <PieChartIcon className="text-white" size={20} />
          </div>
          <h3 className="font-bold text-gray-800">Doanh số điểm danh</h3>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold bg-gradient-to-r from-[#FF6B5A] to-[#FF8F7A] bg-clip-text text-transparent">
            {formatCurrency(totalValue)}
          </div>
          <span className="text-xs text-gray-500">{currentMonth}</span>
        </div>
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={70}
              dataKey="value"
              label={hasData ? ({ percent }) => `${(percent * 100).toFixed(0)}%` : undefined}
              strokeWidth={2}
              stroke="#fff"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{
                background: 'rgba(255,255,255,0.95)',
                border: 'none',
                borderRadius: '12px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
              }}
            />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              formatter={(value) => <span className="text-gray-600 text-sm">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RevenueChart;
