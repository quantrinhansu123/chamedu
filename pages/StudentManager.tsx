
import React, { useState, useMemo, useEffect } from 'react';
import { Search, Filter, Gift, History, User, Phone, MoreHorizontal, Calendar, ArrowRight, Cake, Plus, Edit, Trash2, UserPlus, Shuffle, AlertTriangle, PlusCircle, MinusCircle, RefreshCw, Pause, UserMinus, ChevronDown, ChevronUp, X, DollarSign, BookOpen } from 'lucide-react';
import { Student, StudentStatus, Parent, Contract } from '../types';
import { useNavigate } from 'react-router-dom';
import { useStudents } from '../src/hooks/useStudents';
import { useParents } from '../src/hooks/useParents';
import { useClasses } from '../src/hooks/useClasses';
import { usePermissions } from '../src/hooks/usePermissions';
import { useAuth } from '../src/hooks/useAuth';
import { useContracts } from '../src/hooks/useContracts';
import { getFeedbacks, FeedbackRecord } from '../src/services/feedbackService';
import { ClassModel } from '../types';
import { createEnrollment } from '../src/services/enrollmentService';
import { recalculateStudentStatus } from '../src/services/attendanceService';
import { ImportExportButtons } from '../components/ImportExportButtons';
import { PortalDropdown } from '../components/portal-dropdown';
import { STUDENT_FIELDS, STUDENT_MAPPING, prepareStudentExport } from '../src/utils/excelUtils';
import { getCenters, Center } from '../src/services/centerService';
import { normalizeStudentStatus } from '../src/utils/statusUtils';
import { formatDisplayDate } from '../src/utils/dateUtils';
import { getStudentSessionData } from '../src/utils/student-session-utils';
import {
  CreateStudentModal,
  EditStudentModal,
  EnrollmentModal,
  TransferSessionModal,
  TransferClassModal,
  ReserveModal,
  RemoveClassModal,
  LegacyImportModal,
} from '../src/features/students/components';
import { SearchableClassDropdown } from '../src/features/attendance';
import { ModalPortal } from '@/components/modal-portal';

// Constants for table column count
const STUDENT_TABLE_COLUMNS = {
  base: 12,
  withDropoutReason: 13
};

interface StudentManagerProps {
  initialStatusFilter?: StudentStatus;
  title?: string;
}

export const StudentManager: React.FC<StudentManagerProps> = ({ 
  initialStatusFilter, 
  title = "Danh sách học viên" 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentFeedbacks, setStudentFeedbacks] = useState<FeedbackRecord[]>([]);
  const [feedbacksLoading, setFeedbacksLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<StudentStatus | 'ALL'>(initialStatusFilter || 'ALL');
  const [filterClass, setFilterClass] = useState<string>('ALL');
  const [filterBranch, setFilterBranch] = useState<string>('ALL');
  const [centers, setCenters] = useState<Center[]>([]);
  const [birthdayMonth, setBirthdayMonth] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [assigningClasses, setAssigningClasses] = useState(false);
  const navigate = useNavigate();

  // Action modals state
  const [actionStudent, setActionStudent] = useState<Student | null>(null);
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
  const [showTransferSessionModal, setShowTransferSessionModal] = useState(false);
  const [showTransferClassModal, setShowTransferClassModal] = useState(false);
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [showRemoveClassModal, setShowRemoveClassModal] = useState(false);
  const [actionDropdownId, setActionDropdownId] = useState<string | null>(null);
  const [dropdownAnchorRect, setDropdownAnchorRect] = useState<DOMRect | null>(null);
  const [showLegacyImportModal, setShowLegacyImportModal] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkSyncing, setBulkSyncing] = useState(false);
  
  // Post-creation modal state
  const [showPostCreateModal, setShowPostCreateModal] = useState(false);
  const [newlyCreatedStudent, setNewlyCreatedStudent] = useState<Student | null>(null);

  // Expanded sections state
  const [expandedEnrollment, setExpandedEnrollment] = useState(false);
  const [expandedFinance, setExpandedFinance] = useState(false);
  const [studentEnrollments, setStudentEnrollments] = useState<any[]>([]);
  const [studentContracts, setStudentContracts] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Permissions
  const { canCreate, canEdit, canDelete, shouldHideParentPhone, shouldShowOnlyOwnClasses, staffId, isAdmin } = usePermissions();
  const { staffData } = useAuth();
  const canCreateStudent = canCreate('students');
  const canEditStudent = canEdit('students');
  const canDeleteStudent = canDelete('students');
  const hideParentPhone = shouldHideParentPhone('students');
  const onlyOwnClasses = shouldShowOnlyOwnClasses('students');

  // Fetch ALL students from Firebase (no server-side status filter to handle legacy status values like "Đã nghỉ")
  const { students: allStudents, loading, error, createStudent, updateStudent, deleteStudent } = useStudents();
  
  // Fetch parents for dropdown
  const { parents } = useParents();
  
  // Fetch classes for dropdown
  const { classes } = useClasses({});

  // Fetch all contracts for "Hợp đồng gần nhất" column
  const { contracts } = useContracts();

  // Fetch centers for branch filter
  useEffect(() => {
    const fetchCenters = async () => {
      try {
        const data = await getCenters();
        setCenters(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching centers:', err);
        setCenters([]);
      }
    };
    fetchCenters();
  }, []);

  // Fetch feedbacks when selectedStudent changes
  useEffect(() => {
    const fetchStudentFeedbacks = async () => {
      if (selectedStudent?.id) {
        setFeedbacksLoading(true);
        try {
          const feedbacks = await getFeedbacks({ studentId: selectedStudent.id });
          setStudentFeedbacks(feedbacks);
        } catch (err) {
          console.error('Error fetching feedbacks:', err);
          setStudentFeedbacks([]);
        } finally {
          setFeedbacksLoading(false);
        }
      } else {
        setStudentFeedbacks([]);
        setFeedbacksLoading(false);
      }
    };
    fetchStudentFeedbacks();
  }, [selectedStudent?.id]);

  // Filter students based on teacher's classes (if onlyOwnClasses)
  const students = useMemo(() => {
    if (!onlyOwnClasses || !staffData) return allStudents;
    // Teachers only see students from their classes
    // This requires knowledge of which classes the teacher teaches
    // For now, we'll filter on class reference if available
    return allStudents; // TODO: Implement proper class-based filtering
  }, [allStudents, onlyOwnClasses, staffData]);

  const matchesStudentFilters = (student: Student, includeStatus: boolean) => {
    if (includeStatus && filterStatus !== 'ALL') {
      const normalizedStatus = normalizeStudentStatus(student.status);
      if (normalizedStatus !== filterStatus) return false;
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        student.fullName?.toLowerCase().includes(search) ||
        student.code?.toLowerCase().includes(search) ||
        student.phone?.includes(search) ||
        student.parentName?.toLowerCase().includes(search);
      if (!matchesSearch) return false;
    }

    if (birthdayMonth) {
      const studentMonth = new Date(student.dob).getMonth() + 1;
      if (studentMonth !== parseInt(birthdayMonth)) return false;
    }

    if (filterClass === 'NO_CLASS') {
      if (student.classId || student.class) return false;
    } else if (filterClass !== 'ALL') {
      const selectedClass = classes.find(c => c.id === filterClass);
      const selectedClassName = selectedClass?.name || '';
      const normalize = (s: string) => s?.toLowerCase().replace(/\s+/g, '').trim() || '';
      const studentClassName = normalize(student.class || '');
      const targetClassName = normalize(selectedClassName);
      const matchesClass =
        student.classId === filterClass ||
        studentClassName === targetClassName ||
        (student.classIds && student.classIds.includes(filterClass));
      if (!matchesClass) return false;
    }

    if (filterBranch !== 'ALL' && student.branch !== filterBranch) return false;

    return true;
  };

  const studentsForStats = useMemo(() => {
    return students.filter(student => matchesStudentFilters(student, false));
  }, [students, searchTerm, birthdayMonth, filterClass, filterBranch, classes]);

  const filteredStudents = useMemo(() => {
    return students.filter(student => matchesStudentFilters(student, true));
  }, [students, filterStatus, searchTerm, birthdayMonth, filterClass, filterBranch, classes]);

  const pageStats = useMemo(() => {
    const stats = {
      total: studentsForStats.length,
      trial: 0,
      active: 0,
      debt: 0,
      reserved: 0,
      dropped: 0,
      expiredFee: 0,
    };

    studentsForStats.forEach(student => {
      const status = normalizeStudentStatus(student.status);
      if (status === StudentStatus.TRIAL) stats.trial++;
      else if (status === StudentStatus.ACTIVE) stats.active++;
      else if (status === StudentStatus.DEBT || status === StudentStatus.CONTRACT_DEBT) stats.debt++;
      else if (status === StudentStatus.RESERVED) stats.reserved++;
      else if (status === StudentStatus.DROPPED) stats.dropped++;
      else if (status === StudentStatus.EXPIRED_FEE) stats.expiredFee++;
    });

    return stats;
  }, [studentsForStats]);

  useEffect(() => {
    const visibleIds = new Set(filteredStudents.map(s => s.id));
    setSelectedStudentIds(prev => prev.filter(id => visibleIds.has(id)));
  }, [filteredStudents]);

  const allVisibleSelected = filteredStudents.length > 0 && selectedStudentIds.length === filteredStudents.length;

  // Map studentId → latest contract (by contractDate descending)
  const studentLatestContract = useMemo(() => {
    const map: Record<string, Contract> = {};
    // Sort contracts by contractDate descending to get latest first
    const sorted = [...contracts].sort((a, b) =>
      new Date(b.contractDate || '').getTime() - new Date(a.contractDate || '').getTime()
    );
    for (const contract of sorted) {
      if (contract.studentId && !map[contract.studentId]) {
        map[contract.studentId] = contract;
      }
    }
    return map;
  }, [contracts]);

  // Find students without class assigned
  const studentsWithoutClass = useMemo(() => {
    return students.filter(s => !s.classId && !s.class);
  }, [students]);

  // Get active classes for assignment
  const activeClasses = useMemo(() => {
    return classes.filter(c => 
      c.status === 'Đang học' || c.status === 'Chờ mở' || c.status === 'Active' || c.status === 'Pending'
    );
  }, [classes]);

  // DISABLED: Random class assignment feature - commented out per admin request
  // const handleAssignClassesRandomly = async () => { ... };

  const getStatusColor = (status: string) => {
    const normalizedStatus = normalizeStudentStatus(status);
    switch(normalizedStatus) {
      case StudentStatus.ACTIVE: return 'text-green-600 bg-green-50 ring-green-500/10';
      case StudentStatus.DEBT: return 'text-red-600 bg-red-50 ring-red-500/10';
      case StudentStatus.RESERVED: return 'text-yellow-600 bg-yellow-50 ring-yellow-500/10';
      case StudentStatus.DROPPED: return 'text-gray-600 bg-gray-50 ring-gray-500/10';
      case StudentStatus.TRIAL: return 'text-purple-600 bg-purple-50 ring-purple-500/10';
      case StudentStatus.EXPIRED_FEE: return 'text-orange-600 bg-orange-50 ring-orange-500/10';
      default: return 'text-gray-600 bg-gray-50 ring-gray-500/10';
    }
  };

  // Helper to format ISO date to DD/MM/YYYY
  const formatDob = (isoDate: string) => {
    const d = new Date(isoDate);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  };

  const handleCreateStudent = async (data: Omit<Student, 'id'>) => {
    try {
      const newStudent = await createStudent(data);
      setShowCreateModal(false);
      // Show post-creation modal with options
      if (newStudent) {
        setNewlyCreatedStudent({ ...data, id: newStudent } as Student);
        setShowPostCreateModal(true);
      }
    } catch (err) {
      console.error('Error creating student:', err);
      alert('Không thể tạo học viên. Vui lòng thử lại.');
    }
  };
  
  const handlePostCreateEnroll = () => {
    if (newlyCreatedStudent) {
      setActionStudent(newlyCreatedStudent);
      setShowPostCreateModal(false);
      setShowEnrollmentModal(true);
    }
  };
  
  const handlePostCreateContract = () => {
    if (newlyCreatedStudent) {
      setShowPostCreateModal(false);
      // Navigate to contract page with student info
      navigate(`/contracts/new?studentId=${newlyCreatedStudent.id}&studentName=${encodeURIComponent(newlyCreatedStudent.fullName || '')}`);
    }
  };

  const handleUpdateStudent = async (id: string, data: Partial<Student>) => {
    try {
      // Check if sessions changed to create enrollment record
      const oldSessions = editingStudent?.registeredSessions || 0;
      const newSessions = data.registeredSessions ?? oldSessions;
      const sessionChange = newSessions - oldSessions;

      await updateStudent(id, data);

      // Create enrollment record if sessions changed
      if (sessionChange !== 0 && editingStudent) {
        await createEnrollment({
          studentId: id,
          studentName: editingStudent.fullName,
          classId: editingStudent.classId || '',
          className: editingStudent.class || '',
          sessions: sessionChange,
          type: 'Ghi danh thủ công',
          reason: `Chỉnh sửa thủ công: ${oldSessions} → ${newSessions} buổi`,
          note: `Chỉnh sửa thủ công: ${oldSessions} → ${newSessions} buổi`,
          createdBy: staffData?.name || 'Admin',
          createdAt: new Date().toISOString(),
          createdDate: new Date().toLocaleDateString('vi-VN'),
          finalAmount: 0,
        });
      }

      setShowEditModal(false);
      setEditingStudent(null);
    } catch (err) {
      console.error('Error updating student:', err);
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'Lỗi không xác định khi cập nhật học viên.';
      alert(`Không thể cập nhật học viên: ${msg}`);
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa học viên này?')) return;

    try {
      await deleteStudent(id);
      if (selectedStudent?.id === id) {
        setSelectedStudent(null);
      }
    } catch (err) {
      console.error('Error deleting student:', err);
      alert('Không thể xóa học viên. Vui lòng thử lại.');
    }
  };

  // Recalculate student status based on attendance records
  const handleRecalculateStatus = async (student: Student) => {
    try {
      // If classId exists, use it; otherwise recalculate for all classes
      const result = await recalculateStudentStatus(student.id, student.classId);
      alert(`Đã cập nhật trạng thái:\n- Đã học: ${result.attended} buổi\n- Đăng ký: ${result.registered} buổi\n- Còn lại: ${result.remaining} buổi\n- Trạng thái: ${result.newStatus}`);
      // Refresh students list
      window.location.reload();
    } catch (err) {
      console.error('Error recalculating status:', err);
      alert('Không thể cập nhật trạng thái. Vui lòng thử lại.');
    }
  };

  // Xóa hàng loạt theo các học viên đã tick chọn
  const handleBulkDelete = async () => {
    if (selectedStudentIds.length === 0) {
      alert('Vui lòng chọn ít nhất 1 học viên để xóa.');
      return;
    }
    
    const selectedSet = new Set(selectedStudentIds);
    const studentsToDelete = filteredStudents.filter(student => selectedSet.has(student.id));
    const confirmMsg = `Bạn có chắc chắn muốn xóa ${studentsToDelete.length} học viên đã chọn?\n\nThao tác này KHÔNG THỂ hoàn tác!`;
    if (!confirm(confirmMsg)) return;
    
    setBulkDeleting(true);
    let deleted = 0;
    let failed = 0;
    
    for (const student of studentsToDelete) {
      try {
        await deleteStudent(student.id);
        deleted++;
      } catch (err) {
        console.error('Error deleting:', student.fullName, err);
        failed++;
      }
    }
    
    setBulkDeleting(false);
    if (selectedStudent && selectedSet.has(selectedStudent.id)) {
      setSelectedStudent(null);
    }
    setSelectedStudentIds([]);
    alert(`Đã xóa ${deleted} học viên.${failed > 0 ? ` Lỗi: ${failed}` : ''}`);
  };

  // Đồng bộ tính toán các trường (attended/remaining/status/classProgress) cho các học viên đã tick chọn
  const handleBulkSyncCalculatedFields = async () => {
    if (selectedStudentIds.length === 0) {
      alert('Vui lòng chọn ít nhất 1 học viên để đồng bộ.');
      return;
    }

    const confirmMsg = `Đồng bộ tính toán cho ${selectedStudentIds.length} học viên đã chọn?\n\nHệ thống sẽ tính lại: Đã điểm danh, Còn lại, Trạng thái (nếu áp dụng) theo dữ liệu điểm danh.`;
    if (!confirm(confirmMsg)) return;

    setBulkSyncing(true);
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    // Prefer to use current in-memory data to pass classId when possible
    const byId = new Map(students.map(s => [s.id, s]));

    for (const id of selectedStudentIds) {
      const s = byId.get(id);
      try {
        await recalculateStudentStatus(id, s?.classId || undefined);
        success++;
      } catch (err: any) {
        failed++;
        const name = s?.fullName || id;
        errors.push(`${name}: ${err?.message || 'Lỗi đồng bộ'}`);
        console.error('Bulk sync error:', name, err);
      }
    }

    setBulkSyncing(false);
    alert(
      `Đã đồng bộ ${success}/${selectedStudentIds.length} học viên.` +
        (failed > 0 ? `\nLỗi: ${failed}\n- ${errors.slice(0, 8).join('\n- ')}${errors.length > 8 ? '\n- ...' : ''}` : '')
    );
  };

  // Import students from Excel
  const handleImportStudents = async (data: Record<string, any>[]): Promise<{ success: number; errors: string[] }> => {
    const errors: string[] = [];
    let success = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        if (!row.fullName) {
          errors.push(`Dòng ${i + 1}: Thiếu họ tên`);
          continue;
        }

        // Parse remainingSessions (có thể âm = nợ phí)
        const remainingSessions = typeof row.remainingSessions === 'number' 
          ? row.remainingSessions 
          : parseInt(row.remainingSessions) || 0;

        // Auto-set status = 'Nợ phí' nếu số buổi còn lại < 0
        let status = row.status ? normalizeStudentStatus(row.status) : StudentStatus.ACTIVE;
        if (remainingSessions < 0) {
          status = StudentStatus.DEBT;
        }

        // Auto-match tên lớp từ Excel với lớp trong database
        // VD: "Prestarters 26" → match với "Pre Starters 26"
        const normalizeClassName = (s: string) => s?.toLowerCase().replace(/\s+/g, '').trim() || '';
        const inputClassName = normalizeClassName(row.class || '');
        let matchedClass = classes.find(c => normalizeClassName(c.name) === inputClassName);
        
        // Nếu không exact match, thử partial match
        if (!matchedClass && inputClassName) {
          matchedClass = classes.find(c => 
            normalizeClassName(c.name).includes(inputClassName) ||
            inputClassName.includes(normalizeClassName(c.name))
          );
        }

        await createStudent({
          fullName: row.fullName,
          code: row.code || `HV${Date.now()}${i}`,
          dob: row.dob || '',
          gender: row.gender || '',
          phone: row.phone || '',
          email: row.email || '',
          parentName: row.parentName || '',
          parentPhone2: row.parentPhone2 || '',
          address: row.address || '',
          branch: row.branch || '', // Cơ sở từ Excel
          class: matchedClass?.name || row.class || '', // Dùng tên chuẩn từ DB nếu match được
          classId: matchedClass?.id || '', // Lưu classId để link chính xác
          registeredSessions: typeof row.registeredSessions === 'number' ? row.registeredSessions : parseInt(row.registeredSessions) || 0,
          attendedSessions: typeof row.attendedSessions === 'number' ? row.attendedSessions : parseInt(row.attendedSessions) || 0,
          legacyAttendedSessions: typeof row.legacyAttendedSessions === 'number' ? row.legacyAttendedSessions : parseInt(row.legacyAttendedSessions) || 0,
          remainingSessions: remainingSessions,
          status: status as StudentStatus,
          note: row.note || '',
        } as any);
        success++;
      } catch (err: any) {
        errors.push(`Dòng ${i + 1} (${row.fullName}): ${err.message || 'Lỗi tạo học viên'}`);
      }
    }

    return { success, errors };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-gray-800 hidden lg:block">{title}</h2>
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Tìm tên, mã, SĐT..." 
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select 
            className="pl-2 pr-8 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as StudentStatus | 'ALL')}
            disabled={!!initialStatusFilter}
          >
            <option value="ALL">Tất cả trạng thái</option>
            {Object.values(StudentStatus).map(s => (
                <option key={s} value={s}>{s}</option>
            ))}
          </select>
          
          <select
            className="pl-2 pr-8 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm"
            value={birthdayMonth}
            onChange={(e) => setBirthdayMonth(e.target.value)}
          >
            <option value="">Tháng sinh</option>
            {Array.from({length: 12}, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>Tháng {m}</option>
            ))}
          </select>

          <SearchableClassDropdown
            classes={classes}
            filterValue={filterClass}
            onFilterChange={setFilterClass}
            hideBranchFilter
            placeholder="Gõ để tìm lớp..."
            inputClassName="min-w-[140px] max-w-[280px]"
          />

          <select
            className="pl-2 pr-8 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm min-w-[120px]"
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
          >
            <option value="ALL">Tất cả cơ sở</option>
            {centers.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>

          <ImportExportButtons
            data={students}
            prepareExport={prepareStudentExport}
            exportFileName="DanhSachHocVien"
            fields={STUDENT_FIELDS}
            mapping={STUDENT_MAPPING}
            onImport={handleImportStudents}
            templateFileName="MauNhapHocVien"
            entityName="học viên"
          />

          {/* Nút đồng bộ tính toán (bulk) */}
          {canEditStudent && (
            <button
              onClick={handleBulkSyncCalculatedFields}
              disabled={bulkSyncing || selectedStudentIds.length === 0}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-50"
              title="Tính lại Đã điểm danh/Còn lại/Trạng thái theo dữ liệu điểm danh"
            >
              <RefreshCw size={16} />
              {bulkSyncing ? 'Đang đồng bộ...' : `Đồng bộ (${selectedStudentIds.length})`}
            </button>
          )}

          {/* Nút xóa đã chọn - chỉ hiện khi có quyền xóa */}
          {canDeleteStudent && (
            <button 
              onClick={handleBulkDelete}
              disabled={bulkDeleting || selectedStudentIds.length === 0}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <Trash2 size={16} /> 
              {bulkDeleting ? 'Đang xóa...' : `Xóa đã chọn (${selectedStudentIds.length})`}
            </button>
          )}

          {canCreateStudent && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              <Plus size={16} /> Tạo mới
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => setShowLegacyImportModal(true)}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
            >
              <BookOpen size={16} /> Import buổi học cũ
            </button>
          )}
        </div>
      </div>

      {/* Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 bg-gray-50 rounded-lg border border-gray-200 divide-x divide-y sm:divide-y-0 divide-gray-200">
        <div className="flex items-center justify-center p-3">
          <span className="text-blue-600 font-bold text-sm">Tổng: {pageStats.total}</span>
        </div>
        <div className="flex items-center justify-center p-3">
          <span className="text-purple-600 font-bold text-sm">Học thử: {pageStats.trial}</span>
        </div>
        <div className="flex items-center justify-center p-3">
          <span className="text-green-600 font-bold text-sm">Đang học: {pageStats.active}</span>
        </div>
        <div className="flex items-center justify-center p-3">
          <span className="text-red-600 font-bold text-sm">Nợ phí: {pageStats.debt}</span>
        </div>
        <div className="flex items-center justify-center p-3">
          <span className="text-orange-600 font-bold text-sm">Bảo lưu: {pageStats.reserved}</span>
        </div>
        <div className="flex items-center justify-center p-3">
          <span className="text-amber-600 font-bold text-sm">Hết phí: {pageStats.expiredFee}</span>
        </div>
        <div className="flex items-center justify-center p-3">
          <span className="text-gray-500 font-bold text-sm">Nghỉ học: {pageStats.dropped}</span>
        </div>
      </div>

      {/* Data Integrity Warning */}
      {studentsWithoutClass.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-amber-500" size={20} />
              <div>
                <span className="font-semibold text-amber-800">
                  {studentsWithoutClass.length} học viên chưa được gán lớp
                </span>
                <p className="text-sm text-amber-600">
                  Tổng: {students.length} | Có lớp: {students.length - studentsWithoutClass.length} | Chưa có lớp: {studentsWithoutClass.length}
                </p>
              </div>
            </div>
            {/* DISABLED: Random class assignment button - commented out per admin request
            <button
              onClick={handleAssignClassesRandomly}
              disabled={assigningClasses}
              className="px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Shuffle size={16} />
              {assigningClasses ? 'Đang gán...' : 'Gán lớp ngẫu nhiên'}
            </button>
            */}
          </div>
        </div>
      )}

      <div className={`grid grid-cols-1 ${selectedStudent ? 'lg:grid-cols-3' : 'lg:grid-cols-1'} gap-6`}>
        {/* Student List */}
        <div className={`${selectedStudent ? 'lg:col-span-2' : 'lg:col-span-1'} bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 sticky top-0 z-10">
                <tr>
                    <th className="px-4 py-3 bg-gray-50 w-12 text-center">
                      {canDeleteStudent && (
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStudentIds(filteredStudents.map(student => student.id));
                            } else {
                              setSelectedStudentIds([]);
                            }
                          }}
                          aria-label="Chọn tất cả học viên"
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      )}
                    </th>
                    <th className="px-4 py-3 bg-gray-50 w-12">No.</th>
                    <th className="px-4 py-3 bg-gray-50">Học viên</th>
                    <th className="px-4 py-3 bg-gray-50">Phụ huynh</th>
                    <th className="px-4 py-3 bg-gray-50">Lớp học</th>
                    <th className="px-4 py-3 bg-gray-50 text-center">Đăng ký</th>
                    <th className="px-4 py-3 bg-gray-50 text-center">Đã điểm danh</th>
                    <th className="px-4 py-3 bg-gray-50 text-center">Còn lại</th>
                    <th className="px-4 py-3 bg-gray-50 text-center">Ngày BĐ</th>
                    <th className="px-4 py-3 bg-gray-50">Trạng thái</th>
                    {filterStatus === StudentStatus.DROPPED && (
                      <th className="px-4 py-3 bg-gray-50">Lý do nghỉ học</th>
                    )}
                    <th className="px-4 py-3 bg-gray-50"></th>
                </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={filterStatus === StudentStatus.DROPPED ? STUDENT_TABLE_COLUMNS.withDropoutReason : STUDENT_TABLE_COLUMNS.base} className="text-center py-10 text-gray-500">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                        Đang tải dữ liệu...
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={filterStatus === StudentStatus.DROPPED ? STUDENT_TABLE_COLUMNS.withDropoutReason : STUDENT_TABLE_COLUMNS.base} className="text-center py-10 text-red-500">
                      Lỗi: {error}
                    </td>
                  </tr>
                ) : filteredStudents.length > 0 ? filteredStudents.map((student, index) => (
                    <tr 
                    key={student.id} 
                    className={`hover:bg-indigo-50 cursor-pointer transition-colors ${selectedStudent?.id === student.id ? 'bg-indigo-50' : ''}`}
                    onClick={() => setSelectedStudent(selectedStudent?.id === student.id ? null : student)}
                    >
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      {canDeleteStudent && (
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.includes(student.id)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSelectedStudentIds(prev => {
                              if (checked) {
                                if (prev.includes(student.id)) return prev;
                                return [...prev, student.id];
                              }
                              return prev.filter(id => id !== student.id);
                            });
                          }}
                          aria-label={`Chọn học viên ${student.fullName}`}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{index + 1}</td>
                    <td className="px-4 py-3">
                        <div className="flex flex-col">
                           <span className="font-bold text-gray-800 text-[15px]">{student.fullName}</span>
                           <span className="text-sm font-bold text-red-500 font-handwriting">{formatDob(student.dob)}</span>
                        </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                        <p className="font-bold text-green-700">{student.parentName || '---'}</p>
                        {!hideParentPhone && (
                          <p className="text-gray-500 flex items-center gap-1">
                            <Phone size={10} /> {student.parentPhone || student.phone || '---'}
                          </p>
                        )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                       <p>{student.class || '---'}</p>
                    </td>
                    {(() => {
                      const { registered, attendedAll, remaining } = getStudentSessionData(student);
                      return (
                        <>
                          <td className="px-4 py-3 text-center">
                            <span className="font-semibold text-blue-600">{registered}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-semibold text-green-600">{attendedAll}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-semibold ${remaining < 0 ? 'text-red-600' : remaining <= 3 ? 'text-orange-600' : 'text-gray-700'}`}>
                              {remaining}
                            </span>
                          </td>
                        </>
                      );
                    })()}
                    <td className="px-4 py-3 text-center text-xs text-gray-600">
                       {student.startDate ? new Date(student.startDate).toLocaleDateString('vi-VN') : '---'}
                    </td>
                    <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold text-white ${
                            normalizeStudentStatus(student.status) === StudentStatus.ACTIVE ? 'bg-green-500' :
                            normalizeStudentStatus(student.status) === StudentStatus.DEBT ? 'bg-red-500' :
                            normalizeStudentStatus(student.status) === StudentStatus.RESERVED ? 'bg-yellow-500' :
                            normalizeStudentStatus(student.status) === StudentStatus.DROPPED ? 'bg-gray-500' :
                            normalizeStudentStatus(student.status) === StudentStatus.TRIAL ? 'bg-purple-500' :
                            normalizeStudentStatus(student.status) === StudentStatus.EXPIRED_FEE ? 'bg-orange-500' : 'bg-gray-400'
                        }`}>
                            {normalizeStudentStatus(student.status)}
                        </span>
                    </td>
                    {filterStatus === StudentStatus.DROPPED && (
                      <td className="px-4 py-3 text-xs text-gray-600 max-w-[200px]">
                        <div className="truncate" title={student.dropoutReason || ''}>
                          {student.dropoutReason || <span className="text-gray-400 italic">Chưa có</span>}
                        </div>
                        {student.dropoutDate && (
                          <div className="text-gray-400 text-[10px]">
                            {new Date(student.dropoutDate).toLocaleDateString('vi-VN')}
                          </div>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end relative">
                          {canEditStudent && (
                            <button 
                               onClick={(e) => { 
                                 e.stopPropagation(); 
                                 setEditingStudent(student);
                                 setShowEditModal(true);
                               }}
                               className="text-gray-400 hover:text-indigo-600 p-1"
                               title="Chỉnh sửa"
                            >
                               <Edit size={16} />
                            </button>
                          )}
                          {canDeleteStudent && (
                            <button 
                               onClick={(e) => { 
                                 e.stopPropagation(); 
                                 handleDeleteStudent(student.id);
                               }}
                               className="text-gray-400 hover:text-red-600 p-1"
                               title="Xóa"
                            >
                               <Trash2 size={16} />
                            </button>
                          )}
                          <button 
                             onClick={(e) => { e.stopPropagation(); navigate(`/customers/student-detail/${student.id}`); }}
                             className="text-gray-400 hover:text-indigo-600 p-1"
                             title="Chi tiết"
                          >
                             <ArrowRight size={18} />
                          </button>
                          {/* Action Dropdown - rendered via Portal to escape overflow-hidden */}
                          {canEditStudent && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (actionDropdownId === student.id) {
                                    setActionDropdownId(null);
                                    setDropdownAnchorRect(null);
                                  } else {
                                    setActionDropdownId(student.id);
                                    setDropdownAnchorRect(e.currentTarget.getBoundingClientRect());
                                  }
                                }}
                                className="text-gray-400 hover:text-indigo-600 p-1"
                                title="Thao tác"
                              >
                                <ChevronDown size={16} />
                              </button>
                              <PortalDropdown
                                isOpen={actionDropdownId === student.id}
                                onClose={() => { setActionDropdownId(null); setDropdownAnchorRect(null); }}
                                anchorRect={dropdownAnchorRect}
                              >
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActionStudent(student);
                                      setShowEnrollmentModal(true);
                                      setActionDropdownId(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <PlusCircle size={14} className="text-blue-500" />
                                    Thêm/Bớt buổi
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActionStudent(student);
                                      setShowTransferSessionModal(true);
                                      setActionDropdownId(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <Gift size={14} className="text-green-500" />
                                    Tặng buổi cho HV khác
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActionStudent(student);
                                      setShowTransferClassModal(true);
                                      setActionDropdownId(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <RefreshCw size={14} className="text-indigo-500" />
                                    Chuyển lớp
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActionStudent(student);
                                      setShowReserveModal(true);
                                      setActionDropdownId(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <Pause size={14} className="text-orange-500" />
                                    Bảo lưu
                                  </button>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRecalculateStatus(student);
                                      setActionDropdownId(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <RefreshCw size={14} className="text-cyan-500" />
                                    Cập nhật trạng thái
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActionStudent(student);
                                      setShowRemoveClassModal(true);
                                      setActionDropdownId(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
                                  >
                                    <UserMinus size={14} />
                                    Xóa khỏi lớp
                                  </button>
                              </PortalDropdown>
                            </>
                          )}
                        </div>
                    </td>
                    </tr>
                )) : (
                    <tr>
                        <td colSpan={filterStatus === StudentStatus.DROPPED ? STUDENT_TABLE_COLUMNS.withDropoutReason : STUDENT_TABLE_COLUMNS.base} className="text-center py-10 text-gray-500">
                            Không tìm thấy học viên nào.
                        </td>
                    </tr>
                )}
                </tbody>
            </table>
          </div>
        </div>

        {/* Student Detail & Care History Panel */}
        <div className="lg:col-span-1">
          {selectedStudent ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-100 bg-teal-50/30">
                 <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-900 text-lg">Thông tin học viên</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedStudent(null)}
                        className="text-gray-400 hover:text-gray-700 p-1 rounded-md hover:bg-white/60"
                        title="Đóng"
                        aria-label="Đóng panel thông tin học viên"
                      >
                        <X size={18} />
                      </button>
                      <button className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-white/60" title="Tùy chọn">
                        <MoreHorizontal size={18} />
                      </button>
                    </div>
                 </div>
                 
                 <div className="mb-4">
                    <h4 className="text-xl font-bold text-teal-700 mb-1">{selectedStudent.fullName}</h4>
                    <p className="text-sm text-gray-500">{selectedStudent.code} | {selectedStudent.class}</p>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="p-2 bg-white rounded border border-gray-100">
                        <p className="text-xs text-gray-400">Ngày sinh</p>
                        <p className="font-medium text-gray-800">{formatDob(selectedStudent.dob)}</p>
                    </div>
                    <div className="p-2 bg-white rounded border border-gray-100">
                        <p className="text-xs text-gray-400">Trạng thái</p>
                        <p className="font-medium text-blue-600">{normalizeStudentStatus(selectedStudent.status)}</p>
                    </div>
                 </div>

                 {/* Class Progress Display */}
                 {(() => {
                   // Use helper to get session data (reads from classProgress or fallback to legacy)
                   const { registered, attended } = getStudentSessionData(selectedStudent);
                   const classId = selectedStudent.classId;
                   const progress = classId ? selectedStudent.classProgress?.[classId] : null;
                   const makeupOwed = progress?.makeupOwed ?? 0;

                   // Only show if there's any data
                   if (registered === 0 && attended === 0) return null;

                   const percent = registered > 0 ? Math.round((attended / registered) * 100) : 0;
                   const displayPercent = Math.min(percent, 100); // Cap at 100% for progress bar
                   return (
                     <div className="mt-4 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                       <div className="flex items-center gap-2 mb-2">
                         <BookOpen size={14} className="text-indigo-600" />
                         <span className="text-xs font-semibold text-indigo-700">Tiến độ học tập</span>
                       </div>
                       <div className="flex justify-between text-sm mb-1">
                         <span className="text-gray-600">Đã học: <span className="font-bold text-green-600">{attended}</span>/{registered}</span>
                         {makeupOwed > 0 && (
                           <span className="text-orange-600 font-semibold">Nợ bù: {makeupOwed}</span>
                         )}
                       </div>
                       <div className="w-full bg-gray-200 rounded-full h-2">
                         <div
                           className={`h-2 rounded-full transition-all ${percent > 100 ? 'bg-green-500' : 'bg-indigo-500'}`}
                           style={{ width: `${displayPercent}%` }}
                         />
                       </div>
                       <p className="text-xs text-gray-500 mt-1">
                         {percent}% hoàn thành{percent > 100 && ' (vượt mức)'}
                       </p>
                     </div>
                   );
                 })()}
              </div>
              
              <div>
                 {/* Accordion Style Items */}
                 <div className="border-b border-gray-100">
                     <button 
                        onClick={() => navigate(`/customers/student-detail/${selectedStudent.id}?tab=finance`)}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                     >
                        <span className="font-semibold text-gray-700">Lịch sử ghi danh & Tài chính</span>
                        <ArrowRight size={16} className="text-gray-400" />
                     </button>
                 </div>
                 
                 <div className="p-4">
                     <h4 className="font-bold text-red-500 font-handwriting text-lg mb-3">Lịch sử chăm sóc</h4>
                     
                     <div className="space-y-4 pl-4 border-l-2 border-gray-100 ml-2">
                        {/* Loading state */}
                        {feedbacksLoading && (
                          <p className="text-sm text-gray-400 italic">Đang tải...</p>
                        )}
                        
                        {/* Feedbacks (Form khảo sát, Gọi điện) */}
                        {!feedbacksLoading && studentFeedbacks.length > 0 && studentFeedbacks.map(feedback => (
                           <div key={feedback.id} className="relative mb-6">
                              <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full ring-4 ring-white ${
                                feedback.status === 'Completed' ? 'bg-green-500' : 
                                feedback.status === 'Pending' ? 'bg-orange-500' : 'bg-gray-400'
                              }`}></div>
                              <p className="text-xs text-gray-500 font-medium mb-1">
                                {feedback.date ? new Date(feedback.date).toLocaleDateString('vi-VN') : ''} - 
                                <span className={`ml-1 ${feedback.type === 'Form' ? 'text-purple-600' : 'text-orange-600'}`}>
                                  {feedback.type === 'Form' ? 'Form khảo sát' : 'Gọi điện'}
                                </span>
                                <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${
                                  feedback.status === 'Completed' ? 'bg-green-100 text-green-700' : 
                                  feedback.status === 'Pending' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {feedback.status === 'Completed' ? 'Hoàn thành' : feedback.status === 'Pending' ? 'Cần gọi' : feedback.status}
                                </span>
                              </p>
                              <div className="text-sm text-gray-800 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                <p><span className="text-gray-500">Lớp:</span> {feedback.className}</p>
                                {feedback.averageScore && (
                                  <p><span className="text-gray-500">Điểm TB:</span> <span className="font-bold text-indigo-600">{feedback.averageScore}</span></p>
                                )}
                                {feedback.notes && <p className="mt-1 text-gray-600">{feedback.notes}</p>}
                              </div>
                           </div>
                        ))}
                        
                        {/* Care History */}
                        {selectedStudent.careHistory && selectedStudent.careHistory.length > 0 && selectedStudent.careHistory.map(log => (
                           <div key={log.id} className="relative mb-6">
                              <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-teal-500 ring-4 ring-white"></div>
                              <p className="text-xs text-gray-500 font-medium mb-1">{log.date} - <span className="text-teal-600">{log.type}</span></p>
                              <p className="text-sm text-gray-800 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                {log.content}
                              </p>
                              <p className="text-[10px] text-gray-400 mt-1 text-right">Người tạo: {log.staff}</p>
                           </div>
                        ))}
                        
                        {/* Empty state */}
                        {!feedbacksLoading && studentFeedbacks.length === 0 && (!selectedStudent.careHistory || selectedStudent.careHistory.length === 0) && (
                            <p className="text-sm text-gray-400 italic">Chưa có lịch sử chăm sóc</p>
                        )}
                     </div>
                 </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Create Student Modal */}
      {showCreateModal && (
        <CreateStudentModal
          parents={parents}
          classes={classes}
          centers={centers}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateStudent}
        />
      )}

      {/* Post-Creation Options Modal */}
      {showPostCreateModal && newlyCreatedStudent && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <User className="text-white" size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Tạo học viên thành công!</h3>
                  <p className="text-sm text-green-600">{newlyCreatedStudent.fullName}</p>
                </div>
              </div>
            </div>
            
            <div className="p-5">
              <p className="text-gray-600 mb-4">Bạn muốn tiếp tục với học viên này như thế nào?</p>
              
              <div className="space-y-3">
                {/* Option 1: Ghi danh thủ công */}
                <button
                  onClick={handlePostCreateEnroll}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-200">
                      <UserPlus className="text-indigo-600" size={20} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Ghi danh thủ công</p>
                      <p className="text-sm text-gray-500">Thêm buổi học, chọn lớp, ngày bắt đầu</p>
                    </div>
                  </div>
                </button>
                
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => { setShowPostCreateModal(false); setNewlyCreatedStudent(null); }}
                className="w-full px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
              >
                Để sau
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Edit Student Modal */}
      {showEditModal && editingStudent && (
        <EditStudentModal
          student={editingStudent}
          centers={centers}
          isAdmin={isAdmin}
          onClose={() => {
            setShowEditModal(false);
            setEditingStudent(null);
          }}
          onSubmit={(data) => handleUpdateStudent(editingStudent.id, data)}
        />
      )}

      {/* Enrollment Modal - Thêm/Bớt buổi */}
      {showEnrollmentModal && actionStudent && (
        <EnrollmentModal
          student={actionStudent}
          staffData={staffData}
          onClose={() => {
            setShowEnrollmentModal(false);
            setActionStudent(null);
          }}
          onSubmit={async (data) => {
            await updateStudent(actionStudent.id, {
              registeredSessions: data.newSessions
            });
            await createEnrollment({
              studentId: actionStudent.id,
              studentName: actionStudent.fullName,
              classId: actionStudent.classId || '',
              className: actionStudent.class || '',
              sessions: data.change,
              type: 'Ghi danh thủ công',
              reason: data.note,
              note: data.note,
              createdBy: staffData?.name || 'Admin',
              createdAt: new Date().toISOString(),
              createdDate: new Date().toLocaleDateString('vi-VN'),
              finalAmount: 0,
            });
            setShowEnrollmentModal(false);
            setActionStudent(null);
          }}
        />
      )}

      {/* Transfer Session Modal - Tặng buổi cho HV khác */}
      {showTransferSessionModal && actionStudent && (
        <TransferSessionModal
          student={actionStudent}
          allStudents={allStudents}
          staffData={staffData}
          onClose={() => {
            setShowTransferSessionModal(false);
            setActionStudent(null);
          }}
          onSubmit={async (data) => {
            // Trừ buổi người cho
            await updateStudent(actionStudent.id, {
              registeredSessions: (actionStudent.registeredSessions || 0) - data.sessions
            });
            // Cộng buổi người nhận
            await updateStudent(data.targetStudentId, {
              registeredSessions: (data.targetSessions || 0) + data.sessions
            });
            // Log enrollment cho người cho (trừ)
            await createEnrollment({
              studentId: actionStudent.id,
              studentName: actionStudent.fullName,
              classId: actionStudent.classId || '',
              className: actionStudent.class || '',
              sessions: -data.sessions,
              type: 'Tặng buổi',
              reason: `Tặng ${data.sessions} buổi cho ${data.targetStudentName}. ${data.note}`,
              note: `Tặng ${data.sessions} buổi cho ${data.targetStudentName}. ${data.note}`,
              createdBy: staffData?.name || 'Admin',
              createdAt: new Date().toISOString(),
              createdDate: new Date().toLocaleDateString('vi-VN'),
              finalAmount: 0,
            });
            // Log enrollment cho người nhận (cộng)
            await createEnrollment({
              studentId: data.targetStudentId,
              studentName: data.targetStudentName,
              classId: data.targetClassId || '',
              className: data.targetClassName || '',
              sessions: data.sessions,
              type: 'Nhận tặng buổi',
              reason: `Nhận ${data.sessions} buổi từ ${actionStudent.fullName}. ${data.note}`,
              note: `Nhận ${data.sessions} buổi từ ${actionStudent.fullName}. ${data.note}`,
              createdBy: staffData?.name || 'Admin',
              createdAt: new Date().toISOString(),
              createdDate: new Date().toLocaleDateString('vi-VN'),
              finalAmount: 0,
            });
            setShowTransferSessionModal(false);
            setActionStudent(null);
          }}
        />
      )}

      {/* Transfer Class Modal - Chuyển lớp */}
      {showTransferClassModal && actionStudent && (
        <TransferClassModal
          student={actionStudent}
          classes={activeClasses}
          staffData={staffData}
          onClose={() => {
            setShowTransferClassModal(false);
            setActionStudent(null);
          }}
          onSubmit={async (data) => {
            const oldClass = actionStudent.class || '';
            const oldClassId = actionStudent.classId;

            // Archive lớp cũ vào classProgress (giữ lịch sử)
            const oldProgress = oldClassId && actionStudent.classProgress?.[oldClassId]
              ? actionStudent.classProgress[oldClassId]
              : {
                  registeredSessions: actionStudent.registeredSessions || 0,
                  attendedSessions: actionStudent.attendedSessions || 0,
                  absentSessions: 0,
                  makeupOwed: 0,
                  makeupDone: 0,
                  reservedSessions: 0
                };

            // Build classProgress mới: giữ lớp cũ + init lớp mới với 0 buổi đã học
            const newClassProgress = {
              ...actionStudent.classProgress,
              ...(oldClassId ? { [oldClassId]: oldProgress } : {}),
              [data.newClassId]: {
                registeredSessions: data.sessions,
                attendedSessions: 0,  // RESET - đây là fix chính!
                absentSessions: 0,
                makeupOwed: 0,
                makeupDone: 0,
                reservedSessions: 0
              }
            };

            await updateStudent(actionStudent.id, {
              classId: data.newClassId,
              class: data.newClassName,
              registeredSessions: data.sessions,
              attendedSessions: 0,               // RESET legacy field cho backward compat
              classProgress: newClassProgress    // Single source of truth
            });
            // Log enrollment
            await createEnrollment({
              studentId: actionStudent.id,
              studentName: actionStudent.fullName,
              classId: data.newClassId,
              className: data.newClassName,
              sessions: data.sessions,
              type: 'Chuyển lớp',
              reason: `Chuyển từ ${oldClass} sang ${data.newClassName}. ${data.note}`,
              note: `Chuyển từ ${oldClass} sang ${data.newClassName}. ${data.note}`,
              createdBy: staffData?.name || 'Admin',
              createdAt: new Date().toISOString(),
              createdDate: new Date().toLocaleDateString('vi-VN'),
              finalAmount: 0,
            });
            setShowTransferClassModal(false);
            setActionStudent(null);
          }}
        />
      )}

      {/* Reserve Modal - Bảo lưu */}
      {showReserveModal && actionStudent && (
        <ReserveModal
          student={actionStudent}
          staffData={staffData}
          onClose={() => {
            setShowReserveModal(false);
            setActionStudent(null);
          }}
          onSubmit={async (data) => {
            const { remaining } = getStudentSessionData(actionStudent);
            await updateStudent(actionStudent.id, {
              status: StudentStatus.RESERVED,
              reserveDate: data.reserveDate,
              reserveNote: data.note,
              reserveSessions: remaining
            });
            setShowReserveModal(false);
            setActionStudent(null);
          }}
        />
      )}

      {/* Remove From Class Modal - Xóa khỏi lớp */}
      {showRemoveClassModal && actionStudent && (
        <RemoveClassModal
          student={actionStudent}
          staffData={staffData}
          onClose={() => {
            setShowRemoveClassModal(false);
            setActionStudent(null);
          }}
          onSubmit={async (data) => {
            try {
              const oldClass = actionStudent.class || '';
              const updateData: Record<string, any> = {
                classId: '',
                class: '',
                status: data.newStatus
              };
              // Nếu nghỉ học, lưu lý do và ngày nghỉ
              if (data.newStatus === StudentStatus.DROPPED) {
                updateData.dropoutReason = data.note || '';
                updateData.dropoutDate = new Date().toISOString();
              }

              await updateStudent(actionStudent.id, updateData);

              // Log
              await createEnrollment({
                studentId: actionStudent.id,
                studentName: actionStudent.fullName,
                classId: '',
                className: '',
                sessions: 0,
                type: 'Xóa khỏi lớp',
                reason: `Xóa khỏi lớp ${oldClass}. ${data.note}`,
                note: `Xóa khỏi lớp ${oldClass}. ${data.note}`,
                createdBy: staffData?.name || 'Admin',
                createdAt: new Date().toISOString(),
                createdDate: new Date().toLocaleDateString('vi-VN'),
                finalAmount: 0,
              });

              setShowRemoveClassModal(false);
              setActionStudent(null);
            } catch (err) {
              console.error('[RemoveClassModal] Error:', err);
              const msg =
                err instanceof Error
                  ? err.message
                  : typeof err === 'string'
                    ? err
                    : 'Lỗi không xác định';
              alert(`Không thể lưu thay đổi: ${msg}`);
            }
          }}
        />
      )}


      {/* Legacy Import Modal - admin only */}
      {showLegacyImportModal && (
        <LegacyImportModal
          onClose={() => setShowLegacyImportModal(false)}
          onComplete={() => {
            setShowLegacyImportModal(false);
          }}
        />
      )}
    </div>
  );
};
