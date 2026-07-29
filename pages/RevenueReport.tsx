/**
 * Revenue Report Page
 * Báo cáo doanh thu từ hợp đồng
 */

import React, { useState } from 'react';
import { DollarSign, TrendingUp, AlertTriangle, FileText, BarChart3 } from 'lucide-react';
import { useRevenue } from '../src/hooks/useRevenue';
import { formatCurrency } from '../src/utils/currencyUtils';
import { DailyRevenueChart } from '../components/revenue/DailyRevenueChart';

export const RevenueReport: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  
  const { summary, loading, error } = useRevenue(selectedYear);

  // Generate year options
  const yearOptions = [];
  for (let y = currentYear; y >= currentYear - 5; y--) {
    yearOptions.push(y);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-green-100 p-2 rounded-lg">
            <BarChart3 className="text-green-600" size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Báo cáo doanh thu</h2>
            <p className="text-sm text-gray-500">Tổng hợp từ hợp đồng đăng ký</p>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-600 mr-2">Năm:</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
            Đang tải báo cáo...
          </div>
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-red-500">
          Lỗi: {error}
        </div>
      ) : summary ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <SummaryCard
              icon={<DollarSign size={24} />}
              iconBg="bg-green-100"
              iconColor="text-green-600"
              label="Tổng doanh thu"
              value={formatCurrency(summary.totalRevenue)}
              subtext={`${summary.totalContracts} hợp đồng`}
            />
            <SummaryCard
              icon={<TrendingUp size={24} />}
              iconBg="bg-blue-100"
              iconColor="text-blue-600"
              label="Đã thu"
              value={formatCurrency(summary.paidRevenue)}
              subtext={`${summary.paidContracts} hợp đồng`}
            />
            <SummaryCard
              icon={<AlertTriangle size={24} />}
              iconBg="bg-red-100"
              iconColor="text-red-600"
              label="Công nợ"
              value={formatCurrency(summary.debtAmount)}
              subtext={`${summary.debtContracts} hợp đồng`}
            />
            <SummaryCard
              icon={<FileText size={24} />}
              iconBg="bg-purple-100"
              iconColor="text-purple-600"
              label="Tỷ lệ thu"
              value={summary.totalRevenue > 0 
                ? `${((summary.paidRevenue / summary.totalRevenue) * 100).toFixed(1)}%`
                : '0%'}
              subtext="Đã thu / Tổng"
            />
          </div>

          <DailyRevenueChart data={summary.growth.daily} year={selectedYear} />

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue by Month */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h3 className="font-bold text-gray-800">Doanh thu theo tháng</h3>
              </div>
              <div className="p-4">
                {summary.byMonth.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    Chưa có dữ liệu trong năm {selectedYear}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {summary.byMonth.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="w-20 text-sm text-gray-600">{item.month}</div>
                        <div className="flex-1">
                          <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full"
                              style={{
                                width: `${Math.min(100, (item.totalRevenue / Math.max(...summary.byMonth.map(m => m.totalRevenue))) * 100)}%`
                              }}
                            />
                          </div>
                        </div>
                        <div className="w-32 text-right text-sm font-medium text-gray-900">
                          {formatCurrency(item.totalRevenue)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Revenue by Class */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h3 className="font-bold text-gray-800">Doanh thu theo lớp</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-2 text-left">Lớp</th>
                      <th className="px-4 py-2 text-center">Học viên</th>
                      <th className="px-4 py-2 text-right">Doanh thu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {summary.byClass.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-center py-8 text-gray-400">
                          Chưa có dữ liệu
                        </td>
                      </tr>
                    ) : summary.byClass.slice(0, 10).map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{item.className}</td>
                        <td className="px-4 py-3 text-center">{item.studentCount}</td>
                        <td className="px-4 py-3 text-right font-bold text-green-600">
                          {formatCurrency(item.totalRevenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
          <BarChart3 size={48} className="mx-auto mb-2 opacity-20" />
          Không có dữ liệu
        </div>
      )}
    </div>
  );
};

// Summary Card Component
interface SummaryCardProps {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  subtext: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ icon, iconBg, iconColor, label, value, subtext }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
    <div className="flex items-center gap-3">
      <div className={`${iconBg} p-2 rounded-lg ${iconColor}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-400">{subtext}</p>
      </div>
    </div>
  </div>
);
