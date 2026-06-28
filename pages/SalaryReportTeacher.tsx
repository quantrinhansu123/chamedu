import { collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, writeBatch, runTransaction, arrayUnion, Timestamp, db } from '@/src/utils/legacyFirestoreStub';
/**
 * Salary Report Teacher Page
 * Báo cáo lương GV/TG với Firebase integration
 * Hỗ trợ điều chỉnh lương thực tế khi GV dạy thay tiết cho nhau
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Info, DollarSign, Users, X, Edit2, Save, Check, ShieldAlert } from 'lucide-react';
import { ModalPortal } from '@/components/modal-portal';
import { useSalaryReport } from '../src/hooks/useSalaryReport';
import { formatCurrency } from '../src/utils/currencyUtils';
import { usePermissions } from '../src/hooks/usePermissions';

interface ActualSalary {
  staffId: string;
  month: number;
  year: number;
  actualSalary: number;
  note?: string;
  updatedAt: string;
}

export const SalaryReportTeacher: React.FC = () => {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedStaffIdx, setSelectedStaffIdx] = useState(0);
  const [editingSession, setEditingSession] = useState<any>(null);

  // State for actual salary editing
  const [actualSalaries, setActualSalaries] = useState<Record<string, number>>({});
  const [editingActualSalary, setEditingActualSalary] = useState<string | null>(null);
  const [tempActualSalary, setTempActualSalary] = useState<number>(0);
  const [savingActual, setSavingActual] = useState(false);

  // Permission check: Only Admin/KeToan can see ALL salaries
  const { canSeeAllSalaries, staffId: currentStaffId } = usePermissions();

  const { summaries: allSummaries, loading, error, totalSalary: allTotalSalary, refresh } = useSalaryReport(selectedMonth, selectedYear);

  // Filter summaries based on permission - if not Admin/KeToan, only show own salary
  const summaries = useMemo(() => {
    if (canSeeAllSalaries) return allSummaries;
    // Only show own salary data
    return allSummaries.filter(s => s.staffId === currentStaffId);
  }, [allSummaries, canSeeAllSalaries, currentStaffId]);

  // Recalculate total for filtered data
  const totalSalary = useMemo(() => {
    return summaries.reduce((sum, s) => sum + s.estimatedSalary, 0);
  }, [summaries]);

  // Load actual salaries from Firebase
  useEffect(() => {
    const loadActualSalaries = async () => {
      try {
        const q = query(
          collection(null as any /* firebase removed */, 'actualSalaries'),
          where('month', '==', selectedMonth),
          where('year', '==', selectedYear)
        );
        const snapshot = await getDocs(q);
        const salaries: Record<string, number> = {};
        snapshot.forEach((doc) => {
          const data = doc.data() as ActualSalary;
          salaries[data.staffId] = data.actualSalary;
        });
        setActualSalaries(salaries);
      } catch (err) {
        console.error('Error loading actual salaries:', err);
      }
    };
    loadActualSalaries();
  }, [selectedMonth, selectedYear]);

  // Start editing actual salary
  const startEditActual = (staffId: string, currentValue: number) => {
    setEditingActualSalary(staffId);
    setTempActualSalary(currentValue);
  };

  // Save actual salary to Firebase
  const saveActualSalary = async (staffId: string) => {
    setSavingActual(true);
    try {
      const docId = `${staffId}_${selectedMonth}_${selectedYear}`;
      await setDoc(doc(null as any /* firebase removed */, 'actualSalaries', docId), {
        staffId,
        month: selectedMonth,
        year: selectedYear,
        actualSalary: tempActualSalary,
        updatedAt: new Date().toISOString(),
      });
      
      setActualSalaries(prev => ({
        ...prev,
        [staffId]: tempActualSalary,
      }));
      setEditingActualSalary(null);
    } catch (err) {
      console.error('Error saving actual salary:', err);
      alert('Không thể lưu. Vui lòng thử lại.');
    } finally {
      setSavingActual(false);
    }
  };

  const handleEditSession = (item: any) => {
    setEditingSession({ ...item });
  };

  const handleSaveEdit = async () => {
    if (!editingSession) return;

    try {
      // Save to workSessions collection (source of truth)
      const docRef = doc(null as any /* firebase removed */, 'workSessions', editingSession.id);
      await setDoc(docRef, {
        date: editingSession.date,
        timeStart: editingSession.time?.split(' - ')[0] || editingSession.timeStart,
        timeEnd: editingSession.time?.split(' - ')[1] || editingSession.timeEnd,
        className: editingSession.className,
        type: editingSession.type,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      // Refresh data
      await refresh(selectedMonth, selectedYear);
      setEditingSession(null);
      alert('Đã cập nhật thông tin công!');
    } catch (err) {
      console.error('Error saving:', err);
      alert('Không thể lưu. Vui lòng thử lại.');
    }
  };

  const selectedStaff = summaries[selectedStaffIdx];
  const salaryDetails = selectedStaff?.workDetails || [];
  const totalDetailSalary = salaryDetails.reduce((sum, item) => sum + item.salary, 0);

  // Calculate total actual salary
  const totalActualSalary = summaries.reduce((sum, staff) => {
    const actual = actualSalaries[staff.staffId];
    return sum + (actual !== undefined ? actual : staff.estimatedSalary);
  }, 0);

  // Generate month options
  const monthOptions = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthOptions.push({
      value: `${d.getMonth() + 1}-${d.getFullYear()}`,
      label: `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`,
    });
  }

  const handleMonthChange = (value: string) => {
    const [m, y] = value.split('-').map(Number);
    setSelectedMonth(m);
    setSelectedYear(y);
    setSelectedStaffIdx(0);
  };

  return (
    <div className="space-y-6">
      {/* Permission Notice - shown when user can only see own salary */}
      {!canSeeAllSalaries && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3">
          <ShieldAlert className="text-amber-600" size={20} />
          <span className="text-sm text-amber-800">
            Bạn chỉ có thể xem thông tin lương của chính mình. Liên hệ Admin hoặc Kế toán để xem báo cáo đầy đủ.
          </span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-gray-800 bg-cyan-300 px-3 py-1 rounded-sm shadow-sm">
            {canSeeAllSalaries ? 'Báo cáo lương GV/TG' : 'Lương của tôi'}
          </h2>
          <div className="flex gap-3 text-sm">
            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium flex items-center gap-1">
              <Users size={14} />
              {summaries.length} nhân sự
            </span>
            <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-medium flex items-center gap-1">
              <DollarSign size={14} />
              Tổng: {formatCurrency(totalActualSalary)}
            </span>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-600 mr-2">Xem theo tháng</label>
          <select 
            className="border border-gray-300 rounded px-3 py-1 text-sm bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            value={`${selectedMonth}-${selectedYear}`}
            onChange={(e) => handleMonthChange(e.target.value)}
          >
            {monthOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        {/* LEFT: Summary Table */}
        <div className="w-full xl:w-7/12 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-fit">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-800 border-collapse">
              <thead className="bg-white border-b-2 border-gray-900 font-bold text-xs uppercase">
                <tr>
                  <th className="px-3 py-3 border-r border-gray-300 w-10 text-center">No</th>
                  <th className="px-3 py-3 border-r border-gray-300">Tên nhân sự</th>
                  <th className="px-3 py-3 border-r border-gray-300 text-center">Vị trí</th>
                  <th className="px-3 py-3 border-r border-gray-300 text-center">Số ca</th>
                  <th className="px-3 py-3 border-r border-gray-300 text-right">Lương tạm tính</th>
                  <th className="px-3 py-3 border-r border-gray-300 text-right">Thưởng KPI</th>
                  <th className="px-3 py-3 border-r border-gray-300 text-right">
                    <span className="text-green-700">Lương thực tế</span>
                  </th>
                  <th className="px-3 py-3 text-center">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-500">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                        Đang tải...
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-red-500">Lỗi: {error}</td>
                  </tr>
                ) : summaries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-400">
                      <DollarSign size={48} className="mx-auto mb-2 opacity-20" />
                      Chưa có dữ liệu công đã xác nhận trong tháng này
                    </td>
                  </tr>
                ) : summaries.map((staff, idx) => {
                  const actualValue = actualSalaries[staff.staffId] ?? staff.estimatedSalary;
                  const isEditing = editingActualSalary === staff.staffId;
                  
                  return (
                    <tr 
                      key={staff.staffId} 
                      className={`hover:bg-green-50 cursor-pointer transition-colors ${selectedStaffIdx === idx ? 'bg-green-100' : ''}`}
                      onClick={() => !isEditing && setSelectedStaffIdx(idx)}
                    >
                      <td className="px-3 py-3 border-r border-gray-200 text-center">{idx + 1}</td>
                      <td className="px-3 py-3 border-r border-gray-200">
                        <div className="font-bold">{staff.staffName}</div>
                      </td>
                      <td className="px-3 py-3 border-r border-gray-200 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          staff.position === 'Giáo viên Việt' || staff.position === 'Giáo Viên Việt' ? 'bg-blue-100 text-blue-700' :
                          staff.position === 'Giáo viên Nước ngoài' || staff.position === 'Giáo Viên Nước Ngoài' ? 'bg-purple-100 text-purple-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {staff.position}
                        </span>
                      </td>
                      <td className="px-3 py-3 border-r border-gray-200 text-center font-medium">
                        {staff.confirmedSessions}
                      </td>
                      <td className="px-3 py-3 border-r border-gray-200 text-right font-bold text-indigo-600">
                        {formatCurrency(staff.estimatedSalary)}
                      </td>
                      <td className="px-3 py-3 border-r border-gray-200 text-right font-medium text-orange-600">
                        {formatCurrency(staff.kpiBonus || 0)}
                      </td>
                      <td className="px-3 py-3 border-r border-gray-200 text-right" onClick={(e) => e.stopPropagation()}>
                        {isEditing && canSeeAllSalaries ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              value={tempActualSalary}
                              onChange={(e) => setTempActualSalary(parseInt(e.target.value) || 0)}
                              className="w-28 px-2 py-1 border border-gray-300 rounded text-right text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveActualSalary(staff.staffId);
                                if (e.key === 'Escape') setEditingActualSalary(null);
                              }}
                            />
                            <button
                              onClick={() => saveActualSalary(staff.staffId)}
                              disabled={savingActual}
                              className="p-1 text-green-600 hover:bg-green-100 rounded"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={() => setEditingActualSalary(null)}
                              className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <span className={`font-bold ${actualValue !== staff.estimatedSalary ? 'text-green-600' : 'text-gray-600'}`}>
                              {formatCurrency(actualValue)}
                            </span>
                            {/* Only Admin/KeToan can edit actual salary */}
                            {canSeeAllSalaries && (
                              <button
                                onClick={() => startEditActual(staff.staffId, actualValue)}
                                className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                title="Chỉnh sửa lương thực tế"
                              >
                                <Edit2 size={14} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button className="text-gray-500 hover:text-green-600">
                          <Info size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Footer with totals */}
              {summaries.length > 0 && (
                <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                  <tr className="font-bold">
                    <td colSpan={4} className="px-3 py-3 text-right">TỔNG CỘNG:</td>
                    <td className="px-3 py-3 border-r border-gray-200 text-right text-indigo-700">
                      {formatCurrency(totalSalary)}
                    </td>
                    <td className="px-3 py-3 border-r border-gray-200 text-right text-orange-600">
                      {formatCurrency(summaries.reduce((sum, s) => sum + (s.kpiBonus || 0), 0))}
                    </td>
                    <td className="px-3 py-3 border-r border-gray-200 text-right text-green-700">
                      {formatCurrency(totalActualSalary)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* RIGHT: Detail View */}
        <div className="w-full xl:w-5/12 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {selectedStaff ? (
            <>
              <div className="bg-green-400 px-4 py-2 flex justify-between items-center text-black font-bold text-sm">
                <span>Chi tiết tính công</span>
                <div className="flex gap-6">
                  <span>Tháng: {selectedMonth}/{selectedYear}</span>
                  <span>Nhân viên: {selectedStaff.staffName}</span>
                </div>
              </div>
              
              <div className="p-4 overflow-x-auto">
                <table className="w-full text-sm text-center border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-orange-100 text-gray-900 font-bold text-xs uppercase">
                      <th className="border border-gray-400 px-2 py-2 w-20">Ngày</th>
                      <th className="border border-gray-400 px-2 py-2">Giờ</th>
                      <th className="border border-gray-400 px-2 py-2">Lớp</th>
                      <th className="border border-gray-400 px-2 py-2">Kiểu công</th>
                      <th className="border border-gray-400 px-2 py-2">Lương</th>
                      <th className="border border-gray-400 px-2 py-2 w-16">Sửa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salaryDetails.length > 0 ? salaryDetails.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-2 py-2">{item.date}</td>
                        <td className="border border-gray-300 px-2 py-2">{item.time || '-'}</td>
                        <td className="border border-gray-300 px-2 py-2">{item.className}</td>
                        <td className="border border-gray-300 px-2 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            item.type === 'Dạy chính' ? 'bg-blue-100 text-blue-700' :
                            item.type === 'Trợ giảng' ? 'bg-purple-100 text-purple-700' :
                            item.type === 'Nhận xét' ? 'bg-orange-100 text-orange-700' :
                            item.type === 'Bồi bài' ? 'bg-yellow-100 text-yellow-700' :
                            item.type === 'Dạy thay' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {item.type}
                          </span>
                        </td>
                        <td className="border border-gray-300 px-2 py-2 font-bold">
                          {formatCurrency(item.salary)}
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          {canSeeAllSalaries ? (
                            <button
                              onClick={() => handleEditSession(item)}
                              className="text-gray-500 hover:text-blue-600 underline text-sm"
                            >
                              Sửa
                            </button>
                          ) : '-'}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={6} className="py-4 text-gray-500 italic">Không có dữ liệu chi tiết</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50">
                      <td colSpan={4} className="text-right px-4 py-2">
                        <span className="bg-green-500 text-white px-2 py-1 font-bold text-xs uppercase rounded">Tổng lương</span>
                      </td>
                      <td className="border border-gray-300 px-2 py-2 font-bold text-gray-900">
                        {formatCurrency(totalDetailSalary)}
                      </td>
                      <td className="border border-gray-300"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              
              {/* Note about actual salary adjustment */}
              <div className="px-4 pb-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                  <strong>Lưu ý:</strong> Nếu GV dạy thay tiết cho nhau, có thể điều chỉnh cột "Lương thực tế" ở bảng bên trái.
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 p-10">
              <div className="text-center">
                <DollarSign size={48} className="mx-auto mb-2 opacity-20" />
                {loading ? 'Đang tải...' : 'Chọn một nhân viên để xem chi tiết'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Session Modal */}
      {editingSession && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="font-bold text-gray-800">Sửa thông tin công</h3>
              <button onClick={() => setEditingSession(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày</label>
                  <input
                    type="text"
                    value={editingSession.date}
                    onChange={(e) => setEditingSession({ ...editingSession, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Giờ</label>
                  <input
                    type="text"
                    value={editingSession.time || ''}
                    onChange={(e) => setEditingSession({ ...editingSession, time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="08:00 - 09:30"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lớp</label>
                <input
                  type="text"
                  value={editingSession.className}
                  onChange={(e) => setEditingSession({ ...editingSession, className: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kiểu công</label>
                <select
                  value={editingSession.type}
                  onChange={(e) => setEditingSession({ ...editingSession, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="Dạy chính">Dạy chính</option>
                  <option value="Trợ giảng">Trợ giảng</option>
                  <option value="Nhận xét">Nhận xét</option>
                  <option value="Bồi bài">Bồi bài</option>
                  <option value="Dạy thay">Dạy thay</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lương (đ)</label>
                <input
                  type="number"
                  value={editingSession.salary}
                  onChange={(e) => setEditingSession({ ...editingSession, salary: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  step={10000}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200">
              <button 
                onClick={() => setEditingSession(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Hủy
              </button>
              <button 
                onClick={handleSaveEdit}
                className="px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
              >
                <Save size={16} />
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};
