import { collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, writeBatch, runTransaction, arrayUnion, Timestamp, db } from '@/src/utils/legacyFirestoreStub';
/**
 * Monthly Report Page
 * Báo cáo học tập theo tháng cho từng học sinh
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  FileText,
  Download,
  Printer,
  Calendar,
  User,
  BookOpen,
  CheckCircle,
  XCircle,
  Award,
  TrendingUp,
  MessageSquare,
  Edit3,
  Save,
  X,
  Search,
  Users,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useStudents } from '../src/hooks/useStudents';
import { useClasses } from '../src/hooks/useClasses';
import {
  generateMonthlyReport,
  saveMonthlyComment,
  generateAIComment,
  MonthlyReportData,
  generateStudentPDF,
  downloadBlob,
  preparePDFReportData,
  StudentPDFReportData
} from '../src/services/monthlyReportService';
import { AttendanceStatus, MonthlyComment, Student, StudentStatus, TestComment } from '../types';
import { generateTestCommentPDF, downloadBlob as downloadTestPdfBlob } from '../src/services/testCommentPdfService';
import { SearchableClassDropdown } from '../src/features/attendance/components/SearchableClassDropdown';
import { MonthlyCommentTab } from '../src/features/reports/components/MonthlyCommentTab';
import { TestCommentTab } from '../src/features/reports/components/TestCommentTab';

export const MonthlyReport: React.FC = () => {
  const { students, loading: studentsLoading } = useStudents();
  const { classes, loading: classesLoading } = useClasses();

  // Mode: 'byStudent' (existing) or 'byClass' (new)
  const [mode, setMode] = useState<'byStudent' | 'byClass'>('byStudent');

  // "Theo Học sinh" mode states
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [reportData, setReportData] = useState<MonthlyReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Student filter by class (for "Theo Học sinh" mode)
  const [filterClassId, setFilterClassId] = useState('');

  // "Theo Lớp" mode states
  const [selectedClassId, setSelectedClassId] = useState('');
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [activeTab, setActiveTab] = useState<'monthly' | 'test'>('monthly');

  // Edit comment state
  const [editingCommentClassId, setEditingCommentClassId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [savingComment, setSavingComment] = useState(false);

  // PDF export state
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);

  // Test export state (for "Theo học sinh" mode)
  const [studentTestComments, setStudentTestComments] = useState<TestComment[]>([]);
  const [selectedTestId, setSelectedTestId] = useState('');
  const [loadingTests, setLoadingTests] = useState(false);
  const [exportingTestPDF, setExportingTestPDF] = useState(false);

  const reportRef = useRef<HTMLDivElement>(null);

  // Get selected class for display
  const selectedClass = useMemo(() =>
    classes.find(c => c.id === selectedClassId),
    [classes, selectedClassId]
  );

  // Effect: Load students when class is selected in "byClass" mode
  useEffect(() => {
    if (!selectedClassId || mode !== 'byClass') {
      setClassStudents([]);
      return;
    }

    setLoadingStudents(true);

    // Filter students that belong to selected class
    const studentsInClass = students.filter(s =>
      s.classId === selectedClassId ||
      s.classIds?.includes(selectedClassId)
    );

    // Sort by name
    studentsInClass.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));

    setClassStudents(studentsInClass);
    setLoadingStudents(false);
  }, [selectedClassId, students, mode]);

  // Fetch test comments for selected student (defined before useEffect that uses it)
  const fetchStudentTestComments = useCallback(async (studentId: string) => {
    if (!studentId) {
      setStudentTestComments([]);
      return;
    }

    setLoadingTests(true);
    try {
      const q = query(
        collection(null as any /* firebase removed */, 'testComments'),
        where('studentId', '==', studentId)
      );
      const snapshot = await getDocs(q);
      const tests = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as TestComment[];

      // Sort by date descending
      tests.sort((a, b) => (b.testDate || '').localeCompare(a.testDate || ''));
      setStudentTestComments(tests);
    } catch (error) {
      console.error('Error fetching test comments:', error);
      setStudentTestComments([]);
    } finally {
      setLoadingTests(false);
    }
  }, []);

  // Fetch test comments when student changes (for "Theo học sinh" mode)
  useEffect(() => {
    if (mode === 'byStudent' && selectedStudentId) {
      fetchStudentTestComments(selectedStudentId);
    } else {
      setStudentTestComments([]);
      setSelectedTestId('');
    }
  }, [mode, selectedStudentId, fetchStudentTestComments]);

  // Filter students by class for "Theo Học sinh" mode
  const studentsInFilterClass = useMemo(() => {
    if (!filterClassId) return [];
    return students.filter(s =>
      s.classId === filterClassId ||
      s.classIds?.includes(filterClassId)
    ).sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
  }, [students, filterClassId]);

  // Filter students by search (within class if selected)
  const filteredStudents = useMemo(() => {
    const baseList = filterClassId ? studentsInFilterClass : students;
    if (!searchQuery) return baseList;
    const query = searchQuery.toLowerCase();
    return baseList.filter(s =>
      s.fullName?.toLowerCase().includes(query) ||
      s.code?.toLowerCase().includes(query)
    );
  }, [students, studentsInFilterClass, searchQuery, filterClassId]);

  // Get selected student
  const selectedStudent = students.find(s => s.id === selectedStudentId);

  // Get current student index in list (for next/prev navigation)
  const currentStudentIndex = useMemo(() => {
    if (!selectedStudentId || studentsInFilterClass.length === 0) return -1;
    return studentsInFilterClass.findIndex(s => s.id === selectedStudentId);
  }, [selectedStudentId, studentsInFilterClass]);

  // Navigate to next student
  const handleNextStudent = () => {
    if (currentStudentIndex < studentsInFilterClass.length - 1) {
      const nextStudent = studentsInFilterClass[currentStudentIndex + 1];
      setSelectedStudentId(nextStudent.id);
      setReportData(null);
    }
  };

  // Navigate to previous student
  const handlePrevStudent = () => {
    if (currentStudentIndex > 0) {
      const prevStudent = studentsInFilterClass[currentStudentIndex - 1];
      setSelectedStudentId(prevStudent.id);
      setReportData(null);
    }
  };

  // Export test comment PDF
  const handleExportTestPDF = async () => {
    const selectedTest = studentTestComments.find(t => t.id === selectedTestId);
    if (!selectedTest) {
      alert('Vui lòng chọn bài test!');
      return;
    }

    setExportingTestPDF(true);
    try {
      const blob = await generateTestCommentPDF(selectedTest);
      const dateStr = selectedTest.testDate || new Date().toISOString().split('T')[0];
      const filename = `${selectedTest.studentName}_${selectedTest.testName}_${dateStr}.pdf`;
      downloadTestPdfBlob(blob, filename);
    } catch (error) {
      console.error('Error exporting test PDF:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      alert(`Có lỗi xảy ra khi xuất PDF: ${errorMsg}`);
    } finally {
      setExportingTestPDF(false);
    }
  };

  // Generate report
  const handleGenerateReport = async () => {
    if (!selectedStudent) return;
    
    setLoading(true);
    try {
      const data = await generateMonthlyReport(
        selectedStudent,
        classes,
        selectedMonth,
        selectedYear
      );
      setReportData(data);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Không thể tạo báo cáo. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };
  
  // Print report
  const handlePrint = () => {
    window.print();
  };

  // Export PDF for "Theo Học sinh" mode
  const handleExportPDF = async () => {
    if (!reportData) return;

    setExportingPDF(true);
    try {
      const pdfDataList = preparePDFReportData(reportData);

      if (pdfDataList.length === 0) {
        alert('Không có dữ liệu để xuất PDF');
        return;
      }

      // Export each class report as separate PDF
      for (let i = 0; i < pdfDataList.length; i++) {
        setExportProgress({ current: i + 1, total: pdfDataList.length });
        const pdfData = pdfDataList[i];
        const blob = await generateStudentPDF(pdfData);
        const filename = `bao-cao-${reportData.student.code}-${pdfData.student.className.replace(/\s+/g, '-')}-T${selectedMonth}-${selectedYear}.pdf`;
        downloadBlob(blob, filename);

        // Small delay between downloads to prevent browser issues
        if (i < pdfDataList.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Có lỗi xảy ra khi xuất PDF');
    } finally {
      setExportingPDF(false);
      setExportProgress(null);
    }
  };

  // Save comment
  const handleSaveComment = async (classId: string, className: string) => {
    if (!selectedStudent || !editingCommentText.trim()) return;
    
    setSavingComment(true);
    try {
      await saveMonthlyComment({
        studentId: selectedStudent.id,
        studentName: selectedStudent.fullName,
        classId,
        className,
        month: selectedMonth,
        year: selectedYear,
        teacherComment: editingCommentText,
        updatedAt: new Date().toISOString(),
      });
      
      // Update local state
      if (reportData) {
        setReportData({
          ...reportData,
          classReports: reportData.classReports.map(cr => 
            cr.classId === classId 
              ? { 
                  ...cr, 
                  comment: { 
                    ...cr.comment,
                    id: cr.comment?.id || '',
                    studentId: selectedStudent.id,
                    studentName: selectedStudent.fullName,
                    classId,
                    className,
                    month: selectedMonth,
                    year: selectedYear,
                    teacherComment: editingCommentText,
                    createdAt: cr.comment?.createdAt || new Date().toISOString(),
                  } as MonthlyComment
                }
              : cr
          )
        });
      }
      
      setEditingCommentClassId(null);
      setEditingCommentText('');
    } catch (error) {
      console.error('Error saving comment:', error);
      alert('Không thể lưu nhận xét');
    } finally {
      setSavingComment(false);
    }
  };
  
  // Generate AI comment for a class
  const handleGenerateAIComment = (classId: string) => {
    if (!reportData || !selectedStudent) return;
    
    const classReport = reportData.classReports.find(cr => cr.classId === classId);
    if (!classReport) return;
    
    const aiComment = generateAIComment(
      selectedStudent.fullName,
      classReport.className,
      classReport.stats,
      classReport.attendance
    );
    
    setEditingCommentClassId(classId);
    setEditingCommentText(aiComment);
  };
  
  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN');
  };
  
  // Get status badge
  const getStatusBadge = (status: AttendanceStatus) => {
    const styles: Record<string, { bg: string; text: string; label: string }> = {
      [AttendanceStatus.ON_TIME]: { bg: 'bg-green-100', text: 'text-green-700', label: 'Đúng giờ' },
      [AttendanceStatus.LATE]: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Trễ giờ' },
      [AttendanceStatus.ABSENT]: { bg: 'bg-red-100', text: 'text-red-700', label: 'Vắng' },
      [AttendanceStatus.RESERVED]: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Bảo lưu' },
      [AttendanceStatus.TUTORED]: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Đã bồi' },
    };
    const style = styles[status] || { bg: 'bg-gray-100', text: 'text-gray-700', label: status };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}>
        {style.label}
      </span>
    );
  };
  
  // Month options
  const months = [
    { value: 1, label: 'Tháng 1' },
    { value: 2, label: 'Tháng 2' },
    { value: 3, label: 'Tháng 3' },
    { value: 4, label: 'Tháng 4' },
    { value: 5, label: 'Tháng 5' },
    { value: 6, label: 'Tháng 6' },
    { value: 7, label: 'Tháng 7' },
    { value: 8, label: 'Tháng 8' },
    { value: 9, label: 'Tháng 9' },
    { value: 10, label: 'Tháng 10' },
    { value: 11, label: 'Tháng 11' },
    { value: 12, label: 'Tháng 12' },
  ];
  
  // Year options (last 3 years)
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <FileText className="text-indigo-600" size={24} />
              Báo cáo Học tập Hàng tháng
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Xuất báo cáo chi tiết về điểm danh, điểm số, nhận xét cho từng học sinh
            </p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => {
              setMode('byClass');
              // Reset byStudent state
              setSelectedStudentId('');
              setSearchQuery('');
              setReportData(null);
            }}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
              mode === 'byClass'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Users size={18} />
            Theo Lớp
          </button>
          <button
            onClick={() => {
              setMode('byStudent');
              // Reset byClass state
              setSelectedClassId('');
              setClassStudents([]);
            }}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
              mode === 'byStudent'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <User size={18} />
            Theo Học sinh
          </button>
        </div>

        {/* Filters - "Theo Lớp" mode */}
        {mode === 'byClass' && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Branch + Class Search */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Lớp học</label>
              <SearchableClassDropdown
                classes={classes}
                selectedClassId={selectedClassId}
                onSelect={setSelectedClassId}
                disabled={classesLoading}
                placeholder="Tìm kiếm lớp..."
              />
            </div>

            {/* Month/Year picker */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Tháng</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  {months.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Năm</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Filters - "Theo Học sinh" mode */}
        {mode === 'byStudent' && (
          <div className="mt-6 space-y-4">
            {/* Row 1: Class filter + Month/Year */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Class Filter (optional) */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Lọc theo lớp (tùy chọn)</label>
                <SearchableClassDropdown
                  classes={classes}
                  selectedClassId={filterClassId}
                  onSelect={(classId) => {
                    setFilterClassId(classId);
                    setSelectedStudentId('');
                    setSearchQuery('');
                    setReportData(null);
                  }}
                  disabled={classesLoading}
                  placeholder="Chọn lớp để lọc học sinh..."
                />
              </div>

              {/* Month */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tháng</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  {months.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* Year */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Năm</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Student selector with navigation */}
            <div className="flex items-end gap-3">
              {/* Student Search/Select */}
              <div className="flex-1 relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Học sinh {filterClassId && studentsInFilterClass.length > 0 && `(${studentsInFilterClass.length} học sinh trong lớp)`}
                </label>
                {!selectedStudent ? (
                  filterClassId ? (
                    // Dropdown mode when class is selected
                    <select
                      value={selectedStudentId}
                      onChange={(e) => {
                        setSelectedStudentId(e.target.value);
                        setReportData(null);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">-- Chọn học sinh --</option>
                      {studentsInFilterClass.map((student, idx) => (
                        <option key={student.id} value={student.id}>
                          {idx + 1}. {student.fullName} ({student.code})
                        </option>
                      ))}
                    </select>
                  ) : (
                    // Search mode when no class is selected
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                          type="text"
                          placeholder="Tìm theo tên hoặc mã học sinh..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      {searchQuery && filteredStudents.length > 0 && (
                        <div className="absolute z-50 mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                          {filteredStudents.slice(0, 10).map(student => (
                            <button
                              key={student.id}
                              onClick={() => {
                                setSelectedStudentId(student.id);
                                setSearchQuery('');
                              }}
                              className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                            >
                              <User size={16} className="text-gray-400" />
                              <span className="font-medium">{student.fullName}</span>
                              <span className="text-gray-400 text-sm">({student.code})</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )
                ) : (
                  <div className="p-2 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center gap-2">
                    <User size={16} className="text-indigo-600" />
                    <span className="font-medium text-indigo-700">{selectedStudent.fullName}</span>
                    <span className="text-indigo-500 text-sm">({selectedStudent.code})</span>
                    {filterClassId && currentStudentIndex >= 0 && (
                      <span className="text-indigo-400 text-sm ml-1">
                        [{currentStudentIndex + 1}/{studentsInFilterClass.length}]
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setSelectedStudentId('');
                        setSearchQuery('');
                        setReportData(null);
                      }}
                      className="ml-auto text-indigo-400 hover:text-indigo-600"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* Prev/Next buttons - only show when class is filtered and student is selected */}
              {filterClassId && selectedStudent && studentsInFilterClass.length > 1 && (
                <div className="flex gap-1">
                  <button
                    onClick={handlePrevStudent}
                    disabled={currentStudentIndex <= 0}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Học sinh trước"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    onClick={handleNextStudent}
                    disabled={currentStudentIndex >= studentsInFilterClass.length - 1}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Học sinh tiếp theo"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Generate Button - only for "Theo Học sinh" mode */}
        {mode === 'byStudent' && (
          <>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleGenerateReport}
              disabled={!selectedStudentId || loading}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Đang tạo...
                </>
              ) : (
                <>
                  <FileText size={18} />
                  Tạo báo cáo
                </>
              )}
            </button>

            {reportData && (
              <>
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                >
                  <Printer size={18} />
                  In báo cáo
                </button>
                <button
                  onClick={handleExportPDF}
                  disabled={exportingPDF}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {exportingPDF ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      {exportProgress ? `Xuất ${exportProgress.current}/${exportProgress.total}...` : 'Đang xuất...'}
                    </>
                  ) : (
                    <>
                      <Download size={18} />
                      Xuất PDF
                    </>
                  )}
                </button>
              </>
            )}
          </div>

          {/* Test Export Section */}
          {selectedStudentId && studentTestComments.length > 0 && (
            <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-purple-800 mb-3 flex items-center gap-2">
                <Award size={16} />
                Xuất báo cáo bài Test
              </h4>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs text-purple-600 mb-1">Chọn bài test</label>
                  <select
                    value={selectedTestId}
                    onChange={(e) => setSelectedTestId(e.target.value)}
                    className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 bg-white"
                  >
                    <option value="">-- Chọn bài test --</option>
                    {studentTestComments.map(test => (
                      <option key={test.id} value={test.id}>
                        {test.testName} {test.testDate ? `(${test.testDate})` : ''}
                        {test.book ? ` - ${test.book}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleExportTestPDF}
                  disabled={!selectedTestId || exportingTestPDF}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 text-sm"
                >
                  {exportingTestPDF ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Đang xuất...
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      Xuất PDF Test
                    </>
                  )}
                </button>
              </div>
              {loadingTests && (
                <p className="text-xs text-purple-500 mt-2">Đang tải danh sách bài test...</p>
              )}
            </div>
          )}

          {/* No tests message */}
          {selectedStudentId && studentTestComments.length === 0 && !loadingTests && (
            <div className="mt-4 text-sm text-gray-500 italic p-4 bg-gray-50 rounded-lg">
              Học sinh này chưa có bài test nào.
            </div>
          )}
          </>
        )}
      </div>

      {/* "Theo Lớp" Mode - Comment Tabs */}
      {mode === 'byClass' && selectedClassId && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Users className="text-indigo-600" size={20} />
              {selectedClass?.name || 'Lớp học'}
            </h3>
            <span className="text-sm text-gray-500">
              {classStudents.length} học sinh • Tháng {selectedMonth}/{selectedYear}
            </span>
          </div>

          {loadingStudents ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent mx-auto"></div>
              <p className="text-gray-500 mt-2">Đang tải danh sách học sinh...</p>
            </div>
          ) : classStudents.length === 0 ? (
            <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg">
              <Users className="mx-auto mb-2 text-gray-300" size={48} />
              <p>Không có học sinh trong lớp này</p>
              <p className="text-sm mt-1">Hãy chọn lớp khác hoặc kiểm tra dữ liệu học sinh</p>
            </div>
          ) : (
            <>
              {/* Tab buttons */}
              <div className="flex gap-1 border-b border-gray-200 mb-4">
                <button
                  onClick={() => setActiveTab('monthly')}
                  className={`px-4 py-2 font-medium border-b-2 -mb-px transition-colors ${
                    activeTab === 'monthly'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <MessageSquare size={16} className="inline mr-2" />
                  Nhận xét tháng
                </button>
                <button
                  onClick={() => setActiveTab('test')}
                  className={`px-4 py-2 font-medium border-b-2 -mb-px transition-colors ${
                    activeTab === 'test'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Award size={16} className="inline mr-2" />
                  Nhận xét bài Test
                </button>
              </div>

              {/* Tab content */}
              {activeTab === 'monthly' ? (
                <MonthlyCommentTab
                  students={classStudents}
                  classId={selectedClassId}
                  className={selectedClass?.name || ''}
                  month={selectedMonth}
                  year={selectedYear}
                />
              ) : (
                <TestCommentTab
                  students={classStudents}
                  classId={selectedClassId}
                  className={selectedClass?.name || ''}
                  month={selectedMonth}
                  year={selectedYear}
                />
              )}
            </>
          )}
        </div>
      )}
      
      {/* Report Content - only for "Theo Học sinh" mode */}
      {mode === 'byStudent' && reportData && (
        <div id="monthly-report-content" ref={reportRef} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden print:shadow-none print:border-none">
          {/* Report Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-6 print:bg-indigo-600">
            <h2 className="text-2xl font-bold text-center">
              BÁO CÁO HỌC TẬP THÁNG {selectedMonth}/{selectedYear}
            </h2>
            <p className="text-center text-indigo-100 mt-1">
              Ngày xuất: {new Date().toLocaleDateString('vi-VN')} {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          
          {/* Student Info */}
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <User className="text-indigo-600" size={20} />
              THÔNG TIN HỌC SINH
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Họ và tên</p>
                <p className="font-semibold text-gray-800">{reportData.student.fullName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Mã học sinh</p>
                <p className="font-semibold text-gray-800">{reportData.student.code}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Ngày sinh</p>
                <p className="font-semibold text-gray-800">
                  {reportData.student.dob ? formatDate(reportData.student.dob) : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Các lớp đang học</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {reportData.classReports.map(cr => (
                    <span 
                      key={cr.classId}
                      className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium"
                    >
                      {cr.className}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          {/* Overall Stats */}
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className="text-indigo-600" size={20} />
              THỐNG KÊ TỔNG HỢP THÁNG {selectedMonth}/{selectedYear}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                <p className="text-3xl font-bold text-indigo-600">{reportData.overallStats.totalSessions}</p>
                <p className="text-xs text-gray-500 mt-1">Tổng số buổi</p>
              </div>
              <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                <p className="text-3xl font-bold text-green-600">{reportData.overallStats.attendedSessions}</p>
                <p className="text-xs text-gray-500 mt-1">Số buổi có mặt</p>
              </div>
              <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                <p className="text-3xl font-bold text-red-600">{reportData.overallStats.absentSessions}</p>
                <p className="text-xs text-gray-500 mt-1">Số buổi vắng</p>
              </div>
              <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                <p className="text-3xl font-bold text-emerald-600">{reportData.overallStats.attendanceRate}%</p>
                <p className="text-xs text-gray-500 mt-1">Tỷ lệ tham gia</p>
              </div>
              {/* Homework completion rate - calculate from class reports */}
              <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                <p className="text-3xl font-bold text-blue-600">
                  {(() => {
                    const hwStats = reportData.classReports.reduce(
                      (acc, cr) => ({
                        total: acc.total + (cr.homeworkSummary?.totalHomeworks || 0),
                        completed: acc.completed + (cr.homeworkSummary?.completedHomeworks || 0)
                      }),
                      { total: 0, completed: 0 }
                    );
                    return hwStats.total > 0 ? Math.round((hwStats.completed / hwStats.total) * 100) : 0;
                  })()}%
                </p>
                <p className="text-xs text-gray-500 mt-1">Tỷ lệ hoàn thành BTVN</p>
              </div>
              <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                <p className="text-3xl font-bold text-amber-600">
                  {reportData.overallStats.averageScore !== null ? reportData.overallStats.averageScore : '-'}
                </p>
                <p className="text-xs text-gray-500 mt-1">Điểm trung bình</p>
              </div>
            </div>
          </div>
          
          {/* Per-class Reports */}
          <div className="p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <BookOpen className="text-indigo-600" size={20} />
              BẢNG ĐIỂM THEO KỸ NĂNG
            </h3>
            
            {reportData.classReports.map((classReport, index) => (
              <div key={classReport.classId} className={`${index > 0 ? 'mt-8' : ''}`}>
                {/* Class Header */}
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-indigo-700 flex items-center gap-2">
                    <span className="text-lg">📚</span>
                    {classReport.className}
                  </h4>
                  <span className="text-sm text-gray-500">
                    TB: {classReport.stats.averageScore !== null ? classReport.stats.averageScore : '-'}
                  </span>
                </div>
                
                {/* Attendance Table */}
                {classReport.attendance.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">Ngày</th>
                          <th className="px-3 py-2 text-center font-semibold text-gray-600">Chuyên cần</th>
                          <th className="px-3 py-2 text-center font-semibold text-gray-600">% BTVN</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">Tên bài KT</th>
                          <th className="px-3 py-2 text-center font-semibold text-gray-600">Điểm</th>
                          <th className="px-3 py-2 text-center font-semibold text-gray-600">Điểm thưởng</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {classReport.attendance.map((record, idx) => (
                          <tr key={record.id || idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2">
                              {record.date ? new Date(record.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '-'}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {record.status === AttendanceStatus.ON_TIME || record.status === AttendanceStatus.LATE || record.status === AttendanceStatus.TUTORED ? (
                                <CheckCircle className="inline text-green-500" size={18} />
                              ) : (
                                <XCircle className="inline text-red-500" size={18} />
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {record.homeworkCompletion !== undefined ? `${record.homeworkCompletion}%` : '-'}
                            </td>
                            <td className="px-3 py-2">{record.testName || '-'}</td>
                            <td className="px-3 py-2 text-center font-semibold">
                              {record.score !== undefined ? record.score : '-'}
                            </td>
                            <td className="px-3 py-2 text-center text-amber-600 font-medium">
                              {record.bonusPoints || '-'}
                            </td>
                            <td className="px-3 py-2 text-gray-500">{record.note || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-lg">
                    Chưa có dữ liệu điểm danh trong tháng này
                  </div>
                )}
                
                {/* Teacher Comment */}
                <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-semibold text-green-800 flex items-center gap-2">
                      <MessageSquare size={16} />
                      Nhận xét môn học:
                    </h5>
                    <div className="flex gap-2 print:hidden">
                      {editingCommentClassId !== classReport.classId && (
                        <>
                          <button
                            onClick={() => handleGenerateAIComment(classReport.classId)}
                            className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 flex items-center gap-1"
                          >
                            <Award size={12} />
                            Tạo AI
                          </button>
                          <button
                            onClick={() => {
                              setEditingCommentClassId(classReport.classId);
                              setEditingCommentText(classReport.comment?.teacherComment || classReport.comment?.aiComment || '');
                            }}
                            className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 flex items-center gap-1"
                          >
                            <Edit3 size={12} />
                            Sửa
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {editingCommentClassId === classReport.classId ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingCommentText}
                        onChange={(e) => setEditingCommentText(e.target.value)}
                        rows={6}
                        className="w-full px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
                        placeholder="Nhập nhận xét..."
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => {
                            setEditingCommentClassId(null);
                            setEditingCommentText('');
                          }}
                          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                        >
                          Hủy
                        </button>
                        <button
                          onClick={() => handleSaveComment(classReport.classId, classReport.className)}
                          disabled={savingComment}
                          className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1 disabled:opacity-50"
                        >
                          {savingComment ? (
                            <div className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent"></div>
                          ) : (
                            <Save size={14} />
                          )}
                          Lưu
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-green-900 whitespace-pre-line">
                      {classReport.comment?.teacherComment || classReport.comment?.aiComment || (
                        <span className="text-green-600 italic">Chưa có nhận xét. Nhấn "Tạo AI" để tự động tạo hoặc "Sửa" để nhập thủ công.</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Homework Summary */}
                {classReport.homeworkSummary && classReport.homeworkSummary.totalHomeworks > 0 && (
                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h5 className="font-semibold text-blue-800 flex items-center gap-2 mb-3">
                      <BookOpen size={16} />
                      Thống kê bài tập về nhà:
                    </h5>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-blue-600">{classReport.homeworkSummary.totalHomeworks}</p>
                        <p className="text-xs text-gray-500">Tổng bài tập</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-600">{classReport.homeworkSummary.completedHomeworks}</p>
                        <p className="text-xs text-gray-500">Đã hoàn thành</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-amber-600">{classReport.homeworkSummary.completionRate}%</p>
                        <p className="text-xs text-gray-500">Tỷ lệ hoàn thành</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Test Comments */}
                {classReport.testComments && classReport.testComments.length > 0 && (
                  <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h5 className="font-semibold text-purple-800 flex items-center gap-2 mb-3">
                      <Award size={16} />
                      Kết quả bài kiểm tra:
                    </h5>
                    <div className="space-y-3">
                      {classReport.testComments.map((test, idx) => (
                        <div key={idx} className="bg-white rounded-lg p-3 border border-purple-100">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-purple-900">{test.testName}</p>
                              {test.testDate && (
                                <p className="text-xs text-gray-500">
                                  Ngày: {new Date(test.testDate).toLocaleDateString('vi-VN')}
                                </p>
                              )}
                            </div>
                            {test.score !== null && (
                              <span className="text-xl font-bold text-purple-600">{test.score}</span>
                            )}
                          </div>
                          {test.comment && (
                            <p className="mt-2 text-sm text-gray-700 border-t border-purple-100 pt-2">
                              {test.comment}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {/* Detailed History */}
          <div className="p-6 border-t border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Calendar className="text-indigo-600" size={20} />
              LỊCH SỬ HỌC TẬP CHI TIẾT
            </h3>
            
            {reportData.allAttendance.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Ngày</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Lớp học</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Giờ học</th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-600">Trạng thái</th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-600">Điểm</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Bài tập</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {reportData.allAttendance.map((record, idx) => (
                      <tr key={record.id || idx} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          {record.date ? formatDate(record.date) : '-'}
                        </td>
                        <td className="px-3 py-2 font-medium">{record.className || '-'}</td>
                        <td className="px-3 py-2 text-gray-500">-</td>
                        <td className="px-3 py-2 text-center">
                          {getStatusBadge(record.status)}
                        </td>
                        <td className="px-3 py-2 text-center font-semibold">
                          {record.score !== undefined ? record.score : '-'}
                        </td>
                        <td className="px-3 py-2">{record.testName || '-'}</td>
                        <td className="px-3 py-2 text-gray-500">{record.note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg">
                Chưa có dữ liệu lịch sử học tập trong tháng này
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="p-6 bg-gray-50 border-t border-gray-200 text-center text-sm text-gray-500">
            <p>Báo cáo được tạo tự động bởi hệ thống EduManager Pro</p>
            <p className="mt-1">© {new Date().getFullYear()} - Mọi quyền được bảo lưu</p>
          </div>
        </div>
      )}
      
      {/* Empty State - only for "Theo Học sinh" mode */}
      {mode === 'byStudent' && !reportData && !loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <FileText className="mx-auto text-gray-300 mb-4" size={64} />
          <h3 className="text-lg font-medium text-gray-600">Chưa có báo cáo</h3>
          <p className="text-gray-400 mt-1">
            Chọn học sinh và tháng/năm, sau đó nhấn "Tạo báo cáo" để xem báo cáo học tập
          </p>
        </div>
      )}
      
      {/* Print Styles */}
      <style>{`
        @media print {
          /* Reset page margins */
          @page {
            margin: 10mm;
            size: A4;
          }
          
          /* Hide everything except report */
          body {
            margin: 0 !important;
            padding: 0 !important;
          }
          body * {
            visibility: hidden;
          }
          
          /* Show report content */
          #monthly-report-content,
          #monthly-report-content * {
            visibility: visible;
          }
          
          /* Position report at top */
          #monthly-report-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 5mm !important;
            margin: 0 !important;
          }
          
          /* Compact spacing for print */
          #monthly-report-content .p-6 {
            padding: 12px !important;
          }
          #monthly-report-content .p-4 {
            padding: 8px !important;
          }
          #monthly-report-content .p-3 {
            padding: 6px !important;
          }
          #monthly-report-content .mb-4 {
            margin-bottom: 8px !important;
          }
          #monthly-report-content .mb-6 {
            margin-bottom: 12px !important;
          }
          #monthly-report-content .gap-4 {
            gap: 8px !important;
          }
          #monthly-report-content .gap-6 {
            gap: 12px !important;
          }
          #monthly-report-content .space-y-4 > * + * {
            margin-top: 8px !important;
          }
          #monthly-report-content .space-y-6 > * + * {
            margin-top: 12px !important;
          }
          
          /* Smaller text for print */
          #monthly-report-content {
            font-size: 11px !important;
          }
          #monthly-report-content h2 {
            font-size: 16px !important;
          }
          #monthly-report-content h3 {
            font-size: 13px !important;
          }
          #monthly-report-content h4 {
            font-size: 12px !important;
          }
          
          /* Hide print buttons and controls */
          .print\\:hidden {
            display: none !important;
          }
          
          /* Remove shadows and borders for cleaner print */
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:border-none {
            border: none !important;
          }
          
          /* Avoid page breaks inside elements */
          #monthly-report-content > div {
            page-break-inside: avoid;
          }
          
          /* Print background colors */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
};
