import { collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, writeBatch, runTransaction, arrayUnion, Timestamp, db } from '@/src/utils/legacyFirestoreStub';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ClipboardList, CheckCircle, XCircle, BarChart2, X, Eye, FileDown, Trash2, AlertTriangle, Edit3, Save, Clock, History } from 'lucide-react';
import { ModalPortal } from '@/components/modal-portal';
import { useClasses } from '../src/hooks/useClasses';
import { useAttendance } from '../src/hooks/useAttendance';
import { usePermissions } from '../src/hooks/usePermissions';
import { useAuth } from '../src/hooks/useAuth';
import { useStudents } from '../src/hooks/useStudents';
import { useStaff } from '../src/hooks/useStaff';
import { useHolidays } from '../src/hooks/useHolidays';
import { AttendanceRecord, AttendanceStatus, StudentAttendance, Holiday } from '../types';
import * as XLSX from 'xlsx';

const RECORDS_PER_PAGE = 10;

// Edit permission time limits (in hours)
// Edit permission time limits removed - all roles can edit at any time

interface EditingStudent {
  id: string;
  studentId: string;
  studentName: string;
  originalStatus: AttendanceStatus;
  newStatus: AttendanceStatus;
  reason: string;
}

export const AttendanceHistory: React.FC = () => {
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  
  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [editingStudent, setEditingStudent] = useState<EditingStudent | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editedAttendance, setEditedAttendance] = useState<StudentAttendance[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  
  // Audit log states
  const [detailTab, setDetailTab] = useState<'students' | 'history'>('students');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterClass, setFilterClass] = useState<string>('');
  const [filterTeacher, setFilterTeacher] = useState<string>('');
  const [filterStudent, setFilterStudent] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterFromDate, setFilterFromDate] = useState<string>('');
  const [filterToDate, setFilterToDate] = useState<string>('');
  const [showOnlyValid, setShowOnlyValid] = useState(true);
  const [deletingOrphans, setDeletingOrphans] = useState(false);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [editRecordAfterLoadId, setEditRecordAfterLoadId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filteredAttendanceIds, setFilteredAttendanceIds] = useState<string[] | null>(null);
  const [filterLoading, setFilterLoading] = useState(false);
  const [filterStatusCounts, setFilterStatusCounts] = useState<Record<string, number>>({});
  const [studentSearch, setStudentSearch] = useState('');
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const studentDropdownRef = useRef<HTMLDivElement>(null);
  
  // Permissions
  const { shouldShowOnlyOwnClasses, staffId, canDelete } = usePermissions();
  const { staffData } = useAuth();
  const onlyOwnClasses = shouldShowOnlyOwnClasses('attendance_history');
  const canDeleteAttendanceHistory = canDelete('attendance_history');

  const { classes: allClasses } = useClasses({});
  const { students: allStudents } = useStudents({});
  const { staff: allStaff } = useStaff();
  const { holidays } = useHolidays();

  // Helper: Check if a date is a holiday for a specific class
  const getHolidayForDate = (dateStr: string, classId?: string): Holiday | null => {
    if (!holidays.length) return null;

    // Normalize date format (handle both YYYY-MM-DD and DD/MM/YYYY)
    const normalizedDate = dateStr.includes('/')
      ? dateStr.split('/').reverse().join('-')
      : dateStr;

    for (const holiday of holidays) {
      if (holiday.status !== 'Đã áp dụng') continue;

      // Check if date falls within holiday range
      const start = holiday.startDate;
      const end = holiday.endDate || holiday.startDate;
      if (normalizedDate < start || normalizedDate > end) continue;

      // Check apply type
      if (holiday.applyType === 'all_classes' || holiday.applyType === 'all_branches') {
        return holiday;
      }

      // For specific classes, check if this class is affected
      if (holiday.applyType === 'specific_classes' && classId) {
        if (holiday.classIds?.includes(classId)) {
          return holiday;
        }
      }

      // For specific branch, check class branch
      if (holiday.applyType === 'specific_branch' && classId) {
        const classInfo = allClasses.find(c => c.id === classId);
        if (classInfo?.branch === holiday.branch) {
          return holiday;
        }
      }
    }

    return null;
  };
  const { 
    attendanceRecords: allRecords, 
    loading, 
    studentAttendance, 
    loadStudentAttendance,
    deleteAttendance,
    refresh: refreshAttendance
  } = useAttendance({});

  // Get teachers from staff (role Giáo viên or Trợ giảng)
  const teachers = useMemo(() => {
    return allStaff.filter(s => 
      s.position?.toLowerCase().includes('giáo viên') ||
      s.position?.toLowerCase().includes('trợ giảng') ||
      s.role === 'Giáo viên'
    );
  }, [allStaff]);

  // Filter classes for teachers
  const classes = useMemo(() => {
    if (!onlyOwnClasses || !staffData) return allClasses;
    const myName = staffData.name;
    const myId = staffData.id || staffId;
    return allClasses.filter(cls => 
      cls.teacher === myName || 
      cls.teacherId === myId ||
      cls.assistant === myName ||
      cls.assistantId === myId
    );
  }, [allClasses, onlyOwnClasses, staffData, staffId]);

  // Count orphaned records
  const orphanedRecords = useMemo(() => {
    return allRecords.filter(r => !allClasses.some(c => c.id === r.classId));
  }, [allRecords, allClasses]);

  // Filter attendance records for teachers
  const attendanceRecords = useMemo(() => {
    let records = allRecords;
    
    // Filter out orphaned records (classId doesn't exist in classes)
    if (showOnlyValid) {
      records = records.filter(r => allClasses.some(c => c.id === r.classId));
    }
    
    // Filter by permission
    if (onlyOwnClasses && staffData) {
      const myClassIds = classes.map(c => c.id);
      const myClassNames = classes.map(c => c.name);
      records = records.filter(r => myClassIds.includes(r.classId) || myClassNames.includes(r.className));
    }
    
    // Filter by class
    if (filterClass) {
      records = records.filter(r => r.classId === filterClass || r.className === filterClass);
    }
    
    // Filter by teacher
    if (filterTeacher) {
      const teacherClasses = allClasses.filter(c => 
        c.teacher === filterTeacher || 
        c.teacherId === filterTeacher ||
        c.assistant === filterTeacher ||
        c.assistantId === filterTeacher
      );
      const teacherClassIds = teacherClasses.map(c => c.id);
      records = records.filter(r => teacherClassIds.includes(r.classId));
    }
    
    // Filter by date range
    if (filterFromDate) {
      records = records.filter(r => {
        const recordDate = r.date?.includes('/') 
          ? r.date.split('/').reverse().join('-') 
          : r.date;
        return recordDate >= filterFromDate;
      });
    }
    if (filterToDate) {
      records = records.filter(r => {
        const recordDate = r.date?.includes('/') 
          ? r.date.split('/').reverse().join('-') 
          : r.date;
        return recordDate <= filterToDate;
      });
    }

    // Filter by student or status (from studentAttendance query)
    if (filteredAttendanceIds !== null) {
      records = records.filter(r => filteredAttendanceIds.includes(r.id));
    }
    
    // Sort by date descending
    records.sort((a, b) => {
      const dateA = a.date?.includes('/') ? a.date.split('/').reverse().join('-') : a.date || '';
      const dateB = b.date?.includes('/') ? b.date.split('/').reverse().join('-') : b.date || '';
      return dateB.localeCompare(dateA);
    });
    
    return records;
  }, [allRecords, allClasses, onlyOwnClasses, staffData, classes, filterClass, filterTeacher, filterFromDate, filterToDate, showOnlyValid, filteredAttendanceIds]);

  // Pagination
  const totalPages = Math.ceil(attendanceRecords.length / RECORDS_PER_PAGE);
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * RECORDS_PER_PAGE;
    return attendanceRecords.slice(start, start + RECORDS_PER_PAGE);
  }, [attendanceRecords, currentPage]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterClass, filterTeacher, filterStudent, filterStatus, filterFromDate, filterToDate]);

  // Get holidays within filter date range (to show blocked dates that won't have records)
  const holidaysInRange = useMemo(() => {
    if (!holidays.length) return [];

    // Only show if date filter is applied
    if (!filterFromDate && !filterToDate) return [];

    const fromDate = filterFromDate || '2000-01-01';
    const toDate = filterToDate || '2100-12-31';

    return holidays.filter(holiday => {
      if (holiday.status !== 'Đã áp dụng') return false;

      // Check if holiday overlaps with filter range
      const holidayStart = holiday.startDate;
      const holidayEnd = holiday.endDate || holiday.startDate;

      // Holiday overlaps if: holidayStart <= toDate AND holidayEnd >= fromDate
      if (holidayStart > toDate || holidayEnd < fromDate) return false;

      // If filtering by class, only show holidays that affect that class
      if (filterClass) {
        if (holiday.applyType === 'all_classes' || holiday.applyType === 'all_branches') {
          return true;
        }
        if (holiday.applyType === 'specific_classes') {
          return holiday.classIds?.includes(filterClass);
        }
        if (holiday.applyType === 'specific_branch') {
          const classInfo = allClasses.find(c => c.id === filterClass);
          return classInfo?.branch === holiday.branch;
        }
        return false;
      }

      return true;
    }).sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [holidays, filterFromDate, filterToDate, filterClass, allClasses]);

  // Sorted students list: Đang học first, then Nghỉ học, sorted by name
  const sortedStudents = useMemo(() => {
    const statusOrder: Record<string, number> = {
      'Đang học': 0,
      'Học thử': 1,
      'Nợ phí': 2,
      'Bảo lưu': 3,
      'Nghỉ học': 4,
    };
    return [...allStudents]
      .sort((a, b) => {
        const orderA = statusOrder[a.status] ?? 3;
        const orderB = statusOrder[b.status] ?? 3;
        if (orderA !== orderB) return orderA - orderB;
        return (a.fullName || '').localeCompare(b.fullName || '');
      });
  }, [allStudents]);

  // Filtered students by search
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return sortedStudents;
    const term = studentSearch.toLowerCase();
    return sortedStudents.filter(s => 
      s.fullName?.toLowerCase().includes(term) || 
      s.code?.toLowerCase().includes(term)
    );
  }, [sortedStudents, studentSearch]);

  // Get selected student name
  const selectedStudentName = useMemo(() => {
    if (!filterStudent) return '';
    const student = allStudents.find(s => s.id === filterStudent);
    return student ? `${student.fullName} - ${student.code || ''}` : '';
  }, [filterStudent, allStudents]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (studentDropdownRef.current && !studentDropdownRef.current.contains(e.target as Node)) {
        setShowStudentDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clear all filters
  const clearAllFilters = () => {
    setFilterClass('');
    setFilterTeacher('');
    setFilterStudent('');
    setFilterStatus('');
    setFilterFromDate('');
    setFilterToDate('');
    setStudentSearch('');
  };

  const hasActiveFilters = filterClass || filterTeacher || filterStudent || filterStatus || filterFromDate || filterToDate;

  // Query studentAttendance when student or status filter changes
  useEffect(() => {
    const queryStudentAttendance = async () => {
      if (!filterStudent && !filterStatus) {
        setFilteredAttendanceIds(null);
        setFilterStatusCounts({});
        return;
      }

      setFilterLoading(true);
      try {
        let q = query(collection(null as any /* firebase removed */, 'studentAttendance'));

        // Build query constraints
        const constraints: any[] = [];
        if (filterStudent) {
          constraints.push(where('studentId', '==', filterStudent));
        }
        // Note: Status filter needs to match exact status values from database
        // AttendanceStatus values: 'Đúng giờ', 'Trễ giờ', 'Vắng', 'Bảo lưu', 'Đã bồi'
        if (filterStatus) {
          constraints.push(where('status', '==', filterStatus));
        }

        if (constraints.length > 0) {
          q = query(collection(null as any /* firebase removed */, 'studentAttendance'), ...constraints);
        }

        const snapshot = await getDocs(q);

        // Count students per attendanceId when filtering by status
        const counts: Record<string, number> = {};
        const attendanceIds = new Set<string>();

        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.attendanceId) {
            attendanceIds.add(data.attendanceId);
            if (filterStatus) {
              counts[data.attendanceId] = (counts[data.attendanceId] || 0) + 1;
            }
          }
        });

        setFilteredAttendanceIds([...attendanceIds]);
        setFilterStatusCounts(counts);
      } catch (error) {
        console.error('Error querying studentAttendance:', error);
        // On error, don't filter (show all records)
        setFilteredAttendanceIds(null);
        setFilterStatusCounts({});
      } finally {
        setFilterLoading(false);
      }
    };

    queryStudentAttendance();
  }, [filterStudent, filterStatus]);

  const exportDetailToExcel = () => {
    if (!selectedRecord || studentAttendance.length === 0) return;
    
    const data = studentAttendance.map((sa, index) => ({
      STT: index + 1,
      'Học viên': sa.studentName,
      'Mã HV': sa.studentCode,
      'Trạng thái': sa.status,
      'Ghi chú': sa.note || '',
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Điểm danh');
    XLSX.writeFile(wb, `DiemDanh_${selectedRecord.className}_${selectedRecord.date.replace(/\//g, '-')}.xlsx`);
  };

  // Load detail when viewing
  const handleViewDetail = async (record: AttendanceRecord) => {
    setSelectedRecord(record);
    await loadStudentAttendance(record.id);
    setShowDetailModal(true);
    setIsEditing(false);
    setEditedAttendance([]);
    setDetailTab('students');
    setAuditLogs([]);
  };

  const handleEditRecord = async (record: AttendanceRecord) => {
    setSelectedRecord(record);
    setEditRecordAfterLoadId(record.id);
    await loadStudentAttendance(record.id);
    setShowDetailModal(true);
    setIsEditing(false);
    setEditedAttendance([]);
    setDetailTab('students');
    setAuditLogs([]);
  };

  useEffect(() => {
    if (!editRecordAfterLoadId || selectedRecord?.id !== editRecordAfterLoadId || studentAttendance.length === 0) {
      return;
    }

    setIsEditing(true);
    setEditedAttendance([...studentAttendance]);
    setEditRecordAfterLoadId(null);
  }, [editRecordAfterLoadId, selectedRecord, studentAttendance]);

  // Load audit logs for attendance record
  const loadAuditLogs = async (attendanceId: string) => {
    setLoadingLogs(true);
    try {
      const q = query(
        collection(null as any /* firebase removed */, 'attendanceAuditLog'),
        where('attendanceId', '==', attendanceId)
      );
      const snapshot = await getDocs(q);
      const logs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => (b.editedAt || '').localeCompare(a.editedAt || ''));
      setAuditLogs(logs);
    } catch (error) {
      console.error('Error loading audit logs:', error);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Handle tab change
  const handleTabChange = (tab: 'students' | 'history') => {
    setDetailTab(tab);
    if (tab === 'history' && selectedRecord && auditLogs.length === 0) {
      loadAuditLogs(selectedRecord.id);
    }
  };


  // Check if user can edit this attendance record
  const canEditAttendance = (_record: AttendanceRecord): { canEdit: boolean; reason?: string } => {
    return { canEdit: true };
  };

  // Start editing
  const handleStartEdit = () => {
    if (!selectedRecord) return;
    
    const permission = canEditAttendance(selectedRecord);
    if (!permission.canEdit) {
      alert(permission.reason);
      return;
    }
    
    setIsEditing(true);
    setEditedAttendance([...studentAttendance]);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedAttendance([]);
    setEditingStudent(null);
  };

  // Open edit modal for a student
  const handleEditStudent = (sa: StudentAttendance) => {
    setEditingStudent({
      id: sa.id || '',
      studentId: sa.studentId,
      studentName: sa.studentName,
      originalStatus: sa.status,
      newStatus: sa.status,
      reason: '',
    });
    setShowEditModal(true);
  };

  // Confirm edit for single student
  const handleConfirmEdit = () => {
    if (!editingStudent || !editingStudent.reason.trim()) {
      alert('Vui lòng nhập lý do chỉnh sửa');
      return;
    }
    
    // Update in editedAttendance
    setEditedAttendance(prev => prev.map(sa => 
      sa.studentId === editingStudent.studentId 
        ? { ...sa, status: editingStudent.newStatus, editReason: editingStudent.reason }
        : sa
    ));
    
    setShowEditModal(false);
    setEditingStudent(null);
  };

  // Save all edits
  const handleSaveEdits = async () => {
    if (!selectedRecord || editedAttendance.length === 0) return;
    
    // Find changed records (compare by studentId, not index)
    const changes = editedAttendance.filter((edited) => {
      const original = studentAttendance.find(sa => sa.studentId === edited.studentId);
      return original && edited.status !== original.status;
    });
    
    if (changes.length === 0) {
      alert('Không có thay đổi nào để lưu');
      setIsEditing(false);
      return;
    }
    
    // Check all changes have reasons
    const missingReasons = changes.filter(c => !(c as any).editReason);
    if (missingReasons.length > 0) {
      alert('Vui lòng nhập lý do cho tất cả các thay đổi');
      return;
    }
    
    setSavingEdit(true);
    try {
      // Update each changed student attendance record
      for (const change of changes) {
        const original = studentAttendance.find(sa => sa.studentId === change.studentId);
        if (!original) {
          console.error('Original not found for studentId:', change.studentId);
          continue;
        }
        
        // Use original's ID if change doesn't have one
        const docId = change.id || original.id;
        if (!docId) {
          console.error('No document ID found for student:', change.studentName);
          continue;
        }
        
        // Update studentAttendance document
        const docRef = doc(null as any /* firebase removed */, 'studentAttendance', docId);
        await updateDoc(docRef, {
          status: change.status,
          updatedAt: new Date().toISOString(),
          updatedBy: staffData?.name || 'Unknown',
        });
        
        // Create audit log
        await addDoc(collection(null as any /* firebase removed */, 'attendanceAuditLog'), {
          attendanceId: selectedRecord.id,
          studentAttendanceId: docId,
          studentId: change.studentId,
          studentName: change.studentName,
          classId: selectedRecord.classId,
          className: selectedRecord.className,
          date: selectedRecord.date,
          oldStatus: original.status,
          newStatus: change.status,
          reason: (change as any).editReason,
          editedBy: staffData?.name || 'Unknown',
          editedByUid: staffData?.id || '',
          editedAt: new Date().toISOString(),
        });
      }
      
      // Update attendance record summary
      const present = editedAttendance.filter(s => 
        s.status === AttendanceStatus.ON_TIME || s.status === AttendanceStatus.LATE
      ).length;
      const absent = editedAttendance.filter(s => s.status === AttendanceStatus.ABSENT).length;
      
      const attendanceDocRef = doc(null as any /* firebase removed */, 'attendance', selectedRecord.id);
      await updateDoc(attendanceDocRef, {
        present,
        absent,
        updatedAt: new Date().toISOString(),
      });
      
      // Reload data
      await loadStudentAttendance(selectedRecord.id);
      await refreshAttendance();
      
      setIsEditing(false);
      setEditedAttendance([]);
      alert(`Đã lưu ${changes.length} thay đổi thành công!`);
    } catch (error) {
      console.error('Error saving edits:', error);
      alert('Lỗi khi lưu thay đổi. Vui lòng thử lại.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete orphaned records (records with classId that doesn't exist)
  const handleDeleteOrphans = async () => {
    if (!window.confirm(`Bạn có chắc muốn xóa ${orphanedRecords.length} bản ghi rác?\n\nĐây là các bản ghi điểm danh có classId không tồn tại trong danh sách lớp hiện tại.`)) {
      return;
    }
    
    setDeletingOrphans(true);
    try {
      let deleted = 0;
      for (const record of orphanedRecords) {
        await deleteAttendance(record.id);
        deleted++;
        if (deleted % 10 === 0) {
          console.log(`Deleted ${deleted}/${orphanedRecords.length} orphaned records...`);
        }
      }
      alert(`Đã xóa thành công ${deleted} bản ghi rác!`);
      await refreshAttendance();
    } catch (error) {
      console.error('Error deleting orphaned records:', error);
      alert('Có lỗi khi xóa bản ghi. Vui lòng thử lại.');
    } finally {
      setDeletingOrphans(false);
    }
  };

  // Delete ALL records (for clean start)
  const handleDeleteAll = async () => {
    if (!window.confirm(`⚠️ CẢNH BÁO: Bạn có chắc muốn xóa TẤT CẢ ${allRecords.length} bản ghi điểm danh?\n\nHành động này KHÔNG THỂ hoàn tác!`)) {
      return;
    }
    if (!window.confirm(`Xác nhận lần cuối: Xóa ${allRecords.length} bản ghi?`)) {
      return;
    }
    
    setDeletingOrphans(true);
    try {
      let deleted = 0;
      for (const record of allRecords) {
        await deleteAttendance(record.id);
        deleted++;
        if (deleted % 20 === 0) {
          console.log(`Deleted ${deleted}/${allRecords.length} records...`);
        }
      }
      alert(`Đã xóa thành công ${deleted} bản ghi!`);
      await refreshAttendance();
    } catch (error) {
      console.error('Error deleting all records:', error);
      alert('Có lỗi khi xóa bản ghi. Vui lòng thử lại.');
    } finally {
      setDeletingOrphans(false);
    }
  };

  const handleDeleteRecord = async (record: AttendanceRecord) => {
    const className = record.className || 'lop nay';
    const date = record.date || 'ngay nay';
    if (!window.confirm(`Xoa dong diem danh cua "${className}" ngay ${date}?`)) {
      return;
    }

    setDeletingRecordId(record.id);
    try {
      await deleteAttendance(record.id);
      if (selectedRecord?.id === record.id) {
        setShowDetailModal(false);
        setSelectedRecord(null);
        handleCancelEdit();
      }
      await refreshAttendance();
    } catch (error) {
      console.error('Error deleting attendance record:', error);
      alert('Khong the xoa dong diem danh. Vui long thu lai.');
    } finally {
      setDeletingRecordId(null);
    }
  };

  // Calculate stats from Firebase data
  const totalPresent = attendanceRecords.reduce((sum, r) => sum + (r.present || 0), 0);
  const totalStudents = attendanceRecords.reduce((sum, r) => sum + (r.totalStudents || 0), 0);
  const totalAbsent = attendanceRecords.reduce((sum, r) => sum + (r.absent || 0), 0);
  const totalReserved = attendanceRecords.reduce((sum, r) => sum + (r.reserved || 0), 0);
  const totalTutored = attendanceRecords.reduce((sum, r) => sum + (r.tutored || 0), 0);
  const attendanceRate = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0;
  const totalRecords = attendanceRecords.filter(r => r.status === 'Đã điểm danh').length;
  
  // Calculate percentages for status bar
  const getPercent = (value: number) => totalStudents > 0 ? Math.round((value / totalStudents) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-3 text-gray-600">Đang tải...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
       {/* Header with Action Button */}
       <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
         <div>
           <h2 className="text-lg font-bold text-gray-800">Lịch sử điểm danh</h2>
           <p className="text-sm text-gray-500">Xem lịch sử điểm danh các lớp học</p>
         </div>
       </div>

       {/* Status Summary Bar - 4 attendance statuses (matching AttendanceStatus enum) */}
       <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           {/* Có mặt - Present */}
           <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
             <div className="relative w-14 h-14 flex-shrink-0">
               <svg className="w-14 h-14 transform -rotate-90">
                 <circle cx="28" cy="28" r="24" stroke="#dcfce7" strokeWidth="5" fill="none" />
                 <circle 
                   cx="28" cy="28" r="24" 
                   stroke="#22c55e" strokeWidth="5" fill="none"
                   strokeDasharray={`${getPercent(totalPresent) * 1.508} 150.8`}
                   strokeLinecap="round"
                 />
               </svg>
               <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-green-600">
                 {getPercent(totalPresent)}%
               </span>
             </div>
             <div>
               <p className="text-sm font-medium text-green-800">Có mặt</p>
               <p className="text-xl font-bold text-green-600">{totalPresent}<span className="text-sm text-green-500">/{totalStudents}</span></p>
             </div>
           </div>

           {/* Vắng mặt - Absent */}
           <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
             <div className="relative w-14 h-14 flex-shrink-0">
               <svg className="w-14 h-14 transform -rotate-90">
                 <circle cx="28" cy="28" r="24" stroke="#fee2e2" strokeWidth="5" fill="none" />
                 <circle 
                   cx="28" cy="28" r="24" 
                   stroke="#ef4444" strokeWidth="5" fill="none"
                   strokeDasharray={`${getPercent(totalAbsent) * 1.508} 150.8`}
                   strokeLinecap="round"
                 />
               </svg>
               <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-red-600">
                 {getPercent(totalAbsent)}%
               </span>
             </div>
             <div>
               <p className="text-sm font-medium text-red-800">Vắng mặt</p>
               <p className="text-xl font-bold text-red-600">{totalAbsent}<span className="text-sm text-red-500">/{totalStudents}</span></p>
             </div>
           </div>

           {/* Đã bồi - Tutored */}
           <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
             <div className="relative w-14 h-14 flex-shrink-0">
               <svg className="w-14 h-14 transform -rotate-90">
                 <circle cx="28" cy="28" r="24" stroke="#dbeafe" strokeWidth="5" fill="none" />
                 <circle 
                   cx="28" cy="28" r="24" 
                   stroke="#3b82f6" strokeWidth="5" fill="none"
                   strokeDasharray={`${getPercent(totalTutored) * 1.508} 150.8`}
                   strokeLinecap="round"
                 />
               </svg>
               <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-blue-600">
                 {getPercent(totalTutored)}%
               </span>
             </div>
             <div>
               <p className="text-sm font-medium text-blue-800">Đã bồi</p>
               <p className="text-xl font-bold text-blue-600">{totalTutored}<span className="text-sm text-blue-500">/{totalStudents}</span></p>
             </div>
           </div>

           {/* Bảo lưu - Reserved */}
           <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
             <div className="relative w-14 h-14 flex-shrink-0">
               <svg className="w-14 h-14 transform -rotate-90">
                 <circle cx="28" cy="28" r="24" stroke="#f3e8ff" strokeWidth="5" fill="none" />
                 <circle 
                   cx="28" cy="28" r="24" 
                   stroke="#a855f7" strokeWidth="5" fill="none"
                   strokeDasharray={`${getPercent(totalReserved) * 1.508} 150.8`}
                   strokeLinecap="round"
                 />
               </svg>
               <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-purple-600">
                 {getPercent(totalReserved)}%
               </span>
             </div>
             <div>
               <p className="text-sm font-medium text-purple-800">Bảo lưu</p>
               <p className="text-xl font-bold text-purple-600">{totalReserved}<span className="text-sm text-purple-500">/{totalStudents}</span></p>
             </div>
           </div>
         </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg">
                    <ClipboardList size={24} />
                </div>
                <div>
                    <p className="text-sm text-gray-500 font-medium">Tổng buổi điểm danh</p>
                    <p className="text-2xl font-bold text-gray-900">{totalRecords}</p>
                </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="p-3 bg-green-100 text-green-600 rounded-lg">
                    <CheckCircle size={24} />
                </div>
                <div>
                    <p className="text-sm text-gray-500 font-medium">Tỷ lệ đi học TB</p>
                    <p className="text-2xl font-bold text-gray-900">{attendanceRate}%</p>
                </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="p-3 bg-red-100 text-red-600 rounded-lg">
                    <XCircle size={24} />
                </div>
                <div>
                    <p className="text-sm text-gray-500 font-medium">Tổng lượt vắng</p>
                    <p className="text-2xl font-bold text-gray-900">{totalAbsent}</p>
                </div>
            </div>
       </div>

      {/* Data Integrity Warning */}
      {orphanedRecords.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <h4 className="font-semibold text-red-800">Phát hiện {orphanedRecords.length} bản ghi rác!</h4>
              <p className="text-sm text-red-600 mt-1">
                Đây là các bản ghi điểm danh có classId không tồn tại trong danh sách lớp hiện tại (có thể là data test cũ hoặc lớp đã bị xóa).
              </p>
              <div className="flex gap-3 mt-3">
                <label className="flex items-center gap-2 text-sm">
                  <input 
                    type="checkbox" 
                    checked={showOnlyValid}
                    onChange={(e) => setShowOnlyValid(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span>Chỉ hiển thị bản ghi hợp lệ</span>
                </label>
                <button
                  onClick={handleDeleteOrphans}
                  disabled={deletingOrphans}
                  className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Trash2 size={14} />
                  {deletingOrphans ? 'Đang xóa...' : `Xóa ${orphanedRecords.length} bản ghi rác`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Admin Tools */}
      {allRecords.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-amber-800">
              <strong>Thống kê:</strong> Tổng: {allRecords.length} records | 
              Valid: {allRecords.filter(r => allClasses.some(c => c.id === r.classId)).length} | 
              Orphaned: {orphanedRecords.length} |
              Số lớp: {allClasses.length}
            </div>
            <button
              onClick={handleDeleteAll}
              disabled={deletingOrphans}
              className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Trash2 size={16} />
              {deletingOrphans ? 'Đang xóa...' : `Xóa tất cả ${allRecords.length} records`}
            </button>
          </div>
        </div>
      )}
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-3">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              Lịch sử điểm danh ({attendanceRecords.length} bản ghi)
              {filterLoading && <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></span>}
            </h3>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-1.5 text-sm rounded-lg border flex items-center gap-2 ${
                showFilters || hasActiveFilters 
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700' 
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <BarChart2 size={16} />
              Bộ lọc {hasActiveFilters && `(${[filterClass, filterTeacher, filterStudent, filterStatus, filterFromDate, filterToDate].filter(Boolean).length})`}
            </button>
          </div>

          {/* Quick filters: class + single date */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Lọc nhanh theo lớp</label>
              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Tất cả lớp</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Lọc nhanh theo ngày</label>
              <input
                type="date"
                value={filterFromDate && filterToDate && filterFromDate === filterToDate ? filterFromDate : ''}
                onChange={(e) => {
                  const d = e.target.value;
                  setFilterFromDate(d);
                  setFilterToDate(d);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilterClass('');
                  setFilterFromDate('');
                  setFilterToDate('');
                }}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
              >
                Xóa lọc nhanh
              </button>
            </div>
          </div>
          
          {/* Filter Panel */}
          {showFilters && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {/* Filter by Class */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Lớp học</label>
                  <select
                    value={filterClass}
                    onChange={(e) => setFilterClass(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Tất cả lớp</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Filter by Teacher */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Giáo viên</label>
                  <select
                    value={filterTeacher}
                    onChange={(e) => setFilterTeacher(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Tất cả giáo viên</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>

                {/* Filter by Student - Searchable Dropdown */}
                <div className="relative" ref={studentDropdownRef}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Học viên ({allStudents.length})</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={filterStudent ? selectedStudentName : studentSearch}
                      onChange={(e) => {
                        setStudentSearch(e.target.value);
                        setFilterStudent('');
                        setShowStudentDropdown(true);
                      }}
                      onFocus={() => setShowStudentDropdown(true)}
                      placeholder="Tìm học viên..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 pr-8"
                    />
                    {filterStudent && (
                      <button
                        onClick={() => {
                          setFilterStudent('');
                          setStudentSearch('');
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  {showStudentDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                      <div
                        className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-500"
                        onClick={() => {
                          setFilterStudent('');
                          setStudentSearch('');
                          setShowStudentDropdown(false);
                        }}
                      >
                        Tất cả học viên
                      </div>
                      {filteredStudents.length > 0 ? (
                        filteredStudents.map(s => (
                          <div
                            key={s.id}
                            className={`px-3 py-2 hover:bg-indigo-50 cursor-pointer text-sm flex justify-between items-center ${
                              filterStudent === s.id ? 'bg-indigo-100' : ''
                            }`}
                            onClick={() => {
                              setFilterStudent(s.id);
                              setStudentSearch('');
                              setShowStudentDropdown(false);
                            }}
                          >
                            <span>{s.fullName} {s.code ? `- ${s.code}` : ''}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              s.status === 'Đang học' ? 'bg-green-100 text-green-700' :
                              s.status === 'Nghỉ học' ? 'bg-red-100 text-red-700' :
                              s.status === 'Bảo lưu' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {s.status}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-gray-400">Không tìm thấy</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Filter by Status */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Trạng thái</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Tất cả trạng thái</option>
                    <option value="Đúng giờ">Đúng giờ</option>
                    <option value="Trễ giờ">Trễ giờ</option>
                    <option value="Vắng">Vắng</option>
                    <option value="Bảo lưu">Bảo lưu</option>
                    <option value="Đã bồi">Đã bồi</option>
                  </select>
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Từ ngày</label>
                  <input
                    type="date"
                    value={filterFromDate}
                    onChange={(e) => setFilterFromDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Đến ngày</label>
                  <input
                    type="date"
                    value={filterToDate}
                    onChange={(e) => setFilterToDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Clear Filters Button */}
              {hasActiveFilters && (
                <div className="flex justify-end">
                  <button
                    onClick={clearAllFilters}
                    className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                  >
                    <X size={14} />
                    Xóa tất cả bộ lọc
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Holidays in date range notice */}
        {holidaysInRange.length > 0 && (
          <div className="mx-6 mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-orange-500 flex-shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <p className="font-semibold text-orange-800 mb-2">
                  Các ngày nghỉ trong khoảng thời gian lọc ({holidaysInRange.length})
                </p>
                <p className="text-sm text-orange-700 mb-2">
                  Các ngày này không có điểm danh do đã được đăng ký là ngày nghỉ:
                </p>
                <div className="flex flex-wrap gap-2">
                  {holidaysInRange.map(holiday => (
                    <span
                      key={holiday.id}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg bg-orange-100 text-orange-800 text-sm"
                      title={`${holiday.applyType === 'all_classes' ? 'Tất cả lớp' : holiday.applyType === 'specific_classes' ? `Lớp: ${holiday.classNames?.join(', ')}` : `Cơ sở: ${holiday.branch}`}`}
                    >
                      <span className="font-medium">{holiday.name}</span>
                      <span className="mx-1.5 text-orange-400">•</span>
                      <span>{holiday.startDate}{holiday.endDate !== holiday.startDate ? ` → ${holiday.endDate}` : ''}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500">
            <tr>
              <th className="px-6 py-4">Lớp học</th>
              <th className="px-6 py-4">Ngày</th>
              <th className="px-6 py-4">Sĩ số</th>
              <th className="px-6 py-4">Hiện diện</th>
              <th className="px-6 py-4">Vắng</th>
              <th className="px-6 py-4">
                {filterStatus ? `Số HV ${filterStatus}` : 'Trạng thái'}
              </th>
              <th className="px-6 py-4 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedRecords.length > 0 ? paginatedRecords.map((record) => {
              // Handle various field name formats from Firebase
              // Lookup class name from classes collection if missing
              const classFromCollection = classes.find(c => c.id === record.classId);
              const className = record.className || (record as any).class || (record as any).classname || classFromCollection?.name || '-';
              const totalStudents = record.totalStudents || (record as any).total || 0;
              const present = record.present || (record as any).presentCount || 0;
              const absent = record.absent || (record as any).absentCount || 0;
              const status = record.status || (record as any).attendanceStatus || 'Chưa điểm danh';

              // Check if this is a holiday record (either auto-created or falls on holiday date)
              const isHolidayRecord = status === 'LỊCH NGHỈ CHUNG';
              const recordHoliday = record.date ? getHolidayForDate(record.date, record.classId) : null;
              const showAsHoliday = isHolidayRecord || recordHoliday;
              const holidayName = record.holidayName || recordHoliday?.name || '';

              return (
              <tr key={record.id} className={`hover:bg-gray-50 transition-colors ${showAsHoliday ? 'bg-orange-50' : ''}`}>
                <td className="px-6 py-4 font-medium text-gray-900">{className}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {record.date || '-'}
                    {showAsHoliday && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700" title={holidayName}>
                        LỊCH NGHỈ
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">{totalStudents}</td>
                <td className="px-6 py-4 text-green-600 font-medium">{present}</td>
                <td className="px-6 py-4 text-red-600 font-medium">{absent}</td>
                <td className="px-6 py-4">
                  {filterStatus && filterStatusCounts[record.id] ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
                      {filterStatusCounts[record.id]} học viên
                    </span>
                  ) : showAsHoliday ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                      LỊCH NGHỈ CHUNG
                    </span>
                  ) : (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium
                      ${status === 'Đã điểm danh' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}
                    `}>
                      {status}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-2">
                    {!showAsHoliday ? (
                      <>
                        <button
                          onClick={() => handleViewDetail(record)}
                          className="text-gray-500 hover:text-indigo-600 font-medium text-xs inline-flex items-center gap-1"
                        >
                          <Eye size={14} />
                          Xem
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditRecord(record)}
                          className="text-amber-600 hover:text-amber-700 font-medium text-xs inline-flex items-center gap-1"
                          title="Sua dong diem danh"
                        >
                          <Edit3 size={14} />
                          Sua
                        </button>
                      </>
                    ) : (
                      <span className="text-gray-400 text-xs">{holidayName}</span>
                    )}
                    {canDeleteAttendanceHistory && (
                      <button
                        type="button"
                        onClick={() => handleDeleteRecord(record)}
                        disabled={deletingRecordId === record.id}
                        className="text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1 text-xs font-medium"
                        title="Xoa dong diem danh"
                      >
                        <Trash2 size={14} />
                        {deletingRecordId === record.id ? 'Dang xoa...' : 'Xoa'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
            }) : (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                  Chưa có dữ liệu điểm danh
                </td>
              </tr>
            )}
          </tbody>
        </table>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Hiển thị {((currentPage - 1) * RECORDS_PER_PAGE) + 1} - {Math.min(currentPage * RECORDS_PER_PAGE, attendanceRecords.length)} / {attendanceRecords.length} bản ghi
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Trước
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let page: number;
                if (totalPages <= 5) {
                  page = i + 1;
                } else if (currentPage <= 3) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  page = totalPages - 4 + i;
                } else {
                  page = currentPage - 2 + i;
                }
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1.5 border rounded-lg text-sm ${
                      currentPage === page 
                        ? 'bg-indigo-600 text-white border-indigo-600' 
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedRecord && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-green-50 to-teal-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {isEditing ? 'Chỉnh sửa điểm danh' : 'Chi tiết điểm danh'}
                </h3>
                <p className="text-sm text-teal-600">{selectedRecord.className} - {selectedRecord.date}</p>
              </div>
              <div className="flex items-center gap-2">
                {!isEditing && canEditAttendance(selectedRecord).canEdit && studentAttendance.length > 0 && (
                  <button 
                    onClick={handleStartEdit}
                    className="flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200"
                  >
                    <Edit3 size={16} />
                    Sửa
                  </button>
                )}
                <button onClick={() => { setShowDetailModal(false); setSelectedRecord(null); handleCancelEdit(); }} className="text-gray-400 hover:text-gray-600 p-1">
                  <X size={22} />
                </button>
              </div>
            </div>

            <div className="p-5">
              {/* Edit permission info */}
              {!isEditing && !canEditAttendance(selectedRecord).canEdit && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600 flex items-center gap-2">
                  <Clock size={16} />
                  {canEditAttendance(selectedRecord).reason}
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-700">{selectedRecord.totalStudents}</p>
                  <p className="text-xs text-blue-600">Sĩ số</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-700">
                    {isEditing 
                      ? editedAttendance.filter(s => s.status === AttendanceStatus.ON_TIME || s.status === AttendanceStatus.LATE).length
                      : selectedRecord.present}
                  </p>
                  <p className="text-xs text-green-600">Có mặt</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-red-700">
                    {isEditing
                      ? editedAttendance.filter(s => s.status === AttendanceStatus.ABSENT).length
                      : selectedRecord.absent}
                  </p>
                  <p className="text-xs text-red-600">Vắng</p>
                </div>
              </div>

              {/* Tabs */}
              {!isEditing && (
                <div className="flex gap-1 mb-4 border-b">
                  <button
                    onClick={() => handleTabChange('students')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      detailTab === 'students' 
                        ? 'border-teal-500 text-teal-600' 
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Danh sách học viên
                  </button>
                  <button
                    onClick={() => handleTabChange('history')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${
                      detailTab === 'history' 
                        ? 'border-amber-500 text-amber-600' 
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <History size={16} />
                    Lịch sử sửa đổi
                  </button>
                </div>
              )}

              {/* Student List Tab */}
              {(detailTab === 'students' || isEditing) && (
                <>
                  {isEditing && (
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-semibold text-gray-700">Danh sách học viên</h4>
                      <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                        Click vào nút Sửa để thay đổi trạng thái
                      </span>
                    </div>
                  )}
                  <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left">STT</th>
                          <th className="px-4 py-2 text-left">Học viên</th>
                          <th className="px-4 py-2 text-center">Trạng thái</th>
                          <th className="px-4 py-2 text-left">{isEditing ? 'Lý do sửa' : 'Ghi chú'}</th>
                          {isEditing && <th className="px-4 py-2 text-center w-20">Sửa</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {loading ? (
                          <tr>
                            <td colSpan={isEditing ? 5 : 4} className="px-4 py-8 text-center text-gray-400">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                              Đang tải...
                            </td>
                          </tr>
                        ) : (isEditing ? editedAttendance : studentAttendance).length > 0 ? (isEditing ? editedAttendance : studentAttendance).map((sa, index) => {
                          const originalSa = studentAttendance[index];
                          const isChanged = isEditing && originalSa && sa.status !== originalSa.status;
                          const statusColor = sa.status === AttendanceStatus.ON_TIME 
                            ? 'bg-green-100 text-green-700' 
                            : sa.status === AttendanceStatus.LATE
                              ? 'bg-yellow-100 text-yellow-700'
                              : sa.status === AttendanceStatus.ABSENT 
                                ? 'bg-red-100 text-red-700'
                                : sa.status === AttendanceStatus.RESERVED
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-blue-100 text-blue-700';
                          return (
                            <tr key={sa.id || index} className={isChanged ? 'bg-amber-50' : ''}>
                              <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                              <td className="px-4 py-3 font-medium">{sa.studentName}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor}`}>
                                  {sa.status}
                                </span>
                                {isChanged && (
                                  <span className="ml-1 text-xs text-amber-600">(đã sửa)</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-gray-500 italic">
                                {isEditing ? ((sa as any).editReason || '-') : (sa.note || '-')}
                              </td>
                              {isEditing && (
                                <td className="px-4 py-3 text-center">
                                  <button
                                    onClick={() => handleEditStudent(sa)}
                                    className="p-1.5 text-amber-600 hover:bg-amber-100 rounded"
                                    title="Sửa trạng thái"
                                  >
                                    <Edit3 size={16} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        }) : (
                          <tr>
                            <td colSpan={isEditing ? 5 : 4} className="px-4 py-8 text-center text-gray-400">
                              <p>Không có dữ liệu chi tiết</p>
                              <p className="text-xs mt-1">(Dữ liệu có thể được tạo trước khi tích hợp hệ thống mới)</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* History Tab */}
              {detailTab === 'history' && !isEditing && (
                <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                  {loadingLogs ? (
                    <div className="p-8 text-center text-gray-400">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600 mx-auto mb-2"></div>
                      Đang tải lịch sử...
                    </div>
                  ) : auditLogs.length > 0 ? (
                    <div className="divide-y">
                      {auditLogs.map((log: any) => (
                        <div key={log.id} className="p-3 hover:bg-gray-50">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-gray-800">{log.studentName}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                                  {log.oldStatus}
                                </span>
                                <span className="text-gray-400">→</span>
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                                  {log.newStatus}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mt-1">
                                <span className="font-medium">Lý do:</span> {log.reason}
                              </p>
                            </div>
                            <div className="text-right text-xs text-gray-500">
                              <p className="font-medium">{log.editedBy}</p>
                              <p>{log.editedAt ? new Date(log.editedAt).toLocaleString('vi-VN') : '-'}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-gray-400">
                      <History size={32} className="mx-auto mb-2 opacity-50" />
                      <p>Chưa có lịch sử sửa đổi</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 mt-4 border-t">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleCancelEdit}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                      disabled={savingEdit}
                    >
                      Hủy
                    </button>
                    <button
                      onClick={handleSaveEdits}
                      disabled={savingEdit}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
                    >
                      {savingEdit ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Đang lưu...
                        </>
                      ) : (
                        <>
                          <Save size={16} />
                          Lưu thay đổi
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { setShowDetailModal(false); setSelectedRecord(null); }}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Đóng
                    </button>
                    <button
                      onClick={exportDetailToExcel}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                    >
                      <FileDown size={16} />
                      Xuất báo cáo
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Edit Single Student Modal */}
      {showEditModal && editingStudent && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Sửa điểm danh</h3>
              <button onClick={() => { setShowEditModal(false); setEditingStudent(null); }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              {/* Student info */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="font-medium text-gray-800">{editingStudent.studentName}</p>
                <p className="text-sm text-gray-500">
                  Trạng thái hiện tại: <span className="font-medium">{editingStudent.originalStatus}</span>
                </p>
              </div>

              {/* New status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Trạng thái mới</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: AttendanceStatus.ON_TIME, label: 'Đúng giờ', color: 'green' },
                    { value: AttendanceStatus.LATE, label: 'Đi trễ', color: 'yellow' },
                    { value: AttendanceStatus.ABSENT, label: 'Vắng', color: 'red' },
                    { value: AttendanceStatus.RESERVED, label: 'Bảo lưu', color: 'orange' },
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => setEditingStudent(prev => prev ? { ...prev, newStatus: option.value } : null)}
                      className={`p-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                        editingStudent.newStatus === option.value
                          ? `border-${option.color}-500 bg-${option.color}-50 text-${option.color}-700`
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason (required) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lý do chỉnh sửa <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={editingStudent.reason}
                  onChange={(e) => setEditingStudent(prev => prev ? { ...prev, reason: e.target.value } : null)}
                  placeholder="Nhập lý do chỉnh sửa (bắt buộc)..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  rows={3}
                />
              </div>

              {/* Preview change */}
              {editingStudent.originalStatus !== editingStudent.newStatus && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                  <p className="font-medium text-amber-800 mb-1">Thay đổi:</p>
                  <p className="text-amber-700">
                    {editingStudent.originalStatus} → {editingStudent.newStatus}
                  </p>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => { setShowEditModal(false); setEditingStudent(null); }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmEdit}
                disabled={!editingStudent.reason.trim() || editingStudent.originalStatus === editingStudent.newStatus}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};
