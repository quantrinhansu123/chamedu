import { collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, writeBatch, runTransaction, arrayUnion, Timestamp, db } from '@/src/utils/legacyFirestoreStub';
/**
 * Work Confirmation Page
 * Xác nhận công giáo viên & trợ giảng
 * - Tự động hiển thị công từ TKB
 * - Loại trừ ngày nghỉ
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Search, CheckCircle, Clock, Plus, User, UserX, XCircle, Pencil, Trash2, X, History, MapPin } from 'lucide-react';
import { useAutoWorkSessions, WorkSession } from '../src/hooks/useAutoWorkSessions';
import { usePermissions } from '../src/hooks/usePermissions';
import { useAuth } from '../src/hooks/useAuth';
import { useStaff } from '../src/hooks/useStaff';
import { useClasses } from '../src/hooks/useClasses';
import {
  SubstituteReason,
  updateWorkSessionWithAudit,
  deleteWorkSessionWithAudit
} from '../src/services/workSessionService';
import { useLeaveRequests } from '../src/hooks/useLeaveRequests';
import { ModalPortal } from '@/components/modal-portal';

export const WorkConfirmation: React.FC = () => {
  // Permissions - Teachers only see their own work
  const { isTeacher, canApprove, staffId } = usePermissions();
  const { staffData } = useAuth();
  const canApproveWork = canApprove('work_confirmation');
  // Filters - default to "Tuần này" to show all sessions
  const [timeFilter, setTimeFilter] = useState('Tuần này');

  // Calculate date range based on timeFilter
  const { startDate, endDate } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (timeFilter === 'Hôm nay') {
      return { startDate: today, endDate: today };
    }

    if (timeFilter === 'Tuần này') {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(today);
      monday.setDate(diff);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { startDate: monday, endDate: sunday };
    }

    if (timeFilter === 'Tháng này') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { startDate: firstDay, endDate: lastDay };
    }

    // Default: this week
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today);
    monday.setDate(diff);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { startDate: monday, endDate: sunday };
  }, [timeFilter]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [positionFilter, setPositionFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [centers, setCenters] = useState<{ id: string; name: string }[]>([]);

  // Fetch centers for branch filter
  useEffect(() => {
    const fetchCenters = async () => {
      try {
        const centersSnap = await getDocs(collection(null as any /* firebase removed */, 'centers'));
        const centerData = centersSnap.docs
          .filter(d => d.data().status === 'Active')
          .map(d => ({ id: d.id, name: d.data().name || '' }));
        setCenters(centerData);
      } catch (err) {
        console.error('Error fetching centers:', err);
      }
    };
    fetchCenters();
  }, []);

  const {
    sessions,
    loading,
    error,
    confirmSession,
    unconfirmSession,
    confirmMultiple,
    addManualSession,
    refresh,
  } = useAutoWorkSessions(startDate, endDate);

  // Staff list for substitute selection (hiển thị tất cả nhân viên)
  const { staff: staffList } = useStaff();
  
  // Classes list for substitute class selection
  const { classes: classList } = useClasses();

  // Approved leaves for badge display
  const { requests: approvedLeaves } = useLeaveRequests({ status: 'Đã phê duyệt' });

  // Check if staff is on approved leave for a specific date
  const isOnLeave = (staffIdOrName: string, date: string): boolean => {
    return approvedLeaves.some(leave =>
      (leave.staffId === staffIdOrName || leave.staffName === staffIdOrName) &&
      date >= leave.startDate &&
      date <= leave.endDate
    );
  };

  // Manual form state
  const [manualForm, setManualForm] = useState({
    staffName: '',
    position: 'Giáo viên',
    date: '',
    timeStart: '',
    timeEnd: '',
    className: '', // Lớp học (bắt buộc khi dạy thay)
    type: 'Dạy chính' as WorkSession['type'],
    substituteForStaffName: '',
    substituteReason: '' as SubstituteReason | '',
  });
  
  // State cho custom autocomplete
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const [staffSearchTerm, setStaffSearchTerm] = useState('');
  
  // State cho modal sửa/xóa công
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<WorkSession | null>(null);
  const [editForm, setEditForm] = useState({
    staffName: '',
    position: '',
    date: '',
    timeStart: '',
    timeEnd: '',
    className: '',
    type: 'Dạy chính' as WorkSession['type'],
  });
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // State for staff dropdown in edit modal
  const [showEditStaffDropdown, setShowEditStaffDropdown] = useState(false);
  const [editStaffSearchTerm, setEditStaffSearchTerm] = useState('');

  // Filter sessions và tự động đánh dấu "Nghỉ" cho GV được thay
  const filteredSessions = useMemo(() => {
    // Tìm tất cả công dạy thay để biết GV nào nghỉ
    const substituteRecords = sessions.filter(s =>
      s.type === 'Dạy thay' && s.substituteForStaffName
    );

    // Tạo map: key = "date|className|staffName|timeStart" → value = substitute info
    // Include timeStart để match chính xác buổi học (tránh trường hợp cùng ngày có 2 buổi)
    const substitutedMap = new Map<string, { substituteBy: string; reason?: string }>();
    substituteRecords.forEach(s => {
      const key = `${s.date}|${s.className}|${s.substituteForStaffName}|${s.timeStart}`;
      substitutedMap.set(key, {
        substituteBy: s.staffName,
        reason: s.substituteReason
      });
    });

    return sessions
      .map(s => {
        // Check xem công này có bị thay không (match cả timeStart)
        const key = `${s.date}|${s.className}|${s.staffName}|${s.timeStart}`;
        const substituteInfo = substitutedMap.get(key);

        if (substituteInfo && s.type !== 'Dạy thay') {
          // Đánh dấu công này là "Nghỉ - được thay"
          return {
            ...s,
            isSubstituted: true,
            substitutedBy: substituteInfo.substituteBy,
            substitutedReason: substituteInfo.reason,
          };
        }
        return { ...s, isSubstituted: false };
      })
      .filter(s => {
        // Teachers only see their own work
        if (isTeacher && staffData) {
          const myName = staffData.name;
          const myId = staffData.id || staffId;
          if (s.staffName !== myName && s.staffId !== myId) return false;
        }

        // Date range is already handled by hook - no need for additional time filter

        // Status filter - "Nghỉ" không khớp với filter status thông thường
        if (statusFilter && !s.isSubstituted && s.status !== statusFilter) return false;

        // Position filter (case-insensitive)
        if (positionFilter && !s.position.toLowerCase().includes(positionFilter.toLowerCase())) return false;

        // Search filter
        if (searchTerm && !s.staffName.toLowerCase().includes(searchTerm.toLowerCase())) return false;

        // Branch filter - lọc theo cơ sở từ class.branch
        if (branchFilter !== 'all') {
          const sessionCenter = s.center || '';
          if (branchFilter === 'unassigned') {
            if (sessionCenter.trim() !== '') return false;
          } else {
            if (sessionCenter !== branchFilter) return false;
          }
        }

        return true;
      });
  }, [sessions, statusFilter, positionFilter, searchTerm, branchFilter, isTeacher, staffData, staffId]);

  // Bulk confirm modal state
  const [showBulkConfirmModal, setShowBulkConfirmModal] = useState(false);
  const [bulkConfirmLoading, setBulkConfirmLoading] = useState(false);
  const [pendingToConfirm, setPendingToConfirm] = useState<WorkSession[]>([]);

  // Checkbox selection state for bulk operations
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());

  // Work status for each session: 'Đi làm' | 'Đi muộn' | 'Nghỉ'
  const [sessionWorkStatus, setSessionWorkStatus] = useState<Record<string, 'Đi làm' | 'Đi muộn' | 'Nghỉ'>>({});

  // Cover teacher for sessions with "Nghỉ" status
  const [sessionCoverTeacher, setSessionCoverTeacher] = useState<Record<string, string>>({});

  // Toggle single session selection
  const toggleSessionSelection = (sessionKey: string) => {
    setSelectedSessions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sessionKey)) {
        newSet.delete(sessionKey);
      } else {
        newSet.add(sessionKey);
      }
      return newSet;
    });
  };

  // Toggle all sessions selection
  const toggleSelectAll = () => {
    const pendingSessions = filteredSessions.filter(s =>
      s.status === 'Chờ xác nhận' && !(s as any).isSubstituted
    );
    if (selectedSessions.size === pendingSessions.length) {
      setSelectedSessions(new Set());
    } else {
      const allKeys = pendingSessions.map(s => `${s.date}|${s.staffName}|${s.timeStart}`);
      setSelectedSessions(new Set(allKeys));
    }
  };

  // Get session key for identification
  const getSessionKey = (session: WorkSession) => `${session.date}|${session.staffName}|${session.timeStart}`;

  // Confirm selected sessions (or all pending if none selected)
  const handleConfirmAll = () => {
    const pending = filteredSessions.filter(s =>
      s.status === 'Chờ xác nhận' && !(s as any).isSubstituted
    );

    // If no selections, use all pending
    let toConfirm: WorkSession[];
    if (selectedSessions.size === 0) {
      toConfirm = pending;
    } else {
      toConfirm = pending.filter(s => selectedSessions.has(getSessionKey(s)));
    }

    if (toConfirm.length === 0) {
      alert('Không có công nào được chọn hoặc cần xác nhận');
      return;
    }

    // Initialize work status to "Đi làm" for all selected sessions
    const initialStatus: Record<string, 'Đi làm' | 'Đi muộn' | 'Nghỉ'> = {};
    toConfirm.forEach(s => {
      const key = getSessionKey(s);
      if (!sessionWorkStatus[key]) {
        initialStatus[key] = 'Đi làm';
      }
    });
    setSessionWorkStatus(prev => ({ ...prev, ...initialStatus }));

    // Show confirmation modal
    setPendingToConfirm(toConfirm);
    setShowBulkConfirmModal(true);
  };

  // Execute bulk confirmation with work status
  const executeBulkConfirm = async () => {
    // Validate: sessions with "Nghỉ" must have cover teacher
    for (const session of pendingToConfirm) {
      const key = getSessionKey(session);
      const status = sessionWorkStatus[key] || 'Đi làm';
      if (status === 'Nghỉ' && !sessionCoverTeacher[key]) {
        alert(`Vui lòng chọn giáo viên cover cho ${session.staffName} (${session.date})`);
        return;
      }
    }

    setBulkConfirmLoading(true);
    try {
      // Separate sessions by work status
      const toConfirm = pendingToConfirm.filter(s => {
        const key = getSessionKey(s);
        const status = sessionWorkStatus[key] || 'Đi làm';
        return status !== 'Nghỉ'; // Only confirm Đi làm and Đi muộn
      });

      // For "Nghỉ" sessions, we need to create cover records
      const absentSessions = pendingToConfirm.filter(s => {
        const key = getSessionKey(s);
        return sessionWorkStatus[key] === 'Nghỉ';
      });

      // Confirm working sessions (Đi làm / Đi muộn)
      if (toConfirm.length > 0) {
        // Add workStatus to each session before confirming
        const sessionsWithStatus = toConfirm.map(s => ({
          ...s,
          workStatus: sessionWorkStatus[getSessionKey(s)] || 'Đi làm'
        }));
        await confirmMultiple(sessionsWithStatus);
      }

      // Create cover sessions for absent staff
      for (const session of absentSessions) {
        const key = getSessionKey(session);
        const coverTeacher = sessionCoverTeacher[key];
        if (coverTeacher) {
          // Add manual session for cover teacher
          await addManualSession({
            staffName: coverTeacher,
            position: session.position,
            date: session.date,
            timeStart: session.timeStart,
            timeEnd: session.timeEnd || '',
            className: session.className || '',
            type: 'Dạy thay',
            status: 'Chờ xác nhận',
            substituteForStaffName: session.staffName,
            substituteReason: 'Nghỉ' as SubstituteReason,
          });
        }
      }

      // Clear states
      setShowBulkConfirmModal(false);
      setPendingToConfirm([]);
      setSelectedSessions(new Set());
      setSessionWorkStatus({});
      setSessionCoverTeacher({});

      const confirmedCount = toConfirm.length;
      const absentCount = absentSessions.length;
      let message = `Đã xác nhận ${confirmedCount} công thành công!`;
      if (absentCount > 0) {
        message += ` Đã tạo ${absentCount} công dạy thay.`;
      }
      alert(message);
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      setBulkConfirmLoading(false);
    }
  };

  // Toggle confirm/unconfirm
  const handleToggleConfirm = async (session: WorkSession) => {
    try {
      if (session.status === 'Chờ xác nhận') {
        await confirmSession(session);
      } else if (session.status === 'Đã xác nhận') {
        if (confirm('Bạn có chắc muốn hủy xác nhận công này?')) {
          await unconfirmSession(session);
        }
      }
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    }
  };

  // Add manual
  const handleManualAdd = async () => {
    if (!manualForm.staffName || !manualForm.date || !manualForm.timeStart) {
      alert('Vui lòng điền đầy đủ thông tin');
      return;
    }

    // Validate dạy thay fields - bắt buộc className + GV được thay + lý do
    if (manualForm.type === 'Dạy thay') {
      if (!manualForm.className) {
        alert('Vui lòng chọn lớp học khi dạy thay');
        return;
      }
      if (!manualForm.substituteForStaffName || !manualForm.substituteReason) {
        alert('Vui lòng chọn GV được thay và lý do dạy thay');
        return;
      }
    }

    try {
      await addManualSession({
        staffName: manualForm.staffName,
        position: manualForm.position === 'Giáo viên' ? 'Giáo viên Việt' : 'Trợ giảng',
        date: manualForm.date,
        timeStart: manualForm.timeStart,
        timeEnd: manualForm.timeEnd,
        className: manualForm.className || '',
        type: manualForm.type,
        status: 'Chờ xác nhận',
        // Thông tin dạy thay
        ...(manualForm.type === 'Dạy thay' && {
          substituteForStaffName: manualForm.substituteForStaffName,
          substituteReason: manualForm.substituteReason as SubstituteReason,
        }),
      });
      
      setManualForm({
        staffName: '',
        position: 'Giáo viên',
        date: '',
        timeStart: '',
        timeEnd: '',
        className: '',
        type: 'Dạy chính',
        substituteForStaffName: '',
        substituteReason: '',
      });
      alert('Đã thêm công thành công!');
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    }
  };

  // Format time display
  const formatTimeDisplay = (date: string, timeStart: string, timeEnd: string) => {
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month} ${timeStart} - ${timeEnd || '...'}`;
  };

  // Check quyền sửa/xóa
  const canEditSession = (session: WorkSession) => {
    // Không cho sửa công auto từ TKB (chỉ sửa công manual)
    if (session.isFromTKB && !session.id) return false;
    
    const isAdmin = staffData?.role === 'Quản trị viên' || staffData?.role === 'Quản lý';
    
    // Admin được sửa mọi lúc
    if (isAdmin) return true;
    
    // Lễ tân chỉ được sửa khi "Chờ xác nhận"
    return session.status === 'Chờ xác nhận';
  };

  const canDeleteSession = (session: WorkSession) => {
    // Không cho xóa công auto từ TKB
    if (session.isFromTKB && !session.id) return false;
    
    const isAdmin = staffData?.role === 'Quản trị viên' || staffData?.role === 'Quản lý';
    
    // Admin được xóa mọi lúc
    if (isAdmin) return true;
    
    // Lễ tân chỉ được xóa khi "Chờ xác nhận"
    return session.status === 'Chờ xác nhận';
  };

  // Open edit modal
  const handleOpenEdit = (session: WorkSession) => {
    setSelectedSession(session);
    setEditForm({
      staffName: session.staffName,
      position: session.position,
      date: session.date,
      timeStart: session.timeStart,
      timeEnd: session.timeEnd || '',
      className: session.className || '',
      type: session.type,
    });
    setActionReason('');
    setEditModalOpen(true);
  };

  // Open delete modal
  const handleOpenDelete = (session: WorkSession) => {
    setSelectedSession(session);
    setActionReason('');
    setDeleteModalOpen(true);
  };

  // Handle edit submit
  const handleEditSubmit = async () => {
    if (!selectedSession?.id) {
      alert('Không thể sửa công này');
      return;
    }
    
    if (!actionReason.trim()) {
      alert('Vui lòng nhập lý do sửa');
      return;
    }

    setActionLoading(true);
    try {
      await updateWorkSessionWithAudit(
        selectedSession.id,
        selectedSession,
        editForm,
        {
          name: staffData?.name || 'Unknown',
          role: staffData?.role || 'Unknown'
        },
        actionReason
      );

      // Refresh data to show updated session
      await refresh();

      alert('Đã cập nhật công thành công!');
      setEditModalOpen(false);
      setSelectedSession(null);
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle delete submit
  const handleDeleteSubmit = async () => {
    if (!selectedSession?.id) {
      alert('Không thể xóa công này');
      return;
    }
    
    if (!actionReason.trim()) {
      alert('Vui lòng nhập lý do xóa');
      return;
    }

    setActionLoading(true);
    try {
      await deleteWorkSessionWithAudit(
        selectedSession.id,
        selectedSession,
        {
          name: staffData?.name || 'Unknown',
          role: staffData?.role || 'Unknown'
        },
        actionReason
      );

      // Refresh data to show updated list
      await refresh();

      alert('Đã xóa công thành công!');
      setDeleteModalOpen(false);
      setSelectedSession(null);
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-white bg-green-500 px-4 py-2 inline-block rounded mb-6">
          Xác nhận công giáo viên & trợ giảng
        </h2>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Hiển thị thời gian</label>
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="Hôm nay">Hôm nay</option>
              <option value="Tuần này">Tuần này</option>
              <option value="Tháng này">Tháng này</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Cơ sở</label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="all">Tất cả cơ sở</option>
                <option value="unassigned">Chưa gán cơ sở</option>
                {centers.map(center => (
                  <option key={center.id} value={center.name}>{center.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Trạng thái</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">Tất cả</option>
              <option value="Chờ xác nhận">Chờ xác nhận</option>
              <option value="Đã xác nhận">Đã xác nhận</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Vị trí</label>
            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">Tất cả</option>
              <option value="Giáo viên Việt">Giáo viên Việt</option>
              <option value="Giáo viên Nước ngoài">Giáo viên Nước ngoài</option>
              <option value="Trợ giảng">Trợ giảng</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Tên nhân sự</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Lựa chọn tên..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col xl:flex-row gap-6">
        {/* Left: Table */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 text-sm text-gray-500 italic border-b border-gray-100">
            Hệ thống sẽ tự động hiển thị dựa theo thời khóa biểu và lịch nghỉ
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-green-500 text-white">
                  {/* Checkbox column */}
                  <th className="px-2 py-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={selectedSessions.size > 0 && selectedSessions.size === filteredSessions.filter(s => s.status === 'Chờ xác nhận' && !(s as any).isSubstituted).length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-white text-green-600 focus:ring-green-500"
                      title="Chọn tất cả"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase w-12">STT</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase">Tên nhân viên</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase">Thời gian</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase">Lớp</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase">Kiểu tính công</th>
                  <th className="px-4 py-3 text-center">
                    <button
                      onClick={handleConfirmAll}
                      className="text-xs font-bold text-white uppercase px-3 py-1.5 border border-white rounded hover:bg-green-600 flex items-center gap-1 mx-auto"
                    >
                      <CheckCircle size={14} />
                      {selectedSessions.size > 0 ? `Xác nhận (${selectedSessions.size})` : 'Xác nhận hàng loạt'}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase w-24">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-500">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-2"></div>
                      Đang tải...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-red-500">{error}</td>
                  </tr>
                ) : filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-400">
                      Không có dữ liệu
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((session, idx) => {
                    const isSubstituted = (session as any).isSubstituted;
                    const substitutedBy = (session as any).substitutedBy;
                    const substitutedReason = (session as any).substitutedReason;
                    const onLeave = isOnLeave(session.staffId || session.staffName, session.date);
                    const sessionKey = getSessionKey(session);
                    const isPending = session.status === 'Chờ xác nhận' && !isSubstituted;
                    const isSelected = selectedSessions.has(sessionKey);

                    return (
                      <tr
                        key={session.id || `${session.staffName}-${session.date}-${idx}`}
                        className={`${isSubstituted ? 'bg-red-50 opacity-60' : onLeave ? 'bg-purple-50' : 'hover:bg-gray-50'} ${isSelected ? 'bg-green-50' : ''}`}
                      >
                        {/* Checkbox cell */}
                        <td className="px-2 py-4 text-center">
                          {isPending && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSessionSelection(sessionKey)}
                              className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                            />
                          )}
                        </td>
                        <td className="px-4 py-4 text-gray-500">{idx + 1}</td>
                        <td className="px-4 py-4 font-medium text-gray-900">
                          {session.staffName}
                          {onLeave && !isSubstituted && (
                            <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                              Nghỉ phép
                            </span>
                          )}
                          {isSubstituted && (
                            <div className="text-xs text-red-500 mt-1">
                              <XCircle size={12} className="inline mr-1" />
                              Được thay bởi: {substitutedBy}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-gray-600">
                          <div className="flex items-center gap-2">
                            <Clock size={14} className="text-gray-400" />
                            {formatTimeDisplay(session.date, session.timeStart, session.timeEnd)}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-gray-700">{session.className || '-'}</td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            {isSubstituted ? (
                              <span className="px-3 py-1 rounded text-xs font-medium border bg-red-100 text-red-700 border-red-200">
                                Nghỉ
                              </span>
                            ) : (
                              <span className={`px-3 py-1 rounded text-xs font-medium border ${
                                session.type === 'Dạy thay' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                session.type === 'Bồi bài' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                'bg-gray-50 text-gray-700 border-gray-200'
                              }`}>
                                {session.type}
                              </span>
                            )}
                            {isSubstituted && substitutedReason && (
                              <span className="text-xs text-red-500">
                                ({substitutedReason})
                              </span>
                            )}
                            {session.type === 'Dạy thay' && session.substituteForStaffName && !isSubstituted && (
                              <span className="text-xs text-orange-600">
                                Thay: {session.substituteForStaffName}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          {isSubstituted ? (
                            <span className="px-4 py-1.5 rounded text-xs font-bold bg-gray-200 text-gray-500 cursor-not-allowed">
                              Không tính công
                            </span>
                          ) : onLeave ? (
                            <span className="px-4 py-1.5 rounded text-xs font-bold bg-purple-200 text-purple-700 cursor-not-allowed">
                              Nghỉ phép
                            </span>
                          ) : (
                            <button
                              onClick={() => handleToggleConfirm(session)}
                              className={`px-4 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer ${
                                session.status === 'Đã xác nhận'
                                  ? 'bg-green-500 text-white hover:bg-green-600'
                                  : 'bg-white text-orange-500 border-2 border-orange-400 hover:bg-orange-50'
                              }`}
                            >
                              {session.status}
                            </button>
                          )}
                        </td>
                        {/* Cột Thao tác - Sửa/Xóa */}
                        <td className="px-4 py-4 text-center">
                          {!isSubstituted && session.id && (
                            <div className="flex items-center justify-center gap-1">
                              {canEditSession(session) && (
                                <button
                                  onClick={() => handleOpenEdit(session)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Sửa công"
                                >
                                  <Pencil size={14} />
                                </button>
                              )}
                              {canDeleteSession(session) && (
                                <button
                                  onClick={() => handleOpenDelete(session)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Xóa công"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
          <div className="px-4 py-3 border-t border-gray-100 text-sm text-yellow-700 italic flex items-center gap-2 bg-yellow-50">
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
            Sau khi xác nhận, số công sẽ tự động chuyển sang báo cáo lương.
          </div>
        </div>

        {/* Right: Manual Add Form */}
        <div className="w-full xl:w-96 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-fit">
          <div className="bg-green-500 px-4 py-3 flex items-center gap-2">
            <Plus size={18} className="text-white" />
            <h3 className="text-white font-bold uppercase text-sm">Giao diện thêm công thủ công</h3>
          </div>
          
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tên nhân viên</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Nhập hoặc chọn nhân viên..."
                  value={manualForm.staffName}
                  onChange={(e) => {
                    setManualForm({ ...manualForm, staffName: e.target.value });
                    setStaffSearchTerm(e.target.value);
                    setShowStaffDropdown(true);
                  }}
                  onFocus={() => setShowStaffDropdown(true)}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <button
                  type="button"
                  onClick={() => setShowStaffDropdown(!showStaffDropdown)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                >
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${showStaffDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {/* Custom Dropdown */}
                {showStaffDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {staffList
                      .filter(s => s.name && s.name.toLowerCase().includes(staffSearchTerm.toLowerCase()))
                      .map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setManualForm({ ...manualForm, staffName: s.name });
                            setShowStaffDropdown(false);
                            setStaffSearchTerm('');
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-green-50 flex items-center gap-2 border-b border-gray-50 last:border-0"
                        >
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold">
                            {s.name?.charAt(0)?.toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-800">{s.name}</div>
                            <div className="text-xs text-gray-500">{s.position || s.role}</div>
                          </div>
                        </button>
                      ))
                    }
                    {staffList.filter(s => s.name && s.name.toLowerCase().includes(staffSearchTerm.toLowerCase())).length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-400 text-center">Không tìm thấy</div>
                    )}
                  </div>
                )}
              </div>
              {/* Click outside to close */}
              {showStaffDropdown && (
                <div className="fixed inset-0 z-40" onClick={() => setShowStaffDropdown(false)} />
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vị trí</label>
              <select
                value={manualForm.position}
                onChange={(e) => setManualForm({ ...manualForm, position: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="Giáo viên">Giáo viên</option>
                <option value="Trợ giảng">Trợ giảng</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày</label>
              <input
                type="date"
                value={manualForm.date}
                onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Giờ bắt đầu</label>
                <input
                  type="time"
                  value={manualForm.timeStart}
                  onChange={(e) => setManualForm({ ...manualForm, timeStart: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Giờ kết thúc</label>
                <input
                  type="time"
                  value={manualForm.timeEnd}
                  onChange={(e) => setManualForm({ ...manualForm, timeEnd: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kiểu tính công</label>
              <select
                value={manualForm.type}
                onChange={(e) => setManualForm({ ...manualForm, type: e.target.value as any, substituteForStaffName: '', substituteReason: '' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="Dạy chính">Dạy chính</option>
                <option value="Trợ giảng">Trợ giảng</option>
                <option value="Nhận xét">Nhận xét</option>
                <option value="Dạy thay">Dạy thay</option>
                <option value="Bồi bài">Bồi bài</option>
              </select>
            </div>

            {/* Thông tin dạy thay - chỉ hiển thị khi type = 'Dạy thay' */}
            {manualForm.type === 'Dạy thay' && (
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-200 space-y-3">
                <div className="flex items-center gap-2 text-orange-700 text-sm font-medium">
                  <UserX size={16} />
                  Thông tin dạy thay
                </div>
                
                {/* Chọn lớp học - bắt buộc để hệ thống biết công nào bị override */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lớp học <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={manualForm.className}
                    onChange={(e) => setManualForm({ ...manualForm, className: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="">-- Chọn lớp --</option>
                    {classList
                      .filter(c => c.status === 'Đang học')
                      .map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))
                    }
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dạy thay cho GV <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={manualForm.substituteForStaffName}
                    onChange={(e) => setManualForm({ ...manualForm, substituteForStaffName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="">-- Chọn GV được thay --</option>
                    {staffList
                      .filter(s => s.name && s.name !== manualForm.staffName)
                      .map(s => (
                        <option key={s.id} value={s.name}>{s.name} ({s.position || s.role})</option>
                      ))
                    }
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lý do nghỉ <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={manualForm.substituteReason}
                    onChange={(e) => setManualForm({ ...manualForm, substituteReason: e.target.value as SubstituteReason })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="">-- Chọn lý do --</option>
                    <option value="Nghỉ phép">Nghỉ phép</option>
                    <option value="Nghỉ ốm">Nghỉ ốm</option>
                    <option value="Bận việc đột xuất">Bận việc đột xuất</option>
                    <option value="Nghỉ không lương">Nghỉ không lương</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>
              </div>
            )}
            
            <button
              onClick={handleManualAdd}
              className="w-full bg-green-500 text-white font-bold py-3 rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle size={18} />
              Xác nhận thêm
            </button>
          </div>
        </div>
      </div>

      {/* Modal Sửa công */}
      {editModalOpen && selectedSession && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-500 text-white rounded-t-xl">
              <h3 className="font-bold flex items-center gap-2">
                <Pencil size={18} />
                Sửa công
              </h3>
              <button onClick={() => setEditModalOpen(false)} className="hover:bg-blue-600 p-1 rounded">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                <strong>Lưu ý:</strong> Mọi thay đổi sẽ được ghi lại trong lịch sử (audit log).
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên nhân viên</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Nhập hoặc chọn nhân viên..."
                      value={editForm.staffName}
                      onChange={(e) => {
                        setEditForm({ ...editForm, staffName: e.target.value });
                        setEditStaffSearchTerm(e.target.value);
                        setShowEditStaffDropdown(true);
                      }}
                      onFocus={() => setShowEditStaffDropdown(true)}
                      className="w-full px-3 py-2 pr-8 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditStaffDropdown(!showEditStaffDropdown)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded"
                    >
                      <svg className={`w-4 h-4 text-gray-400 transition-transform ${showEditStaffDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Staff Dropdown */}
                    {showEditStaffDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {staffList
                          .filter(s => s.name && s.name.toLowerCase().includes(editStaffSearchTerm.toLowerCase()))
                          .map(s => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setEditForm({
                                  ...editForm,
                                  staffName: s.name,
                                  position: s.position || s.role
                                });
                                setShowEditStaffDropdown(false);
                                setEditStaffSearchTerm('');
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center gap-2 border-b border-gray-50 last:border-0"
                            >
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                                {s.name?.charAt(0)?.toUpperCase()}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-800">{s.name}</div>
                                <div className="text-xs text-gray-500">{s.position || s.role}</div>
                              </div>
                            </button>
                          ))
                        }
                        {staffList.filter(s => s.name && s.name.toLowerCase().includes(editStaffSearchTerm.toLowerCase())).length === 0 && (
                          <div className="px-3 py-2 text-sm text-gray-400 text-center">Không tìm thấy</div>
                        )}
                      </div>
                    )}
                    {/* Click outside to close */}
                    {showEditStaffDropdown && (
                      <div className="fixed inset-0 z-40" onClick={() => setShowEditStaffDropdown(false)} />
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vị trí</label>
                  <select
                    value={editForm.position}
                    onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="Giáo viên Việt">Giáo viên Việt</option>
                    <option value="Giáo viên Nước ngoài">Giáo viên Nước ngoài</option>
                    <option value="Trợ giảng">Trợ giảng</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ngày</label>
                <input
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Giờ bắt đầu</label>
                  <input
                    type="time"
                    value={editForm.timeStart}
                    onChange={(e) => setEditForm({ ...editForm, timeStart: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Giờ kết thúc</label>
                  <input
                    type="time"
                    value={editForm.timeEnd}
                    onChange={(e) => setEditForm({ ...editForm, timeEnd: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lớp học</label>
                <input
                  type="text"
                  value={editForm.className}
                  onChange={(e) => setEditForm({ ...editForm, className: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kiểu tính công</label>
                <select
                  value={editForm.type}
                  onChange={(e) => setEditForm({ ...editForm, type: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="Dạy chính">Dạy chính</option>
                  <option value="Trợ giảng">Trợ giảng</option>
                  <option value="Nhận xét">Nhận xét</option>
                  <option value="Dạy thay">Dạy thay</option>
                  <option value="Bồi bài">Bồi bài</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lý do sửa <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Nhập lý do sửa công..."
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleEditSubmit}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  {actionLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Modal Xóa công */}
      {deleteModalOpen && selectedSession && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-red-500 text-white rounded-t-xl">
              <h3 className="font-bold flex items-center gap-2">
                <Trash2 size={18} />
                Xóa công
              </h3>
              <button onClick={() => setDeleteModalOpen(false)} className="hover:bg-red-600 p-1 rounded">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-red-50 rounded-lg text-sm text-red-700">
                <strong>Cảnh báo:</strong> Bạn đang xóa công của <strong>{selectedSession.staffName}</strong>
                ngày <strong>{selectedSession.date}</strong>. Hành động này sẽ được ghi lại trong lịch sử.
              </div>

              <div className="p-3 bg-gray-50 rounded-lg text-sm">
                <div><strong>Nhân viên:</strong> {selectedSession.staffName}</div>
                <div><strong>Thời gian:</strong> {selectedSession.date} {selectedSession.timeStart} - {selectedSession.timeEnd}</div>
                <div><strong>Lớp:</strong> {selectedSession.className || '-'}</div>
                <div><strong>Kiểu:</strong> {selectedSession.type}</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lý do xóa <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Nhập lý do xóa công..."
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setDeleteModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleDeleteSubmit}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                >
                  {actionLoading ? 'Đang xóa...' : 'Xác nhận xóa'}
                </button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Modal Xác nhận hàng loạt với trạng thái công */}
      {showBulkConfirmModal && pendingToConfirm.length > 0 && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-green-500 text-white rounded-t-xl">
              <h3 className="font-bold flex items-center gap-2">
                <CheckCircle size={18} />
                Xác nhận hàng loạt ({pendingToConfirm.length} công)
              </h3>
              <button onClick={() => setShowBulkConfirmModal(false)} className="hover:bg-green-600 p-1 rounded">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                <strong>Hướng dẫn:</strong> Chọn trạng thái cho từng công. Nếu chọn "Nghỉ", cần chọn giáo viên cover.
              </div>

              {/* Work status legend */}
              <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  <span>Đi làm</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                  <span>Đi muộn</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                  <span>Nghỉ (cần chọn GV cover)</span>
                </div>
              </div>

              <div className="max-h-[400px] overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Nhân viên</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Ngày / Lớp</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">Trạng thái</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">GV Cover (nếu Nghỉ)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pendingToConfirm.map((session, idx) => {
                      const key = getSessionKey(session);
                      const currentStatus = sessionWorkStatus[key] || 'Đi làm';
                      const currentCover = sessionCoverTeacher[key] || '';

                      return (
                        <tr key={idx} className={`${currentStatus === 'Nghỉ' ? 'bg-red-50' : currentStatus === 'Đi muộn' ? 'bg-yellow-50' : ''}`}>
                          <td className="px-3 py-2">
                            <div className="font-medium">{session.staffName}</div>
                            <div className="text-xs text-gray-500">{session.position}</div>
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            <div>{session.date}</div>
                            <div className="text-xs">{session.className || '-'} ({session.timeStart})</div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1 justify-center">
                              <button
                                type="button"
                                onClick={() => setSessionWorkStatus(prev => ({ ...prev, [key]: 'Đi làm' }))}
                                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                  currentStatus === 'Đi làm'
                                    ? 'bg-green-500 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-green-100'
                                }`}
                              >
                                Đi làm
                              </button>
                              <button
                                type="button"
                                onClick={() => setSessionWorkStatus(prev => ({ ...prev, [key]: 'Đi muộn' }))}
                                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                  currentStatus === 'Đi muộn'
                                    ? 'bg-yellow-500 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-yellow-100'
                                }`}
                              >
                                Đi muộn
                              </button>
                              <button
                                type="button"
                                onClick={() => setSessionWorkStatus(prev => ({ ...prev, [key]: 'Nghỉ' }))}
                                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                  currentStatus === 'Nghỉ'
                                    ? 'bg-red-500 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-red-100'
                                }`}
                              >
                                Nghỉ
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {currentStatus === 'Nghỉ' ? (
                              <select
                                value={currentCover}
                                onChange={(e) => setSessionCoverTeacher(prev => ({ ...prev, [key]: e.target.value }))}
                                className={`w-full px-2 py-1 border rounded text-xs ${
                                  !currentCover ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                }`}
                              >
                                <option value="">-- Chọn GV cover --</option>
                                {staffList
                                  .filter(s => s.name !== session.staffName && (s.position?.includes('Giáo viên') || s.role?.includes('Giáo viên')))
                                  .map(s => (
                                    <option key={s.id} value={s.name}>{s.name}</option>
                                  ))
                                }
                              </select>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 py-4 border-t bg-gray-50 flex gap-3">
              <button
                onClick={() => {
                  setShowBulkConfirmModal(false);
                  setPendingToConfirm([]);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium"
              >
                Hủy bỏ
              </button>
              <button
                onClick={executeBulkConfirm}
                disabled={bulkConfirmLoading}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 font-bold flex items-center justify-center gap-2"
              >
                {bulkConfirmLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Đang xác nhận...
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} />
                    Xác nhận {pendingToConfirm.length} công
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};
