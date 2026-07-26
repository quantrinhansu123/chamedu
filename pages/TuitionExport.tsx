import React, { useEffect, useMemo, useState } from 'react';
import { Download, Printer, RefreshCw } from 'lucide-react';
import { useClasses } from '../src/hooks/useClasses';
import { useStudents } from '../src/hooks/useStudents';
import { getMonthlyTuitionSummary, MonthlyTuitionSummary } from '../src/services/tuitionExportService';
import { formatCurrency } from '../src/utils/currencyUtils';

const currentMonthValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const parseMonthValue = (value: string) => {
  const [year, month] = value.split('-').map(Number);
  return { month, year };
};

const formatDate = (date: string) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('vi-VN');
};

const downloadCsv = (summary: MonthlyTuitionSummary) => {
  const header = ['Ngày', 'Buổi', 'Trạng thái', 'Đơn giá', 'Thành tiền'];
  const rows = summary.rows.map((row) => [
    formatDate(row.date),
    row.sessionNumber || '',
    row.status,
    row.unitPrice,
    row.amount,
  ]);
  const totalRow = ['', '', 'Tổng cộng', '', summary.totalAmount];
  const csv = [header, ...rows, totalRow]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `hoc-phi-${summary.studentName || summary.studentId}-${summary.month}-${summary.year}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

export const TuitionExport: React.FC = () => {
  const { classes, loading: classesLoading } = useClasses();
  const { students, loading: studentsLoading } = useStudents();
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [monthValue, setMonthValue] = useState(currentMonthValue());
  const [summary, setSummary] = useState<MonthlyTuitionSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedClass = useMemo(
    () => classes.find((cls) => cls.id === selectedClassId),
    [classes, selectedClassId]
  );

  const studentsInClass = useMemo(() => {
    if (!selectedClassId) return [];
    return students
      .filter((student) => student.classId === selectedClassId || student.classIds?.includes(selectedClassId))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));
  }, [students, selectedClassId]);

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId),
    [students, selectedStudentId]
  );

  useEffect(() => {
    setSelectedStudentId('');
    setSummary(null);
  }, [selectedClassId]);

  useEffect(() => {
    let active = true;

    const loadSummary = async () => {
      if (!selectedClassId || !selectedStudentId || !monthValue) {
        setSummary(null);
        return;
      }

      try {
        setLoadingSummary(true);
        setError(null);
        const { month, year } = parseMonthValue(monthValue);
        const data = await getMonthlyTuitionSummary({
          classId: selectedClassId,
          studentId: selectedStudentId,
          month,
          year,
        });

        if (!active) return;
        setSummary({
          ...data,
          studentName: data.studentName || selectedStudent?.fullName || '',
          className: data.className || selectedClass?.name || '',
        });
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Không thể tổng kết học phí');
        setSummary(null);
      } finally {
        if (active) setLoadingSummary(false);
      }
    };

    loadSummary();
    return () => {
      active = false;
    };
  }, [monthValue, selectedClass?.name, selectedClassId, selectedStudent?.fullName, selectedStudentId]);

  const reloadSummary = async () => {
    if (!selectedClassId || !selectedStudentId) return;
    const { month, year } = parseMonthValue(monthValue);
    setLoadingSummary(true);
    setError(null);
    try {
      const data = await getMonthlyTuitionSummary({
        classId: selectedClassId,
        studentId: selectedStudentId,
        month,
        year,
      });
      setSummary({
        ...data,
        studentName: data.studentName || selectedStudent?.fullName || '',
        className: data.className || selectedClass?.name || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tổng kết học phí');
    } finally {
      setLoadingSummary(false);
    }
  };

  const isLoading = classesLoading || studentsLoading;
  const canExport = Boolean(summary && summary.rows.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Xuất học phí</h2>
          <p className="mt-1 text-sm text-gray-500">Chọn lớp, tháng và học sinh để tổng kết học phí theo tháng.</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={reloadSummary}
            disabled={!selectedClassId || !selectedStudentId || loadingSummary}
            className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loadingSummary ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
          <button
            type="button"
            onClick={() => summary && downloadCsv(summary)}
            disabled={!canExport}
            className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Xuất CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!summary}
            className="inline-flex items-center gap-2 rounded-md bg-[#5A3416] px-3 py-2 text-sm font-medium text-white hover:bg-[#70421d] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            In
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm print:hidden">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Lớp</label>
            <select
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#A95A00] focus:outline-none focus:ring-2 focus:ring-[#F7D06A]/40"
            >
              <option value="">Chọn lớp</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Tháng</label>
            <input
              type="month"
              value={monthValue}
              onChange={(event) => setMonthValue(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#A95A00] focus:outline-none focus:ring-2 focus:ring-[#F7D06A]/40"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Học sinh</label>
            <select
              value={selectedStudentId}
              onChange={(event) => setSelectedStudentId(event.target.value)}
              disabled={!selectedClassId}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#A95A00] focus:outline-none focus:ring-2 focus:ring-[#F7D06A]/40 disabled:bg-gray-50"
            >
              <option value="">{selectedClassId ? 'Chọn học sinh' : 'Chọn lớp trước'}</option>
              {studentsInClass.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.fullName}{student.code ? ` - ${student.code}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="rounded-lg border border-gray-100 bg-white p-6 text-sm text-gray-500 shadow-sm">
          Đang tải dữ liệu lớp và học sinh...
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!isLoading && selectedClassId && studentsInClass.length === 0 && (
        <div className="rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
          Lớp này chưa có học sinh trong danh sách.
        </div>
      )}

      {summary ? (
        <div id="tuition-export-content" className="space-y-4 rounded-lg border border-gray-100 bg-white p-5 shadow-sm print:border-none print:shadow-none">
          <div className="flex flex-col gap-2 border-b border-gray-100 pb-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Bảng tổng kết học phí tháng {summary.month}/{summary.year}</h3>
              <p className="mt-1 text-sm text-gray-500">
                {summary.studentName || selectedStudent?.fullName || '-'} · {summary.className || selectedClass?.name || '-'}
              </p>
            </div>
            <div className="text-left md:text-right">
              <p className="text-sm text-gray-500">Tổng học phí</p>
              <p className="text-2xl font-bold text-[#A95A00]">{formatCurrency(summary.totalAmount)}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-md bg-gray-50 p-3">
              <p className="text-xs font-medium text-gray-500">Tổng buổi</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{summary.totalSessions}</p>
            </div>
            <div className="rounded-md bg-green-50 p-3">
              <p className="text-xs font-medium text-green-700">Buổi tính phí</p>
              <p className="mt-1 text-xl font-bold text-green-800">{summary.billableSessions}</p>
            </div>
            <div className="rounded-md bg-red-50 p-3">
              <p className="text-xs font-medium text-red-700">Vắng</p>
              <p className="mt-1 text-xl font-bold text-red-800">{summary.absentSessions}</p>
            </div>
            <div className="rounded-md bg-blue-50 p-3">
              <p className="text-xs font-medium text-blue-700">Bảo lưu</p>
              <p className="mt-1 text-xl font-bold text-blue-800">{summary.reservedSessions}</p>
            </div>
            <div className="rounded-md bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-700">Đơn giá</p>
              <p className="mt-1 text-lg font-bold text-amber-800">{formatCurrency(summary.unitPrice)}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-100">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Ngày</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Buổi</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Trạng thái</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Đơn giá</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Thành tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {summary.rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      Chưa có dữ liệu điểm danh trong tháng đã chọn.
                    </td>
                  </tr>
                ) : (
                  summary.rows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 text-gray-900">{formatDate(row.date)}</td>
                      <td className="px-4 py-3 text-gray-600">{row.sessionNumber || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{row.status || '-'}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(row.unitPrice)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(row.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right font-semibold text-gray-700">Tổng cộng</td>
                  <td className="px-4 py-3 text-right font-bold text-[#A95A00]">{formatCurrency(summary.totalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-100 bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
          Chọn đầy đủ lớp, tháng và học sinh để xem tổng kết học phí.
        </div>
      )}
    </div>
  );
};
