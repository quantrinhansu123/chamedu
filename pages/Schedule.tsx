import React, { useState, useMemo, useEffect } from 'react';
import { Printer, ChevronLeft, ChevronRight, Plus, X, MapPin, Users, User, BookOpen, Clock, Home, ChevronUp, Calendar, GraduationCap, CheckCircle, Umbrella, Palette, Check, RotateCcw, Search, BarChart3, DollarSign, TrendingUp } from 'lucide-react';
import { useClasses } from '../src/hooks/useClasses';
import { useStudents } from '../src/hooks/useStudents';
import { usePermissions } from '../src/hooks/usePermissions';
import { useAuth } from '../src/hooks/useAuth';
import { useHolidays } from '../src/hooks/useHolidays';
import { useRooms } from '../src/hooks/useRooms';
import { useStaff } from '../src/hooks/useStaff';
import { ClassModel, Student, Holiday, AttendanceRecord } from '../types';
import { getScheduleTime, getScheduleDays, formatSchedule } from '../src/utils/scheduleUtils';
import { isAssistantRole, isTeacherRole } from '../src/utils/roleUtils';
import { ModalPortal } from '@/components/modal-portal';
import { getCenters } from '../src/services/centerService';
import { getAttendanceRecords } from '../src/services/attendanceService';
import { ClassService } from '../src/services/classService';
import { getSessionsByClass } from '../src/services/sessionService';
import { formatCurrency } from '../src/utils/currencyUtils';

// ============================================
// CLASS COLOR PALETTE SYSTEM
// Soft pastel education theme với 16 màu đẹp
// ============================================
const CLASS_COLOR_PALETTE = [
  // Warm tones
  { bg: 'bg-rose-50', border: 'border-l-rose-400', accent: 'bg-rose-400', ring: 'ring-rose-200', text: 'text-rose-700', gradient: 'from-rose-50 to-rose-100/50' },
  { bg: 'bg-orange-50', border: 'border-l-orange-400', accent: 'bg-orange-400', ring: 'ring-orange-200', text: 'text-orange-700', gradient: 'from-orange-50 to-orange-100/50' },
  { bg: 'bg-amber-50', border: 'border-l-amber-400', accent: 'bg-amber-400', ring: 'ring-amber-200', text: 'text-amber-700', gradient: 'from-amber-50 to-amber-100/50' },
  { bg: 'bg-yellow-50', border: 'border-l-yellow-400', accent: 'bg-yellow-400', ring: 'ring-yellow-200', text: 'text-yellow-700', gradient: 'from-yellow-50 to-yellow-100/50' },
  // Cool tones  
  { bg: 'bg-lime-50', border: 'border-l-lime-500', accent: 'bg-lime-500', ring: 'ring-lime-200', text: 'text-lime-700', gradient: 'from-lime-50 to-lime-100/50' },
  { bg: 'bg-emerald-50', border: 'border-l-emerald-400', accent: 'bg-emerald-400', ring: 'ring-emerald-200', text: 'text-emerald-700', gradient: 'from-emerald-50 to-emerald-100/50' },
  { bg: 'bg-teal-50', border: 'border-l-teal-400', accent: 'bg-teal-400', ring: 'ring-teal-200', text: 'text-teal-700', gradient: 'from-teal-50 to-teal-100/50' },
  { bg: 'bg-cyan-50', border: 'border-l-cyan-400', accent: 'bg-cyan-400', ring: 'ring-cyan-200', text: 'text-cyan-700', gradient: 'from-cyan-50 to-cyan-100/50' },
  // Blue tones
  { bg: 'bg-sky-50', border: 'border-l-sky-400', accent: 'bg-sky-400', ring: 'ring-sky-200', text: 'text-sky-700', gradient: 'from-sky-50 to-sky-100/50' },
  { bg: 'bg-blue-50', border: 'border-l-blue-400', accent: 'bg-blue-400', ring: 'ring-blue-200', text: 'text-blue-700', gradient: 'from-blue-50 to-blue-100/50' },
  { bg: 'bg-indigo-50', border: 'border-l-indigo-400', accent: 'bg-indigo-400', ring: 'ring-indigo-200', text: 'text-indigo-700', gradient: 'from-indigo-50 to-indigo-100/50' },
  { bg: 'bg-violet-50', border: 'border-l-violet-400', accent: 'bg-violet-400', ring: 'ring-violet-200', text: 'text-violet-700', gradient: 'from-violet-50 to-violet-100/50' },
  // Purple/Pink tones
  { bg: 'bg-purple-50', border: 'border-l-purple-400', accent: 'bg-purple-400', ring: 'ring-purple-200', text: 'text-purple-700', gradient: 'from-purple-50 to-purple-100/50' },
  { bg: 'bg-fuchsia-50', border: 'border-l-fuchsia-400', accent: 'bg-fuchsia-400', ring: 'ring-fuchsia-200', text: 'text-fuchsia-700', gradient: 'from-fuchsia-50 to-fuchsia-100/50' },
  { bg: 'bg-pink-50', border: 'border-l-pink-400', accent: 'bg-pink-400', ring: 'ring-pink-200', text: 'text-pink-700', gradient: 'from-pink-50 to-pink-100/50' },
  // Neutral accent
  { bg: 'bg-slate-50', border: 'border-l-slate-400', accent: 'bg-slate-400', ring: 'ring-slate-200', text: 'text-slate-700', gradient: 'from-slate-50 to-slate-100/50' },
];

const ALL_BRANCHES_VALUE = '__ALL_BRANCHES__';
const ALL_BRANCHES_OPTION = {
  id: ALL_BRANCHES_VALUE,
  name: 'Tất cả cơ sở',
  color: 'bg-slate-500',
  textColor: 'text-slate-700',
};

// Hash function để gán màu consistent cho mỗi lớp (fallback khi chưa chọn màu)
const hashClassName = (className: string): number => {
  let hash = 0;
  for (let i = 0; i < className.length; i++) {
    const char = className.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash) % CLASS_COLOR_PALETTE.length;
};

// Lấy màu cho lớp: ưu tiên màu đã lưu, fallback về hash từ tên
const getClassColor = (cls: { name?: string; id?: string; color?: number }): typeof CLASS_COLOR_PALETTE[0] => {
  // Nếu có màu đã lưu, sử dụng nó
  if (typeof cls.color === 'number' && cls.color >= 0 && cls.color < CLASS_COLOR_PALETTE.length) {
    return CLASS_COLOR_PALETTE[cls.color];
  }
  // Fallback: hash từ tên lớp
  const index = hashClassName(cls.name || cls.id || '');
  return CLASS_COLOR_PALETTE[index];
};

// Export để dùng ở ClassManager
export { CLASS_COLOR_PALETTE, hashClassName };

export const Schedule: React.FC = () => {
  const [selectedBranch, setSelectedBranch] = useState(ALL_BRANCHES_VALUE);
  const [centerList, setCenterList] = useState<{ id: string; name: string }[]>([]);
  const [filterTeacher, setFilterTeacher] = useState<string>('ALL');
  const [filterAssistant, setFilterAssistant] = useState<string>('ALL');
  const [filterRoom, setFilterRoom] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [detailModalClass, setDetailModalClass] = useState<ClassModel | null>(null);
  const [savingColorId, setSavingColorId] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);
  const [monthlyAttendanceRecords, setMonthlyAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(today.setDate(diff));
  });

  // Permissions
  const { shouldShowOnlyOwnClasses, staffId } = usePermissions();
  const { staffData } = useAuth();
  const onlyOwnClasses = shouldShowOnlyOwnClasses('schedule');

  const { classes: allClasses } = useClasses({});
  const { students: allStudents } = useStudents({});
  const { holidays } = useHolidays();
  const { rooms } = useRooms();
  const { staff } = useStaff();

  // Get active holidays (applied)
  const activeHolidays = useMemo(() => {
    return holidays.filter(h => h.status === 'Đã áp dụng');
  }, [holidays]);

  // Handle color change for a class
  const handleColorChange = async (classId: string, colorIndex: number | undefined) => {
    setSavingColorId(classId);
    try {
      await ClassService.updateClass(classId, {
        color: colorIndex ?? null // null = auto (hash-based)
      } as Partial<ClassModel>);
      setShowColorPicker(null);
    } catch (error) {
      console.error('Error updating class color:', error);
    } finally {
      setTimeout(() => setSavingColorId(null), 500);
    }
  };

  // Format date to YYYY-MM-DD in local timezone
  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const normalizeDateOnly = (value?: string | null): string => {
    if (!value) return '';
    return value.length >= 10 ? value.slice(0, 10) : value;
  };

  const isClassActiveOnDate = (cls: ClassModel, dateStr: string): boolean => {
    const startDate = normalizeDateOnly(cls.startDate);
    const endDate = normalizeDateOnly(cls.endDate);
    if (startDate && dateStr < startDate) return false;
    if (endDate && dateStr > endDate) return false;
    return true;
  };

  const normalizeClassStatusForCompare = (status?: string) =>
    (status || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .trim();

  const isStudyingClass = (cls: ClassModel) => {
    const status = normalizeClassStatusForCompare(cls.status);
    return status === 'dang hoc' || status === 'active' || status === 'studying';
  };

  // Check if a date falls within any active holiday
  const getHolidayForDate = (date: Date, classId?: string, branch?: string): Holiday | null => {
    const dateStr = formatDateLocal(date);
    
    for (const holiday of activeHolidays) {
      if (dateStr >= holiday.startDate && dateStr <= holiday.endDate) {
        // Check if holiday applies to this class/branch
        if (holiday.applyType === 'all_classes' || holiday.applyType === 'all_branches') {
          return holiday;
        }
        if (holiday.applyType === 'specific_branch' && branch && holiday.branch === branch) {
          return holiday;
        }
        if (holiday.applyType === 'specific_classes' && classId && holiday.classIds?.includes(classId)) {
          return holiday;
        }
        // Also check if no applyType (legacy holidays)
        if (!holiday.applyType) {
          return holiday;
        }
      }
    }
    return null;
  };

  // Get all holidays for current week
  const holidaysThisWeek = useMemo(() => {
    const weekHolidays: Map<string, Holiday[]> = new Map();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + i);
      const dateStr = formatDateLocal(date);
      
      const holidaysOnDate = activeHolidays.filter(h => 
        dateStr >= h.startDate && dateStr <= h.endDate
      );
      
      if (holidaysOnDate.length > 0) {
        weekHolidays.set(dateStr, holidaysOnDate);
      }
    }
    
    return weekHolidays;
  }, [currentWeekStart, activeHolidays]);

  // Load students when a card is expanded
  useEffect(() => {
    if (expandedCardId) {
      // Extract class ID from cardKey (format: "classId|day")
      const classId = expandedCardId.split('|')[0];
      const expandedClass = allClasses.find(c => c.id === classId);
      if (expandedClass) {
        const studentsInClass = allStudents.filter(s => 
          s.classId === expandedClass.id || 
          s.class === expandedClass.name ||
          s.className === expandedClass.name ||
          (s.classIds && s.classIds.includes(expandedClass.id))
        );
        setClassStudents(studentsInClass);
      }
    } else {
      setClassStudents([]);
    }
  }, [expandedCardId, allStudents, allClasses]);

  // Get unique teachers from staff (only teachers) - using roleUtils for normalization
  const uniqueTeachers = useMemo(() => {
    return staff
      .filter(s => isTeacherRole(s.position || '') || isTeacherRole(s.role || ''))
      .map(s => s.name)
      .sort();
  }, [staff]);

  // Get unique assistants from staff - using roleUtils for normalized matching
  const uniqueAssistants = useMemo(() => {
    return staff
      .filter(s => isAssistantRole(s.position || '') || isAssistantRole(s.role || ''))
      .map(s => s.name)
      .sort();
  }, [staff]);

  // Get rooms from rooms collection (active only)
  const uniqueRooms = useMemo(() => {
    return rooms
      .filter(r => r.status === 'Hoạt động')
      .map(r => r.name)
      .sort();
  }, [rooms]);

  // Filter classes for teachers (onlyOwnClasses) and by teacher/assistant/room filters
  const classes = useMemo(() => {
    let filtered = allClasses;
    
    // Filter by own classes if teacher
    if (onlyOwnClasses && staffData) {
      const myName = staffData.name;
      const myId = staffData.id || staffId;
      filtered = filtered.filter(cls => 
        cls.teacher === myName || 
        cls.teacherId === myId ||
        cls.assistant === myName ||
        cls.assistantId === myId ||
        cls.foreignTeacher === myName ||
        cls.foreignTeacherId === myId
      );
    }
    
    // Filter by teacher
    if (filterTeacher !== 'ALL') {
      filtered = filtered.filter(cls => 
        cls.teacher === filterTeacher || cls.foreignTeacher === filterTeacher
      );
    }
    
    // Filter by assistant
    if (filterAssistant !== 'ALL') {
      filtered = filtered.filter(cls => cls.assistant === filterAssistant);
    }
    
    // Filter by room
    if (filterRoom !== 'ALL') {
      filtered = filtered.filter(cls => cls.room === filterRoom);
    }
    
    // Filter by branch/center
    if (selectedBranch !== ALL_BRANCHES_VALUE) {
      filtered = filtered.filter(cls => cls.branch === selectedBranch);
    }

    // Filter by search term (class name)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(cls =>
        (cls.name || '').toLowerCase().includes(term) ||
        (cls.curriculum || '').toLowerCase().includes(term) ||
        (cls.teacher || '').toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [allClasses, onlyOwnClasses, staffData, staffId, filterTeacher, filterAssistant, filterRoom, selectedBranch, searchTerm]);

  useEffect(() => {
    const fetchCenters = async () => {
      try {
        const data = await getCenters();
        const centers = data
          .filter((c) => c.status === 'Active')
          .map((c) => ({ id: c.id!, name: c.name }));
        setCenterList(centers);
      } catch (err) {
        console.error('Error fetching centers:', err);
      }
    };
    fetchCenters();
  }, []);

  const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];
  const branchColors = ['bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-purple-500', 'bg-pink-500'];
  const branches = centerList.map((c, idx) => ({
    id: c.name,
    name: c.name,
    color: branchColors[idx % branchColors.length],
    textColor: `text-${branchColors[idx % branchColors.length].replace('bg-', '').replace('-500', '')}-700`
  }));
  const branchOptions = [ALL_BRANCHES_OPTION, ...branches];
  const selectedBranchData = branchOptions.find(b => b.id === selectedBranch) || ALL_BRANCHES_OPTION;

  // Format week display (Monday to Sunday)
  const weekDisplay = useMemo(() => {
    const endDate = new Date(currentWeekStart);
    endDate.setDate(endDate.getDate() + 6); // Full week Mon-Sun
    return `${currentWeekStart.toLocaleDateString('vi-VN')} - ${endDate.toLocaleDateString('vi-VN')}`;
  }, [currentWeekStart]);

  // Navigate weeks
  const prevWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeekStart(newDate);
  };

  const nextWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeekStart(newDate);
  };

  // Parse days from schedule string (e.g., "18:00-19:00 Thứ 2, 4" -> [2, 4])
  // Supports: "15:00-16:30 Thứ 3, Thứ 5", "08:00-09:30 Thứ 2, 4, 6", "Chủ nhật"
  // Thứ 7 = 7, Chủ nhật = 8
  const parseDaysFromSchedule = (schedule: string): number[] => {
    if (!schedule) return [];
    
    const days: number[] = [];
    const normalizedSchedule = schedule
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    
    // Handle "Chủ nhật" or "CN" -> 8 (Sunday)
    if (/(^|[^a-z])cn([^a-z]|$)|chu\s*nhat|sunday/.test(normalizedSchedule)) {
      days.push(8);
    }
    
    // Find all "Thứ X" patterns (2-7 for Mon-Sat)
    const thuMatches = schedule.matchAll(/Th[ứử]\s*(\d)/gi);
    for (const match of thuMatches) {
      const dayNum = parseInt(match[1]);
      if (dayNum >= 2 && dayNum <= 7 && !days.includes(dayNum)) {
        days.push(dayNum);
      }
    }
    
    // Also find standalone numbers after comma (e.g., "Thứ 2, 4, 6")
    const afterThu = schedule.match(/Th[ứử]\s*\d[\s,]*([,\s\d]+)/i);
    if (afterThu) {
      const extraDays = afterThu[1].match(/\d/g);
      if (extraDays) {
        for (const d of extraDays) {
          const dayNum = parseInt(d);
          if (dayNum >= 2 && dayNum <= 7 && !days.includes(dayNum)) {
            days.push(dayNum);
          }
        }
      }
    }
    
    return days.sort((a, b) => a - b);
  };

  // Map day name to number (Thứ 7 = 7, Chủ nhật = 8)
  const dayNameToNumber: Record<string, number> = {
    'Thứ 2': 2,
    'Thứ 3': 3,
    'Thứ 4': 4,
    'Thứ 5': 5,
    'Thứ 6': 6,
    'Thứ 7': 7,
    'CN': 8,
  };

  // Time periods
  const timePeriods = [
    { id: 'morning', label: 'Sáng', color: 'bg-amber-100 text-amber-800 border-amber-300', startHour: 6, endHour: 12 },
    { id: 'afternoon', label: 'Chiều', color: 'bg-green-100 text-green-800 border-green-300', startHour: 12, endHour: 17 },
    { id: 'evening', label: 'Tối', color: 'bg-purple-100 text-purple-800 border-purple-300', startHour: 17, endHour: 22 },
  ];

  // Get time period from schedule string
  const getTimePeriod = (schedule: string): string => {
    const timeMatch = schedule.match(/(\d{1,2})[h:](\d{2})/);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1]);
      if (hour >= 6 && hour < 12) return 'morning';
      if (hour >= 12 && hour < 17) return 'afternoon';
      return 'evening';
    }
    return 'evening'; // default
  };

  const dayNumberToName: Record<number, string> = {
    2: 'Thứ 2',
    3: 'Thứ 3',
    4: 'Thứ 4',
    5: 'Thứ 5',
    6: 'Thứ 6',
    7: 'Thứ 7',
    8: 'CN',
  };

  const getDayNumberFromDetail = (dayOfWeek?: string, dayLabel?: string): number | null => {
    const raw = `${dayOfWeek || ''} ${dayLabel || ''}`;
    const normalizedRaw = raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
    if (/(^|[^a-z])cn([^a-z]|$)|chu\s*nhat|sunday/.test(normalizedRaw)) return 8;
    if (/^0$|^8$/.test(normalizedRaw)) return 8;
    const match = raw.match(/[2-7]/);
    return match ? parseInt(match[0], 10) : null;
  };

  const getScheduleEntriesForGrid = (cls: ClassModel): ClassModel[] => {
    if (!cls.scheduleDetails?.length) return [cls];

    return cls.scheduleDetails
      .map((detail) => {
        const dayNumber = getDayNumberFromDetail(detail.dayOfWeek, detail.dayLabel);
        if (!dayNumber) return null;

        const dayName = dayNumberToName[dayNumber] || detail.dayLabel || '';
        const startTime = detail.startTime || detail.teacherStartTime || detail.assistantStartTime || detail.foreignTeacherStartTime || '';
        const endTime = detail.endTime || detail.teacherEndTime || detail.assistantEndTime || detail.foreignTeacherEndTime || '';
        const schedule = startTime && endTime ? `${startTime}-${endTime} ${dayName}` : dayName;

        return {
          ...cls,
          schedule,
          room: detail.room || cls.room,
          teacher: detail.teacher || cls.teacher,
          teacherId: detail.teacherId || cls.teacherId,
          assistant: detail.assistant || cls.assistant,
          assistantId: detail.assistantId || cls.assistantId,
          foreignTeacher: detail.foreignTeacher || cls.foreignTeacher,
          foreignTeacherId: detail.foreignTeacherId || cls.foreignTeacherId,
        } as ClassModel;
      })
      .filter((entry): entry is ClassModel => Boolean(entry));
  };

  // Group studying classes by day AND time period
  const scheduleByDayAndPeriod = useMemo(() => {
    const result: Record<string, Record<string, ClassModel[]>> = {};
    
    timePeriods.forEach(period => {
      result[period.id] = {};
      days.forEach(day => {
        result[period.id][day] = [];
      });
    });

    days.forEach((day) => {
      const dayNumber = dayNameToNumber[day];
      classes.forEach(cls => {
        if (!isStudyingClass(cls)) {
          return;
        }
        getScheduleEntriesForGrid(cls).forEach(scheduleEntry => {
          const scheduleDays = parseDaysFromSchedule(scheduleEntry.schedule || '');
          if (scheduleDays.includes(dayNumber)) {
            const period = getTimePeriod(scheduleEntry.schedule || '');
            result[period][day].push(scheduleEntry);
          }
        });
      });
    });
    
    return result;
  }, [classes, currentWeekStart]);

  const selectedMonthDate = useMemo(() => new Date(currentWeekStart), [currentWeekStart]);

  const getMonthRange = (date: Date) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { start, end };
  };

  const getMonthLabel = (date: Date) => `Tháng ${date.getMonth() + 1}/${date.getFullYear()}`;

  useEffect(() => {
    let isMounted = true;
    const start = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() - 5, 1);
    const end = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() + 1, 0);

    getAttendanceRecords({
      startDate: formatDateLocal(start),
      endDate: formatDateLocal(end),
    })
      .then((records) => {
        if (isMounted) setMonthlyAttendanceRecords(records);
      })
      .catch((error) => {
        console.error('Error loading monthly attendance revenue:', error);
        if (isMounted) setMonthlyAttendanceRecords([]);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedMonthDate]);

  const toMinutes = (time?: string) => {
    if (!time) return null;
    const match = time.match(/(\d{1,2})[:h](\d{2})/i);
    if (!match) return null;
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  };

  const getDurationHours = (start?: string, end?: string, fallbackMinutes?: number) => {
    if (fallbackMinutes && fallbackMinutes > 0) return fallbackMinutes / 60;
    const startMinutes = toMinutes(start);
    const endMinutes = toMinutes(end);
    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return 0;
    return (endMinutes - startMinutes) / 60;
  };

  const getScheduleTimeRange = (schedule?: string) => {
    const match = schedule?.match(/(\d{1,2}[:h]\d{2})\s*-\s*(\d{1,2}[:h]\d{2})/i);
    return match ? { start: match[1], end: match[2] } : { start: undefined, end: undefined };
  };

  const shouldCountClassInEstimates = (cls: ClassModel) => {
    const normalizedStatus = normalizeClassStatusForCompare(cls.status);

    return ![
      'tam dung',
      'paused',
      'inactive',
      'ket thuc',
      'da ket thuc',
      'ended',
      'finished',
      'completed',
    ].includes(normalizedStatus);
  };

  const isClassScheduledInMonthlyEstimate = (cls: ClassModel, date: Date) => {
    if (!shouldCountClassInEstimates(cls)) return false;
    return getHolidayForDate(date, cls.id, cls.branch) === null;
  };

  const normalizeForCompare = (value?: string) =>
    (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .trim();

  const parseMoneyValue = (value: unknown) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value !== 'string') return 0;
    const digits = value.replace(/[^\d]/g, '');
    const parsed = Number(digits);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const getEffectiveTotalSessions = (cls: ClassModel) => {
    const totalSessions = Number(cls.totalSessions) || 0;
    if (totalSessions > 0) return totalSessions;

    const progressTotal = (cls.progress || '').match(/\/\s*(\d+)/);
    return progressTotal ? Number(progressTotal[1]) || 0 : 0;
  };

  const isRevenueStudentStatus = (status?: string) => {
    const normalized = normalizeForCompare(status);
    if (!normalized) return true;
    return ![
      'inactive',
      'nghi hoc',
      'tam dung',
      'bao luu',
      'reserved',
      'trial',
      'hoc thu',
      'ended',
      'ket thuc',
      'da ket thuc',
    ].includes(normalized);
  };

  const getClassStudentCount = (cls: ClassModel) => {
    const studentIds = (cls as ClassModel & { studentIds?: string[] }).studentIds || [];
    if (studentIds.length > 0) return studentIds.length;

    const matchedStudents = allStudents.filter(student => {
      const inClass =
        student.classId === cls.id ||
        student.class === cls.name ||
        student.className === cls.name ||
        student.classIds?.includes(cls.id);
      if (!inClass) return false;
      return isRevenueStudentStatus(student.status);
    });
    return matchedStudents.length || cls.activeStudents || cls.studentsCount || 0;
  };

  const getClassRevenueEstimate = (cls: ClassModel, sessionCount = 1) => {
    const canEstimateRevenue = shouldCountClassInEstimates(cls);
    const studentCount = getClassStudentCount(cls);
    const tuitionFee = parseMoneyValue(cls.tuitionFee);
    const totalSessions = getEffectiveTotalSessions(cls);
    const pricePerSession = tuitionFee;

    return {
      canEstimateRevenue,
      studentCount,
      tuitionFee,
      totalSessions,
      pricePerSession,
      revenuePerSession: canEstimateRevenue ? pricePerSession * studentCount : 0,
      estimatedRevenue: canEstimateRevenue ? pricePerSession * studentCount * sessionCount : 0,
      hasTuitionData: tuitionFee > 0,
    };
  };

  const parseClassCreatedDate = (cls: ClassModel) => {
    const classWithDates = cls as ClassModel & { createdAt?: string; createdDate?: string };
    const rawDate = classWithDates.createdDate || classWithDates.createdAt;
    if (!rawDate) return null;

    const dateOnly = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;
    const normalizedDate = dateOnly.includes('/')
      ? dateOnly.split('/').reverse().join('-')
      : dateOnly;
    const parsedDate = new Date(`${normalizedDate}T00:00:00`);

    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  };

  const isSameMonth = (firstDate: Date, secondDate: Date) =>
    firstDate.getFullYear() === secondDate.getFullYear() && firstDate.getMonth() === secondDate.getMonth();

  const isClassCreatedByMonth = (cls: ClassModel, monthDate: Date) => {
    const createdDate = parseClassCreatedDate(cls);
    if (!createdDate) return true;

    const classCreatedMonth = new Date(createdDate.getFullYear(), createdDate.getMonth(), 1);
    const estimateMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    return estimateMonth >= classCreatedMonth;
  };

  const getClassDayEntries = (cls: ClassModel) => {
    const parseDayNumber = (dayOfWeek?: string, dayLabel?: string) => {
      const raw = `${dayOfWeek || ''} ${dayLabel || ''}`;
      const normalizedRaw = raw
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
      if (/(^|[^a-z])cn([^a-z]|$)|chu\s*nhat|sunday/.test(normalizedRaw)) return 8;
      if (/^0$|^8$/.test(normalizedRaw)) return 8;
      const match = raw.match(/\d/);
      return match ? parseInt(match[0], 10) : NaN;
    };

    if (cls.scheduleDetails?.length) {
      return cls.scheduleDetails.map(detail => ({
        dayNumber: parseDayNumber(detail.dayOfWeek, detail.dayLabel),
        teacherHours: getDurationHours(detail.teacherStartTime || detail.startTime, detail.teacherEndTime || detail.endTime, detail.teacherDuration),
        assistantHours: getDurationHours(detail.assistantStartTime || detail.startTime, detail.assistantEndTime || detail.endTime, detail.assistantDuration),
        foreignTeacherHours: getDurationHours(detail.foreignTeacherStartTime || detail.startTime, detail.foreignTeacherEndTime || detail.endTime, detail.foreignTeacherDuration),
      })).filter(entry => entry.dayNumber >= 2 && entry.dayNumber <= 8);
    }

    const range = getScheduleTimeRange(cls.schedule);
    const defaultHours = getDurationHours(range.start, range.end) || 1.5;
    return parseDaysFromSchedule(cls.schedule || '').map(dayNumber => ({
      dayNumber,
      teacherHours: cls.teacherDuration ? cls.teacherDuration / 60 : defaultHours,
      assistantHours: cls.assistant ? (cls.assistantDuration ? cls.assistantDuration / 60 : defaultHours) : 0,
      foreignTeacherHours: cls.foreignTeacher ? (cls.foreignTeacherDuration ? cls.foreignTeacherDuration / 60 : defaultHours) : 0,
    }));
  };

  const getClassMonthlySessionCount = (cls: ClassModel, monthDate: Date) => {
    if (!shouldCountClassInEstimates(cls) || !isClassCreatedByMonth(cls, monthDate)) return 0;

    const entries = getClassDayEntries(cls);
    if (!entries.length) return 0;

    const { start, end } = getMonthRange(monthDate);
    let sessionCount = 0;

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      if (!isClassScheduledInMonthlyEstimate(cls, date)) continue;
      const dayNumber = date.getDay() === 0 ? 8 : date.getDay() + 1;
      sessionCount += entries.filter(entry => entry.dayNumber === dayNumber).length;
    }

    return sessionCount;
  };

  const getMonthlyEstimate = (monthDate: Date) => {
    const { start, end } = getMonthRange(monthDate);
    const teacherMap = new Map<string, { name: string; hours: number; sessions: number; classes: Set<string>; dates: Set<string> }>();
    const classRevenueMap = new Map<string, { id: string; name: string; studentCount: number; sessionCount: number; revenue: number; pricePerSession: number; tuitionFee: number; totalSessions: number; actualSessions: number; actualStudentCount: number; absentCount: number; actualRevenue: number }>();
    let totalSessions = 0;
    let totalRevenue = 0;
    let totalActualRevenue = 0;

    classes.forEach(cls => {
      if (!isClassCreatedByMonth(cls, monthDate)) return;

      const entries = getClassDayEntries(cls);
      if (!entries.length) return;
      const revenueEstimate = getClassRevenueEstimate(cls);

      for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        if (!isClassScheduledInMonthlyEstimate(cls, date)) continue;
        const dayNumber = date.getDay() === 0 ? 8 : date.getDay() + 1;
        const matchedEntries = entries.filter(entry => entry.dayNumber === dayNumber);
        if (!matchedEntries.length) continue;

        matchedEntries.forEach(entry => {
          totalSessions += 1;
          const expectedRevenue = revenueEstimate.revenuePerSession;

          if (revenueEstimate.canEstimateRevenue && revenueEstimate.hasTuitionData && revenueEstimate.studentCount > 0) {
            const currentRevenue = classRevenueMap.get(cls.id) || {
              id: cls.id,
              name: cls.name,
              studentCount: revenueEstimate.studentCount,
              sessionCount: 0,
              revenue: 0,
              pricePerSession: revenueEstimate.pricePerSession,
              tuitionFee: revenueEstimate.tuitionFee,
              totalSessions: revenueEstimate.totalSessions,
              actualSessions: 0,
              actualStudentCount: 0,
              absentCount: 0,
              actualRevenue: 0,
            };
            currentRevenue.sessionCount += 1;
            currentRevenue.revenue += expectedRevenue;
            classRevenueMap.set(cls.id, currentRevenue);
            totalRevenue += expectedRevenue;
          }

          const addTeacher = (name: string | undefined, hours: number) => {
            if (!name || hours <= 0) return;
            const current = teacherMap.get(name) || { name, hours: 0, sessions: 0, classes: new Set<string>(), dates: new Set<string>() };
            current.hours += hours;
            current.sessions += 1;
            current.classes.add(cls.name);
            current.dates.add(formatDateLocal(date));
            teacherMap.set(name, current);
          };

          addTeacher(cls.teacher, entry.teacherHours);
          addTeacher(cls.assistant, entry.assistantHours);
          addTeacher(cls.foreignTeacher, entry.foreignTeacherHours);
        });
      }
    });

    monthlyAttendanceRecords.forEach(record => {
      if (!record.classId) return;
      if (!record.date || record.date < formatDateLocal(start) || record.date > formatDateLocal(end)) return;
      const matchedClass = classes.find(cls => cls.id === record.classId);
      if (!matchedClass) return;

      const revenueEstimate = getClassRevenueEstimate(matchedClass);
      if (!revenueEstimate.hasTuitionData) return;

      const attendedCount = (Number(record.present) || 0) + (Number(record.tutored) || 0);
      const absentCount = Number(record.absent) || 0;
      const reservedCount = Number(record.reserved) || 0;
      if (attendedCount + absentCount + reservedCount <= 0) return;

      const actualRevenue = attendedCount * revenueEstimate.pricePerSession;
      const current = classRevenueMap.get(matchedClass.id) || {
        id: matchedClass.id,
        name: matchedClass.name,
        studentCount: revenueEstimate.studentCount,
        sessionCount: 0,
        revenue: 0,
        pricePerSession: revenueEstimate.pricePerSession,
        tuitionFee: revenueEstimate.tuitionFee,
        totalSessions: revenueEstimate.totalSessions,
        actualSessions: 0,
        actualStudentCount: 0,
        absentCount: 0,
        actualRevenue: 0,
      };
      current.actualSessions += 1;
      current.actualStudentCount += attendedCount;
      current.absentCount += absentCount;
      current.actualRevenue += actualRevenue;
      classRevenueMap.set(matchedClass.id, current);
      totalActualRevenue += actualRevenue;
      });

    return {
      monthLabel: getMonthLabel(monthDate),
      totalSessions,
      totalRevenue,
      totalActualRevenue,
      teacherStats: Array.from(teacherMap.values())
        .map(item => ({
          ...item,
          classCount: item.classes.size,
          teachingDays: item.dates.size,
          averageHoursPerDay: item.dates.size > 0 ? item.hours / item.dates.size : 0,
        }))
        .sort((a, b) => b.hours - a.hours),
      classRevenueStats: Array.from(classRevenueMap.values()).sort(
        (a, b) => (b.revenue + b.actualRevenue) - (a.revenue + a.actualRevenue)
      ),
    };
  };

  const monthlyStats = useMemo(() => getMonthlyEstimate(selectedMonthDate), [classes, allStudents, monthlyAttendanceRecords, selectedMonthDate, activeHolidays]);

  const revenueGrowthData = useMemo(() => {
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() - 5 + index, 1);
      const estimate = getMonthlyEstimate(date);
      return {
        month: `T${date.getMonth() + 1}`,
        amount: estimate.totalRevenue,
        actual: estimate.totalActualRevenue,
      };
    });
  }, [classes, allStudents, monthlyAttendanceRecords, selectedMonthDate, activeHolidays]);

  const maxRevenue = Math.max(...revenueGrowthData.flatMap(item => [item.amount, item.actual]), 1);

  const handlePrint = () => {
    window.print();
  };

  // Normalize status to Vietnamese
  const normalizeStatus = (status: string): string => {
    if (!status) return '-';
    const lower = status.toLowerCase();
    if (lower === 'active' || lower === 'đang học' || lower === 'đang hoạt động') return 'Đang học';
    if (lower === 'inactive' || lower === 'nghỉ học') return 'Nghỉ học';
    if (lower === 'reserved' || lower === 'bảo lưu') return 'Bảo lưu';
    if (lower === 'trial' || lower === 'học thử') return 'Học thử';
    if (lower === 'debt' || lower === 'nợ phí') return 'Nợ phí';
    if (lower === 'ended' || lower === 'kết thúc') return 'Kết thúc';
    return status;
  };

  // Parse class info for display
  const parseClassDisplay = (cls: ClassModel) => {
    return {
      time: getScheduleTime(cls.schedule) || '17:30 - 19:00',
      days: getScheduleDays(cls.schedule),
      year: cls.ageGroup || '',
      className: cls.name,
      teacher: cls.teacher,
      room: cls.room || '',
      foreignTeacher: cls.foreignTeacher,
      assistant: cls.assistant,
    };
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-120px)] print:h-auto print:block">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 p-4 rounded-xl shadow-lg print:hidden">
        <div className="flex items-center gap-4">
          {/* Branch Selector - Redesigned with color */}
          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${selectedBranchData?.color || 'bg-gray-500'} ring-2 ring-white/50`}></div>
            <MapPin className="text-white/80" size={18} />
            <span className="text-white/90 text-sm font-medium">Cơ sở:</span>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="bg-white text-gray-800 border-0 rounded-md px-3 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer"
            >
              {branches.length === 0 && <option value="">-- Chưa có cơ sở --</option>}
              {branchOptions.map(b => (
                <option key={b.id} value={b.id}>● {b.name}</option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm lớp học..."
              className="bg-white text-gray-800 border-0 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/50 w-48"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Week Navigator */}
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-2 py-1">
            <button onClick={prevWeek} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <ChevronLeft size={20} className="text-white" />
            </button>
            <span className="text-sm font-medium text-white min-w-[180px] text-center">
              {weekDisplay}
            </span>
            <button onClick={nextWeek} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <ChevronRight size={20} className="text-white" />
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Teacher Filter */}
          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-2">
            <User className="text-white/80" size={16} />
            <select
              value={filterTeacher}
              onChange={(e) => setFilterTeacher(e.target.value)}
              className="bg-white text-gray-800 border-0 rounded-md px-2 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer min-w-[120px]"
            >
              <option value="ALL">Tất cả GV</option>
              {uniqueTeachers.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Assistant Filter */}
          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-2">
            <User className="text-white/80" size={16} />
            <select
              value={filterAssistant}
              onChange={(e) => setFilterAssistant(e.target.value)}
              className="bg-white text-gray-800 border-0 rounded-md px-2 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer min-w-[120px]"
            >
              <option value="ALL">Tất cả TG</option>
              {uniqueAssistants.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Room Filter */}
          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-2">
            <Home className="text-white/80" size={16} />
            <select
              value={filterRoom}
              onChange={(e) => setFilterRoom(e.target.value)}
              className="bg-white text-gray-800 border-0 rounded-md px-2 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer min-w-[100px]"
            >
              <option value="ALL">Tất cả phòng</option>
              {uniqueRooms.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Print Button */}
          <button 
            onClick={handlePrint}
          className="flex items-center gap-2 bg-white text-indigo-700 px-4 py-2 rounded-lg hover:bg-indigo-50 text-sm font-bold shadow-md transition-colors"
        >
          <Printer size={16} />
          In TKB
        </button>
        </div>
      </div>

      {/* Schedule Grid */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mt-4 print:mt-0 print:shadow-none print:border-0 print:rounded-none">
        {/* Branch Title with dynamic color */}
        <div className={`${
          selectedBranchData?.color?.replace('-500', '-600') 
            ? `bg-gradient-to-r from-${selectedBranchData.color.replace('bg-', '')} to-${selectedBranchData.color.replace('bg-', '').replace('-500', '-600')}`
            : 'bg-gradient-to-r from-emerald-500 to-emerald-600'
        } text-white text-center py-3 text-xl font-bold flex items-center justify-center gap-3`}>
          <div className="w-4 h-4 rounded-full bg-white/30"></div>
          {selectedBranchData.name}
        </div>

        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full border-collapse print:h-auto min-w-[900px]">
            <thead>
              <tr>
                <th className="p-3 border border-gray-300 bg-gray-200 text-sm font-bold text-gray-700 w-16 print:w-10 print:p-1 print:text-xs">
                  Buổi
                </th>
                {days.map((day, idx) => {
                  // Calculate the date for this day column
                  const dayDate = new Date(currentWeekStart);
                  dayDate.setDate(dayDate.getDate() + idx);
                  const dateStr = formatDateLocal(dayDate);
                  const holidaysOnDay = holidaysThisWeek.get(dateStr) || [];
                  const hasHoliday = holidaysOnDay.length > 0;
                  
                  return (
                    <th 
                      key={day} 
                      className={`p-3 border border-gray-300 text-sm font-bold min-w-[180px] print:min-w-0 print:p-1 print:text-xs ${
                        hasHoliday ? 'bg-red-50' : 'bg-gray-100'
                      } text-gray-700`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span>{day}</span>
                        <span className="text-xs font-normal text-gray-500">
                          {dayDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                        </span>
                        {hasHoliday && (
                          <div className="flex items-center gap-1 text-[10px] text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                            <Umbrella size={10} />
                            <span className="font-medium truncate max-w-[100px]">
                              {holidaysOnDay[0].name}
                            </span>
                          </div>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {timePeriods.map(period => (
                <tr key={period.id}>
                  <td className={`border border-gray-300 p-2 text-center font-bold text-sm ${period.color} writing-mode-vertical print:p-1 print:text-xs`}>
                    <div className="flex items-center justify-center h-full">
                      {period.label}
                    </div>
                  </td>
                  {days.map((day, dayIdx) => {
                    const dayClasses = scheduleByDayAndPeriod[period.id]?.[day] || [];
                    
                    // Calculate date for this cell
                    const cellDate = new Date(currentWeekStart);
                    cellDate.setDate(cellDate.getDate() + dayIdx);
                    const cellDateStr = formatDateLocal(cellDate);
                    const holidaysOnDay = holidaysThisWeek.get(cellDateStr) || [];
                  
                  return (
                    <td key={day} className={`border border-gray-300 p-1 align-top print:p-0.5 print:h-auto ${holidaysOnDay.length > 0 ? 'bg-red-50/50' : ''}`} style={{ verticalAlign: 'top' }}>
                      <div className="space-y-1 print:space-y-0.5">
                        {dayClasses.length > 0 ? (
                          dayClasses.map((cls, classIdx) => {
                            const info = parseClassDisplay(cls);
                            const cardKey = `${cls.id}|${day}|${cls.schedule || ''}|${classIdx}`;
                            const isExpanded = expandedCardId === cardKey;
                            
                            // Check if this class is affected by holiday
                            const classHoliday = getHolidayForDate(cellDate, cls.id, cls.branch);
                            const isOnHoliday = classHoliday !== null;
                            
                            // Get consistent color for this class (uses saved color or fallback to hash)
                            const classColor = getClassColor(cls);
                            const monthlySessionCount = getClassMonthlySessionCount(cls, selectedMonthDate);
                            const revenueEstimate = getClassRevenueEstimate(cls, monthlySessionCount);
                            
                            return (
                              <div 
                                key={cardKey}
                                onClick={() => setExpandedCardId(isExpanded ? null : cardKey)}
                                style={{ zIndex: isExpanded ? 20 : classIdx + 1 }}
                                className={`group relative rounded-lg text-xs cursor-pointer transition-all duration-300 ease-out border-l-[3px] print:rounded-none print:border-0 print:shadow-none print:bg-transparent ${
                                  classIdx > 0 ? '-mt-1.5 ml-1' : ''
                                } ${
                                  isOnHoliday
                                    ? 'bg-red-50 border border-red-200 border-l-red-400 opacity-60'
                                    : isExpanded 
                                      ? `bg-gradient-to-br ${classColor.gradient} shadow-xl ${classColor.ring} ring-1 border ${classColor.border} print:ring-0` 
                                      : `${classColor.bg} border border-slate-200/60 ${classColor.border} hover:shadow-lg hover:shadow-slate-200/40 hover:-translate-y-0.5 hover:ring-2 ${classColor.ring}`
                                }`}
                              >
                                {/* Holiday Badge */}
                                {isOnHoliday && (
                                  <div className="bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-t-lg flex items-center gap-1 justify-center">
                                    <Umbrella size={10} />
                                    NGHỈ
                                  </div>
                                )}
                                
                                {/* Compact Header */}
                                <div className={`p-2.5 print:p-0.5 print:block ${isExpanded ? 'pb-0' : ''}`}>
                                  <div className="flex items-start gap-2">
                                    <div className={`w-1.5 self-stretch rounded-full transition-colors ${
                                      isOnHoliday ? 'bg-red-400' : classColor.accent
                                    }`} />
                                    <div className="flex-1 min-w-0">
                                      <p className={`font-bold truncate print:text-[8px] print:font-medium leading-tight ${
                                        isOnHoliday ? 'text-red-700 line-through' : classColor.text
                                      }`}>
                                        {info.className}
                                      </p>
                                      <p className="text-slate-500 text-[10px] print:text-[7px] mt-0.5 flex items-center gap-1.5">
                                        <Clock size={9} className="opacity-60" />
                                        <span>{info.time}</span>
                                        {info.room && (
                                          <>
                                            <span className="text-slate-300">•</span>
                                            <MapPin size={9} className="opacity-60" />
                                            <span>{info.room}</span>
                                          </>
                                        )}
                                      </p>
                                      {revenueEstimate.hasTuitionData && revenueEstimate.canEstimateRevenue && (
                                        <p className="text-emerald-700 text-[10px] print:hidden mt-1 flex items-center gap-1.5 font-semibold">
                                          <DollarSign size={9} className="opacity-70" />
                                          <span>{formatCurrency(revenueEstimate.estimatedRevenue)}</span>
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Expanded Details */}
                                {isExpanded && (
                                  <div 
                                    className="px-2.5 pb-2.5 pt-2 space-y-2.5 print:hidden cursor-pointer group/detail" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDetailModalClass(cls);
                                    }}
                                  >
                                    {/* Curriculum Badge */}
                                    {cls.curriculum && (
                                      <div className="inline-flex items-center gap-1.5 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-md">
                                        <BookOpen size={10} className="opacity-70" />
                                        <span className="font-medium">{cls.curriculum}</span>
                                      </div>
                                    )}
                                    
                                    {/* Teachers - Elegant Pills */}
                                    <div className="flex flex-wrap gap-1.5">
                                      {info.teacher && (
                                        <div className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-full pl-1 pr-2 py-0.5">
                                          <span className="w-4 h-4 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-full flex items-center justify-center text-[8px] font-bold shadow-sm">
                                            {info.teacher.charAt(0)}
                                          </span>
                                          <span className="text-[9px] text-blue-800 font-medium truncate max-w-[60px]">{info.teacher}</span>
                                        </div>
                                      )}
                                      {info.foreignTeacher && (
                                        <div className="inline-flex items-center gap-1.5 bg-violet-50 border border-violet-100 rounded-full pl-1 pr-2 py-0.5">
                                          <span className="w-4 h-4 bg-gradient-to-br from-violet-500 to-violet-600 text-white rounded-full flex items-center justify-center text-[8px] font-bold shadow-sm">
                                            {info.foreignTeacher.charAt(0)}
                                          </span>
                                          <span className="text-[9px] text-violet-800 font-medium truncate max-w-[60px]">{info.foreignTeacher}</span>
                                        </div>
                                      )}
                                      {info.assistant && (
                                        <div className="inline-flex items-center gap-1.5 bg-teal-50 border border-teal-100 rounded-full pl-1 pr-2 py-0.5">
                                          <span className="w-4 h-4 bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-full flex items-center justify-center text-[8px] font-bold shadow-sm">
                                            {info.assistant.charAt(0)}
                                          </span>
                                          <span className="text-[9px] text-teal-800 font-medium truncate max-w-[60px]">{info.assistant}</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Students Section */}
                                    <div className="bg-slate-50/80 rounded-lg p-2 border border-slate-100">
                                      <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">Học viên</span>
                                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold">{classStudents.length}</span>
                                      </div>
                                      {classStudents.length > 0 && (
                                        <div className="space-y-1">
                                          {classStudents.map((student, idx) => (
                                            <div key={student.id} className="flex items-center gap-1.5 text-[10px] py-0.5 group-hover/detail:bg-white/50 rounded px-1 -mx-1 transition-colors">
                                              <span className="w-4 h-4 bg-slate-200 text-slate-600 rounded flex items-center justify-center text-[8px] font-medium">
                                                {idx + 1}
                                              </span>
                                              <span className="flex-1 truncate text-slate-700">{student.fullName || student.name}</span>
                                              <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${
                                                normalizeStatus(student.status) === 'Đang học' ? 'bg-emerald-100 text-emerald-700' :
                                                normalizeStatus(student.status) === 'Học thử' ? 'bg-sky-100 text-sky-700' :
                                                normalizeStatus(student.status) === 'Nợ phí' ? 'bg-rose-100 text-rose-700' :
                                                'bg-slate-100 text-slate-500'
                                              }`}>
                                                {normalizeStatus(student.status)}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    {/* Revenue Estimate */}
                                    <div className="bg-emerald-50/80 rounded-lg p-2 border border-emerald-100">
                                      <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide">Ước doanh thu</span>
                                        <DollarSign size={12} className="text-emerald-600" />
                                      </div>
                                      {!revenueEstimate.canEstimateRevenue ? (
                                        <p className="text-[10px] text-emerald-700/70">
                                          Lớp tạm dừng không tính tiền dự trù.
                                        </p>
                                      ) : revenueEstimate.hasTuitionData ? (
                                        <div className="space-y-1 text-[10px] text-emerald-800">
                                          <div className="flex items-center justify-between gap-2">
                                            <span>Tổng tháng</span>
                                            <span className="font-bold">{formatCurrency(revenueEstimate.estimatedRevenue)}</span>
                                          </div>
                                        </div>
                                      ) : (
                                        <p className="text-[10px] text-emerald-700/70">
                                          Cần có học phí để tính doanh thu.
                                        </p>
                                      )}
                                    </div>

                                    {/* Color Picker - Elegant Inline Design */}
                                    <div 
                                      className="relative"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        onClick={() => setShowColorPicker(showColorPicker === cls.id ? null : cls.id)}
                                        className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border transition-all duration-200 ${
                                          showColorPicker === cls.id 
                                            ? 'bg-white border-slate-300 shadow-sm' 
                                            : 'bg-slate-50/50 border-slate-100 hover:bg-white hover:border-slate-200'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <Palette size={12} className="text-slate-400" />
                                          <span className="text-[10px] text-slate-500">Màu hiển thị</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <div className={`w-4 h-4 rounded-full ${classColor.accent} ring-1 ring-white shadow-sm`} />
                                          {savingColorId === cls.id && (
                                            <div className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                                          )}
                                        </div>
                                      </button>
                                      
                                      {/* Color Picker Dropdown */}
                                      {showColorPicker === cls.id && (
                                        <div className="absolute bottom-full left-0 right-0 mb-1 p-2 bg-white rounded-xl shadow-xl border border-slate-200 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                          <div className="flex items-center justify-between mb-2">
                                            <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Chọn màu</span>
                                            <button
                                              onClick={() => handleColorChange(cls.id, undefined)}
                                              className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                                                cls.color === undefined || cls.color === null
                                                  ? 'bg-slate-200 text-slate-700 font-medium'
                                                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                              }`}
                                            >
                                              <RotateCcw size={9} />
                                              Tự động
                                            </button>
                                          </div>
                                          <div className="grid grid-cols-8 gap-1">
                                            {CLASS_COLOR_PALETTE.map((color, idx) => {
                                              const isSelected = cls.color === idx;
                                              const isAutoSelected = (cls.color === undefined || cls.color === null) && hashClassName(cls.name || '') === idx;
                                              return (
                                                <button
                                                  key={idx}
                                                  onClick={() => handleColorChange(cls.id, idx)}
                                                  className={`group relative w-5 h-5 rounded-md transition-all duration-150 ${color.accent} ${
                                                    isSelected 
                                                      ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' 
                                                      : isAutoSelected
                                                        ? 'ring-1 ring-offset-1 ring-dashed ring-slate-300'
                                                        : 'hover:scale-110 hover:ring-2 hover:ring-offset-1 hover:ring-slate-200'
                                                  }`}
                                                >
                                                  {isSelected && (
                                                    <Check size={10} className="absolute inset-0 m-auto text-white drop-shadow-sm" />
                                                  )}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div className="h-full flex items-center justify-center text-gray-300 text-xs py-4">
                            -
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Teaching and Revenue Stats */}
      <div className="mt-4 grid grid-cols-1 xl:grid-cols-3 gap-4 print:hidden">
        <div className="xl:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-slate-50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-indigo-600" />
              <h3 className="font-bold text-slate-800">Thống kê giờ dạy giáo viên</h3>
            </div>
            <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded-md">
              {monthlyStats.monthLabel}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Giáo viên</th>
                  <th className="px-4 py-3 text-right">Giờ dạy</th>
                  <th className="px-4 py-3 text-right">TB/ngày</th>
                  <th className="px-4 py-3 text-right">Số buổi</th>
                  <th className="px-4 py-3 text-right">Số lớp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monthlyStats.teacherStats.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      Chưa có dữ liệu giờ dạy trong tháng này
                    </td>
                  </tr>
                ) : monthlyStats.teacherStats.slice(0, 12).map((item) => (
                  <tr key={item.name} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          {item.name.charAt(0)}
                        </span>
                        <span className="font-semibold text-slate-800">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-700">
                      {item.hours.toFixed(1)}h
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{item.averageHoursPerDay.toFixed(1)}h</td>
                    <td className="px-4 py-3 text-right text-slate-700">{item.sessions}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{item.classCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={18} className="text-blue-600" />
                <span className="text-xs font-semibold uppercase text-slate-500">Tổng buổi</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{monthlyStats.totalSessions}</p>
              <p className="text-xs text-slate-400 mt-1">Tạm tính theo lịch tháng</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={18} className="text-emerald-600" />
                <span className="text-xs font-semibold uppercase text-slate-500">Tổng tiền</span>
              </div>
              <p className="text-xl font-bold text-emerald-700 break-words">{formatCurrency(monthlyStats.totalRevenue)}</p>
              <p className="text-xs text-slate-400 mt-1">Theo thời khóa biểu tháng</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={18} className="text-teal-600" />
                <span className="text-xs font-semibold uppercase text-slate-500">Thực thu</span>
              </div>
              <p className="text-xl font-bold text-teal-700 break-words">{formatCurrency(monthlyStats.totalActualRevenue)}</p>
              <p className="text-xs text-slate-400 mt-1">Theo điểm danh đã lưu</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-slate-50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <DollarSign size={18} className="text-emerald-600" />
                <h3 className="font-bold text-slate-800">Doanh thu ước tính theo lớp</h3>
              </div>
              <span className="text-xs font-semibold text-slate-500">{monthlyStats.classRevenueStats.length} lớp</span>
            </div>
            <div className="max-h-72 overflow-auto">
              <table className="w-full min-w-[1040px] text-xs">
                <thead className="sticky top-0 z-10 bg-white uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Lớp</th>
                    <th className="px-3 py-2.5 text-right">Buổi TKB</th>
                    <th className="px-3 py-2.5 text-right">Học phí/buổi</th>
                    <th className="px-3 py-2.5 text-right">Học viên</th>
                    <th className="px-3 py-2.5 text-right">Doanh thu dự kiến</th>
                    <th className="px-3 py-2.5 text-right">Buổi đã điểm danh</th>
                    <th className="px-3 py-2.5 text-right">Lượt thực học</th>
                    <th className="px-3 py-2.5 text-right">Thực thu</th>
                    <th className="px-3 py-2.5 text-right">Số buổi nghỉ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {monthlyStats.classRevenueStats.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-6 text-center text-sm text-slate-400">
                        Chưa có lớp có học phí trong tháng này
                      </td>
                    </tr>
                  ) : monthlyStats.classRevenueStats.slice(0, 10).map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-3 py-3 font-semibold text-slate-800">{item.name}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{item.sessionCount}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{formatCurrency(item.pricePerSession)}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{item.studentCount}</td>
                      <td className="px-3 py-3 text-right font-bold text-emerald-700">{formatCurrency(item.revenue)}</td>
                      <td className="px-3 py-3 text-right text-teal-700">{item.actualSessions}</td>
                      <td className="px-3 py-3 text-right text-teal-700">{item.actualStudentCount}</td>
                      <td className="px-3 py-3 text-right font-bold text-teal-700">{formatCurrency(item.actualRevenue)}</td>
                      <td className="px-3 py-3 text-right text-rose-600">{item.absentCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-slate-50 flex items-center gap-2">
              <TrendingUp size={18} className="text-emerald-600" />
              <h3 className="font-bold text-slate-800">Dự kiến và thực thu theo tháng</h3>
            </div>
            <div className="p-4">
              <div className="h-48 flex items-end gap-2">
                {revenueGrowthData.map((item) => (
                  <div key={item.month} className="flex-1 h-full flex flex-col justify-end items-center gap-2 min-w-0">
                    <div className="w-full flex items-end justify-center gap-1 h-36">
                      <div
                        className="w-full max-w-5 rounded-t-md bg-gradient-to-t from-emerald-500 to-teal-400"
                        style={{ height: `${Math.max(6, (item.amount / maxRevenue) * 100)}%` }}
                        title={`${item.month} dự kiến theo thời khóa biểu: ${formatCurrency(item.amount)}`}
                      />
                      <div
                        className="w-full max-w-5 rounded-t-md bg-gradient-to-t from-sky-500 to-blue-400"
                        style={{ height: `${Math.max(6, (item.actual / maxRevenue) * 100)}%` }}
                        title={`${item.month} thực thu: ${formatCurrency(item.actual)}`}
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-600">{item.month}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500" /> Dự kiến</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-sky-500" /> Thực thu</span>
                <span className="inline-flex items-center gap-1.5"><BarChart3 size={14} /> 6 tháng gần nhất</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Footer */}
      <div className="hidden print:block text-center text-xs text-gray-400 mt-8">
        <p>Hệ thống quản lý đào tạo EduManager Pro</p>
        <p>Ngày in: {new Date().toLocaleDateString('vi-VN')}</p>
      </div>

      {/* Class Detail Modal */}
      {detailModalClass && (
        <ClassDetailModal 
          classData={detailModalClass} 
          allStudents={allStudents}
          onClose={() => setDetailModalClass(null)} 
        />
      )}
    </div>
  );
};

// ============================================
// CLASS DETAIL MODAL FOR SCHEDULE
// ============================================
interface ClassDetailModalProps {
  classData: ClassModel;
  allStudents: Student[];
  onClose: () => void;
}

const ClassDetailModal: React.FC<ClassDetailModalProps> = ({ classData, allStudents, onClose }) => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter students in this class
  const studentsInClass = useMemo(() => {
    return allStudents.filter(s => 
      s.classId === classData.id || 
      s.class === classData.name ||
      s.className === classData.name ||
      (s.classIds && s.classIds.includes(classData.id))
    );
  }, [allStudents, classData]);

  // Fetch sessions
  useEffect(() => {
    const fetchSessions = async () => {
      setLoading(true);
      try {
        const data = await getSessionsByClass(classData.id);
        setSessions(data);
      } catch (err) {
        console.error('Error fetching sessions:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, [classData.id]);

  const completedSessions = sessions.filter(s => s.status === 'Đã học').length;
  const getTodayLocalDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const formatDateOnlyForDisplay = (value?: string, options?: Intl.DateTimeFormatOptions) => {
    if (!value) return '';
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    if (!year || !month || !day) return '';
    return new Date(year, month - 1, day).toLocaleDateString('vi-VN', options);
  };
  const upcomingSessions = sessions
    .filter(s => s.status === 'Chưa học' && s.date >= getTodayLocalDate())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  // Normalize status
  const normalizeStatus = (status: string): string => {
    if (!status) return '-';
    const lower = status.toLowerCase();
    if (lower === 'active' || lower === 'đang học' || lower === 'đang hoạt động') return 'Đang học';
    if (lower === 'inactive' || lower === 'nghỉ học') return 'Nghỉ học';
    if (lower === 'reserved' || lower === 'bảo lưu') return 'Bảo lưu';
    if (lower === 'trial' || lower === 'học thử') return 'Học thử';
    if (lower === 'debt' || lower === 'nợ phí') return 'Nợ phí';
    if (lower === 'ended' || lower === 'kết thúc') return 'Kết thúc';
    return status;
  };

  const getStatusColor = (status: string) => {
    const normalized = normalizeStatus(status);
    switch (normalized) {
      case 'Đang học': return 'bg-green-100 text-green-700';
      case 'Kết thúc': return 'bg-gray-100 text-gray-700';
      case 'Bảo lưu': return 'bg-yellow-100 text-yellow-700';
      case 'Học thử': return 'bg-blue-100 text-blue-700';
      case 'Nợ phí': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <ModalPortal>
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Clean & Modern */}
        <div className="relative px-6 py-5 border-b border-slate-100">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">{classData.name}</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(classData.status)}`}>
                  {normalizeStatus(classData.status)}
                </span>
                {classData.ageGroup && (
                  <span className="text-slate-500 text-sm flex items-center gap-1">
                    <Users size={14} className="opacity-60" />
                    {classData.ageGroup}
                  </span>
                )}
                {classData.branch && (
                  <span className="text-slate-500 text-sm flex items-center gap-1">
                    <MapPin size={14} className="opacity-60" />
                    {classData.branch}
                  </span>
                )}
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Teachers Row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="group p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl border border-blue-100 hover:shadow-md transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                  <User className="text-white" size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-blue-600/70 font-semibold">Giáo viên VN</p>
                  <p className="font-semibold text-slate-800 truncate">{classData.teacher || 'Chưa phân công'}</p>
                </div>
              </div>
            </div>
            <div className="group p-4 bg-gradient-to-br from-violet-50 to-violet-100/50 rounded-xl border border-violet-100 hover:shadow-md transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-200">
                  <GraduationCap className="text-white" size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-violet-600/70 font-semibold">Giáo viên NN</p>
                  <p className="font-semibold text-slate-800 truncate">{classData.foreignTeacher || 'Không có'}</p>
                </div>
              </div>
            </div>
            <div className="group p-4 bg-gradient-to-br from-teal-50 to-teal-100/50 rounded-xl border border-teal-100 hover:shadow-md transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-teal-200">
                  <User className="text-white" size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-teal-600/70 font-semibold">Trợ giảng</p>
                  <p className="font-semibold text-slate-800 truncate">{classData.assistant || 'Không có'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Schedule Info Row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2 mb-1">
                <Clock size={14} className="text-slate-400" />
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Lịch học</span>
              </div>
              <p className="font-medium text-slate-800">{formatSchedule(classData.schedule) || 'Chưa có'}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2 mb-1">
                <Home size={14} className="text-slate-400" />
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Phòng học</span>
              </div>
              <p className="font-medium text-slate-800">{classData.room || 'Chưa xếp'}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2 mb-1">
                <BookOpen size={14} className="text-slate-400" />
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Giáo trình</span>
              </div>
              <p className="font-medium text-slate-800">{classData.curriculum || 'Chưa có'}</p>
            </div>
          </div>

          {/* Time Period */}
          <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-200">
                <Calendar className="text-white" size={18} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-amber-600/70 font-semibold">Thời gian khóa học</p>
                <p className="font-semibold text-slate-800">
                  {formatDateOnlyForDisplay(classData.startDate) || 'Chưa có'} 
                  <span className="mx-2 text-amber-400">→</span>
                  {formatDateOnlyForDisplay(classData.endDate) || 'Chưa có'}
                </p>
              </div>
            </div>
          </div>

          {/* Session Progress */}
          <div className="p-4 bg-gradient-to-br from-indigo-50 to-slate-50 rounded-xl border border-indigo-100">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-200">
                <CheckCircle className="text-white" size={16} />
              </div>
              <h3 className="font-bold text-slate-800">Tiến độ buổi học</h3>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 text-indigo-600">
                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Đang tải...</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1 bg-slate-200 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-indigo-500 to-violet-500 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: sessions.length ? `${(completedSessions / sessions.length) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="text-sm font-bold text-indigo-700 bg-indigo-100 px-2 py-1 rounded-lg">
                    {completedSessions}/{sessions.length}
                  </span>
                </div>
                
                {upcomingSessions.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Buổi học sắp tới</p>
                    <div className="grid grid-cols-5 gap-2">
                      {upcomingSessions.map((session, idx) => (
                        <div key={session.id} className="text-center p-2 bg-white rounded-lg border border-slate-100 hover:border-indigo-200 transition-colors">
                          <p className="text-xs font-bold text-indigo-600">
                            {formatDateOnlyForDisplay(session.date, { weekday: 'short' })}
                          </p>
                          <p className="text-sm font-semibold text-slate-800">
                            {formatDateOnlyForDisplay(session.date, { day: '2-digit', month: '2-digit' })}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Students List */}
          <div className="p-4 bg-gradient-to-br from-emerald-50 to-slate-50 rounded-xl border border-emerald-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-md shadow-emerald-200">
                  <Users className="text-white" size={16} />
                </div>
                <h3 className="font-bold text-slate-800">Danh sách học viên</h3>
              </div>
              <span className="text-sm bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-bold">
                {studentsInClass.length}
              </span>
            </div>
            
            {studentsInClass.length > 0 ? (
              <div className="max-h-[180px] overflow-y-auto space-y-2 pr-2">
                {studentsInClass.map((student, idx) => (
                  <div 
                    key={student.id}
                    className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-slate-100 hover:border-emerald-200 hover:shadow-sm transition-all"
                  >
                    <span className="w-7 h-7 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-lg flex items-center justify-center text-xs font-bold shadow-sm">
                      {idx + 1}
                    </span>
                    <span className="flex-1 text-sm font-medium text-slate-700">{student.fullName || student.name}</span>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${getStatusColor(student.status)}`}>
                      {normalizeStatus(student.status)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-400">Chưa có học viên trong lớp</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-4 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-700 text-sm font-semibold transition-colors shadow-lg shadow-slate-300"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};
