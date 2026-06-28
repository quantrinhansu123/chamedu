import { collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, writeBatch, runTransaction, arrayUnion, Timestamp, db } from '@/src/utils/legacyFirestoreStub';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, User, Phone, Mail, MapPin, Calendar, BookOpen, DollarSign, Clock, MessageSquare, FileText, X, GraduationCap, CheckCircle2, CalendarCheck, Circle, TrendingUp, AlertTriangle, History, CreditCard, AlertCircle, BadgeDollarSign, FileDown, RefreshCw, Eye } from 'lucide-react';
import { useClasses } from '../src/hooks/useClasses';
import { useStudents } from '../src/hooks/useStudents';
import { useSettlementInvoices } from '../src/hooks/useSettlementInvoices';
import { SettlementHistoryTable } from '../src/features/debt/components';
import { useFeedback } from '../src/hooks/useFeedback';
import { useTutoring } from '../src/hooks/useTutoring';
import { formatSchedule } from '../src/utils/scheduleUtils';
import { createEnrollment } from '../src/services/enrollmentService';
import { generateFeedbackPDF, generateFeedbackExcel } from '../src/services/feedbackReportService';
import { useAuth } from '../src/hooks/useAuth';
import { Plus, Minus } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getStudentSessionData } from '../src/utils/student-session-utils';
import { ModalPortal } from '@/components/modal-portal';
import { StudentStatus, EnrollmentRecord } from '../types';
import { recalculateStudentStatus } from '../src/services/attendanceService';

export const StudentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'finance' | 'feedback'>('info');
  
  // Update tab from URL query param when component mounts or URL changes
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get('tab');
    if (tabParam === 'finance') {
      setActiveTab('finance');
    } else if (tabParam === 'enrollment' || tabParam === 'history') {
      setActiveTab('history');
    } else if (tabParam === 'feedback') {
      setActiveTab('feedback');
    }
  }, [location.search]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showManualEnrollModal, setShowManualEnrollModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const { classes } = useClasses({});
  const { students, loading, updateStudent } = useStudents({});
  const [enrolling, setEnrolling] = useState(false);
  
  // Manual enrollment state
  const [manualEnrollForm, setManualEnrollForm] = useState({
    action: 'add' as 'add' | 'subtract',
    sessions: 1,
    reason: '',
  });
  const [processingManual, setProcessingManual] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [viewingClassId, setViewingClassId] = useState<string | null>(null);
  const [viewingClassName, setViewingClassName] = useState<string>('');
  const [classAttendanceRecords, setClassAttendanceRecords] = useState<any[]>([]);
  const [loadingClassAttendance, setLoadingClassAttendance] = useState(false);
  
  // Get feedback data for this student from Firebase
  const { callFeedbacks, formFeedbacks, loading: feedbackLoading } = useFeedback({ studentId: id });
  const { invoices: settlementInvoices, loading: settlementLoading } = useSettlementInvoices({ studentId: id });

  // Get tutoring history for this student
  const { tutoringList, loading: tutoringLoading } = useTutoring({});
  const studentTutoring = useMemo(() => {
    if (!id) return [];
    return tutoringList.filter(t => t.studentId === id);
  }, [tutoringList, id]);

  // Attendance stats for student
  const [attendanceStats, setAttendanceStats] = useState({
    totalSessions: 0,
    presentSessions: 0,
    absentSessions: 0,
    lateSessions: 0,
    onTimeSessions: 0,
    attendanceRate: 0,
  });

  // Fetch attendance stats
  useEffect(() => {
    const fetchAttendanceStats = async () => {
      if (!id) return;
      try {
        const q = query(
          collection(null as any /* firebase removed */, 'studentAttendance'),
          where('studentId', '==', id)
        );
        const snapshot = await getDocs(q);
        const records = snapshot.docs.map(d => d.data()).filter(r => r.status && r.status !== '');
        
        // Define present statuses (both new and legacy)
        const PRESENT_STATUSES = ['Đúng giờ', 'Trễ giờ', 'Đã bồi', 'Có mặt', 'Đến trễ'];
        const ABSENT_STATUSES = ['Vắng'];
        
        const total = records.length;
        const present = records.filter(r => PRESENT_STATUSES.includes(r.status)).length;
        const absent = records.filter(r => ABSENT_STATUSES.includes(r.status)).length;
        
        // Calculate late and on-time sessions
        let late = 0;
        let onTime = 0;
        records.forEach(r => {
          if (PRESENT_STATUSES.includes(r.status)) {
            if (r.status === 'Trễ giờ' || r.punctuality === 'late' || r.isLate) {
              late++;
            } else if (r.status === 'Đúng giờ' || r.punctuality === 'onTime') {
              onTime++;
            } else if (r.status === 'Đã bồi') {
              // Tutored sessions count as present but not as on-time or late
              onTime++; // Count as on-time for simplicity
            } else {
              // Legacy 'Có mặt' or 'Đến trễ' - check punctuality
              if (r.punctuality === 'late' || r.isLate) {
                late++;
              } else {
                onTime++;
              }
            }
          }
        });
        
        setAttendanceStats({
          totalSessions: total,
          presentSessions: present,
          absentSessions: absent,
          lateSessions: late,
          onTimeSessions: onTime,
          attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0,
        });
      } catch (error) {
        console.error('Error fetching attendance stats:', error);
      }
    };
    fetchAttendanceStats();
  }, [id]);

  // Enrollment history for student
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [financeLoading, setFinanceLoading] = useState(false);

  // Fetch enrollments and contracts
  useEffect(() => {
    const fetchFinanceData = async () => {
      if (!id) return;
      setFinanceLoading(true);
      try {
        // Fetch enrollments
        const enrollQ = query(
          collection(null as any /* firebase removed */, 'enrollments'),
          where('studentId', '==', id)
        );
        const enrollSnap = await getDocs(enrollQ);
        const enrollList = enrollSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort by createdAt desc
        enrollList.sort((a: any, b: any) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        setEnrollments(enrollList);

        // Fetch contracts
        const contractQ = query(
          collection(null as any /* firebase removed */, 'contracts'),
          where('studentId', '==', id)
        );
        const contractSnap = await getDocs(contractQ);
        const contractList = contractSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        contractList.sort((a: any, b: any) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        setContracts(contractList);
      } catch (error) {
        console.error('Error fetching finance data:', error);
      } finally {
        setFinanceLoading(false);
      }
    };
    fetchFinanceData();
  }, [id]);

  // Find student by ID from Firebase data
  const student = students.find(s => s.id === id);
  
  // Calculate remaining sessions and warning
  const remainingSessions = useMemo(() => {
    if (!student) return 0;
    const { remaining } = getStudentSessionData(student);
    return Math.max(0, remaining);
  }, [student]);
  
  const showSessionWarning = remainingSessions > 0 && remainingSessions <= 6;
  const studentHistoryClasses = useMemo(() => {
    if (!student) return [];

    const classMap = new Map(classes.map(c => [c.id, c]));
    const classIds = new Set<string>();

    (student.classIds || []).forEach((cid: string) => cid && classIds.add(cid));
    if (student.classId) classIds.add(student.classId);
    Object.keys(student.classProgress || {}).forEach(cid => cid && classIds.add(cid));
    (enrollments || []).forEach((e: any) => e?.classId && classIds.add(e.classId));

    return Array.from(classIds).map((classId) => {
      const cls = classMap.get(classId);
      const progress = (student.classProgress as any)?.[classId];
      const enrollmentName = (enrollments || []).find((e: any) => e.classId === classId)?.className;
      return {
        id: classId,
        name: cls?.name || enrollmentName || (classId === student.classId ? (student.class || student.className || 'Lớp hiện tại') : `Lớp cũ (${classId.slice(0, 6)})`),
        curriculum: cls?.curriculum || '--',
        startDate: cls?.startDate,
        endDate: cls?.endDate,
        registered: progress?.registeredSessions,
        attended: progress?.attendedSessions,
      };
    });
  }, [student, classes, enrollments]);
  const classProgressRows = useMemo(() => {
    if (!student?.classProgress) return [];
    return Object.entries(student.classProgress).map(([classId, progress]: [string, any]) => {
      const cls = classes.find(c => c.id === classId);
      const registered = progress?.registeredSessions || 0;
      const attended = progress?.attendedSessions || 0;
      return {
        classId,
        className: cls?.name || (classId === student.classId ? student.class : `Lớp cũ (${classId.slice(0, 6)})`),
        registered,
        attended,
        remaining: registered - attended,
        isCurrent: classId === student.classId,
      };
    });
  }, [student, classes]);
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    fullName: '',
    gender: 'Nam',
    dob: '',
    address: '',
    parentName: '',
    phone: '',
    email: '',
    parentName2: '',
    phone2: '',
  });

  // Update form when student data loads
  useEffect(() => {
    if (student) {
      setEditForm({
        fullName: student.fullName || '',
        gender: student.gender || 'Nam',
        dob: student.dob || '',
        address: '',
        parentName: student.parentName || '',
        phone: student.phone || '',
        email: '',
        parentName2: '',
        phone2: '',
      });
    }
  }, [student]);

  // Enroll form state
  const [enrollForm, setEnrollForm] = useState({
    classId: '',
    startDate: new Date().toISOString().split('T')[0],
    sessions: 48,
    notes: '',
    startSessionNumber: 1, // Buổi học bắt đầu
  });
  const [nextSessionInfo, setNextSessionInfo] = useState<{
    sessionNumber: number;
    date: string;
    completedSessions: number;
    totalSessions: number;
  } | null>(null);
  const [loadingNextSession, setLoadingNextSession] = useState(false);

  // Function to get next available session for a class
  const fetchNextSession = async (classId: string) => {
    if (!classId) {
      setNextSessionInfo(null);
      return;
    }
    
    setLoadingNextSession(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get all sessions for this class
      const sessionsQuery = query(
        collection(null as any /* firebase removed */, 'classSessions'),
        where('classId', '==', classId)
      );
      const sessionsSnap = await getDocs(sessionsQuery);
      // Sort by sessionNumber locally (Firestore index not available)
      const sessions = sessionsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a: any, b: any) => a.sessionNumber - b.sessionNumber) as any[];

      // Count completed sessions (status = 'Đã học' or date < today)
      const completedSessions = sessions.filter(s => 
        s.status === 'Đã học' || s.date < today
      ).length;

      // Find next upcoming session (date >= today and status != 'Đã học')
      const nextSession = sessions.find(s => 
        s.date >= today && s.status !== 'Đã học'
      );

      const actualTotalSessions = sessions.length;
      
      if (nextSession) {
        setNextSessionInfo({
          sessionNumber: nextSession.sessionNumber,
          date: nextSession.date,
          completedSessions,
          totalSessions: actualTotalSessions
        });
        
        // Auto-fill the form with actual session data
        setEnrollForm(prev => ({
          ...prev,
          startDate: nextSession.date,
          startSessionNumber: nextSession.sessionNumber,
          sessions: prev.sessions === 0 ? actualTotalSessions : prev.sessions // Update if not set
        }));
      } else {
        // No upcoming sessions - class might be finished
        setNextSessionInfo({
          sessionNumber: actualTotalSessions + 1,
          date: today,
          completedSessions,
          totalSessions: actualTotalSessions
        });
        
        // Update sessions count
        setEnrollForm(prev => ({
          ...prev,
          sessions: prev.sessions === 0 ? actualTotalSessions : prev.sessions
        }));
      }
    } catch (error) {
      console.error('Error fetching next session:', error);
      setNextSessionInfo(null);
    } finally {
      setLoadingNextSession(false);
    }
  };

  // Export finance history to Excel
  const exportFinanceHistory = () => {
    if (!student) return;

    const enrollmentData = enrollments.map((enroll: any, idx: number) => ({
      STT: idx + 1,
      'Ngày': enroll.createdDate || (enroll.createdAt ? new Date(enroll.createdAt).toLocaleDateString('vi-VN') : ''),
      'Loại': enroll.type,
      'Lớp': enroll.className || '--',
      'Số buổi': enroll.sessions,
      'Số tiền': enroll.finalAmount || 0,
      'Ghi chú': enroll.note || enroll.reason || ''
    }));

    const contractData = contracts.map((contract: any, idx: number) => ({
      STT: idx + 1,
      'Mã HĐ': contract.code || contract.id?.slice(0, 8),
      'Loại': contract.category || contract.type,
      'Ngày tạo': contract.createdAt ? new Date(contract.createdAt).toLocaleDateString('vi-VN') : '--',
      'Tổng tiền': contract.totalAmount || 0,
      'Trạng thái': contract.status
    }));

    const wb = XLSX.utils.book_new();

    // Enrollment sheet
    if (enrollmentData.length > 0) {
      const wsEnroll = XLSX.utils.json_to_sheet(enrollmentData);
      XLSX.utils.book_append_sheet(wb, wsEnroll, 'Lịch sử ghi danh');
    }

    // Contracts sheet
    if (contractData.length > 0) {
      const wsContract = XLSX.utils.json_to_sheet(contractData);
      XLSX.utils.book_append_sheet(wb, wsContract, 'Hợp đồng');
    }

    const fileName = `TaiChinh_${student.fullName?.replace(/\s+/g, '_') || 'HocVien'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Calculate feedback stats for export
  const getFeedbackStats = () => {
    const allFeedbacks = [...callFeedbacks, ...formFeedbacks];
    const withScores = allFeedbacks.filter(f => f.averageScore);

    const calcAvg = (arr: number[]) => arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : '0';

    return {
      total: allFeedbacks.length,
      callCount: callFeedbacks.length,
      formCount: formFeedbacks.length,
      avgScore: calcAvg(withScores.map(f => f.averageScore || 0)),
      teacherAvg: calcAvg(allFeedbacks.filter(f => f.teacherScore).map(f => f.teacherScore || 0)),
      curriculumAvg: calcAvg(allFeedbacks.filter(f => f.curriculumScore).map(f => f.curriculumScore || 0)),
      serviceAvg: calcAvg(allFeedbacks.filter(f => f.careScore).map(f => f.careScore || 0)),
      facilityAvg: calcAvg(allFeedbacks.filter(f => f.facilitiesScore).map(f => f.facilitiesScore || 0)),
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-3 text-gray-600">Đang tải...</span>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
        <p className="text-gray-500 mb-4">Không tìm thấy học viên</p>
        <button 
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Quay lại
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-gray-500 hover:text-indigo-600 mb-4 transition-colors"
        >
          <ChevronLeft size={18} /> Quay lại
        </button>
        
        <div className="flex flex-col md:flex-row gap-6 items-start">
           <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center text-3xl font-bold text-indigo-600 border-4 border-white shadow-sm">
              {student.fullName.charAt(0)}
           </div>
           
           <div className="flex-1">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                 <div>
                    <h1 className="text-2xl font-bold text-gray-900">{student.fullName}</h1>
                    <p className="text-gray-500 font-medium">
                      {student.code} • <span className={`text-${student.status === 'Đang học' ? 'green' : 'gray'}-600`}>{student.status}</span>
                      {student.badDebt && <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-bold">Nợ xấu</span>}
                    </p>
                    {showSessionWarning && (
                      <div className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                        <AlertCircle size={16} className="text-amber-600" />
                        <span className="text-sm text-amber-700 font-medium">
                          Cảnh báo: Còn {remainingSessions} buổi học - Cần gia hạn hợp đồng!
                        </span>
                      </div>
                    )}
                 </div>
                 <div className="flex gap-2">
                    <button 
                      onClick={() => setShowEditModal(true)}
                      className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg font-medium hover:bg-indigo-100 transition-colors border border-indigo-200"
                    >
                       Sửa hồ sơ
                    </button>
                    <button 
                      onClick={() => setShowEnrollModal(true)}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                       Đăng ký lớp mới
                    </button>
                    <button 
                      onClick={() => setShowManualEnrollModal(true)}
                      className="px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors shadow-sm flex items-center gap-1"
                    >
                      <Plus size={16} />
                      Ghi danh thủ công
                    </button>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                 <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="p-2 bg-gray-50 rounded-full text-gray-400"><Phone size={16} /></div>
                    <div>
                       <p className="text-xs text-gray-400">Điện thoại</p>
                       <p className="font-medium">{student.phone}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="p-2 bg-gray-50 rounded-full text-gray-400"><Calendar size={16} /></div>
                    <div>
                       <p className="text-xs text-gray-400">Ngày sinh</p>
                       <p className="font-medium">{student.dob}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="p-2 bg-gray-50 rounded-full text-gray-400"><User size={16} /></div>
                    <div>
                       <p className="text-xs text-gray-400">Phụ huynh</p>
                       <p className="font-medium">{student.parentName}</p>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
         <div className="flex gap-6 overflow-x-auto">
            <button 
              onClick={() => setActiveTab('info')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'info' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
               Thông tin chung
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'history' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
               Lịch sử học tập
            </button>
            <button 
              onClick={() => setActiveTab('finance')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'finance' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
               Tài chính & Công nợ
            </button>
            <button 
              onClick={() => setActiveTab('feedback')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'feedback' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
               Chăm sóc & Feedback
            </button>
         </div>
      </div>

      {/* Content */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[300px]">
         {activeTab === 'info' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div>
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                     <User size={18} className="text-indigo-600" /> Thông tin cá nhân
                  </h3>
                  <div className="space-y-3 text-sm">
                     <div className="grid grid-cols-3 py-2 border-b border-gray-50">
                        <span className="text-gray-500">Họ và tên</span>
                        <span className="col-span-2 font-medium">{student.fullName}</span>
                     </div>
                     <div className="grid grid-cols-3 py-2 border-b border-gray-50">
                        <span className="text-gray-500">Giới tính</span>
                        <span className="col-span-2 font-medium">{student.gender}</span>
                     </div>
                     <div className="grid grid-cols-3 py-2 border-b border-gray-50">
                        <span className="text-gray-500">Ngày sinh</span>
                        <span className="col-span-2 font-medium">{student.dob}</span>
                     </div>
                     <div className="grid grid-cols-3 py-2 border-b border-gray-50">
                        <span className="text-gray-500">Địa chỉ</span>
                        <span className="col-span-2 font-medium">Chưa cập nhật</span>
                     </div>
                  </div>
               </div>
               
               <div>
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                     <User size={18} className="text-indigo-600" /> Thông tin phụ huynh
                  </h3>
                   <div className="space-y-3 text-sm">
                     <div className="grid grid-cols-3 py-2 border-b border-gray-50">
                        <span className="text-gray-500">Họ tên PH1</span>
                        <span className="col-span-2 font-medium">{student.parentName}</span>
                     </div>
                     <div className="grid grid-cols-3 py-2 border-b border-gray-50">
                        <span className="text-gray-500">Số điện thoại 1</span>
                        <span className="col-span-2 font-medium text-blue-600 cursor-pointer">{student.phone}</span>
                     </div>
                     <div className="grid grid-cols-3 py-2 border-b border-gray-50">
                        <span className="text-gray-500">Họ tên PH2</span>
                        <span className="col-span-2 font-medium text-gray-400 italic">Chưa cập nhật</span>
                     </div>
                     <div className="grid grid-cols-3 py-2 border-b border-gray-50">
                        <span className="text-gray-500">Số điện thoại 2</span>
                        <span className="col-span-2 font-medium text-gray-400 italic">Chưa cập nhật</span>
                     </div>
                     <div className="grid grid-cols-3 py-2 border-b border-gray-50">
                        <span className="text-gray-500">Email</span>
                        <span className="col-span-2 font-medium text-gray-400 italic">Chưa cập nhật</span>
                     </div>
                     <div className="grid grid-cols-3 py-2 border-b border-gray-50">
                        <span className="text-gray-500">Địa chỉ</span>
                        <span className="col-span-2 font-medium text-gray-400 italic">Chưa cập nhật</span>
                     </div>
                  </div>
               </div>
            </div>
         )}

         {activeTab === 'history' && (
            <div>
               {/* Header with Recalculate Button */}
               <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-gray-800">Thống kê điểm danh</h3>
                  <button
                     onClick={async () => {
                        if (!id) return;
                        if (!window.confirm('Bạn có chắc muốn tính lại số buổi đã học? Hệ thống sẽ đếm lại từ dữ liệu điểm danh thực tế.')) {
                           return;
                        }
                        setRecalculating(true);
                        try {
                           const result = await recalculateStudentStatus(id);
                           alert(`Đã tính lại số buổi:\n- Đã học: ${result.attended} buổi\n- Đăng ký: ${result.registered} buổi\n- Còn lại: ${result.remaining} buổi\n- Trạng thái: ${result.newStatus}`);
                           // Refresh page to show updated data
                           window.location.reload();
                        } catch (err) {
                           console.error('Error recalculating:', err);
                           alert('Không thể tính lại số buổi. Vui lòng thử lại.');
                        } finally {
                           setRecalculating(false);
                        }
                     }}
                     disabled={recalculating || !id}
                     className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed border border-indigo-200 transition-colors"
                  >
                     <RefreshCw size={16} className={recalculating ? 'animate-spin' : ''} />
                     {recalculating ? 'Đang tính lại...' : 'Tính lại số buổi'}
                  </button>
               </div>
               
               {/* Attendance Stats Cards */}
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 rounded-xl border border-emerald-200">
                     <div className="flex items-center gap-2 mb-2">
                        <TrendingUp size={18} className="text-emerald-600" />
                        <span className="text-sm font-medium text-emerald-700">Chuyên cần</span>
                     </div>
                     <p className="text-2xl font-bold text-emerald-700">{attendanceStats.attendanceRate}%</p>
                     <p className="text-xs text-emerald-600 mt-1">{attendanceStats.presentSessions}/{attendanceStats.totalSessions} buổi</p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
                     <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 size={18} className="text-blue-600" />
                        <span className="text-sm font-medium text-blue-700">Đúng giờ</span>
                     </div>
                     <p className="text-2xl font-bold text-blue-700">{attendanceStats.onTimeSessions}</p>
                     <p className="text-xs text-blue-600 mt-1">buổi đến đúng giờ</p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-xl border border-amber-200">
                     <div className="flex items-center gap-2 mb-2">
                        <Clock size={18} className="text-amber-600" />
                        <span className="text-sm font-medium text-amber-700">Đi trễ</span>
                     </div>
                     <p className="text-2xl font-bold text-amber-700">{attendanceStats.lateSessions}</p>
                     <p className="text-xs text-amber-600 mt-1">buổi đến muộn</p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl border border-red-200">
                     <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle size={18} className="text-red-600" />
                        <span className="text-sm font-medium text-red-700">Vắng mặt</span>
                     </div>
                     <p className="text-2xl font-bold text-red-700">{attendanceStats.absentSessions}</p>
                     <p className="text-xs text-red-600 mt-1">buổi nghỉ học</p>
                  </div>
               </div>

               <h3 className="font-bold text-gray-800 mb-4">Các lớp đã tham gia</h3>
               <div className="overflow-hidden border border-gray-200 rounded-lg">
                  <table className="w-full text-left text-sm">
                     <thead className="bg-gray-50 font-semibold text-gray-600">
                        <tr>
                           <th className="px-4 py-3">Tên lớp</th>
                           <th className="px-4 py-3">Giáo trình</th>
                           <th className="px-4 py-3">Thời gian</th>
                           <th className="px-4 py-3">Kết quả</th>
                           <th className="px-4 py-3 text-center">Trạng thái</th>
                           <th className="px-4 py-3 text-center">Thao tác</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100">
                        {(() => {
                           if (studentHistoryClasses.length === 0) {
                              return (
                                 <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                                       Chưa có lớp học nào
                                    </td>
                                 </tr>
                              );
                           }

                           return studentHistoryClasses.map(cls => {
                              const getStatusBadge = (status: string) => {
                                 const s = status?.toLowerCase() || '';
                                 if (s.includes('đang học') || s === 'active') return { bg: 'bg-green-100', text: 'text-green-700', label: 'Đang học' };
                                 if (s.includes('hoàn thành') || s === 'completed') return { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Hoàn thành' };
                                 if (s.includes('bảo lưu') || s === 'reserved') return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Bảo lưu' };
                                 if (s.includes('nghỉ') || s === 'inactive') return { bg: 'bg-red-100', text: 'text-red-700', label: 'Nghỉ học' };
                                 return { bg: 'bg-gray-100', text: 'text-gray-600', label: status || '--' };
                              };
                              const badge = getStatusBadge(student.status);
                              
                              return (
                                 <tr key={cls.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-indigo-600">{cls.name}</td>
                                    <td className="px-4 py-3">{cls.curriculum || '--'}</td>
                                    <td className="px-4 py-3">
                                       {cls.startDate ? new Date(cls.startDate).toLocaleDateString('vi-VN') : '--'}
                                       {' - '}
                                       {cls.endDate ? new Date(cls.endDate).toLocaleDateString('vi-VN') : 'Nay'}
                                    </td>
                                    <td className="px-4 py-3">
                                      {typeof cls.attended === 'number' && typeof cls.registered === 'number'
                                        ? `${cls.attended}/${cls.registered}`
                                        : '--'}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                       <span className={`${badge.bg} ${badge.text} px-2 py-1 rounded text-xs font-bold`}>
                                          {badge.label}
                                       </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                       <button
                                          onClick={async () => {
                                             setViewingClassId(cls.id);
                                             setViewingClassName(cls.name || '');
                                             setLoadingClassAttendance(true);
                                             try {
                                                const attendanceQuery = query(
                                                   collection(null as any /* firebase removed */, 'studentAttendance'),
                                                   where('studentId', '==', id),
                                                   where('classId', '==', cls.id)
                                                );
                                                const attendanceSnap = await getDocs(attendanceQuery);
                                                const records = attendanceSnap.docs.map(d => ({
                                                   id: d.id,
                                                   ...d.data()
                                                })).sort((a: any, b: any) => {
                                                   const dateA = a.date || '';
                                                   const dateB = b.date || '';
                                                   return dateB.localeCompare(dateA);
                                                });
                                                setClassAttendanceRecords(records);
                                             } catch (error) {
                                                console.error('Error loading class attendance:', error);
                                                alert('Không thể tải danh sách buổi học');
                                             } finally {
                                                setLoadingClassAttendance(false);
                                             }
                                          }}
                                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors"
                                       >
                                          <Eye size={14} />
                                          Xem
                                       </button>
                                    </td>
                                 </tr>
                              );
                           });
                        })()}
                     </tbody>
                  </table>
               </div>

               {/* Modal xem các buổi đã học */}
               {viewingClassId && (
                  <ModalPortal>
                     <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                           <div className="flex items-center justify-between p-6 border-b border-gray-200">
                              <div>
                                 <h3 className="text-lg font-bold text-gray-800">Các buổi đã học</h3>
                                 <p className="text-sm text-gray-500 mt-1">
                                    {viewingClassName || classes.find(c => c.id === viewingClassId)?.name || 'N/A'}
                                 </p>
                              </div>
                              <button
                                 onClick={() => {
                                    setViewingClassId(null);
                                    setViewingClassName('');
                                    setClassAttendanceRecords([]);
                                 }}
                                 className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                              >
                                 <X size={20} className="text-gray-500" />
                              </button>
                           </div>
                           
                           <div className="flex-1 overflow-y-auto p-6">
                              {loadingClassAttendance ? (
                                 <div className="text-center py-10">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3"></div>
                                    <p className="text-gray-500">Đang tải...</p>
                                 </div>
                              ) : classAttendanceRecords.length === 0 ? (
                                 <div className="text-center py-10 text-gray-400">
                                    <CalendarCheck size={48} className="mx-auto mb-3 opacity-50" />
                                    <p>Chưa có buổi học nào được ghi nhận</p>
                                 </div>
                              ) : (
                                 <div className="space-y-3">
                                    {classAttendanceRecords.map((record: any) => {
                                       const getStatusColor = (status: string) => {
                                          if (status === 'Đúng giờ') return 'bg-green-100 text-green-700';
                                          if (status === 'Trễ giờ') return 'bg-yellow-100 text-yellow-700';
                                          if (status === 'Vắng') return 'bg-red-100 text-red-700';
                                          if (status === 'Bảo lưu') return 'bg-blue-100 text-blue-700';
                                          if (status === 'Đã bồi') return 'bg-purple-100 text-purple-700';
                                          return 'bg-gray-100 text-gray-700';
                                       };
                                       
                                       return (
                                          <div key={record.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                                             <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                   <div className="flex items-center gap-3 mb-2">
                                                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(record.status || '')}`}>
                                                         {record.status || 'N/A'}
                                                      </span>
                                                      {record.sessionNumber && (
                                                         <span className="text-sm text-gray-600">
                                                            Buổi #{record.sessionNumber}
                                                         </span>
                                                      )}
                                                      {record.attendanceType === 'makeup' ? (
                                                         <span className="text-xs text-orange-600">⚠️ Học bù</span>
                                                      ) : record.attendanceType === 'session' || record.sessionId ? (
                                                         <span className="text-xs text-green-600">✅ Buổi chính thức</span>
                                                      ) : record.attendanceType === 'manual' ? (
                                                         <span className="text-xs text-blue-600">📝 Điểm danh thủ công</span>
                                                      ) : null}
                                                   </div>
                                                   <div className="text-sm text-gray-600 space-y-1">
                                                      <div className="flex items-center gap-2">
                                                         <Calendar size={14} />
                                                         <span>{record.date ? new Date(record.date).toLocaleDateString('vi-VN') : 'N/A'}</span>
                                                      </div>
                                                      {record.note && (
                                                         <div className="flex items-start gap-2 mt-2">
                                                            <FileText size={14} className="mt-0.5 flex-shrink-0" />
                                                            <span className="text-xs text-gray-500">{record.note}</span>
                                                         </div>
                                                      )}
                                                      {(record.homeworkCompletion !== undefined || record.score !== undefined || record.testName) && (
                                                         <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                                            {record.homeworkCompletion !== undefined && (
                                                               <span>BTVN: {record.homeworkCompletion}%</span>
                                                            )}
                                                            {record.testName && (
                                                               <span>Bài KT: {record.testName}</span>
                                                            )}
                                                            {record.score !== undefined && (
                                                               <span>Điểm: {record.score}</span>
                                                            )}
                                                         </div>
                                                      )}
                                                   </div>
                                                </div>
                                             </div>
                                          </div>
                                       );
                                    })}
                                 </div>
                              )}
                           </div>
                           
                           <div className="border-t border-gray-200 p-4 bg-gray-50">
                              <div className="flex items-center justify-between text-sm">
                                 <span className="text-gray-600">
                                    Tổng: <strong>{classAttendanceRecords.length}</strong> buổi
                                 </span>
                                 <button
                                    onClick={() => {
                                       setViewingClassId(null);
                                       setViewingClassName('');
                                       setClassAttendanceRecords([]);
                                    }}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                                 >
                                    Đóng
                                 </button>
                              </div>
                           </div>
                        </div>
                     </div>
                  </ModalPortal>
               )}

               {/* Tutoring History Section */}
               <div className="mt-8">
                  <div className="flex items-center gap-2 mb-4">
                     <div className="p-2 bg-violet-100 rounded-lg">
                        <GraduationCap className="text-violet-600" size={20} />
                     </div>
                     <h3 className="font-bold text-gray-800">Lịch sử bồi bài</h3>
                     <span className="text-xs bg-violet-100 text-violet-700 px-2 py-1 rounded-full font-bold">
                        {studentTutoring.length}
                     </span>
                  </div>

                  {tutoringLoading ? (
                     <div className="text-center py-6">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-600 mx-auto mb-2"></div>
                        <p className="text-sm text-gray-500">Đang tải...</p>
                     </div>
                  ) : studentTutoring.length === 0 ? (
                     <div className="bg-gray-50 rounded-xl p-6 text-center">
                        <GraduationCap size={32} className="mx-auto text-gray-300 mb-2" />
                        <p className="text-gray-400 text-sm">Chưa có lịch sử bồi bài</p>
                     </div>
                  ) : (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {studentTutoring.map((session) => {
                           const getStatusStyle = (status: string) => {
                              switch(status) {
                                 case 'Chưa bồi': return { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-600', icon: Circle };
                                 case 'Đã hẹn': return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', icon: CalendarCheck };
                                 case 'Đã bồi': return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', icon: CheckCircle2 };
                                 default: return { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600', icon: Circle };
                              }
                           };
                           const style = getStatusStyle(session.status);
                           const StatusIcon = style.icon;

                           return (
                              <div 
                                 key={session.id} 
                                 className={`${style.bg} ${style.border} border rounded-xl p-4 transition-all hover:shadow-md`}
                              >
                                 <div className="flex items-center justify-between mb-2">
                                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${style.text}`}>
                                       <StatusIcon size={14} />
                                       {session.status === 'Đã bồi' ? 'Hoàn thành' : session.status}
                                    </span>
                                    {session.scheduledDate && (
                                       <span className="text-xs text-gray-500">
                                          {new Date(session.scheduledDate).toLocaleDateString('vi-VN')}
                                       </span>
                                    )}
                                 </div>
                                 
                                 <p className="text-sm font-medium text-gray-800 mb-1">{session.className}</p>
                                 
                                 <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                                    {session.scheduledTime && (
                                       <span className="flex items-center gap-1">
                                          <Clock size={10} />
                                          {session.scheduledTime}
                                       </span>
                                    )}
                                    {session.tutorName && (
                                       <span className="flex items-center gap-1 text-violet-600">
                                          <User size={10} />
                                          {session.tutorName}
                                       </span>
                                    )}
                                 </div>
                                 
                                 {session.note && (
                                    <p className="mt-2 text-xs text-gray-400 italic truncate" title={session.note}>
                                       {session.note}
                                    </p>
                                 )}
                              </div>
                           );
                        })}
                     </div>
                  )}
               </div>
            </div>
         )}

         {activeTab === 'finance' && (
            <div className="space-y-6">
               {financeLoading ? (
                  <div className="text-center py-10">
                     <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3"></div>
                     <p className="text-gray-500">Đang tải dữ liệu...</p>
                  </div>
               ) : (
                  <>
                     {/* Summary Cards */}
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
                           <div className="flex items-center gap-2 mb-2">
                              <BookOpen size={18} className="text-blue-600" />
                              <span className="text-sm font-medium text-blue-700">Buổi đăng ký</span>
                           </div>
                           <p className="text-2xl font-bold text-blue-700">{student ? getStudentSessionData(student).registered : 0}</p>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 rounded-xl border border-emerald-200">
                           <div className="flex items-center gap-2 mb-2">
                              <CheckCircle2 size={18} className="text-emerald-600" />
                              <span className="text-sm font-medium text-emerald-700">Đã học</span>
                           </div>
                           {(() => {
                              const sessionData = student ? getStudentSessionData(student) : { attended: 0, legacyAttended: 0 };
                              const total = sessionData.attended + (sessionData.legacyAttended || 0);
                              return (
                                <>
                                  <p className="text-2xl font-bold text-emerald-700">{total}</p>
                                  {(sessionData.legacyAttended || 0) > 0 && (
                                    <p className="text-xs text-emerald-600 mt-1">
                                      Mới: {sessionData.attended} | Cũ: {sessionData.legacyAttended}
                                    </p>
                                  )}
                                </>
                              );
                           })()}
                        </div>
                        <div className={`bg-gradient-to-br p-4 rounded-xl border ${remainingSessions <= 6 ? 'from-amber-50 to-amber-100 border-amber-200' : 'from-gray-50 to-gray-100 border-gray-200'}`}>
                           <div className="flex items-center gap-2 mb-2">
                              <Clock size={18} className={remainingSessions <= 6 ? 'text-amber-600' : 'text-gray-600'} />
                              <span className={`text-sm font-medium ${remainingSessions <= 6 ? 'text-amber-700' : 'text-gray-700'}`}>Còn lại (TT nợ HV)</span>
                           </div>
                           <p className={`text-2xl font-bold ${remainingSessions <= 6 ? 'text-amber-700' : 'text-gray-700'}`}>{remainingSessions}</p>
                           {remainingSessions > 0 && (
                              <p className={`text-xs mt-1 ${remainingSessions <= 6 ? 'text-amber-600' : 'text-gray-500'}`}>
                                 ~{((remainingSessions * 150000) / 1000000).toFixed(1)} triệu
                              </p>
                           )}
                        </div>
                        <div className={`bg-gradient-to-br p-4 rounded-xl border ${student?.badDebt ? 'from-red-50 to-red-100 border-red-200' : 'from-gray-50 to-gray-100 border-gray-200'}`}>
                           <div className="flex items-center gap-2 mb-2">
                              <BadgeDollarSign size={18} className={student?.badDebt ? 'text-red-600' : 'text-gray-600'} />
                              <span className={`text-sm font-medium ${student?.badDebt ? 'text-red-700' : 'text-gray-700'}`}>Nợ xấu</span>
                           </div>
                           <p className={`text-2xl font-bold ${student?.badDebt ? 'text-red-700' : 'text-gray-700'}`}>
                              {student?.badDebtAmount ? `${(student.badDebtAmount / 1000000).toFixed(1)}tr` : '0'}
                           </p>
                        </div>
                     </div>

                     {/* Class progress history (includes old classes) */}
                     {classProgressRows.length > 0 && (
                        <div className="bg-white border border-gray-200 rounded-xl p-4">
                           <h4 className="font-semibold text-gray-800 mb-3">Tiến độ theo lớp (gồm lớp cũ)</h4>
                           <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                 <thead className="text-xs text-gray-500 uppercase border-b">
                                    <tr>
                                       <th className="py-2 text-left">Lớp</th>
                                       <th className="py-2 text-center">Đăng ký</th>
                                       <th className="py-2 text-center">Đã điểm danh</th>
                                       <th className="py-2 text-center">Còn lại</th>
                                    </tr>
                                 </thead>
                                 <tbody>
                                    {classProgressRows.map(row => (
                                       <tr key={row.classId} className="border-b last:border-b-0">
                                          <td className="py-2">
                                             <div className="flex items-center gap-2">
                                                <span className="font-medium text-gray-800">{row.className || '--'}</span>
                                                {row.isCurrent && (
                                                   <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700">
                                                      Lớp hiện tại
                                                   </span>
                                                )}
                                             </div>
                                          </td>
                                          <td className="py-2 text-center text-blue-700 font-semibold">{row.registered}</td>
                                          <td className="py-2 text-center text-green-700 font-semibold">{row.attended}</td>
                                          <td className={`py-2 text-center font-semibold ${row.remaining < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                                             {row.remaining}
                                          </td>
                                       </tr>
                                    ))}
                                 </tbody>
                              </table>
                           </div>
                        </div>
                     )}

                     {/* Enrollment History */}
                     <div>
                        <div className="flex items-center justify-between mb-4">
                           <h3 className="font-bold text-gray-800 flex items-center gap-2">
                              <History size={18} className="text-indigo-600" /> Lịch sử ghi danh & tài chính
                           </h3>
                           <button
                              onClick={exportFinanceHistory}
                              disabled={enrollments.length === 0 && contracts.length === 0}
                              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed border border-green-200"
                           >
                              <FileDown size={16} />
                              Xuất Excel
                           </button>
                        </div>
                        <div className="overflow-hidden border border-gray-200 rounded-lg">
                           <table className="w-full text-left text-sm">
                              <thead className="bg-gray-50 font-semibold text-gray-600">
                                 <tr>
                                    <th className="px-4 py-3">Ngày</th>
                                    <th className="px-4 py-3">Loại</th>
                                    <th className="px-4 py-3">Lớp</th>
                                    <th className="px-4 py-3 text-center">Số buổi</th>
                                    <th className="px-4 py-3 text-right">Số tiền</th>
                                    <th className="px-4 py-3">Ghi chú</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                 {enrollments.length === 0 ? (
                                    <tr>
                                       <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                                          Chưa có lịch sử ghi danh
                                       </td>
                                    </tr>
                                 ) : enrollments.map((enroll: any) => (
                                    <tr key={enroll.id} className="hover:bg-gray-50">
                                       <td className="px-4 py-3">{enroll.createdDate || new Date(enroll.createdAt).toLocaleDateString('vi-VN')}</td>
                                       <td className="px-4 py-3">
                                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                             enroll.type === 'Hợp đồng mới' ? 'bg-green-100 text-green-700' :
                                             enroll.type === 'Hợp đồng tái phí' ? 'bg-blue-100 text-blue-700' :
                                             enroll.type === 'Ghi danh thủ công' ? 'bg-purple-100 text-purple-700' :
                                             enroll.type === 'Tặng buổi' ? 'bg-pink-100 text-pink-700' :
                                             enroll.type === 'Nhận tặng buổi' ? 'bg-emerald-100 text-emerald-700' :
                                             enroll.type === 'Chuyển lớp' ? 'bg-amber-100 text-amber-700' :
                                             'bg-gray-100 text-gray-700'
                                          }`}>
                                             {enroll.type}
                                          </span>
                                       </td>
                                       <td className="px-4 py-3">{enroll.className || '--'}</td>
                                       <td className="px-4 py-3 text-center font-medium">
                                          <span className={enroll.sessions > 0 ? 'text-green-600' : enroll.sessions < 0 ? 'text-red-600' : ''}>
                                             {enroll.sessions > 0 ? '+' : ''}{enroll.sessions}
                                          </span>
                                       </td>
                                       <td className="px-4 py-3 text-right">{enroll.finalAmount ? enroll.finalAmount.toLocaleString('vi-VN') + 'đ' : '--'}</td>
                                       <td className="px-4 py-3 text-gray-500 truncate max-w-[200px]" title={enroll.note || enroll.reason}>{enroll.note || enroll.reason || '--'}</td>
                                    </tr>
                                 ))}
                              </tbody>
                           </table>
                        </div>
                     </div>

                     {/* Contract History */}
                     <div>
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                           <CreditCard size={18} className="text-indigo-600" /> Lịch sử hợp đồng
                        </h3>
                        <div className="overflow-hidden border border-gray-200 rounded-lg">
                           <table className="w-full text-left text-sm">
                              <thead className="bg-gray-50 font-semibold text-gray-600">
                                 <tr>
                                    <th className="px-4 py-3">Mã HĐ</th>
                                    <th className="px-4 py-3">Loại</th>
                                    <th className="px-4 py-3">Ngày tạo</th>
                                    <th className="px-4 py-3 text-right">Tổng tiền</th>
                                    <th className="px-4 py-3 text-center">Trạng thái</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                 {contracts.length === 0 ? (
                                    <tr>
                                       <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                                          Chưa có hợp đồng
                                       </td>
                                    </tr>
                                 ) : contracts.map((contract: any) => (
                                    <tr key={contract.id} className="hover:bg-gray-50">
                                       <td className="px-4 py-3 font-medium text-gray-700">{contract.code || contract.id.slice(0, 8)}</td>
                                       <td className="px-4 py-3">{contract.category || contract.type}</td>
                                       <td className="px-4 py-3">{contract.createdAt ? new Date(contract.createdAt).toLocaleDateString('vi-VN') : '--'}</td>
                                       <td className="px-4 py-3 text-right font-medium">{contract.totalAmount?.toLocaleString('vi-VN')}đ</td>
                                       <td className="px-4 py-3 text-center">
                                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                             contract.status === 'Đã thanh toán' ? 'bg-green-100 text-green-700' :
                                             contract.status === 'Nợ phí' ? 'bg-red-100 text-red-700' :
                                             contract.status === 'Nháp' ? 'bg-gray-100 text-gray-700' :
                                             'bg-amber-100 text-amber-700'
                                          }`}>
                                             {contract.status}
                                          </span>
                                       </td>
                                    </tr>
                                 ))}
                              </tbody>
                           </table>
                        </div>
                     </div>

                     {/* Bad Debt Section */}
                     {student?.badDebt && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                           <h3 className="font-bold text-red-800 mb-3 flex items-center gap-2">
                              <AlertTriangle size={18} /> Thông tin nợ xấu
                           </h3>
                           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                 <p className="text-red-600">Số buổi nợ</p>
                                 <p className="font-bold text-red-800">{student.badDebtSessions || 0} buổi</p>
                              </div>
                              <div>
                                 <p className="text-red-600">Số tiền nợ</p>
                                 <p className="font-bold text-red-800">{(student.badDebtAmount || 0).toLocaleString('vi-VN')}đ</p>
                              </div>
                              <div>
                                 <p className="text-red-600">Ngày ghi nhận</p>
                                 <p className="font-bold text-red-800">{student.badDebtDate || '--'}</p>
                              </div>
                              <div>
                                 <p className="text-red-600">Ghi chú</p>
                                 <p className="font-medium text-red-800">{student.badDebtNote || '--'}</p>
                              </div>
                           </div>
                        </div>
                     )}

                     {/* Settlement History Section */}
                     <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 border-b bg-gray-50">
                           <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                              <FileText size={18} className="text-indigo-600" />
                              Lịch sử tất toán
                           </h3>
                        </div>
                        <SettlementHistoryTable
                           invoices={settlementInvoices}
                           loading={settlementLoading}
                           showStudentName={false}
                        />
                     </div>
                  </>
               )}
            </div>
         )}

         {activeTab === 'feedback' && (
            <div className="space-y-8">
               {feedbackLoading ? (
                  <div className="text-center py-10">
                     <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-3"></div>
                     <p className="text-gray-500">Đang tải dữ liệu phản hồi...</p>
                  </div>
               ) : (
                  <>
                     {/* Call Feedback Section */}
                     <div>
                        <div className="flex items-center justify-between mb-3 px-1">
                            <h3 className="bg-green-500 text-white px-3 py-1 text-sm font-bold uppercase inline-block">
                               Phản hồi từ Khách hàng liên hệ qua điện thoại
                            </h3>
                            <button 
                              onClick={() => setShowReportModal(true)}
                              className="text-xs text-blue-600 hover:underline font-medium"
                            >
                              Xem báo cáo
                            </button>
                        </div>
                        <div className="overflow-x-auto border border-gray-200">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead>
                                    <tr className="bg-green-500 text-white font-bold text-xs">
                                        <th className="p-2 border-r border-green-400 text-center w-10">STT</th>
                                        <th className="p-2 border-r border-green-400">Phụ Huynh</th>
                                        <th className="p-2 border-r border-green-400">Học viên</th>
                                        <th className="p-2 border-r border-green-400 w-16">Trạng thái</th>
                                        <th className="p-2 border-r border-green-400">Giáo Viên</th>
                                        <th className="p-2 border-r border-green-400 text-center">Chương trình học</th>
                                        <th className="p-2 border-r border-green-400">Chăm sóc khách hàng</th>
                                        <th className="p-2 border-r border-green-400 text-center">Cơ sở vật chất</th>
                                        <th className="p-2 border-r border-green-400 text-center w-16">Điểm TB</th>
                                        <th className="p-2">Người gọi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {callFeedbacks.length === 0 ? (
                                       <tr>
                                          <td colSpan={10} className="p-4 text-center text-gray-400">
                                             Chưa có phản hồi qua điện thoại
                                          </td>
                                       </tr>
                                    ) : callFeedbacks.map((fb, idx) => (
                                        <tr key={fb.id} className="border-b border-gray-200 hover:bg-gray-50">
                                            <td className="p-2 border-r border-gray-200 text-center">{idx + 1}</td>
                                            <td className="p-2 border-r border-gray-200">
                                               <span className="font-bold">{fb.parentName || student.parentName}</span>
                                               <br/><span className="text-xs text-gray-500">{fb.parentPhone || student.phone}</span>
                                            </td>
                                            <td className="p-2 border-r border-gray-200">
                                               {fb.studentName || student.fullName}
                                               <br/><span className="text-xs text-gray-500">{fb.className}</span>
                                            </td>
                                            <td className="p-2 border-r border-gray-200 text-center">
                                               <span className={`px-2 py-0.5 rounded text-xs ${
                                                  fb.status === 'Đã gọi' ? 'bg-blue-100 text-blue-700' :
                                                  fb.status === 'Hoàn thành' ? 'bg-green-100 text-green-700' :
                                                  'bg-yellow-100 text-yellow-700'
                                               }`}>{fb.status}</span>
                                            </td>
                                            <td className="p-2 border-r border-gray-200">
                                               {fb.teacher && <span>{fb.teacher}</span>}
                                               {fb.teacherScore && <span className="font-bold"> ({fb.teacherScore})</span>}
                                               {!fb.teacher && !fb.teacherScore && '---'}
                                            </td>
                                            <td className="p-2 border-r border-gray-200 text-center">{fb.curriculumScore || '---'}</td>
                                            <td className="p-2 border-r border-gray-200">
                                                {fb.content && <span>{fb.content}</span>}
                                                {fb.careScore && <><br/><span className="font-bold">{fb.careScore}</span></>}
                                                {!fb.content && !fb.careScore && '---'}
                                            </td>
                                            <td className="p-2 border-r border-gray-200 text-center">{fb.facilitiesScore || '---'}</td>
                                            <td className="p-2 border-r border-gray-200 text-center font-bold">{fb.averageScore?.toFixed(2) || '---'}</td>
                                            <td className="p-2">{fb.caller || '---'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                     </div>

                     {/* Form Feedback Section */}
                     <div>
                        <div className="flex items-center justify-between mb-3 px-1">
                            <h3 className="bg-green-500 text-white px-3 py-1 text-sm font-bold uppercase inline-block">
                               Phản hồi từ Khách hàng điền qua FORM
                            </h3>
                        </div>
                        <div className="overflow-x-auto border border-gray-200">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead>
                                    <tr className="bg-green-500 text-white font-bold text-xs">
                                        <th className="p-2 border-r border-green-400 text-center w-10">STT</th>
                                        <th className="p-2 border-r border-green-400">Phụ Huynh</th>
                                        <th className="p-2 border-r border-green-400">Học viên</th>
                                        <th className="p-2 border-r border-green-400">Giáo Viên</th>
                                        <th className="p-2 border-r border-green-400 text-center">Chương trình học</th>
                                        <th className="p-2 border-r border-green-400">Chăm sóc khách hàng</th>
                                        <th className="p-2 border-r border-green-400 text-center">Cơ sở vật chất</th>
                                        <th className="p-2 text-center w-16">Điểm TB</th>
                                    </tr>
                                </thead>
                                <tbody>
                                     {formFeedbacks.length === 0 ? (
                                        <tr>
                                           <td colSpan={8} className="p-4 text-center text-gray-400">
                                              Chưa có phản hồi qua Form
                                           </td>
                                        </tr>
                                     ) : formFeedbacks.map((fb, idx) => (
                                        <tr key={fb.id} className="border-b border-gray-200 hover:bg-gray-50">
                                            <td className="p-2 border-r border-gray-200 text-center">{idx + 1}</td>
                                            <td className="p-2 border-r border-gray-200">
                                               <span className="font-bold">{fb.parentName || student.parentName}</span>
                                               <br/><span className="text-xs text-gray-500">{fb.parentPhone || student.phone}</span>
                                            </td>
                                            <td className="p-2 border-r border-gray-200">
                                               {fb.studentName || student.fullName}
                                               <br/><span className="text-xs text-gray-500">{fb.className}</span>
                                            </td>
                                            <td className="p-2 border-r border-gray-200">
                                               {fb.teacher && <span>{fb.teacher}</span>}
                                               {fb.teacherScore && <span className="font-bold"> ({fb.teacherScore})</span>}
                                               {!fb.teacher && !fb.teacherScore && '---'}
                                            </td>
                                            <td className="p-2 border-r border-gray-200 text-center">{fb.curriculumScore || '---'}</td>
                                            <td className="p-2 border-r border-gray-200">
                                                {fb.content && <span>{fb.content}</span>}
                                                {fb.careScore && <><br/><span className="font-bold">{fb.careScore}</span></>}
                                                {!fb.content && !fb.careScore && '---'}
                                            </td>
                                            <td className="p-2 border-r border-gray-200 text-center">{fb.facilitiesScore || '---'}</td>
                                            <td className="p-2 text-center font-bold">{fb.averageScore?.toFixed(2) || '---'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                     </div>
                  </>
               )}
            </div>
         )}
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-purple-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Sửa hồ sơ học viên</h3>
                <p className="text-sm text-indigo-600">{student.fullName}</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={22} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Personal Info */}
                <div>
                  <h4 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <User size={16} className="text-indigo-600" /> Thông tin cá nhân
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên *</label>
                      <input
                        type="text"
                        value={editForm.fullName}
                        onChange={(e) => setEditForm({...editForm, fullName: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Giới tính</label>
                      <select
                        value={editForm.gender}
                        onChange={(e) => setEditForm({...editForm, gender: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="Nam">Nam</option>
                        <option value="Nữ">Nữ</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ngày sinh</label>
                      <input
                        type="date"
                        value={editForm.dob}
                        onChange={(e) => setEditForm({...editForm, dob: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Parent Info */}
                <div>
                  <h4 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <User size={16} className="text-indigo-600" /> Thông tin phụ huynh
                  </h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Họ tên PH1 *</label>
                        <input
                          type="text"
                          value={editForm.parentName}
                          onChange={(e) => setEditForm({...editForm, parentName: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">SĐT 1 *</label>
                        <input
                          type="tel"
                          value={editForm.phone}
                          onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Họ tên PH2</label>
                        <input
                          type="text"
                          value={editForm.parentName2}
                          onChange={(e) => setEditForm({...editForm, parentName2: e.target.value})}
                          placeholder="Nhập tên PH2"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">SĐT 2</label>
                        <input
                          type="tel"
                          value={editForm.phone2}
                          onChange={(e) => setEditForm({...editForm, phone2: e.target.value})}
                          placeholder="Nhập SĐT 2"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                        placeholder="Nhập email"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
                      <input
                        type="text"
                        value={editForm.address}
                        onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                        placeholder="Nhập địa chỉ"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                Hủy
              </button>
              <button
                onClick={() => { alert('Đã lưu thay đổi!'); setShowEditModal(false); }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Enroll Class Modal */}
      {showEnrollModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-green-50 to-teal-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Đăng ký lớp mới</h3>
                <p className="text-sm text-teal-600">Học viên: {student.fullName}</p>
              </div>
              <button onClick={() => setShowEnrollModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={22} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chọn lớp học *</label>
                <select
                  value={enrollForm.classId}
                  onChange={(e) => {
                    const selectedClass = classes.find(c => c.id === e.target.value);
                    setEnrollForm({
                      ...enrollForm, 
                      classId: e.target.value,
                      // Temporarily set to class's totalSessions (will be updated after fetching actual sessions)
                      sessions: selectedClass?.totalSessions || 0
                    });
                    setNextSessionInfo(null); // Reset để tránh hiển thị số cũ
                    // Fetch next available session for this class (will update sessions count)
                    fetchNextSession(e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Chọn lớp --</option>
                  {classes
                    .filter(c => c.status === 'Đang học' || c.status === 'Chờ mở' || c.status === 'Active' || c.status === 'Pending')
                    .map(cls => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} - {cls.teacher} ({formatSchedule(cls.schedule)}) {cls.totalSessions ? `[${cls.totalSessions} buổi]` : ''}
                      </option>
                    ))}
                </select>
                {loadingNextSession && (
                  <p className="text-xs text-gray-500 mt-1">Đang tải thông tin buổi học...</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ngày bắt đầu
                  {nextSessionInfo && (
                    <span className="text-xs text-green-600 font-normal ml-1">(Buổi {nextSessionInfo.sessionNumber})</span>
                  )}
                </label>
                <input
                  type="date"
                  value={enrollForm.startDate}
                  onChange={(e) => setEnrollForm({...enrollForm, startDate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
                {nextSessionInfo && (
                  <p className="text-xs text-gray-500 mt-1">
                    Tiến độ lớp: {nextSessionInfo.completedSessions}/{nextSessionInfo.totalSessions} buổi đã học
                    {nextSessionInfo.completedSessions > 0 && (
                      <span className="text-orange-600"> - Học viên sẽ bắt đầu từ buổi {nextSessionInfo.sessionNumber}</span>
                    )}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số buổi đăng ký</label>
                <input
                  type="number"
                  value={enrollForm.sessions}
                  onChange={(e) => setEnrollForm({...enrollForm, sessions: parseInt(e.target.value) || 1})}
                  min={1}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                <textarea
                  value={enrollForm.notes}
                  onChange={(e) => setEnrollForm({...enrollForm, notes: e.target.value})}
                  rows={3}
                  placeholder="Ghi chú thêm..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {enrollForm.classId && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>Lớp đã chọn:</strong> {classes.find(c => c.id === enrollForm.classId)?.name}
                  </p>
                  <p className="text-sm text-blue-600">
                    Giáo viên: {classes.find(c => c.id === enrollForm.classId)?.teacher}
                  </p>
                  {nextSessionInfo && (
                    <p className="text-sm text-green-600 mt-1">
                      Tổng số buổi: <strong>{nextSessionInfo.totalSessions}</strong> buổi 
                      {nextSessionInfo.completedSessions > 0 && (
                        <span> (Đã học: {nextSessionInfo.completedSessions} buổi)</span>
                      )}
                    </p>
                  )}
                  {nextSessionInfo && nextSessionInfo.totalSessions === 0 && (
                    <p className="text-sm text-orange-600 mt-1">
                      ⚠️ Lớp chưa có buổi học. Vui lòng tạo buổi học trước khi đăng ký.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
              <button
                onClick={() => setShowEnrollModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                Hủy
              </button>
              <button
                onClick={async () => { 
                  if (!enrollForm.classId) {
                    alert('Vui lòng chọn lớp học!');
                    return;
                  }
                  
                  setEnrolling(true);
                  try {
                    const selectedClass = classes.find(c => c.id === enrollForm.classId);
                    if (!selectedClass) {
                      alert('Không tìm thấy lớp học!');
                      return;
                    }
                    
                    // Update student with new class
                    await updateStudent(id!, {
                      classId: enrollForm.classId,
                      class: selectedClass.name,
                      status: StudentStatus.ACTIVE, // Update status to active
                      enrollmentDate: enrollForm.startDate,
                      registeredSessions: enrollForm.sessions, // Số buổi đăng ký (để track nợ phí)
                      attendedSessions: 0, // Reset attended sessions
                      startSessionNumber: nextSessionInfo?.sessionNumber || 1, // Buổi bắt đầu học
                    });
                    
                    alert('Đã đăng ký lớp thành công!'); 
                    setShowEnrollModal(false);
                    setNextSessionInfo(null);
                    // Reset form
                    setEnrollForm({
                      classId: '',
                      startDate: new Date().toISOString().split('T')[0],
                      sessions: 48,
                      notes: '',
                      startSessionNumber: 1,
                    });
                  } catch (err) {
                    console.error('Error enrolling student:', err);
                    alert('Có lỗi khi đăng ký lớp. Vui lòng thử lại!');
                  } finally {
                    setEnrolling(false);
                  }
                }}
                disabled={enrolling}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {enrolling ? 'Đang xử lý...' : 'Xác nhận đăng ký'}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Feedback Report Modal */}
      {showReportModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-green-50 to-teal-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Báo cáo phản hồi khách hàng</h3>
                <p className="text-sm text-teal-600">Học viên: {student.fullName}</p>
              </div>
              <button onClick={() => setShowReportModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={22} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[60vh]">
              {/* Summary Stats */}
              {(() => {
                const stats = getFeedbackStats();
                return (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-blue-50 p-4 rounded-lg text-center">
                        <p className="text-2xl font-bold text-blue-700">{stats.total}</p>
                        <p className="text-xs text-blue-600">Tổng phản hồi</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg text-center">
                        <p className="text-2xl font-bold text-green-700">{stats.callCount}</p>
                        <p className="text-xs text-green-600">Qua điện thoại</p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg text-center">
                        <p className="text-2xl font-bold text-purple-700">{stats.formCount}</p>
                        <p className="text-xs text-purple-600">Qua Form</p>
                      </div>
                      <div className="bg-orange-50 p-4 rounded-lg text-center">
                        <p className="text-2xl font-bold text-orange-700">{stats.avgScore}</p>
                        <p className="text-xs text-orange-600">Điểm TB</p>
                      </div>
                    </div>

                    {/* Score Breakdown */}
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-700 mb-3">Điểm đánh giá chi tiết</h4>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-600 w-40">Giáo viên</span>
                          <div className="flex-1 bg-gray-200 rounded-full h-3">
                            <div className="bg-green-500 h-3 rounded-full" style={{width: `${(parseFloat(String(stats.teacherAvg)) / 5) * 100}%`}}></div>
                          </div>
                          <span className="text-sm font-bold text-gray-700 w-12">{stats.teacherAvg}/5</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-600 w-40">Chương trình học</span>
                          <div className="flex-1 bg-gray-200 rounded-full h-3">
                            <div className="bg-blue-500 h-3 rounded-full" style={{width: `${(parseFloat(String(stats.curriculumAvg)) / 5) * 100}%`}}></div>
                          </div>
                          <span className="text-sm font-bold text-gray-700 w-12">{stats.curriculumAvg}/5</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-600 w-40">Chăm sóc khách hàng</span>
                          <div className="flex-1 bg-gray-200 rounded-full h-3">
                            <div className="bg-purple-500 h-3 rounded-full" style={{width: `${(parseFloat(String(stats.serviceAvg)) / 5) * 100}%`}}></div>
                          </div>
                          <span className="text-sm font-bold text-gray-700 w-12">{stats.serviceAvg}/5</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-600 w-40">Cơ sở vật chất</span>
                          <div className="flex-1 bg-gray-200 rounded-full h-3">
                            <div className="bg-orange-500 h-3 rounded-full" style={{width: `${(parseFloat(String(stats.facilityAvg)) / 5) * 100}%`}}></div>
                          </div>
                          <span className="text-sm font-bold text-gray-700 w-12">{stats.facilityAvg}/5</span>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* Recent Feedbacks */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-3">Phản hồi gần đây</h4>
                <div className="space-y-3">
                  {[...callFeedbacks, ...formFeedbacks].slice(0, 3).map((fb, idx) => (
                    <div key={idx} className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-gray-800">{fb.studentName}</span>
                        <span className={`text-xs px-2 py-1 rounded ${fb.type === 'Call' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                          {fb.type === 'Call' ? 'Điện thoại' : 'Form'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{fb.content}</p>
                      {fb.averageScore && (
                        <p className="text-sm mt-2"><span className="text-gray-500">Điểm TB:</span> <span className="font-bold text-orange-600">{fb.averageScore}</span></p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
              <button
                onClick={() => setShowReportModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  if (!student) return;
                  try {
                    const stats = getFeedbackStats();
                    generateFeedbackExcel(
                      { fullName: student.fullName, code: student.code, className: student.className },
                      [...callFeedbacks, ...formFeedbacks],
                      stats
                    );
                  } catch (error) {
                    console.error('Error exporting Excel:', error);
                    alert('Lỗi khi xuất file Excel. Vui lòng thử lại.');
                  }
                }}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
              >
                <FileDown size={16} />
                Xuất Excel
              </button>
              <button
                onClick={async () => {
                  if (!student) return;
                  try {
                    const stats = getFeedbackStats();
                    await generateFeedbackPDF(
                      { fullName: student.fullName, code: student.code, className: student.className },
                      [...callFeedbacks, ...formFeedbacks],
                      stats
                    );
                  } catch (error) {
                    console.error('Error exporting PDF:', error);
                    alert('Lỗi khi xuất file PDF. Vui lòng thử lại.');
                  }
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <FileText size={16} />
                Xuất PDF
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Manual Enrollment Modal - Ghi danh thủ công */}
      {showManualEnrollModal && student && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-amber-50 to-orange-50 flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Ghi danh thủ công</h3>
                <p className="text-sm text-amber-600">Học viên: {student.fullName}</p>
              </div>
              <button onClick={() => setShowManualEnrollModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={22} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Current sessions info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Số buổi hiện tại:</p>
                <p className="text-2xl font-bold text-gray-800">
                  {getStudentSessionData(student).registered} buổi
                </p>
                {student.className && (
                  <p className="text-sm text-gray-500 mt-1">Lớp: {student.className}</p>
                )}
              </div>

              {/* Action type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Loại thao tác</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setManualEnrollForm(prev => ({ ...prev, action: 'add' }))}
                    className={`flex-1 py-3 px-4 rounded-lg border-2 flex items-center justify-center gap-2 font-medium transition-colors ${
                      manualEnrollForm.action === 'add' 
                        ? 'border-green-500 bg-green-50 text-green-700' 
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Plus size={18} />
                    Thêm buổi
                  </button>
                  <button
                    onClick={() => setManualEnrollForm(prev => ({ ...prev, action: 'subtract' }))}
                    className={`flex-1 py-3 px-4 rounded-lg border-2 flex items-center justify-center gap-2 font-medium transition-colors ${
                      manualEnrollForm.action === 'subtract' 
                        ? 'border-red-500 bg-red-50 text-red-700' 
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Minus size={18} />
                    Trừ buổi
                  </button>
                </div>
              </div>

              {/* Sessions count */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số buổi</label>
                <input
                  type="number"
                  min="1"
                  value={manualEnrollForm.sessions}
                  onChange={(e) => setManualEnrollForm(prev => ({ ...prev, sessions: parseInt(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lý do *</label>
                <textarea
                  value={manualEnrollForm.reason}
                  onChange={(e) => setManualEnrollForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Nhập lý do ghi danh thủ công..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>

              {/* Preview */}
              <div className={`p-3 rounded-lg ${manualEnrollForm.action === 'add' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <p className="text-sm">
                  <span className="text-gray-600">Số buổi sau thay đổi: </span>
                  <span className={`font-bold ${manualEnrollForm.action === 'add' ? 'text-green-700' : 'text-red-700'}`}>
                    {(() => {
                      const { registered } = getStudentSessionData(student);
                      return manualEnrollForm.action === 'add'
                        ? registered + manualEnrollForm.sessions
                        : Math.max(0, registered - manualEnrollForm.sessions);
                    })()} buổi
                  </span>
                </p>
              </div>
            </div>

            <div className="p-5 border-t border-gray-200 flex justify-end gap-3 bg-gray-50 flex-shrink-0">
              <button
                onClick={() => {
                  setShowManualEnrollModal(false);
                  setManualEnrollForm({ action: 'add', sessions: 1, reason: '' });
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                Hủy
              </button>
              <button
                onClick={async () => {
                  if (!manualEnrollForm.reason.trim()) {
                    alert('Vui lòng nhập lý do!');
                    return;
                  }
                  
                  setProcessingManual(true);
                  try {
                    const { registered: currentSessions } = getStudentSessionData(student);
                    const newSessions = manualEnrollForm.action === 'add'
                      ? currentSessions + manualEnrollForm.sessions
                      : Math.max(0, currentSessions - manualEnrollForm.sessions);
                    
                    // Update student sessions
                    await updateStudent(id!, {
                      registeredSessions: newSessions,
                    });
                    
                    // Create enrollment record
                    await createEnrollment({
                      studentId: student.id,
                      studentName: student.fullName || '',
                      sessions: manualEnrollForm.action === 'add' ? manualEnrollForm.sessions : -manualEnrollForm.sessions,
                      type: 'Ghi danh thủ công',
                      contractCode: '',
                      finalAmount: 0,
                      createdDate: new Date().toLocaleDateString('vi-VN'),
                      createdBy: user?.displayName || user?.email || 'Unknown',
                      note: `${manualEnrollForm.action === 'add' ? 'Thêm' : 'Trừ'} ${manualEnrollForm.sessions} buổi - ${manualEnrollForm.reason}`,
                      classId: student.classId || '',
                      className: student.className || '',
                    });
                    
                    alert(`Đã ${manualEnrollForm.action === 'add' ? 'thêm' : 'trừ'} ${manualEnrollForm.sessions} buổi thành công!`);
                    setShowManualEnrollModal(false);
                    setManualEnrollForm({ action: 'add', sessions: 1, reason: '' });
                  } catch (err) {
                    console.error('Error manual enrollment:', err);
                    alert('Có lỗi xảy ra. Vui lòng thử lại!');
                  } finally {
                    setProcessingManual(false);
                  }
                }}
                disabled={processingManual || !manualEnrollForm.reason.trim()}
                className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 ${
                  manualEnrollForm.action === 'add' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {processingManual ? 'Đang xử lý...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};
