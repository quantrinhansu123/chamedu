/**
 * Attendance Page
 * Điểm danh với 5 trạng thái: Đúng giờ, Trễ giờ, Vắng, Bảo lưu, Đã bồi
 * Logic: Vắng  → Auto tạo record bồi bài
 * + Tab Rà soát điểm danh cho lễ tân
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { Calendar, Save, CheckCircle, AlertCircle, BookOpen, Users, Plus, ClipboardCheck, XCircle, AlertTriangle, ChevronDown, Trash2, Printer } from 'lucide-react';
import { printSessionCommentSlip } from '../src/utils/commentSlipPrint';
import { ModalPortal } from '@/components/modal-portal';
import { SearchableClassDropdown, LearningMaterialPickerModal, AttitudeCommentField } from '../src/features/attendance';
import { getLearningMaterialsData, type LearningMaterialsData } from '../src/services/learningMaterialService';
import {
  serializeAttentionCard,
  serializeCheckExerciseTags,
  serializeLessonExerciseTags,
  parseExerciseNotes,
  parseAttentionCard,
  parseCheckExerciseTags,
  parseLessonExerciseTags,
  formatAttentionCardSummary,
  formatCheckTagsSummary,
  formatLessonExerciseTagsSummary,
  hasAttentionCardSelection,
  hasCheckTagsSelection,
  hasLessonExerciseTagsSelection,
  type AttentionCardData,
  type CheckExerciseTagsData,
  type LessonExerciseTagsData,
} from '../src/utils/learningMaterialNotes';
import { AttendanceStatus, AttendanceRecord, StudentStatus } from '../types';
import { useClasses } from '../src/hooks/useClasses';
import { useStudents } from '../src/hooks/useStudents';
import { useAttendance } from '../src/hooks/useAttendance';
import { useAuth } from '../src/hooks/useAuth';
import { usePermissions } from '../src/hooks/usePermissions';
import { useSessions } from '../src/hooks/useSessions';
import {
  ClassSession,
  generateSessionsForClass,
  saveSessionsToFirestore,
  deleteSessionsByClass,
  renumberSessionsByDate,
  getSessionsByDate,
  createReviewSession,
} from '../src/services/sessionService';
import {
  getAttendanceRecords,
  getStudentAttendanceBySession,
  getStudentAttendanceByClassAndDate,
  saveReviewStudentAttendance,
} from '../src/services/attendanceService';
import { formatSchedule } from '../src/utils/scheduleUtils';
import { useHolidays } from '../src/hooks/useHolidays';
import { Holiday } from '../types';

interface StudentAttendanceState {
  studentId: string;
  studentName: string;
  studentCode: string;
  status: AttendanceStatus;
  note: string;
  attitudeComment: string;
  attentionCard: string;
  lessonExerciseTags: string;
  checkExerciseTags: string;
  // Thông tin Điểm số
  homeworkCompletion?: number;  // % BTVN (0-100)
  testName?: string;            // Tên bài KT
  score?: number;               // Điểm (0-10)
  bonusPoints?: number;         // Điểm thưxng
  // Thông tin đi học
  punctuality?: 'onTime' | 'late' | '';  // Đúng giờ / Trễ giờ
}

// Interface for pending attendance save (Phase 4)
interface PendingAttendanceSave {
  classId: string;
  className: string;
  date: string;
  attendanceData: StudentAttendanceState[];
}

// Interface cho rà soát điểm danh
interface UnmarkedStudent {
  id: string;
  sessionId: string;
  sessionDate: string;
  sessionNumber: number;
  classId: string;
  className: string;
  studentId: string;
  studentName: string;
}

interface SessionWithUnmarked {
  sessionId: string;
  sessionDate: string;
  sessionNumber: number;
  classId: string;
  className: string;
  unmarkedStudents: UnmarkedStudent[];
}

const CLASS_LEARNING_PICKER_ID = '__class_learning_picker__';

export const Attendance: React.FC = () => {
  const { user, staffData } = useAuth();
  const { shouldShowOnlyOwnClasses, staffId } = usePermissions();
  const onlyOwnClasses = shouldShowOnlyOwnClasses('attendance');
  const [searchParams, setSearchParams] = useSearchParams();

  const { classes: allClasses, loading: classLoading } = useClasses();
  const { students: allStudents, loading: studentLoading } = useStudents();
  const { checkExisting, loadStudentAttendance, studentAttendance, saveAttendance } = useAttendance();
  const { holidays } = useHolidays();

  const isValidDateParam = useCallback((v: string | null) => {
    if (!v) return false;
    // Expect YYYY-MM-DD
    return /^\d{4}-\d{2}-\d{2}$/.test(v);
  }, []);

  const sanitizeTabParam = useCallback((v: string | null) => {
    return v === 'review' ? 'review' : 'attendance';
  }, []);

  // Helper function to get today's date in local timezone (YYYY-MM-DD)
  const getTodayLocalDate = (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper: Check if a date is a holiday for a specific class
  const getHolidayForDate = (dateStr: string, classId?: string): Holiday | null => {
    if (!holidays.length) return null;
    
    for (const holiday of holidays) {
      if (holiday.status !== 'Đã áp dụng') continue;
      
      // Check if date falls within holiday range
      const start = holiday.startDate;
      const end = holiday.endDate || holiday.startDate;
      if (dateStr < start || dateStr > end) continue;
      
      // Check apply type
      if (holiday.applyType === 'all_classes' || holiday.applyType === 'all_branches') {
        return holiday;
      }
      
      if (holiday.applyType === 'specific_classes' && classId) {
        if (holiday.classIds?.includes(classId)) {
          return holiday;
        }
      }
      
      // For specific_branch, we'd need branch info from class - skip for now
    }
    
    return null;
  };

  // Filter classes for teachers (onlyOwnClasses)
  const classes = useMemo(() => {
    if (!onlyOwnClasses || !staffData) return allClasses;
    const myName = staffData.name;
    const myId = staffData.id || staffId;
    return allClasses.filter(cls => 
      cls.teacher === myName || 
      cls.teacherId === myId ||
      cls.assistant === myName ||
      cls.assistantId === myId ||
      cls.foreignTeacher === myName ||
      cls.foreignTeacherId === myId
    );
  }, [allClasses, onlyOwnClasses, staffData, staffId]);

  // Tab state
  const [activeTab, setActiveTab] = useState<'attendance' | 'review'>(() =>
    sanitizeTabParam(searchParams.get('tab')) as 'attendance' | 'review'
  );

  const [selectedClassId, setSelectedClassId] = useState(() => searchParams.get('classId') || '');
  const [selectedSession, setSelectedSession] = useState<ClassSession | null>(null);
  const [sessionDropdownOpen, setSessionDropdownOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 420, maxHeight: 400 });
  const sessionDropdownRef = useRef<HTMLDivElement>(null);
  const dropdownPanelRef = useRef<HTMLDivElement>(null);
  const sessionButtonRef = useRef<HTMLButtonElement>(null);

  const [attendanceDate, setAttendanceDate] = useState(() => {
    const dateParam = searchParams.get('date');
    return isValidDateParam(dateParam) ? (dateParam as string) : getTodayLocalDate();
  });
  const [attendanceData, setAttendanceData] = useState<StudentAttendanceState[]>([]);
  const [existingRecord, setExistingRecord] = useState<AttendanceRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false); // Flag to prevent sync useEffect from overwriting reset
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [useSessionMode, setUseSessionMode] = useState(() => {
    const mode = searchParams.get('mode');
    return mode === 'manual' ? false : true;
  }); // Default to session mode
  const [showAddSessionModal, setShowAddSessionModal] = useState(false);
  const [showGradeFields, setShowGradeFields] = useState(false);
  const [learningMaterials, setLearningMaterials] = useState<LearningMaterialsData | null>(null);
  const [materialPicker, setMaterialPicker] = useState<{
    studentId: string;
    studentName: string;
    mode: 'attention' | 'lessonTypes' | 'checkTags';
  } | null>(null);
  const [generatingSessions, setGeneratingSessions] = useState(false);
  const [deletingSessions, setDeletingSessions] = useState(false); // Loading state for delete sessions

  // State for makeup confirm dialog (Phase 4)
  const [showMakeupConfirm, setShowMakeupConfirm] = useState(false);
  const [pendingSaveData, setPendingSaveData] = useState<PendingAttendanceSave | null>(null);

  // Bug 3 fix: Track session IDs that have attendance records
  const [completedSessionIds, setCompletedSessionIds] = useState<Set<string>>(new Set());
  const [completedDates, setCompletedDates] = useState<Set<string>>(new Set());

  // Review tab state
  const [reviewDate, setReviewDate] = useState<string>(() => {
    const p = searchParams.get('reviewDate');
    if (isValidDateParam(p)) return p as string;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  });
  const [reviewFilterClass, setReviewFilterClass] = useState<string>('');
  const [reviewFilterBranch, setReviewFilterBranch] = useState<string>(''); // Bug 4 fix: Add branch filter
  const [reviewLoading, setReviewLoading] = useState(false);
  const [sessionsWithUnmarked, setSessionsWithUnmarked] = useState<SessionWithUnmarked[]>([]);
  const [reviewReasons, setReviewReasons] = useState<Record<string, string>>({});
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    type: 'late' | 'absent' | 'reserved'; // Bug 4 fix: Add 'reserved' type
    student: UnmarkedStudent | null;
    reason: string;
  }>({ show: false, type: 'late', student: null, reason: '' });
  const [processingReview, setProcessingReview] = useState(false);

  // Check if selected date is a holiday (for tab 1)
  const selectedDateHoliday = useMemo(() => {
    return getHolidayForDate(attendanceDate, selectedClassId);
  }, [attendanceDate, selectedClassId, holidays]);

  // Check if review date is a global holiday (for tab 2)
  const reviewDateHoliday = useMemo(() => {
    return getHolidayForDate(reviewDate);
  }, [reviewDate, holidays]);

  // Get selected class info for sessions hook (needed for addMakeup when no sessions exist)
  const selectedClassForSessions = useMemo(() => {
    return classes.find(c => c.id === selectedClassId);
  }, [classes, selectedClassId]);

  // Sessions hook
  const { sessions: allSessions, upcomingSessions, loading: sessionsLoading, markSessionComplete, addMakeup, refresh: refreshSessions } = useSessions({
    classId: selectedClassId,
    classInfo: selectedClassForSessions ? {
      name: selectedClassForSessions.name,
      teacherId: selectedClassForSessions.teacherId,
      teacherName: selectedClassForSessions.teacher,
      room: selectedClassForSessions.room,
    } : undefined
  });

  /** Cùng một ngày có >1 document classSessions → dropdown trùng chữ; thêm hậu tố Buổi N để phân biệt */
  const sessionDatesWithDuplicates = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of allSessions) {
      if (s.sessionNumber <= 0 || !s.date) continue;
      counts.set(s.date, (counts.get(s.date) || 0) + 1);
    }
    const dups = new Set<string>();
    counts.forEach((n, date) => {
      if (n > 1) dups.add(date);
    });
    return dups;
  }, [allSessions]);

  // Persist key filters to URL so refresh doesn't lose context
  useEffect(() => {
    // Use functional update so we don't depend on the `searchParams` object in deps
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);

      const setOrDelete = (k: string, v: string | null | undefined) => {
        if (v) next.set(k, v);
        else next.delete(k);
      };

      setOrDelete('tab', activeTab);
      setOrDelete('classId', selectedClassId || null);
      setOrDelete('date', attendanceDate || null);
      setOrDelete('mode', useSessionMode ? 'session' : 'manual');
      setOrDelete('reviewDate', reviewDate || null);

      // Note: sessionId is managed in its own effect (depends on selectedSession)

      return next;
    }, { replace: true });
  }, [activeTab, selectedClassId, attendanceDate, useSessionMode, reviewDate, setSearchParams]);

  // Persist selected session to URL (and restore on refresh)
  useEffect(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (selectedSession?.id) next.set('sessionId', selectedSession.id);
      else next.delete('sessionId');
      return next;
    }, { replace: true });
  }, [selectedSession?.id, setSearchParams]);

  // Auto-restore selected session from URL OR by matching date
  useEffect(() => {
    if (!useSessionMode) return;
    if (!selectedClassId) return;
    if (sessionsLoading) return;
    if (allSessions.length === 0) return;
    if (selectedSession) return;

    const sessionIdParam = searchParams.get('sessionId');
    const fromParam = sessionIdParam ? allSessions.find(s => s.id === sessionIdParam) : undefined;
    if (fromParam) {
      setSelectedSession(fromParam);
      if (fromParam.date && fromParam.date !== attendanceDate) {
        setAttendanceDate(fromParam.date);
      }
      return;
    }

    if (!attendanceDate) return;
    const matching = allSessions.find(s => s.date === attendanceDate);
    if (!matching) return;

    // Don't auto-select sessions that already have attendance
    const hasAttendance =
      completedSessionIds.has(matching.id) ||
      completedDates.has(matching.date) ||
      !!matching.attendanceId;
    if (hasAttendance) return;

    setSelectedSession(matching);
  }, [
    useSessionMode,
    selectedClassId,
    sessionsLoading,
    allSessions,
    selectedSession,
    searchParams.get('sessionId'),
    attendanceDate,
    completedSessionIds,
    completedDates,
  ]);

  // Close dropdown on page scroll or resize (but NOT when scrolling inside dropdown)
  const handlePageScroll = useCallback((e: Event) => {
    // Ignore scroll events from inside the dropdown panel
    if (dropdownPanelRef.current?.contains(e.target as Node)) return;
    setSessionDropdownOpen(false);
  }, []);
  useEffect(() => {
    if (!sessionDropdownOpen) return;
    window.addEventListener('scroll', handlePageScroll, true);
    window.addEventListener('resize', () => setSessionDropdownOpen(false));
    return () => {
      window.removeEventListener('scroll', handlePageScroll, true);
      window.removeEventListener('resize', () => setSessionDropdownOpen(false));
    };
  }, [sessionDropdownOpen, handlePageScroll]);

  // Close dropdown when class changes
  useEffect(() => {
    setSessionDropdownOpen(false);
  }, [selectedClassId]);

  useEffect(() => {
    getLearningMaterialsData()
      .then(setLearningMaterials)
      .catch((error) => console.error('[Attendance] load learning materials:', error));
  }, []);

  useEffect(() => {
    if (!selectedClassId) {
      setCompletedSessionIds(new Set());
      setCompletedDates(new Set());
      return;
    }

    const loadCompleted = async () => {
      try {
        const records = await getAttendanceRecords({ classId: selectedClassId });
        const completedIds = new Set<string>();
        const completedDateSet = new Set<string>();
        records.forEach((data) => {
          if (data.sessionId) completedIds.add(data.sessionId);
          if (data.date) completedDateSet.add(data.date);
        });
        setCompletedSessionIds(completedIds);
        setCompletedDates(completedDateSet);
      } catch (error) {
        console.error('Error loading completed sessions:', error);
      }
    };

    loadCompleted();
    const interval = setInterval(loadCompleted, 15000);
    return () => clearInterval(interval);
  }, [selectedClassId]);

  // Get students for selected class - only show students eligible for attendance
  // Eligible statuses: Đang học, Học thử, Đã học hết phí, Nợ phí (exclude: Nghỉ học, Bảo lưu, Nợ hợp đồng)
  const ATTENDANCE_ELIGIBLE_STATUSES = [
    StudentStatus.ACTIVE,
    StudentStatus.TRIAL,
    StudentStatus.EXPIRED_FEE,
    StudentStatus.DEBT,
  ];
  const selectedClass = classes.find(c => c.id === selectedClassId);
  const classStudents = useMemo(() => {
    return allStudents.filter(s => 
      (s.classId === selectedClassId || 
      s.class === selectedClass?.name ||
      s.className === selectedClass?.name ||
      (s.classIds && s.classIds.includes(selectedClassId))) &&
      ATTENDANCE_ELIGIBLE_STATUSES.includes(s.status as StudentStatus)
    );
  }, [allStudents, selectedClassId, selectedClass?.name]);

  // Check if selected date is valid for class schedule
  const isValidScheduleDay = useMemo(() => {
    if (!selectedClass?.schedule || !attendanceDate) return true; // Allow if no schedule defined
    
    // Parse date using local timezone to avoid UTC issues
    const [year, month, day] = attendanceDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    const schedule = selectedClass.schedule.toLowerCase();
    
    // Map Vietnamese day names to day numbers
    const dayMap: Record<string, number[]> = {
      'chủ nhật': [0],
      'thứ 2': [1], 'thứ hai': [1], 't2': [1],
      'thứ 3': [2], 'thứ ba': [2], 't3': [2],
      'thứ 4': [3], 'thứ tư': [3], 't4': [3],
      'thứ 5': [4], 'thứ nĒm': [4], 't5': [4],
      'thứ 6': [5], 'thứ sáu': [5], 't6': [5],
      'thứ 7': [6], 'thứ bảy': [6], 't7': [6],
    };
    
    // Find which days are in the schedule
    const scheduleDays: number[] = [];
    for (const [dayName, dayNums] of Object.entries(dayMap)) {
      if (schedule.includes(dayName)) {
        scheduleDays.push(...dayNums);
      }
    }
    
    // Also check for "2, 4, 6" or "3, 5, 7" format
    if (schedule.match(/\b2\b/)) scheduleDays.push(1);
    if (schedule.match(/\b3\b/)) scheduleDays.push(2);
    if (schedule.match(/\b4\b/)) scheduleDays.push(3);
    if (schedule.match(/\b5\b/)) scheduleDays.push(4);
    if (schedule.match(/\b6\b/)) scheduleDays.push(5);
    if (schedule.match(/\b7\b/)) scheduleDays.push(6);
    
    // If no days found, allow any day
    if (scheduleDays.length === 0) return true;
    
    return scheduleDays.includes(dayOfWeek);
  }, [selectedClass?.schedule, attendanceDate]);

  // Initialize attendance data when class/date changes
  useEffect(() => {
    setIsResetting(false); // Clear reset flag on class/date change
    if (!selectedClassId || classStudents.length === 0) {
      setAttendanceData([]);
      setExistingRecord(null);
      return;
    }

    const initData = async () => {
      // Check if attendance exists
      const existing = await checkExisting(selectedClassId, attendanceDate);
      setExistingRecord(existing);

      if (existing) {
        // Load existing attendance
        await loadStudentAttendance(existing.id);
      } else {
        // Initialize empty attendance
        setAttendanceData(
          classStudents.map(s => ({
            studentId: s.id,
            studentName: s.fullName || (s as any).name || 'Unknown',
            studentCode: s.code || s.id.slice(0, 6),
            status: AttendanceStatus.PENDING,
            note: '',
            attitudeComment: '',
            attentionCard: '',
            lessonExerciseTags: '',
            checkExerciseTags: '',
            homeworkCompletion: undefined,
            testName: '',
            score: undefined,
            bonusPoints: undefined,
            punctuality: '',
          }))
        );
      }
    };

    initData();
  }, [selectedClassId, attendanceDate, classStudents.length]);

  // Create stable reference for classStudents IDs to avoid infinite loop
  const classStudentIds = useMemo(() => 
    classStudents.map(s => s.id).sort().join(','), 
    [classStudents]
  );
  
  // Create stable reference for studentAttendance to avoid infinite loop
  const studentAttendanceKey = useMemo(() => {
    if (studentAttendance.length === 0) return '';
    return studentAttendance.map(sa => 
      `${sa.studentId}:${sa.status || ''}:${sa.note || ''}:${sa.attitudeComment || ''}:${sa.attentionCard || ''}:${sa.lessonExerciseTags || ''}:${sa.checkExerciseTags || ''}`
    ).sort().join('|');
  }, [studentAttendance]);
  
  // Sync with loaded student attendance - only show students in current filtered classStudents
  useEffect(() => {
    if (isResetting) return; // Skip sync when user is resetting the form
    if (studentAttendance.length > 0 && existingRecord && classStudents.length > 0) {
      const newAttendanceData = classStudents.map(s => {
        const existing = studentAttendance.find(sa => sa.studentId === s.id);
        return {
          studentId: s.id,
          studentName: s.fullName || (s as any).name || 'Unknown',
          studentCode: s.code || s.id.slice(0, 6),
          status: existing?.status || AttendanceStatus.PENDING,
          note: existing?.note || '',
          attitudeComment: existing?.attitudeComment || '',
          attentionCard: existing?.attentionCard || '',
          lessonExerciseTags: existing?.lessonExerciseTags || '',
          checkExerciseTags: existing?.checkExerciseTags || '',
          homeworkCompletion: existing?.homeworkCompletion,
          testName: existing?.testName || '',
          score: existing?.score,
          bonusPoints: existing?.bonusPoints,
          punctuality: existing?.punctuality || '',
        };
      });
      
      // Only update if data actually changed to prevent infinite loop
      setAttendanceData(prev => {
        // Check if data is actually different
        if (prev.length !== newAttendanceData.length) {
          return newAttendanceData;
        }
        
        const hasChanged = prev.some((p, i) => {
          const n = newAttendanceData[i];
          return !n || 
            p.studentId !== n.studentId ||
            p.status !== n.status ||
            p.note !== n.note ||
            p.attitudeComment !== n.attitudeComment ||
            p.attentionCard !== n.attentionCard ||
            p.lessonExerciseTags !== n.lessonExerciseTags ||
            p.checkExerciseTags !== n.checkExerciseTags ||
            p.homeworkCompletion !== n.homeworkCompletion ||
            p.testName !== n.testName ||
            p.score !== n.score ||
            p.bonusPoints !== n.bonusPoints ||
            p.punctuality !== n.punctuality;
        });
        
        return hasChanged ? newAttendanceData : prev;
      });
    }
  }, [studentAttendanceKey, existingRecord?.id, classStudentIds, isResetting]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceData(prev =>
      prev.map(s => (s.studentId === studentId ? { ...s, status } : s))
    );
  };

  const handleNoteChange = (studentId: string, note: string) => {
    setAttendanceData(prev =>
      prev.map(s => (s.studentId === studentId ? { ...s, note } : s))
    );
  };

  const handleAttitudeCommentChange = (studentId: string, attitudeComment: string) => {
    setAttendanceData(prev =>
      prev.map(s => (s.studentId === studentId ? { ...s, attitudeComment } : s))
    );
  };

  const handleSaveAttentionCard = (studentId: string, data: AttentionCardData) => {
    setAttendanceData((prev) =>
      prev.map((s) =>
        s.studentId === studentId
          ? { ...s, attentionCard: serializeAttentionCard(data) }
          : s
      )
    );
  };

  const handleSaveLessonExerciseTags = (studentId: string, data: LessonExerciseTagsData) => {
    setAttendanceData((prev) =>
      prev.map((s) =>
        s.studentId === studentId
          ? { ...s, lessonExerciseTags: serializeLessonExerciseTags(data) }
          : s
      )
    );
  };

  const handleSaveCheckExerciseTags = (studentId: string, data: CheckExerciseTagsData) => {
    setAttendanceData((prev) =>
      prev.map((s) =>
        s.studentId === studentId
          ? { ...s, checkExerciseTags: serializeCheckExerciseTags(data) }
          : s
      )
    );
  };

  const normalizeLearningText = (value?: string | null) =>
    (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const handleAutoFillLearningMaterials = () => {
    if (!learningMaterials) {
      setMessage({ type: 'error', text: 'Chưa tải được học liệu.' });
      return;
    }
    if (attendanceData.length === 0) {
      setMessage({ type: 'error', text: 'Chưa có học sinh  để nhập bài học.' });
      return;
    }

    const selectedClassText = normalizeLearningText(
      [selectedClass?.name, selectedClass?.curriculum, selectedClass?.ageGroup].filter(Boolean).join(' ')
    );
    const matchedGrade =
      learningMaterials.grades.find((grade) => {
        const gradeText = normalizeLearningText(grade.name);
        return gradeText && selectedClassText.includes(gradeText);
      }) || learningMaterials.grades[0];
    const matchedGradeBand =
      learningMaterials.gradeBands.find((band) => band.id === matchedGrade?.gradeBandId) ||
      learningMaterials.gradeBands[0];

    if (!matchedGrade || !matchedGradeBand) {
      setMessage({ type: 'error', text: 'Chưa có khối/lớp học liệu  để nhập bài học.' });
      return;
    }

    const exerciseTypes = learningMaterials.exerciseTypes.filter((exercise) => exercise.gradeId === matchedGrade.id);
    if (exerciseTypes.length === 0) {
      setMessage({ type: 'error', text: 'Lớp học liệu này chưa có dạng bài.' });
      return;
    }

    const firstExercise = exerciseTypes[0];
    const allMaterials = learningMaterials.materials
      .filter((material) => exerciseTypes.some((exercise) => exercise.id === material.exerciseTypeId))
      .map((material) => ({ id: material.id, title: material.title }));
    const allNotes = exerciseTypes.flatMap((exercise) =>
      parseExerciseNotes(exercise.description).map((note) => ({
        ...note,
        id: `${exercise.id}:${note.id}`,
        title: note.title || exercise.title,
      }))
    );

    const attentionPayload: AttentionCardData = {
      gradeBandId: matchedGradeBand.id,
      gradeBandName: matchedGradeBand.name,
      gradeId: matchedGrade.id,
      gradeName: matchedGrade.name,
      exerciseTypeId: firstExercise.id,
      exerciseTypeTitle: exerciseTypes.map((exercise) => exercise.title).join(', '),
      exerciseTypes: exerciseTypes.map((exercise) => ({ id: exercise.id, title: exercise.title })),
      materials: allMaterials,
      selectedNotes: allNotes,
    };
    const lessonPayload: LessonExerciseTagsData = {
      gradeBandId: matchedGradeBand.id,
      gradeBandName: matchedGradeBand.name,
      gradeId: matchedGrade.id,
      gradeName: matchedGrade.name,
      exerciseTypes: exerciseTypes.map((exercise) => ({ id: exercise.id, title: exercise.title })),
    };
    const checkPayload: CheckExerciseTagsData = {
      gradeBandId: matchedGradeBand.id,
      gradeBandName: matchedGradeBand.name,
      gradeId: matchedGrade.id,
      gradeName: matchedGrade.name,
      exerciseTypeId: firstExercise.id,
      exerciseTypeTitle: exerciseTypes.map((exercise) => exercise.title).join(', '),
      exerciseTypes: exerciseTypes.map((exercise) => ({ id: exercise.id, title: exercise.title })),
      materials: allMaterials,
    };

    const serializedAttention = serializeAttentionCard(attentionPayload);
    const serializedLessonTypes = serializeLessonExerciseTags(lessonPayload);
    const serializedCheckTags = serializeCheckExerciseTags(checkPayload);

    setAttendanceData((prev) =>
      prev.map((student) => ({
        ...student,
        attentionCard: serializedAttention,
        lessonExerciseTags: serializedLessonTypes,
        checkExerciseTags: serializedCheckTags,
      }))
    );
    setMessage({
      type: 'success',
      text: `Đã nhập bài học cho ${attendanceData.length} học sinh.`,
    });
  };

  const handleOpenClassLearningPicker = () => {
    if (!learningMaterials) {
      setMessage({ type: 'error', text: 'Chưa tải được học liệu.' });
      return;
    }
    if (attendanceData.length === 0) {
      setMessage({ type: 'error', text: 'Chưa có học sinh để nhập bài.' });
      return;
    }
    setMaterialPicker({
      studentId: CLASS_LEARNING_PICKER_ID,
      studentName: 'Cả lớp',
      mode: 'attention',
    });
  };

  const handleSaveClassLearningMaterials = (data: AttentionCardData) => {
    if (!learningMaterials) return;
    const exerciseTypesList =
      data.exerciseTypes?.length
        ? data.exerciseTypes
        : data.exerciseTypeId
          ? [{ id: data.exerciseTypeId, title: data.exerciseTypeTitle }]
          : [];
    const typeIds = new Set(exerciseTypesList.map((item) => item.id));
    const materials =
      data.materials?.length
        ? data.materials
        : learningMaterials.materials
            .filter((material) => typeIds.has(material.exerciseTypeId))
            .map((material) => ({ id: material.id, title: material.title }));
    const lessonPayload: LessonExerciseTagsData = {
      gradeBandId: data.gradeBandId,
      gradeBandName: data.gradeBandName,
      gradeId: data.gradeId,
      gradeName: data.gradeName,
      exerciseTypes: exerciseTypesList,
    };
    const firstExercise = exerciseTypesList[0];
    const checkPayload: CheckExerciseTagsData = {
      gradeBandId: data.gradeBandId,
      gradeBandName: data.gradeBandName,
      gradeId: data.gradeId,
      gradeName: data.gradeName,
      exerciseTypeId: firstExercise?.id,
      exerciseTypeTitle: exerciseTypesList.map((item) => item.title).join(', '),
      exerciseTypes: exerciseTypesList,
      materials,
    };
    const serializedAttention = serializeAttentionCard(data);
    const serializedLessonTypes = serializeLessonExerciseTags(lessonPayload);
    const serializedCheckTags = serializeCheckExerciseTags(checkPayload);

    setAttendanceData((prev) =>
      prev.map((student) => ({
        ...student,
        attentionCard: serializedAttention,
        lessonExerciseTags: serializedLessonTypes,
        checkExerciseTags: serializedCheckTags,
      }))
    );
    setMessage({ type: 'success', text: `Đã nhập bài cho ${attendanceData.length} học sinh.` });
  };

  const handleGradeChange = (studentId: string, field: keyof StudentAttendanceState, value: any) => {
    setAttendanceData(prev =>
      prev.map(s => (s.studentId === studentId ? { ...s, [field]: value } : s))
    );
  };

  const handlePrintCommentSlip = (student: StudentAttendanceState) => {
    if (!selectedClass) return;
    const dateToUse = selectedSession?.date || attendanceDate;
    printSessionCommentSlip({
      studentName: student.studentName,
      studentCode: student.studentCode,
      className: selectedClass.name,
      date: dateToUse,
      sessionNumber: selectedSession?.sessionNumber,
      status: student.status || 'Chưa điểm danh',
      homeworkCompletion: student.homeworkCompletion,
      testName: student.testName,
      score: student.score,
      bonusPoints: student.bonusPoints,
      note: student.note,
      attitudeComment: student.attitudeComment,
      attentionCard: student.attentionCard,
      checkExerciseTags: student.checkExerciseTags,
      teacherName: selectedClass.teacher || staffData?.name,
    });
  };

  const handleBulkStatus = (status: AttendanceStatus) => {
    setAttendanceData(prev => prev.map(s => ({ ...s, status })));
  };

  const handleSave = async () => {
    if (!selectedClassId || attendanceData.length === 0) {
      setMessage({ type: 'error', text: 'Vui lòng chọn lớp và học sinh' });
      return;
    }

    const selectedClass = classes.find(c => c.id === selectedClassId);
    if (!selectedClass) return;
    
    // Check if at least one student has a status marked
    const hasMarkedStudents = attendanceData.some(s => s.status && s.status !== '');
    if (!hasMarkedStudents) {
      setMessage({ type: 'error', text: 'Vui lòng đánh dấu trạng thái cho ít nhất một học sinh trước khi lưu.' });
      return;
    }

    // Use session date if in session mode, otherwise use manual date
    let dateToUse = selectedSession?.date || attendanceDate;
    
    // Normalize date format to ensure it's YYYY-MM-DD
    if (dateToUse) {
      if (dateToUse.includes('T')) {
        dateToUse = dateToUse.split('T')[0];
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateToUse)) {
        console.error('[Attendance] Invalid date format:', dateToUse);
        setMessage({
          type: 'error',
          text: 'Định dạng ngày không hợp lệ. Vui lòng thử lại.'
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setSaving(false);
        return;
      }
    }
    
    // If in session mode but no session selected, try to find session for the date
    let sessionToUse = selectedSession;
    if (useSessionMode && !selectedSession && dateToUse) {
      const matchingSession = allSessions.find(s => s.date === dateToUse);
      if (matchingSession) {
        sessionToUse = matchingSession;
        console.log('[Attendance] Auto-found session for date:', dateToUse, 'sessionId:', matchingSession.id);
      } else {
        console.warn('[Attendance] No session found for date:', dateToUse, 'in session mode');
      }
    }

    // When in session mode, require a session to be selected or auto-found
    if (useSessionMode && !sessionToUse) {
      setMessage({
        type: 'error',
        text: 'Vui lòng chọn buổi học từ dropdown phía trên để bắt đầu điểm danh. Nếu muốn điểm danh học bù ngoài lịch, vui lòng đổi từ "Chọn theo lịch học" sang "Chọn ngày tự do".'
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Block saving if date is not valid for schedule AND not previously completed (only when not in session mode)
    if (!useSessionMode && !isValidScheduleDay && !completedDates.has(dateToUse)) {
      setMessage({
        type: 'error',
        text: `Không thể điểm danh: Ngày ${new Date(dateToUse).toLocaleDateString('vi-VN')} không nằm trong lịch học của lớp. Chỉ có thể điểm danh vào các ngày trong lịch học hoặc các ngày đã điểm danh trước đó.`
      });
      return;
    }

    try {
      setSaving(true);
      setIsResetting(false); // Allow sync useEffect after save
      setMessage(null);

      // Check duplicate BEFORE saving (prevent race condition)
      const duplicateCheck = await checkExisting(selectedClassId, dateToUse);
      if (duplicateCheck && duplicateCheck.id !== existingRecord?.id) {
        // Different record exists for same class + date - block save
        setMessage({
          type: 'error',
          text: `Lớp ${selectedClass.name} đã được điểm danh ngày ${dateToUse}. Vui lòng chọn ngày khác hoặc chỉnh sửa bản ghi hiện có.`
        });
        setSaving(false);
        return;
      }

      // Phase 4: Check if this is non-session attendance
      if (!selectedSession && !useSessionMode) {
        // Check if class has sessions (either generated or existing)
        const hasExistingSessions = allSessions.length > 0;

        if (hasExistingSessions) {
          // Class has sessions but user is saving without selecting one
          // Store pending data and show confirm dialog
          setPendingSaveData({
            classId: selectedClassId,
            className: selectedClass.name,
            date: dateToUse,
            attendanceData: [...attendanceData],
          });
          setShowMakeupConfirm(true);
          setSaving(false);
          return;
        }
        // If class has no sessions â†’ will save as 'manual' type below
      }

      const absentCount = attendanceData.filter(s => s.status === AttendanceStatus.ABSENT).length;

      // Use the found session (either selected or auto-found)
      const finalSession = sessionToUse || selectedSession;
      
      console.log('[Attendance] Saving attendance:', {
        useSessionMode,
        hasSelectedSession: !!selectedSession,
        hasFinalSession: !!finalSession,
        sessionId: finalSession?.id || null,
        sessionNumber: finalSession?.sessionNumber || null,
        date: dateToUse,
        studentsCount: attendanceData.length
      });

      const attendanceId = await saveAttendance(
        {
          classId: selectedClassId,
          className: selectedClass.name,
          date: dateToUse,
          // Use null instead of undefined - Firestore doesn't accept undefined values
          sessionNumber: finalSession?.sessionNumber ?? null,
          sessionId: finalSession?.id ?? null,
          totalStudents: attendanceData.length,
          present: attendanceData.filter(s => s.status === AttendanceStatus.ON_TIME || s.status === AttendanceStatus.LATE).length,
          absent: absentCount,
          reserved: attendanceData.filter(s => s.status === AttendanceStatus.RESERVED).length,
          tutored: attendanceData.filter(s => s.status === AttendanceStatus.TUTORED).length,
          status: 'Đã điểm danh',
          createdBy: user?.uid ?? null,
        },
        attendanceData.map(s => ({
          studentId: s.studentId,
          studentName: s.studentName,
          studentCode: s.studentCode,
          status: s.status,
          note: s.note,
          attitudeComment: s.attitudeComment,
          attentionCard: s.attentionCard,
          lessonExerciseTags: s.lessonExerciseTags,
          checkExerciseTags: s.checkExerciseTags,
          homeworkCompletion: s.homeworkCompletion,
          testName: s.testName,
          score: s.score,
          bonusPoints: s.bonusPoints,
          punctuality: s.punctuality,
          isLate: s.punctuality === 'late',
        }))
      );

      // Mark session as complete when attendance is saved
      // Fix: allStudentsMarked check removed - session should be marked complete once attendance saved
      // Use finalSession (either selected or auto-found) instead of selectedSession
      if (finalSession?.id && attendanceId) {
        try {
          await markSessionComplete(finalSession.id, attendanceId);
          console.log('[Attendance] Marked session complete:', finalSession.id);
        } catch (err) {
          console.warn('Could not mark session complete:', err);
          // Don't block attendance save if session update fails
        }
      } else if (!finalSession?.id && useSessionMode) {
        console.warn('[Attendance] No session ID to mark complete. useSessionMode:', useSessionMode, 'selectedSession:', !!selectedSession, 'dateToUse:', dateToUse, 'allSessions:', allSessions.length);
      }

      setMessage({
        type: 'success',
        text: absentCount > 0
          ? `Lưu thành công! Đã tạo ${absentCount} lịch bồi bài cho học sinh vắng.`
          : 'Lưu điểm danh thành công!',
      });

      // Reset selection
      setSelectedSession(null);
    } catch (error) {
      console.error('[Attendance] Save error:', error);
      let errorMessage = 'Không thể lưu điểm danh. Vui lòng thử lại.';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        // Log full error details for debugging
        console.error('[Attendance] Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        // Try to extract meaningful error message
        const err = error as any;
        if (err.message) errorMessage = err.message;
        else if (err.code) errorMessage = `Lỗi ${err.code}: ${err.message || 'Không thể lưu điểm danh'}`;
        console.error('[Attendance] Error object:', err);
      }
      
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setSaving(false);
    }
  };

  // Phase 4: Save with specific attendance type (for makeup/manual attendance)
  const saveWithType = async (type: 'makeup' | 'manual') => {
    if (!pendingSaveData) return;

    // Validate type parameter
    if (type !== 'makeup' && type !== 'manual') {
      console.error('[Attendance] Invalid attendance type:', type);
      setMessage({ type: 'error', text: 'Loại điểm danh không hợp lệ' });
      return;
    }

    setSaving(true);
    setShowMakeupConfirm(false);

    try {
      const absentCount = pendingSaveData.attendanceData.filter(
        s => s.status === AttendanceStatus.ABSENT
      ).length;

      await saveAttendance(
        {
          classId: pendingSaveData.classId,
          className: pendingSaveData.className,
          date: pendingSaveData.date,
          sessionNumber: null, // No session selected
          sessionId: null,
          attendanceType: type, // 'makeup' or 'manual'
          totalStudents: pendingSaveData.attendanceData.length,
          present: pendingSaveData.attendanceData.filter(
            s => s.status === AttendanceStatus.ON_TIME || s.status === AttendanceStatus.LATE
          ).length,
          absent: absentCount,
          reserved: pendingSaveData.attendanceData.filter(s => s.status === AttendanceStatus.RESERVED).length,
          tutored: pendingSaveData.attendanceData.filter(s => s.status === AttendanceStatus.TUTORED).length,
          status: 'Đã điểm danh',
          createdBy: user?.uid ?? null,
        },
        pendingSaveData.attendanceData.map(s => ({
          studentId: s.studentId,
          studentName: s.studentName,
          studentCode: s.studentCode,
          status: s.status,
          note: s.note,
          attitudeComment: s.attitudeComment,
          attentionCard: s.attentionCard,
          lessonExerciseTags: s.lessonExerciseTags,
          checkExerciseTags: s.checkExerciseTags,
          homeworkCompletion: s.homeworkCompletion,
          testName: s.testName,
          score: s.score,
          bonusPoints: s.bonusPoints,
          punctuality: s.punctuality,
          isLate: s.punctuality === 'late',
        }))
      );

      setMessage({
        type: 'success',
        text: type === 'makeup'
          ? `Đã lưu điểm danh học bù!${absentCount > 0 ? ` Đã tạo ${absentCount} lịch bồi bài.` : ''}`
          : 'Lưu điểm danh thành công!',
      });

      setPendingSaveData(null);
    } catch (error) {
      console.error('[Attendance] SaveWithType error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Không thể lưu điểm danh. Vui lòng thử lại.';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setSaving(false);
    }
  };

  // Handle session selection
  const handleSelectSession = (session: ClassSession) => {
    setSelectedSession(session);
    setAttendanceDate(session.date);
  };

  // Auto-generate sessions for class if missing
  const handleAutoGenerateSessions = async () => {
    if (!selectedClass) {
      setMessage({ type: 'error', text: 'Vui lòng chọn lớp trước' });
      return;
    }

    if (!selectedClass.schedule) {
      setMessage({ type: 'error', text: 'Lớp này chưa có lịch học. Vui lòng cập nhật lịch học trước.' });
      return;
    }

    try {
      setGeneratingSessions(true);
      setMessage(null);

      // Use class startDate and endDate to create sessions for the entire course
      if (!selectedClass.startDate) {
        setMessage({ 
          type: 'error', 
          text: 'Lớp này chưa có ngày bắt đầu. Vui lòng cập nhật ngày bắt đầu khóa học trước.' 
        });
        return;
      }

      // Helper to parse date string using local timezone (avoid UTC parsing issues)
      const parseLocalDate = (dateStr: string): Date => {
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
      };
      
      // Determine start date for generation
      let fromDate: Date;
      if (selectedClass.endDate) {
        // If has endDate, always start from class startDate
        fromDate = parseLocalDate(selectedClass.startDate);
      } else {
        // If no endDate, start from the last session date + 1 day, or from startDate if no sessions exist
        if (allSessions.length > 0) {
          // Find the latest session date
          const lastSessionDate = allSessions.reduce((latest, session) => {
            return session.date > latest ? session.date : latest;
          }, allSessions[0].date);
          
          // Start from the day after the last session
          fromDate = parseLocalDate(lastSessionDate);
          fromDate.setDate(fromDate.getDate() + 1);
        } else {
          // No sessions exist, start from class startDate
          fromDate = parseLocalDate(selectedClass.startDate);
        }
      }
      fromDate.setHours(0, 0, 0, 0); // Reset to start of day
      
      // Determine end date
      let toDate: Date;
      if (selectedClass.endDate) {
        // If has endDate, use it
        toDate = parseLocalDate(selectedClass.endDate);
      } else {
        // If no endDate, add 30 days from fromDate (incremental generation)
        toDate = new Date(fromDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      }
      
      // Use totalSessions if available, otherwise calculate based on date range
      // If no endDate, don't limit by totalSessions (allow incremental generation)
      const maxSessions = selectedClass.endDate && selectedClass.totalSessions && selectedClass.totalSessions > 0
        ? selectedClass.totalSessions
        : 50; // Default to 50 sessions per generation if no endDate or totalSessions

      // Helper to format date to YYYY-MM-DD using local date
      const formatLocalDate = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      // Generate sessions based on class schedule
      const generatedSessions = await generateSessionsForClass({
        id: selectedClass.id,
        name: selectedClass.name,
        schedule: selectedClass.schedule,
        startDate: formatLocalDate(fromDate),
        endDate: selectedClass.endDate,
        room: selectedClass.room,
        teacherId: selectedClass.teacherId,
        teacherName: selectedClass.teacher,
        totalSessions: selectedClass.totalSessions,
      }, {
        fromDate,
        toDate,
        maxSessions,
      });

      if (generatedSessions.length === 0) {
        setMessage({ 
          type: 'error', 
          text: 'Không thể tạo buổi học. Vui lòng kiểm tra lại lịch học và số buổi học của lớp.' 
        });
        return;
      }

      // Filter out sessions that already exist (by date)
      const existingDates = new Set(allSessions.map(s => s.date));
      const newSessions = generatedSessions.filter(s => !existingDates.has(s.date));

      if (newSessions.length === 0) {
        if (selectedClass.endDate) {
          setMessage({ 
            type: 'info', 
            text: 'Tất cả các buổi học từ ngày bắt đầu đến ngày kết thúc đã được tạo. Không có buổi học mới nào cần tạo.' 
          });
        } else {
          setMessage({ 
            type: 'info', 
            text: 'Không có buổi học mới trong 30 ngày tiếp theo. Bạn có thể bấm lại  để tạo thêm 30 ngày nữa.' 
          });
        }
        return;
      }

      // Save to Firestore
      const savedCount = await saveSessionsToFirestore(newSessions);
      
      // Renumber all sessions by date to ensure unique sequential sessionNumbers
      try {
        const renumberedCount = await renumberSessionsByDate(selectedClassId);
        if (renumberedCount > 0) {
          console.log(`[Attendance] Renumbered ${renumberedCount} sessions`);
        }
      } catch (error) {
        console.warn('[Attendance] Error renumbering sessions:', error);
        // Don't block success message if renumbering fails
      }
      
      const dateRange = selectedClass.endDate 
        ? `từ ${new Date(selectedClass.startDate).toLocaleDateString('vi-VN')} đến ${new Date(selectedClass.endDate).toLocaleDateString('vi-VN')}`
        : `trong 30 ngày tiếp theo (từ ${fromDate.toLocaleDateString('vi-VN')} đến ${toDate.toLocaleDateString('vi-VN')})`;
      
      setMessage({ 
        type: 'success', 
        text: `Đã tạo ${savedCount} buổi học ${dateRange}.${!selectedClass.endDate ? ' Bạn có thể bấm lại  để tạo thêm 30 ngày nữa.' : ''}` 
      });

      // Refresh sessions after a short delay to allow Firestore to update
      setTimeout(() => {
        if (refreshSessions) {
          refreshSessions();
        }
      }, 1500);

    } catch (error) {
      console.error('[Attendance] Error auto-generating sessions:', error);
      setMessage({ 
        type: 'error', 
        text: `Lỗi khi tạo buổi học: ${error instanceof Error ? error.message : 'Lỗi không xác định'}` 
      });
    } finally {
      setGeneratingSessions(false);
    }
  };

  // Delete all sessions for the class
  const handleDeleteAllSessions = async () => {
    if (!selectedClassId || !selectedClass) {
      setMessage({ type: 'error', text: 'Vui lòng chọn lớp trước' });
      return;
    }

    if (allSessions.length === 0) {
      setMessage({ type: 'info', text: 'Lớp này chưa có buổi học nào  để xóa.' });
      return;
    }

    // Confirm before deleting
    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn xóa TẤT CẢ ${allSessions.length} buổi học của lớp "${selectedClass.name}"?\n\n` +
      'Hành động này không thể hoàn tác!'
    );

    if (!confirmed) return;

    try {
      setDeletingSessions(true);
      setMessage(null);

      const deletedCount = await deleteSessionsByClass(selectedClassId);
      
      setMessage({ 
        type: 'success', 
        text: `Đã xóa ${deletedCount} buổi học của lớp "${selectedClass.name}".` 
      });

      // Clear selected session if it was deleted
      setSelectedSession(null);

      // Refresh sessions after a short delay
      setTimeout(() => {
        if (refreshSessions) {
          refreshSessions();
        }
      }, 1000);

    } catch (error) {
      console.error('[Attendance] Error deleting sessions:', error);
      setMessage({ 
        type: 'error', 
        text: `Lỗi khi xóa buổi học: ${error instanceof Error ? error.message : 'Lỗi không xác định'}` 
      });
    } finally {
      setDeletingSessions(false);
    }
  };

  // Phase 1: Handle date change with auto-detect session logic
  const handleDateChange = (newDate: string) => {
    setAttendanceDate(newDate);

    // Skip auto-detect if sessions still loading
    if (sessionsLoading) {
      setSelectedSession(null);
      return;
    }

    // Auto-detect: Find session matching this date
    const matchingSession = allSessions.find(s => s.date === newDate);

    if (matchingSession) {
      // Check if session already has attendance
      const hasAttendance = completedSessionIds.has(matchingSession.id) ||
                           completedDates.has(matchingSession.date) ||
                           matchingSession.attendanceId;

      if (hasAttendance) {
        // Phase 1.2: Warning - session already has attendance
        setMessage({
          type: 'error',
          text: `Buổi ${matchingSession.sessionNumber} (${matchingSession.dayOfWeek}) đã được điểm danh. Vui lòng chọn buổi khác hoặc chỉnh sửa bản ghi hiện có.`
        });
        setSelectedSession(null);
      } else {
        // Phase 1.1: Auto-link - select the matching session
        setSelectedSession(matchingSession);
        setMessage({
          type: 'success',
          text: `Đã tự động chọn Buổi ${matchingSession.sessionNumber} (${matchingSession.dayOfWeek})`
        });
      }
    } else {
      // No matching session - clear selection (will trigger makeup confirm on save)
      setSelectedSession(null);
      setMessage(null);
    }
  };

  const getStatusStyle = (status: AttendanceStatus, current: AttendanceStatus) => {
    const isActive = status === current && status !== AttendanceStatus.PENDING;
    const styles: Record<string, string> = {
      [AttendanceStatus.PENDING]: 'bg-white text-gray-400 border-gray-200',
      [AttendanceStatus.ON_TIME]: isActive
        ? 'bg-green-600 text-white border-green-600'
        : 'bg-white text-green-600 border-green-300 hover:bg-green-50',
      [AttendanceStatus.LATE]: isActive
        ? 'bg-yellow-500 text-white border-yellow-500'
        : 'bg-white text-yellow-600 border-yellow-300 hover:bg-yellow-50',
      [AttendanceStatus.ABSENT]: isActive
        ? 'bg-red-600 text-white border-red-600'
        : 'bg-white text-red-600 border-red-300 hover:bg-red-50',
      [AttendanceStatus.RESERVED]: isActive
        ? 'bg-orange-500 text-white border-orange-500'
        : 'bg-white text-orange-500 border-orange-300 hover:bg-orange-50',
      [AttendanceStatus.TUTORED]: isActive
        ? 'bg-blue-600 text-white border-blue-600'
        : 'bg-white text-blue-600 border-blue-300 hover:bg-blue-50',
    };
    return styles[status] || styles[AttendanceStatus.PENDING];
  };

  // Stats
  const stats = {
    total: attendanceData.length,
    pending: attendanceData.filter(s => s.status === AttendanceStatus.PENDING || !s.status).length,
    present: attendanceData.filter(s => s.status === AttendanceStatus.ON_TIME || s.status === AttendanceStatus.LATE).length,
    absent: attendanceData.filter(s => s.status === AttendanceStatus.ABSENT).length,
    reserved: attendanceData.filter(s => s.status === AttendanceStatus.RESERVED).length,
    tutored: attendanceData.filter(s => s.status === AttendanceStatus.TUTORED).length,
  };

  // ========== REVIEW TAB FUNCTIONS ==========
  
  // Helper: Check if a class has schedule on given date
  const classHasScheduleOnDate = (classInfo: any, dateStr: string): boolean => {
    if (!classInfo?.schedule) return false;
    
    // Parse date using local timezone to avoid UTC issues
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday...
    const schedule = classInfo.schedule.toLowerCase();
    
    // Map day numbers - more comprehensive patterns
    const dayPatterns: Record<number, string[]> = {
      0: ['chủ nhật', 'cn', 'sunday'],
      1: ['thứ 2', 'thứ hai', 't2', 'th 2', 'monday'],
      2: ['thứ 3', 'thứ ba', 't3', 'th 3', 'tuesday'],
      3: ['thứ 4', 'thứ tư', 't4', 'th 4', 'wednesday'],
      4: ['thứ 5', 'thứ nĒm', 't5', 'th 5', 'thursday'],
      5: ['thứ 6', 'thứ sáu', 't6', 'th 6', 'friday'],
      6: ['thứ 7', 'thứ bảy', 't7', 'th 7', 'saturday'],
    };
    
    const patterns = dayPatterns[dayOfWeek] || [];
    const hasSchedule = patterns.some(p => schedule.includes(p));
    
    // Also check for number patterns like "2, 4, 6" or "2-4-6"
    const dayNumber = dayOfWeek === 0 ? 'cn' : String(dayOfWeek + 1); // Convert to Vietnamese day numbering (2-7, CN)
    const numberPattern = new RegExp(`\\b${dayOfWeek === 0 ? '(cn|chủ nhật)' : (dayOfWeek + 1)}\\b`, 'i');
    const hasNumberMatch = numberPattern.test(schedule);
    
    console.log('[Schedule Check]', classInfo.name, '| Date:', dateStr, '| DayOfWeek:', dayOfWeek, '| Schedule:', classInfo.schedule, '| Match:', hasSchedule || hasNumberMatch);
    
    return hasSchedule || hasNumberMatch;
  };

  // Load unmarked students for review tab - NEW LOGIC: Read from class schedule
  const loadUnmarkedStudents = async () => {
    if (allClasses.length === 0) return;
    
    setReviewLoading(true);
    try {
      // Debug: Show all classes and their schedules
      console.log('[Review] All classes:', allClasses.length);
      allClasses.forEach(c => {
        console.log('[Review] Class:', c.name, '| Status:', c.status, '| Schedule:', c.schedule);
      });
      
      // Step 1: Find all active classes that should have session on reviewDate
      // Include more status variations: Active, Đang học, Chờ mx (exclude: Kết thúc, Đã hủy, Đã kết thúc)
      const excludeStatuses = ['Kết thúc', 'Đã kết thúc', 'Đã hủy', 'Cancelled', 'Completed'];
      const activeClasses = allClasses.filter(c => {
        const isActive = !excludeStatuses.includes(c.status);
        const hasSchedule = classHasScheduleOnDate(c, reviewDate);
        console.log('[Review] Filter:', c.name, '| Status:', c.status, '| isActive:', isActive, '| hasSchedule:', hasSchedule);
        return isActive && hasSchedule;
      });
      
      console.log('[Review] Classes with schedule on', reviewDate, ':', activeClasses.map(c => c.name));
      
      // Step 2: Get existing sessions for this date
      const sessionsOnDate = await getSessionsByDate(reviewDate);
      const existingSessions = new Map<string, ClassSession>();
      sessionsOnDate.forEach((session) => {
        if (session.id) existingSessions.set(session.classId, session);
      });
      
      console.log('[Review] Existing sessions in DB:', existingSessions.size);
      
      const results: SessionWithUnmarked[] = [];
      
      // Step 3: Process each class that should have session
      for (const classInfo of activeClasses) {
        // Check if class is on holiday
        const classHoliday = getHolidayForDate(reviewDate, classInfo.id);
        if (classHoliday) {
          console.log('[Review] Class:', classInfo.name, '- SKIPPED: Holiday -', classHoliday.name);
          continue;
        }
        
        const existingSession = existingSessions.get(classInfo.id);
        const sessionId = existingSession?.id || `temp_${classInfo.id}_${reviewDate}`;
        const sessionNumber = existingSession?.sessionNumber || 0;
        
        // Get students in this class - only include students eligible for attendance
        // Eligible statuses: Đang học, Học thử, Đã học hết phí, Nợ phí (same as main attendance tab)
        const allClassStudents = allStudents.filter(s => 
          s.classId === classInfo.id || s.class === classInfo.name || s.className === classInfo.name
        );
        const studentsInClass = allClassStudents.filter(s => 
          ATTENDANCE_ELIGIBLE_STATUSES.includes(s.status as StudentStatus)
        );
        
        console.log('[Review] Class:', classInfo.name, '| All students:', allClassStudents.length, '| Active:', studentsInClass.length);
        if (allClassStudents.length > 0) {
          console.log('[Review] Student statuses:', [...new Set(allClassStudents.map(s => s.status))]);
        }
        
        if (studentsInClass.length === 0) {
          console.log('[Review] Class:', classInfo.name, '- SKIPPED: No active students');
          continue;
        }
        
        // Get attendance records - check by sessionId OR by classId+date
        let markedStudentIds = new Set<string>();
        
        if (existingSession?.id) {
          const bySession = await getStudentAttendanceBySession(existingSession.id);
          bySession.forEach((record) => markedStudentIds.add(record.studentId));
        }

        const byDate = await getStudentAttendanceByClassAndDate(classInfo.id, reviewDate);
        byDate.forEach((record) => markedStudentIds.add(record.studentId));
        
        console.log('[Review] Class:', classInfo.name, '- Students:', studentsInClass.length, '- Marked:', markedStudentIds.size, '- HasSession:', !!existingSession);
        
        // Find unmarked students
        const unmarked: UnmarkedStudent[] = studentsInClass
          .filter(s => !markedStudentIds.has(s.id))
          .map(s => ({
            id: `${sessionId}_${s.id}`,
            sessionId,
            sessionDate: reviewDate,
            sessionNumber,
            classId: classInfo.id,
            className: classInfo.name,
            studentId: s.id,
            studentName: s.fullName || (s as any).name || 'Unknown'
          }));
        
        if (unmarked.length > 0) {
          results.push({
            sessionId,
            sessionDate: reviewDate,
            sessionNumber,
            classId: classInfo.id,
            className: classInfo.name,
            unmarkedStudents: unmarked
          });
        } else {
          console.log('[Review] Class:', classInfo.name, '- SKIPPED: All students already marked');
        }
      }
      
      results.sort((a, b) => a.className.localeCompare(b.className));
      setSessionsWithUnmarked(results);
      
    } catch (err) {
      console.error('Error loading unmarked students:', err);
    } finally {
      setReviewLoading(false);
    }
  };

  // Load when review date changes or tab switches
  useEffect(() => {
    if (activeTab === 'review') {
      loadUnmarkedStudents();
    }
  }, [reviewDate, activeTab, allClasses.length, allStudents.length]);

  // Filter sessions by class and branch - Bug 4 fix
  const filteredReviewSessions = useMemo(() => {
    let filtered = sessionsWithUnmarked;
    if (reviewFilterClass) {
      filtered = filtered.filter(s => s.classId === reviewFilterClass);
    }
    if (reviewFilterBranch) {
      const classesInBranch = new Set(allClasses.filter(c => c.branch === reviewFilterBranch).map(c => c.id));
      filtered = filtered.filter(s => classesInBranch.has(s.classId));
    }
    return filtered;
  }, [sessionsWithUnmarked, reviewFilterClass, reviewFilterBranch, allClasses]);

  // Total unmarked count
  const totalUnmarked = useMemo(() => {
    return filteredReviewSessions.reduce((sum, s) => sum + s.unmarkedStudents.length, 0);
  }, [filteredReviewSessions]);

  // Confirm attendance review
  const handleReviewConfirm = async () => {
    if (!confirmDialog.student) return;
    
    setProcessingReview(true);
    try {
      const student = confirmDialog.student;
      const isLate = confirmDialog.type === 'late';
      const isReserved = confirmDialog.type === 'reserved'; // Bug 4 fix
      
      let actualSessionId = student.sessionId;
      
      // If sessionId is temporary (starts with temp_), create a real session first
      if (student.sessionId.startsWith('temp_')) {
        const classInfo = allClasses.find(c => c.id === student.classId);
        actualSessionId = await createReviewSession({
          classId: student.classId,
          className: student.className,
          date: student.sessionDate,
          time: classInfo?.time || classInfo?.schedule || '',
          room: classInfo?.room || '',
          createdBy: staffData?.name || 'Lễ tân',
        });
        console.log('[Review] Created new session:', actualSessionId);
      }

      await saveReviewStudentAttendance({
        sessionId: actualSessionId,
        classId: student.classId,
        className: student.className,
        studentId: student.studentId,
        studentName: student.studentName,
        date: student.sessionDate,
        sessionNumber: student.sessionNumber,
        status: isLate ? 'Đi trễ' : isReserved ? 'Bảo lưu' : 'Vắng',
        note:
          confirmDialog.reason ||
          (isLate
            ? 'Đến trễ - Rà soát điểm danh'
            : isReserved
              ? 'Bảo lưu - Rà soát điểm danh'
              : 'Nghỉ học - Rà soát điểm danh'),
        checkedBy: staffData?.name || 'Lễ tân',
      });
      
      // Remove from list
      setSessionsWithUnmarked(prev => prev.map(session => {
        if (session.sessionId !== student.sessionId) return session;
        return {
          ...session,
          unmarkedStudents: session.unmarkedStudents.filter(s => s.studentId !== student.studentId)
        };
      }).filter(s => s.unmarkedStudents.length > 0));
      
      // Clear reason
      setReviewReasons(prev => {
        const newReasons = { ...prev };
        delete newReasons[student.id];
        return newReasons;
      });
      
      setConfirmDialog({ show: false, type: 'late', student: null, reason: '' });
      
    } catch (err) {
      console.error('Error confirming attendance:', err);
      alert('Có li xảy ra khi xác nhận!');
    } finally {
      setProcessingReview(false);
    }
  };

  // Bug 4 fix: Support 'reserved' type
  const openReviewConfirmDialog = (type: 'late' | 'absent' | 'reserved', student: UnmarkedStudent) => {
    setConfirmDialog({
      show: true,
      type,
      student,
      reason: reviewReasons[student.id] || ''
    });
  };

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Tab Header */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'attendance'
                ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Users size={18} />
            Điểm danh
          </button>
          <button
            onClick={() => setActiveTab('review')}
            className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'review'
                ? 'bg-amber-50 text-amber-700 border-b-2 border-amber-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <ClipboardCheck size={18} />
            Rà soát điểm danh
            {totalUnmarked > 0 && activeTab !== 'review' && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{totalUnmarked}</span>
            )}
          </button>
        </div>

        {/* Attendance Tab Controls */}
        {activeTab === 'attendance' && (
          <div className="p-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Điểm danh lớp học</h2>
                <p className="text-sm text-gray-500">5 trạng thái: Đúng giờ, Trễ giờ, Vắng, Bảo lưu, Đã bồi</p>
              </div>
              <div className="flex flex-wrap gap-3 w-full md:w-auto">
                {/* Searchable class dropdown with branch filter */}
                <SearchableClassDropdown
                  classes={classes}
                  selectedClassId={selectedClassId}
                  onSelect={(classId) => {
                    setSelectedClassId(classId);
                    setSelectedSession(null);
                  }}
                  disabled={classLoading}
                  placeholder="Tìm kiếm lớp..."
                />
                
                <div className="flex items-center bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setUseSessionMode(true)}
                    className={`px-3 py-1 text-xs font-medium rounded ${
                      useSessionMode ? 'bg-white shadow text-indigo-600' : 'text-gray-600'
                    }`}
                  >
                    Buổi học
                  </button>
                  <button
                    onClick={() => {
                      setUseSessionMode(false);
                      setSelectedSession(null); // Reset session khi chuyển sang chế độ chọn ngày
                    }}
                    className={`px-3 py-1 text-xs font-medium rounded ${
                      !useSessionMode ? 'bg-white shadow text-indigo-600' : 'text-gray-600'
                    }`}
                  >
                    Chọn ngày
                  </button>
                </div>

                {useSessionMode ? (
                  <div ref={sessionDropdownRef} className="relative">
                    <button
                      ref={sessionButtonRef}
                      type="button"
                      onClick={() => {
                        if (selectedClassId && !sessionsLoading) {
                          if (!sessionDropdownOpen && sessionButtonRef.current) {
                            const rect = sessionButtonRef.current.getBoundingClientRect();
                            // Calculate max height based on actual available space below button
                            const availableSpace = window.innerHeight - rect.bottom - 12; // 12px padding from bottom
                            setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width, maxHeight: Math.max(200, availableSpace) });
                          }
                          setSessionDropdownOpen(!sessionDropdownOpen);
                        }
                      }}
                      disabled={!selectedClassId || sessionsLoading}
                      className="w-[420px] px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center justify-between disabled:bg-gray-100"
                    >
                      <span className={`${selectedSession ? 'text-gray-900' : 'text-gray-500'} whitespace-nowrap overflow-hidden text-ellipsis`}>
                        {selectedSession 
                          ? (() => {
                              const teacherName = selectedSession.teacherName || selectedClass?.teacher || '';
                              const dateStr = new Date(selectedSession.date).toLocaleDateString('vi-VN');
                              const timeStr = selectedSession.time || '';
                              const dup =
                                sessionDatesWithDuplicates.has(selectedSession.date)
                                  ? ` · Buổi ${selectedSession.sessionNumber}`
                                  : '';
                              return teacherName 
                                ? `GV: ${teacherName} - ${selectedSession.dayOfWeek} - ${dateStr}${timeStr ? ` (${timeStr})` : ''}${dup}`
                                : `Buổi ${selectedSession.sessionNumber} - ${dateStr} (${selectedSession.dayOfWeek})`;
                            })()
                          : '-- Chọn buổi học --'
                        }
                      </span>
                      <ChevronDown size={16} className="text-gray-400" />
                    </button>
                    
                    {sessionDropdownOpen && createPortal(
                      <>
                        {/* Overlay to close on click outside */}
                        <div className="fixed inset-0" style={{ zIndex: 99998 }} onClick={() => setSessionDropdownOpen(false)} />
                        <div
                          ref={dropdownPanelRef}
                          style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, maxHeight: dropdownPos.maxHeight, zIndex: 99999 }}
                          className="bg-white border border-gray-300 rounded-lg shadow-2xl overflow-y-auto"
                        >
                        {[...allSessions]
                          .filter(s => s.sessionNumber > 0) // Bug 2 fix: Filter out sessions with invalid sessionNumber
                          .sort((a, b) => {
                            // Sort by date descending (ngày l:n lên trước)
                            return b.date.localeCompare(a.date);
                          })
                          .map(s => {
                          const today = new Date().toISOString().split('T')[0];
                          const isPast = s.date < today;
                          const isToday = s.date === today;
                          // Check if session is a holiday (Cloud Function sets status='Nghỉ' + holidayId)
                          const isHoliday = s.status === 'Nghỉ' || !!s.holidayId;
                          // Fix: Check both session flags AND actual attendance existence
                          const hasAttendanceRecord = completedSessionIds.has(s.id) ||
                                                      (s.date && completedDates.has(s.date));
                          const isCompleted = s.status === 'Đã học' || !!s.attendanceId || hasAttendanceRecord;

                          let bgClass = 'bg-white hover:bg-gray-50';
                          let iconColor = '#9ca3af';
                          let icon = '○';

                          if (isHoliday) {
                            bgClass = 'bg-purple-50 hover:bg-purple-100';
                            iconColor = '#7c3aed';
                            icon = '⊘';
                          } else if (isCompleted) {
                            bgClass = 'bg-green-50 hover:bg-green-100';
                            iconColor = '#16a34a';
                            icon = '✓';
                          } else if (isPast) {
                            bgClass = 'bg-red-50 hover:bg-red-100';
                            iconColor = '#dc2626';
                            icon = '✗';
                          } else if (isToday) {
                            bgClass = 'bg-yellow-50 hover:bg-yellow-100';
                            iconColor = '#ca8a04';
                            icon = '●';
                          }

                          return (
                            <div
                              key={s.id}
                              onClick={() => {
                                handleSelectSession(s);
                                setSessionDropdownOpen(false);
                              }}
                              className={`px-3 py-2 cursor-pointer text-xs flex items-center gap-2 ${bgClass} ${selectedSession?.id === s.id ? 'ring-2 ring-inset ring-indigo-400' : ''}`}
                            >
                              <span style={{ color: iconColor, fontWeight: 'bold', fontSize: '12px' }}>{icon}</span>
                              <span className="whitespace-nowrap">
                                {(() => {
                                  const teacherName = s.teacherName || selectedClass?.teacher || '';
                                  const dateStr = new Date(s.date).toLocaleDateString('vi-VN');
                                  const timeStr = s.time || '';
                                  const dup =
                                    sessionDatesWithDuplicates.has(s.date) ? ` · Buổi ${s.sessionNumber}` : '';
                                  return teacherName 
                                    ? `GV: ${teacherName} - ${s.dayOfWeek} - ${dateStr}${timeStr ? ` (${timeStr})` : ''}${dup}`
                                    : `Buổi ${s.sessionNumber} - ${dateStr} (${s.dayOfWeek})`;
                                })()}
                              </span>
                              {isHoliday && <span className="ml-auto text-xs text-purple-600 font-medium">{s.holidayName || 'Nghỉ lễ'}</span>}
                            </div>
                          );
                        })}
                      </div>
                      </>,
                      document.body
                    )}
                  </div>
                ) : (
                  <input
                    type="date"
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={attendanceDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Review Tab Controls */}
        {activeTab === 'review' && (
          <div className="p-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Rà soát điểm danh</h2>
                <p className="text-sm text-gray-500">Kiểm tra học sinh chưa được điểm danh từ buổi học trước</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Ngày học</label>
                  <input
                    type="date"
                    value={reviewDate}
                    onChange={(e) => setReviewDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Lọc theo lớp</label>
                  <select
                    value={reviewFilterClass}
                    onChange={(e) => setReviewFilterClass(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 min-w-[200px]"
                  >
                    <option value="">Tất cả lớp</option>
                    {allClasses.filter(c => ['Đang học', 'Chờ mx'].includes(c.status)).map(cls => (
                      <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                  </select>
                </div>
                {/* Bug 4 fix: Add branch filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Lọc theo cơ sx</label>
                  <select
                    value={reviewFilterBranch}
                    onChange={(e) => setReviewFilterBranch(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 min-w-[150px]"
                  >
                    <option value="">Tất cả cơ sx</option>
                    {[...new Set(allClasses.map(c => c.branch).filter(Boolean))].map(branch => (
                      <option key={branch} value={branch}>{branch}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========== ATTENDANCE TAB CONTENT ========== */}
      {activeTab === 'attendance' && (
        <>
      {/* Session info */}
      {selectedSession && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex items-center gap-3">
          <Calendar className="text-indigo-600" size={20} />
          <div>
            <p className="font-medium text-indigo-900">
              Buổi {selectedSession.sessionNumber}: {selectedSession.dayOfWeek}, {new Date(selectedSession.date).toLocaleDateString('vi-VN')}
            </p>
            <p className="text-sm text-indigo-600">
              {selectedSession.time && `Giờ: ${selectedSession.time}`}
              {selectedSession.room && ` • Phòng: ${selectedSession.room}`}
            </p>
          </div>
        </div>
      )}
      
      {/* No sessions warning - differentiate between no sessions created vs all completed */}
      {useSessionMode && selectedClassId && !sessionsLoading && upcomingSessions.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertCircle size={20} />
              <span>
                {allSessions.length === 0
                  ? 'Chưa có buổi học nào được tạo cho lớp này. Vui lòng tạo buổi học hoặc chuyển sang chế độ "Chọn ngày".'
                  : `Tất cả ${allSessions.length} buổi học đã được điểm danh. Bạn có thể chọn buổi từ danh sách hoặc thêm buổi học bù.`}
              </span>
            </div>
            <div className="flex gap-2">
              {selectedClass?.schedule && (
                <button
                  onClick={handleAutoGenerateSessions}
                  disabled={generatingSessions}
                  className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Sẽ tạo buổi học từ hôm nay theo lịch học của lớp"
                >
                  {generatingSessions ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                      Đang tạo...
                    </>
                  ) : (
                    <>
                      <Plus size={14} /> Tạo buổi học tự động
                    </>
                  )}
                </button>
              )}
              <button
                onClick={() => setShowAddSessionModal(true)}
                className="flex items-center gap-1 px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
              >
                <Plus size={14} /> Thêm buổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Always show auto-generate and delete buttons when in session mode and class has schedule */}
      {useSessionMode && selectedClassId && !sessionsLoading && selectedClass?.schedule && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-blue-800">
              <Calendar size={18} />
              <span className="text-sm font-medium">
                Quản lý buổi học
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAutoGenerateSessions}
                disabled={generatingSessions || !selectedClass.startDate}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title={selectedClass.startDate 
                  ? `Sẽ tạo buổi học từ ${new Date(selectedClass.startDate).toLocaleDateString('vi-VN')} đến ${selectedClass.endDate ? new Date(selectedClass.endDate).toLocaleDateString('vi-VN') : 'ngày kết thúc'} theo lịch học của lớp`
                  : 'Lớp chưa có ngày bắt đầu. Vui lòng cập nhật ngày bắt đầu khóa học.'}
              >
                {generatingSessions ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    Đang tạo...
                  </>
                ) : (
                  <>
                    <Plus size={14} /> Tạo buổi học tự động
                  </>
                )}
              </button>
              {allSessions.length > 0 && (
                <button
                  onClick={handleDeleteAllSessions}
                  disabled={deletingSessions}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={`Xóa tất cả ${allSessions.length} buổi học của lớp này`}
                >
                  {deletingSessions ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                      Đang xóa...
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} /> Xóa toàn bộ
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
          {selectedClass.startDate && (
            <div className="text-xs text-blue-600">
              {selectedClass.endDate ? (
                <>
                  <strong>{new Date(selectedClass.startDate).toLocaleDateString('vi-VN')}</strong> - <strong>{new Date(selectedClass.endDate).toLocaleDateString('vi-VN')}</strong>
                  {allSessions.length > 0 && (
                    <> • Mỗi lần bấm tạo thêm <strong>30 ngày</strong></>
                  )}
                </>
              ) : (
                <>
                  Từ <strong>{new Date(selectedClass.startDate).toLocaleDateString('vi-VN')}</strong>
                  {allSessions.length > 0 && (
                    <> • Mỗi lần bấm tạo thêm <strong>30 ngày</strong></>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          {message.text}
        </div>
      )}

      {/* Schedule Warning - BLOCKING */}
      {selectedClassId && !isValidScheduleDay && !useSessionMode && !completedDates.has(attendanceDate) && (
        <div className="bg-red-100 border-2 border-red-400 rounded-lg p-4 flex items-start gap-3 text-red-800">
          <AlertTriangle size={24} className="flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-lg">KHÔNG THỂ ĐIỂM DANH - NGÀY KHÔNG HỢP LỆ </p>
            <p className="mt-1">
              Ngày {new Date(attendanceDate).toLocaleDateString('vi-VN')} không nằm trong lịch học của lớp 
              {selectedClass?.schedule && <> (Lịch: {formatSchedule(selectedClass.schedule)})</>}.
            </p>
            <p className="text-sm mt-2 text-red-600">
              Bạn chỉ có thể điểm danh vào các ngày trong lịch học hoặc các ngày đã điểm danh trước đó.
            </p>
          </div>
        </div>
      )}

      {/* Holiday Warning - BLOCKING */}
      {selectedDateHoliday && (
        <div className="bg-red-100 border-2 border-red-400 rounded-lg p-4 flex items-start gap-3 text-red-800">
          <AlertTriangle size={24} className="flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-lg">KHÔNG THỂ ĐIỂM DANH - NGÀY NGHỈ</p>
            <p className="mt-1">
              <strong>{selectedDateHoliday.name}</strong> ({selectedDateHoliday.startDate} - {selectedDateHoliday.endDate})
            </p>
            <p className="text-sm mt-2 text-red-600">
              Đây là ngày nghỉ đã được đăng ký. Không thể lưu điểm danh cho ngày này.
            </p>
            <p className="text-sm mt-1 text-red-600">
              Nếu có bản ghi cũ, lịch sử điểm danh sẽ hiển thị trạng thái "LỊCH NGHỈ CHUNG".
            </p>
          </div>
        </div>
      )}

      {!selectedClassId ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
          <Calendar size={48} className="mx-auto mb-4 opacity-30" />
          <p>Vui lòng chọn lớp để bắt đầu điểm danh</p>
        </div>
      ) : studentLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Đang tải danh sách học sinh...</p>
        </div>
      ) : classStudents.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
          <Users size={48} className="mx-auto mb-4 opacity-30" />
          <p>Không có học sinh trong lớp này</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Stats Header */}
          <div className="grid grid-cols-6 border-b border-gray-100 divide-x divide-gray-100">
            <div className="p-4 text-center">
              <p className="text-xs text-gray-500 uppercase font-bold">Tổng số</p>
              <p className="text-xl font-bold text-gray-800">{stats.total}</p>
            </div>
            <div className="p-4 text-center bg-gray-50">
              <p className="text-xs text-gray-500 uppercase font-bold">Chưa điểm danh</p>
              <p className="text-xl font-bold text-gray-600">{stats.pending}</p>
            </div>
            <div className="p-4 text-center bg-green-50">
              <p className="text-xs text-green-600 uppercase font-bold">Có mặt</p>
              <p className="text-xl font-bold text-green-700">{stats.present}</p>
            </div>
            <div className="p-4 text-center bg-red-50">
              <p className="text-xs text-red-600 uppercase font-bold">Vắng</p>
              <p className="text-xl font-bold text-red-700">{stats.absent}</p>
            </div>
            <div className="p-4 text-center bg-orange-50">
              <p className="text-xs text-orange-600 uppercase font-bold">Bảo lưu</p>
              <p className="text-xl font-bold text-orange-700">{stats.reserved}</p>
            </div>
            <div className="p-4 text-center bg-blue-50">
              <p className="text-xs text-blue-600 uppercase font-bold">Đã bồi</p>
              <p className="text-xl font-bold text-blue-700">{stats.tutored}</p>
            </div>
          </div>

          {/* Bulk Actions */}
          <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-gray-600">Điểm danh nhanh:</span>
              <button
                onClick={() => handleBulkStatus(AttendanceStatus.ON_TIME)}
                className="px-3 py-1 text-xs font-medium rounded bg-green-100 text-green-700 hover:bg-green-200"
              >
                Tất cả đúng giờ
              </button>
              <button
                onClick={() => handleBulkStatus(AttendanceStatus.ABSENT)}
                className="px-3 py-1 text-xs font-medium rounded bg-red-100 text-red-700 hover:bg-red-200"
              >
                Tất cả vắng
              </button>
              <button
                onClick={() => handleBulkStatus(AttendanceStatus.RESERVED)}
                className="px-3 py-1 text-xs font-medium rounded bg-orange-100 text-orange-700 hover:bg-orange-200"
              >
                Tất cả bảo lưu
              </button>
            </div>
            <button
              type="button"
              onClick={handleOpenClassLearningPicker}
              disabled={!learningMaterials || attendanceData.length === 0}
              className="inline-flex items-center gap-1.5 rounded border border-indigo-200 bg-white px-3 py-1 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <BookOpen size={14} />
              Nhập bài
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500">
              <tr>
                <th className="px-4 py-4 w-12">STT</th>
                <th className="px-4 py-4">Học viên</th>
                <th className="px-4 py-4 text-center">Trạng thái</th>
                  {showGradeFields && (
                  <>
                    <th className="px-4 py-4 text-center w-20">% BTVN</th>
                    <th className="px-4 py-4 w-28">Tên bài KT</th>
                    <th className="px-4 py-4 text-center w-20">Điểm</th>
                    <th className="px-4 py-4 text-center w-24">Điểm thưxng</th>
                  </>
                )}
                <th className="px-4 py-4">Ghi chú</th>
                <th className="px-4 py-4">Nhận xét ý thức</th>
                <th className="px-4 py-4">Thẻ chú ý</th>
                <th className="px-4 py-4">Dạng bài học</th>
                <th className="px-4 py-4">Kiểm tra mai</th>
                <th className="px-4 py-4 text-center w-28">In phiếu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {attendanceData.map((student, index) => (
                <tr key={student.studentId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{index + 1}</td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-bold text-gray-900">{student.studentName}</p>
                      <p className="text-xs text-gray-500">{student.studentCode}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-1 flex-wrap">
                      <button
                        onClick={() => handleStatusChange(student.studentId, AttendanceStatus.ON_TIME)}
                        className={`px-2 py-1 rounded text-xs font-bold border transition-colors ${getStatusStyle(AttendanceStatus.ON_TIME, student.status)}`}
                      >
                        Đúng giờ
                      </button>
                      <button
                        onClick={() => handleStatusChange(student.studentId, AttendanceStatus.LATE)}
                        className={`px-2 py-1 rounded text-xs font-bold border transition-colors ${getStatusStyle(AttendanceStatus.LATE, student.status)}`}
                      >
                        Trễ giờ
                      </button>
                      <button
                        onClick={() => handleStatusChange(student.studentId, AttendanceStatus.ABSENT)}
                        className={`px-2 py-1 rounded text-xs font-bold border transition-colors ${getStatusStyle(AttendanceStatus.ABSENT, student.status)}`}
                        title="Vắng sẽ tự động tạo lịch bồi bài"
                      >
                        Vắng
                      </button>
                      <button
                        onClick={() => handleStatusChange(student.studentId, AttendanceStatus.RESERVED)}
                        className={`px-2 py-1 rounded text-xs font-bold border transition-colors ${getStatusStyle(AttendanceStatus.RESERVED, student.status)}`}
                      >
                        Bảo lưu
                      </button>
                      <button
                        onClick={() => handleStatusChange(student.studentId, AttendanceStatus.TUTORED)}
                        className={`px-2 py-1 rounded text-xs font-bold border transition-colors ${getStatusStyle(AttendanceStatus.TUTORED, student.status)}`}
                      >
                        Đã bồi
                      </button>
                    </div>
                  </td>
                  {showGradeFields && (
                    <>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="%"
                          value={student.homeworkCompletion ?? ''}
                          onChange={(e) => handleGradeChange(student.studentId, 'homeworkCompletion', e.target.value ? Number(e.target.value) : undefined)}
                          className="w-16 px-2 py-1 border border-gray-200 rounded text-center text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          placeholder="Bài KT..."
                          value={student.testName || ''}
                          onChange={(e) => handleGradeChange(student.studentId, 'testName', e.target.value)}
                          className="w-24 px-2 py-1 border border-gray-200 rounded text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.5"
                          placeholder="0-10"
                          value={student.score ?? ''}
                          onChange={(e) => handleGradeChange(student.studentId, 'score', e.target.value ? Number(e.target.value) : undefined)}
                          className="w-16 px-2 py-1 border border-gray-200 rounded text-center text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={student.bonusPoints ?? ''}
                          onChange={(e) => handleGradeChange(student.studentId, 'bonusPoints', e.target.value ? Number(e.target.value) : undefined)}
                          className="w-16 px-2 py-1 border border-gray-200 rounded text-center text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                    </>
                  )}
                  <td className="px-4 py-3">
                    <textarea
                      placeholder="Ghi chú... (Enter  đi xuđng dòng)"
                      value={student.note}
                      onChange={(e) => handleNoteChange(student.studentId, e.target.value)}
                      rows={2}
                      className="w-full min-w-[180px] border-b border-gray-200 focus:border-indigo-500 outline-none bg-transparent py-1 text-gray-600 resize-y"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <AttitudeCommentField
                      value={student.attitudeComment}
                      onChange={(v) => handleAttitudeCommentChange(student.studentId, v)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        setMaterialPicker({
                          studentId: student.studentId,
                          studentName: student.studentName,
                          mode: 'attention',
                        })
                      }
                      className="w-full min-w-[140px] rounded-lg border border-gray-300 px-2 py-2 text-left text-xs hover:bg-gray-50"
                    >
                      <span className="font-medium text-indigo-700">Chọn từ học liệu</span>
                      <span
                        className={`mt-1 block ${hasAttentionCardSelection(student.attentionCard) ? 'font-medium text-green-700' : 'text-gray-500'}`}
                      >
                        {formatAttentionCardSummary(student.attentionCard)}
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        setMaterialPicker({
                          studentId: student.studentId,
                          studentName: student.studentName,
                          mode: 'lessonTypes',
                        })
                      }
                      className="w-full min-w-[140px] rounded-lg border border-gray-300 px-2 py-2 text-left text-xs hover:bg-gray-50"
                    >
                      <span className="font-medium text-blue-700">Chọn dạng bài</span>
                      <span
                        className={`mt-1 block ${hasLessonExerciseTagsSelection(student.lessonExerciseTags) ? 'font-medium text-green-700' : 'text-gray-500'}`}
                      >
                        {formatLessonExerciseTagsSummary(student.lessonExerciseTags)}
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        setMaterialPicker({
                          studentId: student.studentId,
                          studentName: student.studentName,
                          mode: 'checkTags',
                        })
                      }
                      className="w-full min-w-[140px] rounded-lg border border-gray-300 px-2 py-2 text-left text-xs hover:bg-gray-50"
                    >
                      <span className="font-medium text-green-700">Gắn dạng bài</span>
                      <span
                        className={`mt-1 block ${hasCheckTagsSelection(student.checkExerciseTags) ? 'font-medium text-green-700' : 'text-gray-500'}`}
                      >
                        {formatCheckTagsSummary(student.checkExerciseTags)}
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => handlePrintCommentSlip(student)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-xs font-medium"
                      title="In phiếu nhận xét gửi phụ huynh"
                    >
                      <Printer size={14} />
                      In phiếu
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center sticky bottom-0">
            <div className="text-sm text-gray-500">
              {stats.absent > 0 && (
                <span className="flex items-center gap-1 text-orange-600">
                  <BookOpen size={16} />
                  {stats.absent} học sinh vắng sẽ được tạo lịch bồi bài tự động
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsResetting(true);
                  setAttendanceData(
                    classStudents.map(s => ({
                      studentId: s.id,
                      studentName: s.fullName,
                      studentCode: s.code,
                      status: AttendanceStatus.PENDING,
                      note: '',
                      attitudeComment: '',
                      attentionCard: '',
                      lessonExerciseTags: '',
                      checkExerciseTags: '',
                      punctuality: '',
                    }))
                  );
                }}
                className="px-6 py-2 border border-gray-300 bg-white rounded-lg text-gray-700 font-medium hover:bg-gray-50"
              >
                Reset
              </button>
              <button
                onClick={handleSave}
                disabled={saving || attendanceData.length === 0 || !!selectedDateHoliday || (useSessionMode && !selectedSession)}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Save size={18} /> Lưu điểm danh
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Makeup Attendance Confirm Dialog (Phase 4) */}
      {showMakeupConfirm && (
        <ModalPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="text-amber-500" size={24} />
              <h3 className="text-lg font-semibold">Điểm danh học bù?</h3>
            </div>

            <p className="text-gray-600 mb-4">
              Bạn đang điểm danh mà không chọn buổi học. Điểm danh này sẽ được
              tính là <strong>buổi học bù</strong> và không ảnh hưxng đến số buổi
              còn lại của học sinh.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowMakeupConfirm(false);
                  setPendingSaveData(null);
                  setUseSessionMode(true);
                }}
                disabled={saving}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Chọn buổi học
              </button>
              <button
                onClick={() => saveWithType('makeup')}
                disabled={saving}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Đang lưu...
                  </>
                ) : (
                  'Xác nhận học bù'
                )}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Learning material picker */}
      {materialPicker && (
        <LearningMaterialPickerModal
          open
          mode={materialPicker.mode}
          studentName={materialPicker.studentName}
          learningData={learningMaterials}
          initialAttention={parseAttentionCard(
            attendanceData.find((s) => s.studentId === materialPicker.studentId)?.attentionCard
          )}
          initialLessonTypes={parseLessonExerciseTags(
            attendanceData.find((s) => s.studentId === materialPicker.studentId)?.lessonExerciseTags
          )}
          initialCheckTags={parseCheckExerciseTags(
            attendanceData.find((s) => s.studentId === materialPicker.studentId)?.checkExerciseTags
          )}
          onClose={() => setMaterialPicker(null)}
          onSaveAttention={(data) => handleSaveAttentionCard(materialPicker.studentId, data)}
          onSaveLessonTypes={(data) => handleSaveLessonExerciseTags(materialPicker.studentId, data)}
          onSaveCheckTags={(data) => handleSaveCheckExerciseTags(materialPicker.studentId, data)}
        />
      )}

      {/* Add Session Modal */}
      {showAddSessionModal && selectedClassId && (
        <AddSessionModal
          classId={selectedClassId}
          className={selectedClass?.name || ''}
          onClose={() => setShowAddSessionModal(false)}
          onAdd={async (date, time, note) => {
            try {
              await addMakeup(date, time, note);
              setShowAddSessionModal(false);
              setMessage({ type: 'success', text: 'Đã thêm buổi học bù thành công!' });
            } catch (err) {
              setMessage({ type: 'error', text: 'Không thể thêm buổi học: ' + (err as Error).message });
            }
          }}
        />
      )}
        </>
      )}

      {/* ========== REVIEW TAB CONTENT ========== */}
      {activeTab === 'review' && (
        <>
          {/* Holiday Warning for Review */}
          {reviewDateHoliday && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
              <AlertTriangle className="text-red-500 flex-shrink-0" size={24} />
              <div>
                <p className="font-medium text-red-800">
                  NGÀY NGHỈ: {reviewDateHoliday.name}
                </p>
                <p className="text-sm text-red-600">
                  Ngày {reviewDate} là ngày nghỉ ({reviewDateHoliday.startDate} - {reviewDateHoliday.endDate}). Các lớp có thể không cần điểm danh.
                </p>
              </div>
            </div>
          )}

          {/* Summary Warning */}
          {totalUnmarked > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
              <AlertTriangle className="text-amber-500 flex-shrink-0" size={24} />
              <div>
                <p className="font-medium text-amber-800">
                  Có {totalUnmarked} học sinh chưa được điểm danh ngày {reviewDate}
                </p>
                <p className="text-sm text-amber-600">
                  Vui lòng rà soát và xác nhận trạng thái điểm danh cho từng học sinh
                </p>
              </div>
            </div>
          )}

          {/* Loading/Empty/Content */}
          {reviewLoading ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-amber-500 border-t-transparent mx-auto mb-4"></div>
              <p className="text-gray-500">Đang tải dữ liệu...</p>
            </div>
          ) : filteredReviewSessions.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
              <p className="text-gray-600 font-medium">Tất cả học sinh đã được điểm danh!</p>
              <p className="text-sm text-gray-400 mt-1">Không có học sinh nào cần rà soát cho ngày {reviewDate}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredReviewSessions.map(session => (
                <div key={session.sessionId} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  {/* Session Header */}
                  <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3">
                    <h3 className="text-white font-semibold">
                      Buổi học: {session.sessionDate}
                    </h3>
                    <p className="text-amber-100 text-sm">
                      Lớp: {session.className} - Buổi {session.sessionNumber}
                    </p>
                  </div>
                  
                  {/* Students Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-12">STT</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tên Học sinh</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-48">Thời gian/ Lý do</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-40">Trạng thái</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-56">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {session.unmarkedStudents.map((student, idx) => (
                          <tr key={student.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-600">{idx + 1}</td>
                            <td className="px-4 py-3">
                              <span className="font-medium text-gray-800">{student.studentName}</span>
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                placeholder="Nhập lý do..."
                                value={reviewReasons[student.id] || ''}
                                onChange={(e) => setReviewReasons(prev => ({
                                  ...prev,
                                  [student.id]: e.target.value
                                }))}
                                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                <AlertTriangle size={12} />
                                Chưa điểm danh
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => openReviewConfirmDialog('late', student)}
                                  className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 flex items-center gap-1"
                                >
                                  <CheckCircle size={14} />
                                  Điểm danh đến trễ
                                </button>
                                <button
                                  onClick={() => openReviewConfirmDialog('absent', student)}
                                  className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 flex items-center gap-1"
                                >
                                  <XCircle size={14} />
                                  Vắng/Nghỉ học
                                </button>
                                {/* Bug 4 fix: Add Bảo lưu button */}
                                <button
                                  onClick={() => openReviewConfirmDialog('reserved', student)}
                                  className="px-3 py-1.5 bg-orange-500 text-white text-xs font-medium rounded-lg hover:bg-orange-600 flex items-center gap-1"
                                >
                                  <AlertTriangle size={14} />
                                  Bảo lưu
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Review Confirm Dialog */}
      {confirmDialog.show && confirmDialog.student && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Xác nhận điểm danh</h3>
            
            <p className="text-gray-600 mb-4">
              Bạn có chắc chắn muốn{' '}
              {confirmDialog.type === 'late' ? (
                <span className="text-green-600 font-medium">Xác nhận Điểm danh đến trễ</span>
              ) : (
                <span className="text-red-600 font-medium">Xác nhận Vắng/Nghỉ học</span>
              )}{' '}
              cho học sinh <span className="font-semibold">{confirmDialog.student.studentName}</span>?
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú (tùy chọn)</label>
              <textarea
                value={confirmDialog.reason}
                onChange={(e) => setConfirmDialog(prev => ({ ...prev, reason: e.target.value }))}
                placeholder={confirmDialog.type === 'late' ? 'VD: Đến mu"n 15 phút' : 'VD: Có phép (đm)'}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-y"
              />
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDialog({ show: false, type: 'late', student: null, reason: '' })}
                disabled={processingReview}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Hủy
              </button>
              <button
                onClick={handleReviewConfirm}
                disabled={processingReview}
                className={`px-4 py-2 text-white rounded-lg font-medium flex items-center gap-2 ${
                  confirmDialog.type === 'late' ? 'bg-green-600 hover:bg-green-700' :
                  confirmDialog.type === 'reserved' ? 'bg-orange-500 hover:bg-orange-600' :
                  'bg-red-600 hover:bg-red-700'
                } disabled:opacity-50`}
              >
                {processingReview ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Đang xử lý...
                  </>
                ) : (
                  'Xác nhận'
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

// Add Session Modal Component
interface AddSessionModalProps {
  classId: string;
  className: string;
  onClose: () => void;
  onAdd: (date: string, time?: string, note?: string) => Promise<void>;
}

const AddSessionModal: React.FC<AddSessionModalProps> = ({ classId, className, onClose, onAdd }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('');
  const [note, setNote] = useState('Buổi học bù');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      alert('Vui lòng chọn ngày');
      return;
    }
    setLoading(true);
    try {
      await onAdd(date, time || undefined, note || undefined);
    } finally {
      setLoading(false);
    }
  };

  const dayOfWeek = new Date(date).toLocaleDateString('vi-VN', { weekday: 'long' });

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 rounded-t-xl">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Thêm buổi học</h3>
            <p className="text-sm text-indigo-600">{className}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <span className="text-2xl">&times;</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <strong>Lưu ý:</strong> Buổi học này sẽ được đánh dấu là "Học bù" và thêm vào danh sách buổi học của lớp.
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ngày học *</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
            {date && (
              <p className="text-sm text-gray-500 mt-1">{dayOfWeek}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Giờ học</label>
            <div className="flex gap-2">
              <input
                type="time"
                value={time.split('-')[0] || ''}
                onChange={(e) => {
                  const end = time.split('-')[1] || '';
                  setTime(e.target.value + (end ? '-' + end : ''));
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Bắt đầu"
              />
              <span className="flex items-center text-gray-400">-</span>
              <input
                type="time"
                value={time.split('-')[1] || ''}
                onChange={(e) => {
                  const start = time.split('-')[0] || '';
                  setTime((start ? start + '-' : '') + e.target.value);
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Kết thúc"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 resize-y"
              placeholder="Lý do học bù... (Enter  đi xuđng dòng)"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              disabled={loading}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Đang thêm...
                </>
              ) : (
                <>
                  <Plus size={16} /> Thêm buổi học
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
};
