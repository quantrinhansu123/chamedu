import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit, writeBatch, runTransaction, arrayUnion, Timestamp, db } from '@/src/utils/legacyFirestoreStub';
/**
 * Dashboard Page
 * Warm Education Design - Teal & Coral Theme
 * Aesthetic: Professional, Warm, Memorable
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getCenters } from '../src/services/centerService';
import {
  Users,
  BookOpen,
  TrendingUp,
  DollarSign,
  AlertCircle,
  X,
  Phone,
  Mail,
  MapPin,
  Sparkles,
  CalendarDays,
  Wallet,
  PieChart as PieChartIcon,
  BarChart3,
  Cake,
  Activity,
  CalendarCheck,
  AlertTriangle,
  CheckSquare,
  Clock,
  FileText,
  GraduationCap
} from 'lucide-react';
import { 
  Area,
  BarChart, 
  Bar, 
  ComposedChart,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Line
} from 'recharts';
import { formatCurrency } from '../src/utils/currencyUtils';
import { getRevenueSummary, type RevenueGrowthPoint } from '../src/services/revenueService';
import { calculateMonthlyScheduleRevenue, calculateScheduleRevenueGrowth } from '../src/services/scheduleRevenueService';
import { StudentService } from '../src/services/studentService';
import { ClassService } from '../src/services/classService';
import { useSalaryReport } from '../src/hooks/useSalaryReport';
import { usePermissions } from '../src/hooks/usePermissions';
import { useAuth } from '../src/hooks/useAuth';
import { ModalPortal } from '@/components/modal-portal';
import { StudentStatus } from '../types';

// Warm Education Color Palette - Teal & Coral Theme
const COLORS = {
  noPhi: '#0D9488',      // Teal - Nợ phí (primary)
  hocThu: '#F59E0B',     // Amber - Học thử
  baoLuu: '#6366F1',     // Indigo - Bảo lưu
  nghiHoc: '#EF4444',    // Red - Nghỉ học
  hvMoi: '#10B981',      // Emerald - HV mới
  hocPhi: '#FF6B5A',     // Coral - Học phí (accent)
};

const PIE_COLORS = ['#0D9488', '#FF6B5A', '#F59E0B', '#10B981', '#6366F1'];

type RevenueGrowthPeriod = 'daily' | 'monthly' | 'yearly';
type StudentStatsPeriod = 'daily' | 'monthly' | 'yearly';
type StudentMetricKey = 'trialStudents' | 'totalStudents' | 'droppedStudents';

const STUDENT_STAT_METRICS: Array<{ key: StudentMetricKey; label: string; color: string; category?: string }> = [
  { key: 'trialStudents', label: 'Học thử', color: COLORS.hocThu, category: StudentStatus.TRIAL },
  { key: 'totalStudents', label: 'Số học sinh', color: COLORS.hvMoi },
  { key: 'droppedStudents', label: 'Nghỉ học', color: COLORS.nghiHoc, category: StudentStatus.DROPPED },
];

interface StudentTrendPoint {
  key: string;
  label: string;
  trialStudents: number;
  totalStudents: number;
  droppedStudents: number;
}

// Gradient definitions for cards - Warm Education Theme
const GRADIENTS = {
  primary: 'from-teal-500 via-teal-600 to-emerald-600',
  secondary: 'from-emerald-400 to-teal-500',
  warm: 'from-[#FF6B5A] to-[#FF8F7A]',
  cool: 'from-slate-600 to-slate-800',
  accent: 'from-amber-400 to-orange-500',
};

interface StudentData {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  className?: string;
  currentClassName?: string;
  status?: string;
  hasDebt?: boolean;
  createdAt?: string;
  updatedAt?: string;
  enrollmentDate?: string;
  startDate?: string;
  dropoutDate?: string;
  parentPhone?: string;
}

interface DashboardStats {
  totalStudents: number;
  totalClasses: number;
  avgPerClass: number;
  studentsByStatus: { name: string; value: number; color: string }[];
  revenueData: { month: string; expected: number; actual: number }[];
  debtStats: { noPhi: number; noHocPhi: number };
  totalRevenue: number;
  expectedScheduleRevenue: number;
  scheduleSessionCount: number;
  totalContractRevenue: number;
  totalDebt: number;
  totalBadDebt: number; // Nợ xấu (học sinh nghỉ học còn nợ)
  badDebtStudents: number; // Số học sinh nợ xấu
  salaryForecast: { position: string; amount: number }[];
  salaryPercent: number;
  businessHealth: { metric: string; value: number; status: string }[];
  lowStockProducts: { name: string; quantity: number }[];
  upcomingBirthdays: { name: string; position: string; date: string; dayOfMonth: number; branch?: string }[];
  studentBirthdays: { id: string; name: string; position: string; date: string; dayOfMonth: number; branch?: string }[];
  classStats: { name: string; count: number }[];
  revenueByClass: { name: string; value: number }[]; // Doanh thu theo lớp
  // Phase 3: New widgets data
  myWorkDays: number; // Số ngày công tháng này
  studentsExpiringSoon: { id: string; fullName: string; className: string; remainingSessions: number; expectedEndDate?: string; contractStartDate?: string }[]; // DS sắp hết phí
  studentsWithDebt: { id: string; fullName: string; className: string; status: string }[]; // DS nợ phí
  // Phase 4: GV Dashboard data
  myClasses: { id: string; name: string; studentCount: number; scheduleDay: string; scheduleTime: string }[];
  myStudentIds: string[];
  myTotalStudents: number;
  myAvgPerClass: number;
  upcomingClasses: { id: string; className: string; date: string; time: string; room: string }[];
  btvnNeedingReport: { id: string; className: string; lastClassDate: string }[];
  topAbsentStudents: { id: string; name: string; absences: number }[];
  topLowHomework: { id: string; name: string; completionRate: number }[];
  myStudentBirthdays: { id: string; name: string; date: string; dayOfMonth: number }[];
  myConfirmedSalary: number;
  myPendingSalary: number;
  myConfirmedSessions: number;
  myTotalSessions: number;
}

const parseDashboardDate = (value?: string | Date | { toDate?: () => Date } | null): Date | null => {
  if (!value) return null;
  const date = typeof value === 'object' && 'toDate' in value && value.toDate ? value.toDate() : new Date(value as string | Date);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const endOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const addMonths = (date: Date, months: number) => new Date(date.getFullYear(), date.getMonth() + months, 1);

const getStudentStartedDate = (student: StudentData): Date | null =>
  parseDashboardDate(student.enrollmentDate || student.startDate || student.createdAt);

const getStudentDroppedDate = (student: StudentData): Date | null =>
  parseDashboardDate(student.dropoutDate || student.updatedAt || student.createdAt);

const buildStudentTrendData = (students: StudentData[], period: StudentStatsPeriod): StudentTrendPoint[] => {
  const now = new Date();
  const buckets: Array<{ key: string; label: string; start: Date; end: Date }> = [];

  if (period === 'daily') {
    const firstDay = addDays(startOfDay(now), -29);
    for (let index = 0; index < 30; index += 1) {
      const day = addDays(firstDay, index);
      buckets.push({
        key: day.toISOString().slice(0, 10),
        label: `${String(day.getDate()).padStart(2, '0')}/${String(day.getMonth() + 1).padStart(2, '0')}`,
        start: startOfDay(day),
        end: endOfDay(day),
      });
    }
  } else if (period === 'monthly') {
    const firstMonth = addMonths(new Date(now.getFullYear(), now.getMonth(), 1), -11);
    for (let index = 0; index < 12; index += 1) {
      const month = addMonths(firstMonth, index);
      buckets.push({
        key: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`,
        label: `T${month.getMonth() + 1}/${month.getFullYear()}`,
        start: month,
        end: new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999),
      });
    }
  } else {
    const firstYear = now.getFullYear() - 4;
    for (let year = firstYear; year <= now.getFullYear(); year += 1) {
      buckets.push({
        key: String(year),
        label: String(year),
        start: new Date(year, 0, 1),
        end: new Date(year, 11, 31, 23, 59, 59, 999),
      });
    }
  }

  return buckets.map((bucket) => {
    let trialStudents = 0;
    let totalStudents = 0;
    let droppedStudents = 0;

    students.forEach((student) => {
      const startedDate = getStudentStartedDate(student);
      const droppedDate = student.status === StudentStatus.DROPPED ? getStudentDroppedDate(student) : null;

      if (student.status === StudentStatus.TRIAL && startedDate && startedDate >= bucket.start && startedDate <= bucket.end) {
        trialStudents += 1;
      }

      if (student.status === StudentStatus.DROPPED && droppedDate && droppedDate >= bucket.start && droppedDate <= bucket.end) {
        droppedStudents += 1;
      }

      if (
        student.status === StudentStatus.ACTIVE &&
        startedDate &&
        startedDate >= bucket.start &&
        startedDate <= bucket.end
      ) {
        totalStudents += 1;
      }
    });

    return {
      key: bucket.key,
      label: bucket.label,
      trialStudents,
      totalStudents,
      droppedStudents,
    };
  });
};

export const Dashboard: React.FC = () => {
  // Permission check for revenue and salary visibility
  const { canSeeRevenue, canSeeAllSalaries, isTeacher, staffId } = usePermissions();
  const { user } = useAuth();

  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalClasses: 0,
    avgPerClass: 0,
    studentsByStatus: [],
    revenueData: [],
    debtStats: { noPhi: 0, noHocPhi: 0 },
    totalRevenue: 0,
    expectedScheduleRevenue: 0,
    scheduleSessionCount: 0,
    totalContractRevenue: 0,
    totalDebt: 0,
    totalBadDebt: 0,
    badDebtStudents: 0,
    salaryForecast: [],
    salaryPercent: 0,
    businessHealth: [],
    lowStockProducts: [],
    upcomingBirthdays: [],
    studentBirthdays: [],
    classStats: [],
    revenueByClass: [],
    // Phase 3: New widgets
    myWorkDays: 0,
    studentsExpiringSoon: [],
    studentsWithDebt: [],
    // Phase 4: GV Dashboard
    myClasses: [],
    myStudentIds: [],
    myTotalStudents: 0,
    myAvgPerClass: 0,
    upcomingClasses: [],
    btvnNeedingReport: [],
    topAbsentStudents: [],
    topLowHomework: [],
    myStudentBirthdays: [],
    myConfirmedSalary: 0,
    myPendingSalary: 0,
    myConfirmedSessions: 0,
    myTotalSessions: 0,
  });

  // Phase 3: Checklist state
  const [checklistItems, setChecklistItems] = useState<{ id: string; task: string; count: number; done: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth] = useState('Tháng hiện tại');
  
  // State cho bảng thống kê
  const [statsMonth, setStatsMonth] = useState(new Date().getMonth() + 1);
  const [statsYear, setStatsYear] = useState(new Date().getFullYear());
  const [statsCategory, setStatsCategory] = useState<'salary' | 'students' | 'revenue'>('students'); // Default to students for safety
  const [statsSortOrder, setStatsSortOrder] = useState('asc'); // asc = thấp đến cao
  const [statsLimit, setStatsLimit] = useState(5);
  const [studentStatsPeriod, setStudentStatsPeriod] = useState<StudentStatsPeriod>('monthly');
  const [visibleStudentMetrics, setVisibleStudentMetrics] = useState<Record<StudentMetricKey, boolean>>({
    trialStudents: true,
    totalStudents: true,
    droppedStudents: true,
  });

  // Fallback logic: reset category if user loses permission
  useEffect(() => {
    if (statsCategory === 'salary' && !canSeeAllSalaries) {
      setStatsCategory('students');
    }
    if (statsCategory === 'revenue' && !canSeeRevenue) {
      setStatsCategory('students');
    }
  }, [canSeeAllSalaries, canSeeRevenue, statsCategory]);

  // Fetch salary report data
  const { summaries: salaryReportData } = useSalaryReport(statsMonth, statsYear);
  
  // State cho bộ lọc cơ sở (branch filter)
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [centerList, setCenterList] = useState<{ id: string; name: string }[]>([]);
  
  useEffect(() => {
    const fetchCenters = async () => {
      try {
        const data = await getCenters();
        setCenterList(
          data
            .filter((c) => c.status === 'Active')
            .map((c) => ({ id: c.id!, name: c.name }))
        );
      } catch (err) {
        console.error('Error fetching centers:', err);
      }
    };
    fetchCenters();
  }, []);

  // State cho modal danh sách học viên
  const [allStudents, setAllStudents] = useState<StudentData[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const studentTrendData = useMemo(
    () => buildStudentTrendData(allStudents, studentStatsPeriod),
    [allStudents, studentStatsPeriod]
  );
  const activeStudentMetrics = useMemo(
    () => STUDENT_STAT_METRICS.filter((metric) => visibleStudentMetrics[metric.key]),
    [visibleStudentMetrics]
  );
  
  // State cho doanh số bán hàng từ báo cáo tài chính
  const [revenuePieData, setRevenuePieData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [revenueGrowthPeriod, setRevenueGrowthPeriod] = useState<RevenueGrowthPeriod>('monthly');
  const [revenueGrowthSeries, setRevenueGrowthSeries] = useState<Record<RevenueGrowthPeriod, RevenueGrowthPoint[]>>({
    daily: [],
    monthly: [],
    yearly: [],
  });
  const revenueGrowthChartData = useMemo(
    () => revenueGrowthSeries[revenueGrowthPeriod].slice(-12),
    [revenueGrowthPeriod, revenueGrowthSeries]
  );
  const visibleRevenueGrowth = useMemo(
    () => revenueGrowthSeries[revenueGrowthPeriod].slice(-12).reverse(),
    [revenueGrowthPeriod, revenueGrowthSeries]
  );
  useEffect(() => {
    fetchDashboardData();
  }, [selectedBranch]); // Re-fetch when branch filter changes

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch students
      const allStudentsData = (await StudentService.getStudents()).map((student: any) => ({
        ...student,
        className: student.className || student.class,
        currentClassName: student.currentClassName || student.class,
        hasDebt: student.hasDebt || student.status === 'Nợ phí',
      })) as StudentData[];
      setAllStudents(allStudentsData);

      // Fetch classes
      const allClasses = await ClassService.getClasses();

      // Fetch contracts for revenue
      const contractsSnap = await getDocs(collection(null as any /* firebase removed */, 'contracts'));
      const allContracts = contractsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, any>));

      // Apply branch filter
      const filterByBranch = (items: any[], branchFields = ['branch', 'center', 'centerName']) => {
        if (selectedBranch === 'all') return items;

        // "unassigned" = show items WITHOUT any branch field
        if (selectedBranch === 'unassigned') {
          return items.filter(item => {
            for (const field of branchFields) {
              if (item[field] && item[field].trim() !== '') return false; // Has a branch, exclude
            }
            return true; // No branch field set
          });
        }

        // Filter by specific branch
        return items.filter(item => {
          for (const field of branchFields) {
            if (item[field] && item[field] === selectedBranch) return true;
          }
          return false;
        });
      };

      // Filter data by selected branch
      const students = filterByBranch(allStudentsData);
      const classes = filterByBranch(allClasses);

      // Filter contracts by student branch (via studentId lookup)
      const studentIds = new Set(students.map(s => s.id));
      const contracts = selectedBranch === 'all'
        ? allContracts
        : allContracts.filter(c => studentIds.has(c.studentId));

      // Calculate stats
      const totalStudents = students.length;
      const totalClasses = classes.length;
      const avgPerClass = totalClasses > 0 ? (totalStudents / totalClasses).toFixed(1) : 0;
      
      // Students by status - fetch real data (dùng giá trị Vietnamese từ enum)
      const statusCounts = {
        'Nợ phí': students.filter(s => s.hasDebt || s.status === 'Nợ phí').length,
        'Học thử': students.filter(s => s.status === 'Học thử').length,
        'Bảo lưu': students.filter(s => s.status === 'Bảo lưu').length,
        'Nghỉ học': students.filter(s => s.status === 'Nghỉ học').length,
        'HV mới': students.filter(s => {
          if (!s.createdAt) return false;
          const created = new Date(s.createdAt);
          const now = new Date();
          return (now.getTime() - created.getTime()) < 30 * 24 * 60 * 60 * 1000;
        }).length,
      };
      
      const studentsByStatus = [
        { name: 'Nợ phí', value: statusCounts['Nợ phí'], color: COLORS.noPhi },
        { name: 'Học thử', value: statusCounts['Học thử'], color: COLORS.hocThu },
        { name: 'Bảo lưu', value: statusCounts['Bảo lưu'], color: COLORS.baoLuu },
        { name: 'Nghỉ học', value: statusCounts['Nghỉ học'], color: COLORS.nghiHoc },
        { name: 'HV mới', value: statusCounts['HV mới'], color: COLORS.hvMoi },
      ];
      
      // Revenue calculation
      const paidContracts = contracts.filter(c => c.status === 'Paid' || c.status === 'Đã thanh toán');
      const debtContracts = contracts.filter(c => c.status === 'Debt' || c.status === 'Nợ phí');
      
      let totalRevenue = 0;
      let totalContractRevenue = paidContracts.reduce((sum, c) => sum + (c.finalTotal || c.totalAmount || 0), 0);
      let totalDebt = debtContracts.reduce((sum, c) => sum + (c.finalTotal || c.totalAmount || 0), 0);
      let revenueData: { month: string; expected: number; actual: number }[] = [];
      let revenueByClass: { name: string; value: number }[] = [];
      let expectedScheduleRevenue = 0;
      let scheduleSessionCount = 0;
      
      // Calculate bad debt from students who dropped out with debt
      const badDebtStudentsList = students.filter((s: any) => s.badDebt === true);
      const totalBadDebt = badDebtStudentsList.reduce((sum: number, s: any) => sum + (s.badDebtAmount || 0), 0);
      const badDebtStudents = badDebtStudentsList.length;
      
      // Fetch financial report data for pie chart
      try {
        const financialSummary = await getRevenueSummary(
          new Date().getFullYear(),
          selectedBranch,
          new Date().getMonth() + 1
        );

        totalContractRevenue = financialSummary.paidRevenue;
        totalRevenue = financialSummary.totalAttendanceRevenue;
        totalDebt = financialSummary.debtAmount;
        revenueData = financialSummary.byCategory.map((item) => ({
          month: item.category,
          expected: 0,
          actual: item.amount,
        }));
        revenueByClass = financialSummary.byCategory.map((item) => ({
          name: item.category,
          value: item.amount,
        }));

        if (financialSummary.byCategory.length > 0) {
          setRevenuePieData(financialSummary.byCategory.map((item: any) => ({
            name: item.category,
            value: item.amount,
            color: item.color,
          })));
        } else {
          // No data - show empty
          setRevenuePieData([]);
        }
        setRevenueGrowthSeries({ daily: [], monthly: [], yearly: [] });
      } catch (err) {
        console.error('Error fetching financial data:', err);
        setRevenuePieData([]);
        setRevenueGrowthSeries({ daily: [], monthly: [], yearly: [] });
      }
      
      // Products are now loaded via useProducts() hook with realtime updates
      // No need to fetch here - see allProducts from useProducts()
      
      // Fetch staff for birthday and salary - real data from Firebase
      const staffSnap = await getDocs(collection(null as any /* firebase removed */, 'staff'));
      const staffListRaw = staffSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Also get staff from staffSalaries if staff collection is empty
      let allStaffRaw = staffListRaw;
      if (staffListRaw.length === 0) {
        const staffSalariesSnap = await getDocs(collection(null as any /* firebase removed */, 'staffSalaries'));
        const uniqueStaff = new Map();
        staffSalariesSnap.docs.forEach(d => {
          const data = d.data();
          if (!uniqueStaff.has(data.staffId)) {
            uniqueStaff.set(data.staffId, {
              id: data.staffId,
              name: data.staffName,
              position: data.position,
              birthDate: data.birthDate || data.dob,
              branch: data.branch || data.center || '',
            });
          }
        });
        allStaffRaw = Array.from(uniqueStaff.values());
      }

      // Apply branch filter to staff
      const allStaff = filterByBranch(allStaffRaw);
      
      const now = new Date();
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();
      
      // Get all birthdays in current month (for filter to work)
      // Check multiple possible field names
      const upcomingBirthdays = allStaff
        .filter((s: any) => {
          const bdayStr = s['sinh nhật'] || s['ngày sinh'] || s.birthDate || s.dob || s.dateOfBirth;
          if (!bdayStr) return false;
          const bday = bdayStr.toDate ? bdayStr.toDate() : new Date(bdayStr);
          if (isNaN(bday.getTime())) return false;
          // Include all birthdays in current month
          return bday.getMonth() === thisMonth;
        })
        .map((s: any) => {
          const bdayStr = s['sinh nhật'] || s['ngày sinh'] || s.birthDate || s.dob || s.dateOfBirth;
          const bday = bdayStr.toDate ? bdayStr.toDate() : new Date(bdayStr);
          return {
            name: s.name || s.staffName,
            position: s.position || 'Nhân viên',
            date: `${String(bday.getDate()).padStart(2, '0')}/${String(bday.getMonth() + 1).padStart(2, '0')}/${bday.getFullYear()}`,
            dayOfMonth: bday.getDate(),
            branch: s.branch || s.center || '',
          };
        })
        .sort((a: any, b: any) => a.dayOfMonth - b.dayOfMonth);
      
      console.log('Staff list:', allStaff.length, 'Birthdays this month:', upcomingBirthdays.length);
      
      // Student birthdays - similar logic
      const studentBirthdays = students
        .filter((s: any) => {
          const bdayStr = s['sinh nhật'] || s['ngày sinh'] || s.birthDate || s.dob || s.dateOfBirth;
          if (!bdayStr) return false;
          const bday = bdayStr.toDate ? bdayStr.toDate() : new Date(bdayStr);
          if (isNaN(bday.getTime())) return false;
          return bday.getMonth() === thisMonth;
        })
        .map((s: any) => {
          const bdayStr = s['sinh nhật'] || s['ngày sinh'] || s.birthDate || s.dob || s.dateOfBirth;
          const bday = bdayStr.toDate ? bdayStr.toDate() : new Date(bdayStr);
          return {
            id: s.id,
            name: s.name || s.fullName,
            position: 'Học viên',
            date: `${String(bday.getDate()).padStart(2, '0')}/${String(bday.getMonth() + 1).padStart(2, '0')}/${bday.getFullYear()}`,
            dayOfMonth: bday.getDate(),
            branch: s.branch || '',
          };
        })
        .sort((a: any, b: any) => a.dayOfMonth - b.dayOfMonth);
      
      console.log('Student birthdays this month:', studentBirthdays.length);
      
      // Class stats - count students per class (using studentIds or counting from students collection)
      const classStats = classes.map((c: any) => {
        // Count students in this class from actual student data
        // Match by: classId, classIds array, class name (legacy), or currentClassName
        const studentCount = students.filter((s: any) =>
          s.classId === c.id ||
          s.classIds?.includes(c.id) ||
          s.class === c.name ||
          s.currentClassName === c.name
        ).length;
        return {
          name: c.name || 'Không tên',
          count: studentCount || c.currentStudents || c.studentIds?.length || 0,
        };
      }).filter(c => c.count > 0); // Only show classes with students

      const scheduleEstimate = calculateMonthlyScheduleRevenue({
        classes,
        students,
        monthDate: now,
      });
      expectedScheduleRevenue = scheduleEstimate.totalEstimatedRevenue;
      scheduleSessionCount = scheduleEstimate.totalSessions;
      setRevenueGrowthSeries(
        calculateScheduleRevenueGrowth({
          classes,
          students,
          monthDate: now,
        })
      );

      // Fetch work sessions for real salary calculation
      const workSessionsSnap = await getDocs(collection(null as any /* firebase removed */, 'workSessions'));
      const workSessionsRaw = workSessionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Keep workSessions alias for GV dashboard (needs all sessions, not filtered by branch)
      const workSessions = workSessionsRaw;

      // Filter work sessions by branch for salary calculations (via classId or direct branch field)
      const classIds = new Set(classes.map((c: any) => c.id));
      const filteredWorkSessions = selectedBranch === 'all'
        ? workSessionsRaw
        : workSessionsRaw.filter((ws: any) =>
            (ws.branch && ws.branch === selectedBranch) ||
            (ws.center && ws.center === selectedBranch) ||
            (ws.classId && classIds.has(ws.classId))
          );
      const confirmedSessions = filteredWorkSessions.filter((ws: any) => ws.status === 'Đã xác nhận');
      
      // Calculate salary by position from confirmed work sessions
      const salaryByPosition: { [key: string]: number } = {
        'Giáo viên Việt': 0,
        'Giáo viên Nước ngoài': 0,
        'Trợ giảng': 0,
      };
      
      // Salary rates per session
      const salaryRates: { [key: string]: number } = {
        'Giáo viên Việt': 200000,
        'Giáo viên Nước ngoài': 400000,
        'Trợ giảng': 100000,
      };
      
      confirmedSessions.forEach((ws: any) => {
        const pos = ws.position || 'Trợ giảng';
        const rate = salaryRates[pos] || 100000;
        if (pos.includes('Việt') || pos === 'Giáo viên') {
          salaryByPosition['Giáo viên Việt'] += rate;
        } else if (pos.includes('Nước ngoài') || pos.includes('NN')) {
          salaryByPosition['Giáo viên Nước ngoài'] += rate;
        } else {
          salaryByPosition['Trợ giảng'] += rate;
        }
      });
      
      const tongLuong = Object.values(salaryByPosition).reduce((a, b) => a + b, 0);
      
      const salaryForecast = [
        { position: 'Lương giáo viên Việt', amount: salaryByPosition['Giáo viên Việt'] },
        { position: 'Lương giáo viên NN', amount: salaryByPosition['Giáo viên Nước ngoài'] },
        { position: 'Lương trợ giảng', amount: salaryByPosition['Trợ giảng'] },
        { position: 'Tổng', amount: tongLuong },
      ];
      const salaryPercent = totalRevenue > 0 ? Math.round((tongLuong / totalRevenue) * 100 * 100) / 100 : 0;

      // ========================================
      // Phase 3: New widgets data calculation
      // ========================================

      // Widget 1: Số ngày công của tháng (current user)
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const currentUserId = user?.staffData?.id || user?.uid || '';

      const myWorkDays = workSessions.filter((ws: any) => {
        const wsDate = ws.date ? new Date(ws.date) : null;
        if (!wsDate) return false;
        return (
          ws.staffId === currentUserId &&
          ws.status === 'Đã xác nhận' &&
          wsDate.getMonth() === currentMonth &&
          wsDate.getFullYear() === currentYear
        );
      }).length;

      // Build student -> latest contract map (reusing contracts from earlier fetch)
      const studentLatestContract: Record<string, { startDate: string; category: string }> = {};
      contracts.forEach((c: any) => {
        if (!c.studentId || c.status === 'Đã hủy') return;
        let contractStartDate = c.createdAt || '';
        if (c.items && c.items.length > 0) {
          const itemDates = c.items
            .filter((item: any) => item.startDate)
            .map((item: any) => item.startDate);
          if (itemDates.length > 0) {
            contractStartDate = itemDates.sort().pop() || contractStartDate;
          }
        }
        const existing = studentLatestContract[c.studentId];
        if (!existing || contractStartDate > existing.startDate) {
          studentLatestContract[c.studentId] = {
            startDate: contractStartDate,
            category: c.category || 'Hợp đồng mới',
          };
        }
      });

      // Widget 2: DS Học Sinh sắp hết phí (remainingSessions <= 5)
      const EXPIRY_THRESHOLD = 5;

      // Helper to get class days from schedule
      const getClassDaysOfWeek = (classData: any): number[] => {
        const days: number[] = [];
        if (classData?.scheduleDetails && classData.scheduleDetails.length > 0) {
          classData.scheduleDetails.forEach((detail: any) => {
            const dayNum = parseInt(detail.dayOfWeek);
            if (!isNaN(dayNum)) {
              days.push(dayNum === 7 ? 6 : dayNum - 1);
            } else if (detail.dayOfWeek === 'CN') {
              days.push(0);
            }
          });
          return days;
        }
        if (classData?.schedule) {
          const dayMap: Record<string, number> = { '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6 };
          const matches = classData.schedule.match(/\d/g);
          if (matches) {
            matches.forEach((d: string) => {
              if (dayMap[d] !== undefined) days.push(dayMap[d]);
            });
          }
        }
        return days.length > 0 ? days : [1, 3];
      };

      // Helper to calculate expected end date
      const calculateExpectedEndDate = (remainingSessions: number, classId?: string): string => {
        if (!remainingSessions || remainingSessions <= 0) return '-';
        const studentClass = classId ? classes.find((c: any) => c.id === classId) : null;
        const classDays = getClassDaysOfWeek(studentClass);
        let sessionsCount = 0;
        const endDate = new Date();
        let dayCount = 0;
        while (sessionsCount < remainingSessions && dayCount < 365) {
          endDate.setDate(endDate.getDate() + 1);
          dayCount++;
          if (classDays.includes(endDate.getDay())) sessionsCount++;
        }
        return `${String(endDate.getDate()).padStart(2, '0')}/${String(endDate.getMonth() + 1).padStart(2, '0')}/${endDate.getFullYear()}`;
      };

      // Helper to format date
      const formatContractDate = (dateStr: string | undefined): string => {
        if (!dateStr) return '-';
        try {
          const date = new Date(dateStr);
          if (isNaN(date.getTime())) return '-';
          return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
        } catch { return '-'; }
      };

      const studentsExpiringSoon = students
        .filter((s: any) =>
          s.status === 'Đang học' &&
          s.remainingSessions !== undefined &&
          s.remainingSessions <= EXPIRY_THRESHOLD &&
          s.remainingSessions > 0
        )
        .map((s: any) => {
          const latestContract = studentLatestContract[s.id];
          return {
            id: s.id,
            fullName: s.fullName || s.name || '',
            className: s.currentClassName || s.className || s.class || '-',
            remainingSessions: s.remainingSessions,
            expectedEndDate: calculateExpectedEndDate(s.remainingSessions, s.classId || s.classIds?.[0]),
            contractStartDate: formatContractDate(latestContract?.startDate || s.enrollmentDate || s.startDate),
          };
        })
        .sort((a: any, b: any) => a.remainingSessions - b.remainingSessions);

      // Widget 3: DS Học Sinh Nợ Phí
      const studentsWithDebt = students
        .filter((s: any) =>
          s.hasDebt === true || s.status === 'Nợ phí' ||
          (s.remainingSessions !== undefined && s.remainingSessions < 0)
        )
        .map((s: any) => ({
          id: s.id,
          fullName: s.fullName || s.name || '',
          className: s.currentClassName || s.className || s.class || '-',
          status: s.status || 'Nợ phí',
        }));

      // ========================================
      // Phase 4: GV Dashboard Data
      // ========================================

      // Get classes where current user is the teacher
      const myClasses = classes
        .filter((c: any) => c.teacherId === staffId || c.assistantId === staffId)
        .map((c: any) => ({
          id: c.id,
          name: c.name || '',
          studentCount: c.currentStudents || c.studentIds?.length || 0,
          scheduleDay: c.scheduleDay || c.schedule?.day || '',
          scheduleTime: c.scheduleTime || c.schedule?.time || '',
        }));

      // Get all student IDs from my classes
      const myStudentIds: string[] = [];
      classes
        .filter((c: any) => c.teacherId === staffId || c.assistantId === staffId)
        .forEach((c: any) => {
          if (c.studentIds) {
            myStudentIds.push(...c.studentIds);
          }
        });
      const uniqueMyStudentIds = [...new Set(myStudentIds)];

      // My stats
      const myTotalStudents = uniqueMyStudentIds.length;
      const myAvgPerClass = myClasses.length > 0
        ? Math.round(myTotalStudents / myClasses.length * 10) / 10
        : 0;

      // Upcoming classes (today/this week)
      const todayStr = now.toISOString().split('T')[0];
      const dayOfWeek = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][now.getDay()];

      // Fetch schedule for upcoming classes
      let upcomingClasses: { id: string; className: string; date: string; time: string; room: string }[] = [];
      try {
        const scheduleSnap = await getDocs(collection(null as any /* firebase removed */, 'schedule'));
        const scheduleData = scheduleSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        upcomingClasses = scheduleData
          .filter((s: any) => {
            const classInfo = classes.find((c: any) => c.id === s.classId);
            if (!classInfo) return false;
            const isMyClass = classInfo.teacherId === staffId || classInfo.assistantId === staffId;
            if (!isMyClass) return false;

            // Check if schedule is today or this week
            const scheduleDate = s.date ? new Date(s.date) : null;
            if (scheduleDate) {
              const diffDays = Math.ceil((scheduleDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              return diffDays >= 0 && diffDays <= 7;
            }
            // Or check by day of week
            return s.dayOfWeek === dayOfWeek || s.day === dayOfWeek;
          })
          .slice(0, 5)
          .map((s: any) => {
            const classInfo = classes.find((c: any) => c.id === s.classId);
            return {
              id: s.id,
              className: classInfo?.name || s.className || '',
              date: s.date || s.dayOfWeek || s.day || '',
              time: s.startTime || s.time || '',
              room: s.room || s.roomName || '',
            };
          });
      } catch (err) {
        console.log('No schedule data for GV dashboard');
      }

      // If no schedule entries, use class schedule info
      if (upcomingClasses.length === 0) {
        upcomingClasses = myClasses
          .filter(c => c.scheduleDay === dayOfWeek || c.scheduleDay.includes(dayOfWeek))
          .slice(0, 5)
          .map(c => ({
            id: c.id,
            className: c.name,
            date: dayOfWeek,
            time: c.scheduleTime,
            room: '',
          }));
      }

      // BTVN needing report - classes that had class recently but no homework report
      let btvnNeedingReport: { id: string; className: string; lastClassDate: string }[] = [];
      try {
        const homeworkSnap = await getDocs(collection(null as any /* firebase removed */, 'homework'));
        const homeworkData = homeworkSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Find classes needing report (simplified logic)
        btvnNeedingReport = myClasses
          .filter(c => {
            // Check if there's a homework report for this class in the last 3 days
            const recentHomework = homeworkData.find((hw: any) => {
              if (hw.classId !== c.id) return false;
              const hwDate = hw.createdAt?.toDate?.() || new Date(hw.createdAt);
              const diffDays = Math.ceil((now.getTime() - hwDate.getTime()) / (1000 * 60 * 60 * 24));
              return diffDays <= 3;
            });
            return !recentHomework;
          })
          .slice(0, 5)
          .map(c => ({
            id: c.id,
            className: c.name,
            lastClassDate: 'Cần báo cáo',
          }));
      } catch (err) {
        console.log('No homework data');
      }

      // Top 5 frequently absent students (from my classes only)
      let topAbsentStudents: { id: string; name: string; absences: number }[] = [];
      try {
        const attendanceSnap = await getDocs(collection(null as any /* firebase removed */, 'studentAttendance'));
        const attendanceData = attendanceSnap.docs.map(d => d.data());

        const absenceCounts: { [studentId: string]: number } = {};
        attendanceData
          .filter((a: any) =>
            uniqueMyStudentIds.includes(a.studentId) &&
            (a.status === 'Vắng' || a.status === 'Absent')
          )
          .forEach((a: any) => {
            absenceCounts[a.studentId] = (absenceCounts[a.studentId] || 0) + 1;
          });

        topAbsentStudents = Object.entries(absenceCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([studentId, count]) => {
            const student = students.find((s: any) => s.id === studentId) as StudentData | undefined;
            return {
              id: studentId,
              name: student?.fullName || 'Unknown',
              absences: count,
            };
          });
      } catch (err) {
        console.log('No attendance data for alerts');
      }

      // Top 5 students with lowest homework completion (placeholder - simplified)
      const topLowHomework: { id: string; name: string; completionRate: number }[] = [];

      // My class student birthdays
      const myStudentBirthdays = students
        .filter((s: any) => {
          if (!uniqueMyStudentIds.includes(s.id)) return false;
          const bdayStr = s['sinh nhật'] || s['ngày sinh'] || s.birthDate || s.dob || s.dateOfBirth;
          if (!bdayStr) return false;
          const bday = bdayStr.toDate ? bdayStr.toDate() : new Date(bdayStr);
          if (isNaN(bday.getTime())) return false;
          return bday.getMonth() === thisMonth;
        })
        .map((s: any) => {
          const bdayStr = s['sinh nhật'] || s['ngày sinh'] || s.birthDate || s.dob || s.dateOfBirth;
          const bday = bdayStr.toDate ? bdayStr.toDate() : new Date(bdayStr);
          return {
            id: s.id,
            name: s.fullName || s.name || '',
            date: `${String(bday.getDate()).padStart(2, '0')}/${String(bday.getMonth() + 1).padStart(2, '0')}`,
            dayOfMonth: bday.getDate(),
          };
        })
        .sort((a: any, b: any) => a.dayOfMonth - b.dayOfMonth);

      // My salary calculation
      const myWorkSessionsThisMonth = workSessions.filter((ws: any) => {
        const wsDate = ws.date ? new Date(ws.date) : null;
        if (!wsDate) return false;
        return (
          ws.staffId === staffId &&
          wsDate.getMonth() === currentMonth &&
          wsDate.getFullYear() === currentYear
        );
      });

      const myConfirmedSessionsData = myWorkSessionsThisMonth.filter((ws: any) => ws.status === 'Đã xác nhận');
      const myPendingSessionsData = myWorkSessionsThisMonth.filter((ws: any) => ws.status === 'Chờ xác nhận');

      // Get salary rate based on position (simplified)
      const myStaff = allStaff.find((s: any) => s.id === staffId) as { id: string; position?: string } | undefined;
      const myPosition = myStaff?.position || 'Trợ giảng';
      const myRate = salaryRates[myPosition] || salaryRates['Trợ giảng'] || 100000;

      const myConfirmedSalary = myConfirmedSessionsData.length * myRate;
      const myPendingSalary = myPendingSessionsData.length * myRate;
      const myConfirmedSessions = myConfirmedSessionsData.length;
      const myTotalSessions = myWorkSessionsThisMonth.length;

      // ========================================

      // Chỉ số sức khỏe doanh nghiệp - tính từ dữ liệu thực
      const activeStudents = students.filter((s: any) => s.status === 'Đang học').length;
      const debtStudents = students.filter((s: any) => s.hasDebt || s.status === 'Nợ phí').length;
      const droppedStudents = statusCounts['Nghỉ học'];
      
      const tiLeTaiTuc = totalStudents > 0 ? Math.round((activeStudents / totalStudents) * 100) : 0;
      const tiLeNoPhi = totalStudents > 0 ? Math.round((debtStudents / totalStudents) * 100) : 0;
      const tiLeNghiHoc = totalStudents > 0 ? Math.round((droppedStudents / totalStudents) * 100) : 0;
      
      // Tính điểm hài lòng từ feedback
      let diemHaiLong = 0;
      try {
        const feedbackSnap = await getDocs(collection(null as any /* firebase removed */, 'feedbacks'));
        if (feedbackSnap.size > 0) {
          const totalRating = feedbackSnap.docs.reduce((sum, doc) => sum + (doc.data().rating || 0), 0);
          diemHaiLong = Math.round((totalRating / feedbackSnap.size) * 20); // rating 1-5 -> 20-100%
        }
      } catch (err) {
        console.log('No feedback data');
      }
      
      const tiSuatLoiNhuan = totalRevenue > 0 ? Math.round(((totalRevenue - tongLuong) / totalRevenue) * 100) : 0;
      
      // Đánh giá nghịch: <10% Tốt, <20% Khá, <30% Trung Bình, <50% Yếu, >=50% Rất yếu
      const getStatusInverse = (value: number, hasData: boolean = true) => {
        if (!hasData) return 'Chưa có dữ liệu';
        if (value < 10) return 'Tốt';
        if (value < 20) return 'Khá';
        if (value < 30) return 'Trung Bình';
        if (value < 50) return 'Yếu';
        return 'Rất yếu';
      };
      
      // Đánh giá thuận: >80% Tốt, >60% Khá, >40% TB, >20% Yếu
      const getStatusNormal = (value: number, hasData: boolean = true) => {
        if (!hasData) return 'Chưa có dữ liệu';
        if (value >= 80) return 'Tốt';
        if (value >= 60) return 'Khá';
        if (value >= 40) return 'Trung Bình';
        if (value >= 20) return 'Yếu';
        return 'Rất yếu';
      };
      
      const hasStudentData = totalStudents > 0;
      const hasFeedbackData = diemHaiLong > 0;
      const hasRevenueData = totalRevenue > 0;
      
      const businessHealth = [
        { metric: 'Tỉ lệ tái tục', value: tiLeTaiTuc, status: getStatusNormal(tiLeTaiTuc, hasStudentData) },
        { metric: 'Tỉ lệ nợ phí', value: tiLeNoPhi, status: getStatusInverse(tiLeNoPhi, hasStudentData) },
        { metric: 'Tỉ lệ nghỉ học', value: tiLeNghiHoc, status: getStatusInverse(tiLeNghiHoc, hasStudentData) },
        { metric: 'Điểm số hài lòng', value: diemHaiLong, status: getStatusNormal(diemHaiLong, hasFeedbackData) },
        { metric: 'Tỉ suất lợi nhuận', value: tiSuatLoiNhuan, status: getStatusNormal(tiSuatLoiNhuan, hasRevenueData) },
      ];
      
      setStats({
        totalStudents,
        totalClasses,
        avgPerClass: Number(avgPerClass),
        studentsByStatus,
        revenueData,
        debtStats: {
          noPhi: Math.round(totalDebt * 0.6),
          noHocPhi: Math.round(totalDebt * 0.4)
        },
        totalRevenue,
        expectedScheduleRevenue,
        scheduleSessionCount,
        totalContractRevenue,
        totalDebt,
        totalBadDebt,
        badDebtStudents,
        salaryForecast,
        salaryPercent,
        businessHealth,
        lowStockProducts: [], // Now using useProducts() hook with realtime
        upcomingBirthdays,
        studentBirthdays,
        classStats,
        revenueByClass,
        // Phase 3: New widgets
        myWorkDays,
        studentsExpiringSoon,
        studentsWithDebt,
        // Phase 4: GV Dashboard
        myClasses,
        myStudentIds: uniqueMyStudentIds,
        myTotalStudents,
        myAvgPerClass,
        upcomingClasses,
        btvnNeedingReport,
        topAbsentStudents,
        topLowHomework,
        myStudentBirthdays,
        myConfirmedSalary,
        myPendingSalary,
        myConfirmedSessions,
        myTotalSessions,
      });

      // Phase 3: Widget 4 - Auto-generated checklist
      const birthdaysToday = studentBirthdays.filter((b: any) => {
        const [day, month] = b.date.split('/').map(Number);
        return day === now.getDate() && month === now.getMonth() + 1;
      }).length;

      setChecklistItems([
        { id: '1', task: 'Nhắc HS sắp hết phí', count: studentsExpiringSoon.length, done: false },
        { id: '2', task: 'Nhắc HS nợ phí', count: studentsWithDebt.length, done: false },
        { id: '3', task: 'Chúc mừng sinh nhật HS', count: birthdaysToday, done: false },
        { id: '4', task: 'Xác nhận công GV', count: workSessions.filter((ws: any) => ws.status === 'Chờ xác nhận').length, done: false },
      ]);
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Show empty data on error - no mock data
      setStats({
        totalStudents: 0,
        totalClasses: 0,
        avgPerClass: 0,
        studentsByStatus: [
          { name: 'Nợ phí', value: 0, color: COLORS.noPhi },
          { name: 'Học thử', value: 0, color: COLORS.hocThu },
          { name: 'Bảo lưu', value: 0, color: COLORS.baoLuu },
          { name: 'Nghỉ học', value: 0, color: COLORS.nghiHoc },
          { name: 'HV mới', value: 0, color: COLORS.hvMoi },
        ],
        revenueData: [],
        debtStats: { noPhi: 0, noHocPhi: 0 },
        totalRevenue: 0,
        expectedScheduleRevenue: 0,
        scheduleSessionCount: 0,
        totalContractRevenue: 0,
        totalDebt: 0,
        totalBadDebt: 0,
        badDebtStudents: 0,
        salaryForecast: [],
        salaryPercent: 0,
        businessHealth: [],
        lowStockProducts: [],
        upcomingBirthdays: [],
        studentBirthdays: [],
        classStats: [],
        revenueByClass: [],
        // Phase 3: New widgets
        myWorkDays: 0,
        studentsExpiringSoon: [],
        studentsWithDebt: [],
        // Phase 4: GV Dashboard
        myClasses: [],
        myStudentIds: [],
        myTotalStudents: 0,
        myAvgPerClass: 0,
        upcomingClasses: [],
        btvnNeedingReport: [],
        topAbsentStudents: [],
        topLowHomework: [],
        myStudentBirthdays: [],
        myConfirmedSalary: 0,
        myPendingSalary: 0,
        myConfirmedSessions: 0,
        myTotalSessions: 0,
      });
      setRevenuePieData([]);
      setChecklistItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Pie chart: Doanh số vs Nợ phí
  const revenueDebtPieData = [
    { name: 'Dự kiến (TKB)', value: stats.expectedScheduleRevenue, color: '#3B82F6' },
    { name: 'Nợ phí', value: stats.totalDebt, color: '#F59E0B' },
  ];

  // Lọc học viên theo category
  const getStudentsByCategory = (category: string): StudentData[] => {
    const now = new Date();
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    
    switch (category) {
      case 'Nợ phí':
        return allStudents.filter(s => s.hasDebt || s.status === 'Nợ phí');
      case 'Học thử':
        return allStudents.filter(s => s.status === 'Học thử');
      case 'Bảo lưu':
        return allStudents.filter(s => s.status === 'Bảo lưu');
      case 'Nghỉ học':
        return allStudents.filter(s => s.status === 'Nghỉ học');
      case 'HV mới':
        return allStudents.filter(s => {
          if (!s.createdAt) return false;
          const created = new Date(s.createdAt);
          return created.getTime() > thirtyDaysAgo;
        });
      default:
        return [];
    }
  };

  // Handle click vào cột chart
  const handleBarClick = (data: any) => {
    if (data && data.name) {
      setSelectedCategory(data.name);
      setShowStudentModal(true);
    }
  };

  const filteredStudents = selectedCategory ? getStudentsByCategory(selectedCategory) : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFFBF5] via-white to-teal-50/30 flex items-center justify-center -m-6">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto">
            {/* Outer ring */}
            <div className="absolute inset-0 rounded-full border-4 border-teal-100"></div>
            {/* Spinning teal ring */}
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-teal-500 border-r-teal-300 animate-spin"></div>
            {/* Inner spinning coral ring */}
            <div className="absolute inset-3 rounded-full border-4 border-transparent border-t-[#FF6B5A] animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.7s' }}></div>
            {/* Center dot */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3 h-3 bg-gradient-to-br from-teal-400 to-emerald-500 rounded-full animate-pulse"></div>
            </div>
          </div>
          <p className="text-slate-700 mt-5 font-semibold text-lg">Đang tải dữ liệu...</p>
          <p className="text-slate-400 text-sm mt-1">Vui lòng đợi trong giây lát</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFFBF5] via-white to-teal-50/20 -m-6 p-6">
      {/* Decorative background elements - Warm Education Theme */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-teal-300 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-pulse"></div>
        <div className="absolute top-1/3 -left-40 w-80 h-80 bg-[#FF6B5A] rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute -bottom-40 right-1/4 w-72 h-72 bg-amber-300 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-pulse" style={{ animationDelay: '4s' }}></div>
        <div className="absolute top-2/3 left-1/3 w-64 h-64 bg-emerald-300 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" style={{ animationDelay: '6s' }}></div>
      </div>

      <div className="relative z-10 space-y-6">
        {/* Hero Header - Teal Gradient */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 p-6 shadow-2xl shadow-teal-500/20">
          {/* Decorative pattern overlay */}
          <div className="absolute inset-0 opacity-10">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)"/>
            </svg>
          </div>
          {/* Animated shimmer */}
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 animate-shimmer"></div>
          
          {/* Content */}
          <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            {/* Left: Welcome & Branch */}
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 backdrop-blur-sm rounded-2xl">
                <Sparkles className="text-white" size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                <div className="flex items-center gap-2 mt-1">
                  <MapPin className="text-white/80" size={14} />
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="bg-white/20 backdrop-blur-md text-white border border-white/30 rounded-full px-4 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/40 cursor-pointer hover:bg-white/30 transition-all appearance-none pr-8"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '16px' }}
                  >
                    <option value="all" className="bg-white text-gray-800">Tất cả cơ sở</option>
                    {centerList.map(center => (
                      <option key={center.id} value={center.name} className="bg-white text-gray-800">{center.name}</option>
                    ))}
                    <option value="unassigned" className="bg-white text-gray-800 italic">-- Không phân loại --</option>
                  </select>
                </div>
              </div>
            </div>
            
            {/* Right: Stats Cards */}
            <div className="flex flex-wrap gap-4">
              {/* Students Card */}
              <div className="group relative bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-default">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-white/20 rounded-xl group-hover:scale-110 transition-transform">
                    <Users className="text-white" size={22} />
                  </div>
                  <div>
                    <div className="text-white/70 text-xs font-medium uppercase tracking-wider">Học viên</div>
                    <div className="text-3xl font-bold text-white">{stats.totalStudents}</div>
                  </div>
                </div>
              </div>
              
              {/* Classes Card */}
              <div className="group relative bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-default">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-white/20 rounded-xl group-hover:scale-110 transition-transform">
                    <BookOpen className="text-white" size={22} />
                  </div>
                  <div>
                    <div className="text-white/70 text-xs font-medium uppercase tracking-wider">Lớp học</div>
                    <div className="text-3xl font-bold text-white">{stats.totalClasses}</div>
                  </div>
                </div>
              </div>
              
              {/* Average Card */}
              <div className="group relative bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-default">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-white/20 rounded-xl group-hover:scale-110 transition-transform">
                    <TrendingUp className="text-white" size={22} />
                  </div>
                  <div>
                    <div className="text-white/70 text-xs font-medium uppercase tracking-wider">TB/Lớp</div>
                    <div className="text-3xl font-bold text-white">{stats.avgPerClass}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - Full width when revenue hidden */}
          <div className={`col-span-12 ${canSeeRevenue ? 'lg:col-span-7' : ''} space-y-6`}>
            {/* Student Stats Bar Chart */}
            <div className="group bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg shadow-slate-200/50 border border-white/60 hover:shadow-xl hover:shadow-teal-100/30 transition-all duration-300">
              <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl shadow-lg shadow-teal-500/30">
                    <BarChart3 className="text-white" size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">Thống kê học viên</h3>
                    <span className="text-xs text-gray-500">Theo ngày, tháng hoặc năm</span>
                  </div>
                </div>
                <div className="inline-flex rounded-xl border border-teal-100 bg-teal-50 p-1 text-xs font-semibold">
                  {[
                    ['daily', 'Ngày'],
                    ['monthly', 'Tháng'],
                    ['yearly', 'Năm'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setStudentStatsPeriod(value as StudentStatsPeriod)}
                      className={`px-3 py-1.5 rounded-lg transition-colors ${
                        studentStatsPeriod === value
                          ? 'bg-white text-teal-700 shadow-sm'
                          : 'text-gray-500 hover:text-teal-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={studentTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      formatter={(value: number, name: string) => {
                        const metric = STUDENT_STAT_METRICS.find((item) => item.key === name);
                        return [value, metric?.label || name];
                      }}
                      contentStyle={{ 
                        background: 'rgba(255,255,255,0.95)', 
                        border: 'none', 
                        borderRadius: '12px', 
                        boxShadow: '0 10px 40px rgba(0,0,0,0.1)' 
                      }} 
                    />
                    {activeStudentMetrics.map((metric) => (
                      <Bar
                        key={metric.key}
                        dataKey={metric.key}
                        name={metric.label}
                        fill={metric.color}
                        radius={[8, 8, 0, 0]}
                        maxBarSize={42}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-3 mt-4 justify-center">
                {STUDENT_STAT_METRICS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      setVisibleStudentMetrics((prev) => ({
                        ...prev,
                        [item.key]: !prev[item.key],
                      }))
                    }
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors text-xs font-medium border ${
                      visibleStudentMetrics[item.key]
                        ? 'bg-gray-50 border-gray-100 text-gray-700'
                        : 'bg-white border-gray-200 text-gray-400'
                    }`}
                  >
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span>{item.label}</span>
                    <span className="text-gray-400">
                      ({studentTrendData.reduce((sum, row) => sum + Number(row[item.key] || 0), 0)})
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Revenue Comparison - Only for revenue-allowed roles */}
            {canSeeRevenue && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg shadow-slate-200/50 border border-white/60 hover:shadow-xl hover:shadow-emerald-100/30 transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg">
                  <Wallet className="text-white" size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">Doanh thu từng lớp</h3>
                  <span className="text-xs text-gray-500">Hiện diện × học phí · {currentMonth}</span>
                </div>
              </div>
              <div className="text-center mb-4">
                <div className="text-3xl font-bold text-emerald-600">
                  {formatCurrency(stats.totalRevenue)}
                </div>
                <p className="text-xs text-gray-500 mt-1">Tổng {stats.revenueByClass.length} lớp có điểm danh</p>
              </div>
              {stats.revenueByClass.length > 0 ? (
                <div className="border border-gray-100 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-emerald-50/80 sticky top-0">
                      <tr>
                        <th className="text-left py-2.5 px-3 font-medium text-gray-600">Lớp học</th>
                        <th className="text-right py-2.5 px-3 font-medium text-gray-600">Doanh thu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...stats.revenueByClass]
                        .sort((a, b) => b.value - a.value)
                        .map((item) => (
                          <tr key={item.name} className="border-t border-gray-100 hover:bg-emerald-50/40">
                            <td className="py-2.5 px-3 text-gray-800 font-medium">{item.name}</td>
                            <td className="py-2.5 px-3 text-right font-semibold text-emerald-600">
                              {formatCurrency(item.value)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="h-44 flex flex-col items-center justify-center text-gray-400">
                  <Wallet size={40} className="mb-2 opacity-30" />
                  <span className="text-sm">Chưa có dữ liệu doanh thu điểm danh</span>
                </div>
              )}
            </div>
            )}

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg shadow-slate-200/50 border border-white/60 hover:shadow-xl hover:shadow-emerald-100/30 transition-all duration-300">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-xl shadow-lg">
                    <TrendingUp className="text-white" size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">Tăng trưởng học phí dự kiến</h3>
                    <p className="text-xs text-gray-500">Sĩ số × học phí × buổi trên TKB</p>
                  </div>
                </div>
                <div className="inline-flex rounded-xl border border-teal-100 bg-teal-50 p-1 text-xs font-semibold">
                  {[
                    ['daily', 'Ngày'],
                    ['monthly', 'Tháng'],
                    ['yearly', 'Năm'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRevenueGrowthPeriod(value as RevenueGrowthPeriod)}
                      className={`px-3 py-1.5 rounded-lg transition-colors ${
                        revenueGrowthPeriod === value
                          ? 'bg-white text-teal-700 shadow-sm'
                          : 'text-gray-500 hover:text-teal-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {revenueGrowthChartData.length > 0 ? (
                <div className="mb-5 h-60 rounded-2xl bg-gradient-to-b from-teal-50/70 to-white p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={revenueGrowthChartData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revenueGrowthArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0D9488" stopOpacity={0.34} />
                          <stop offset="95%" stopColor="#0D9488" stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbeafe" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        tickFormatter={(value) => `${(Number(value) / 1000000).toFixed(0)}tr`}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          name === 'growthRate' ? `${value.toFixed(1)}%` : formatCurrency(value),
                          name === 'growthRate' ? 'Tỷ lệ tăng trưởng' : 'Học phí dự kiến',
                        ]}
                        contentStyle={{
                          background: 'rgba(255,255,255,0.96)',
                          border: 'none',
                          borderRadius: '12px',
                          boxShadow: '0 10px 40px rgba(15,23,42,0.12)',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        name="Học phí dự kiến"
                        stroke="#0D9488"
                        strokeWidth={2}
                        fill="url(#revenueGrowthArea)"
                        activeDot={{ r: 5, fill: '#0D9488', stroke: '#ffffff', strokeWidth: 2 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        name="Đường tăng trưởng"
                        stroke="#14B8A6"
                        strokeWidth={3}
                        dot={{ r: 3, fill: '#14B8A6', stroke: '#ffffff', strokeWidth: 2 }}
                        activeDot={{ r: 5 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="mb-5 h-52 flex flex-col items-center justify-center rounded-2xl bg-teal-50/50 text-gray-400">
                  <TrendingUp size={36} className="mb-2 opacity-30" />
                  <span className="text-sm">Chưa có dữ liệu biểu đồ tăng trưởng</span>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="bg-teal-50/60 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-semibold">Kỳ</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Học phí dự kiến</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Tăng/Giảm</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Tỷ lệ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visibleRevenueGrowth.length > 0 ? (
                      visibleRevenueGrowth.map((item) => {
                        const isUp = item.change >= 0;
                        return (
                          <tr key={item.key} className="hover:bg-teal-50/30 transition-colors">
                            <td className="px-3 py-2.5 font-medium text-gray-800">{item.label}</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-teal-700">
                              {formatCurrency(item.revenue)}
                            </td>
                            <td className={`px-3 py-2.5 text-right font-semibold ${isUp ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {isUp ? '+' : ''}{formatCurrency(item.change)}
                            </td>
                            <td className={`px-3 py-2.5 text-right font-semibold ${item.growthRate === null ? 'text-gray-400' : isUp ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {item.growthRate === null ? '-' : `${isUp ? '+' : ''}${item.growthRate.toFixed(1)}%`}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-3 py-8 text-center text-gray-400">
                          Chưa có dữ liệu tăng trưởng học phí dự kiến
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column - Pie Charts - Only for revenue-allowed roles */}
          {canSeeRevenue && (
          <div className="col-span-12 lg:col-span-5 space-y-6">
            {/* Revenue Pie Chart */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg shadow-slate-200/50 border border-white/60 hover:shadow-xl hover:shadow-[#FF6B5A]/10 transition-all duration-300">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-[#FF6B5A] to-[#FF8F7A] rounded-xl shadow-lg shadow-[#FF6B5A]/30">
                    <PieChartIcon className="text-white" size={20} />
                  </div>
                  <h3 className="font-bold text-gray-800">Doanh số điểm danh</h3>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold bg-gradient-to-r from-[#FF6B5A] to-[#FF8F7A] bg-clip-text text-transparent">
                    {formatCurrency(revenuePieData.reduce((sum, item) => sum + item.value, 0))}
                  </div>
                  <span className="text-xs text-gray-500">{currentMonth}</span>
                </div>
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={revenuePieData.length > 0 ? revenuePieData : [{ name: 'Chưa có', value: 1, color: '#e5e7eb' }]}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      dataKey="value"
                      label={revenuePieData.length > 0 ? ({ percent }) => `${(percent * 100).toFixed(0)}%` : undefined}
                      strokeWidth={2}
                      stroke="#fff"
                    >
                      {(revenuePieData.length > 0 ? revenuePieData : [{ color: '#e5e7eb' }]).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ background: 'rgba(255,255,255,0.95)', border: 'none', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      formatter={(value) => <span className="text-gray-600 text-sm">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Revenue vs Debt Pie Chart */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg shadow-slate-200/50 border border-white/60 hover:shadow-xl hover:shadow-amber-100/30 transition-all duration-300">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg">
                    <DollarSign className="text-white" size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">Doanh số / Nợ phí</h3>
                    <span className="text-xs text-gray-500">Dự kiến theo thời khoá biểu · {currentMonth}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                    {formatCurrency(stats.expectedScheduleRevenue)}
                  </div>
                  <span className="text-xs text-gray-500">{stats.scheduleSessionCount} buổi trên TKB</span>
                </div>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={revenueDebtPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      dataKey="value"
                      label={({ percent }) => percent > 0 ? `${(percent * 100).toFixed(0)}%` : ''}
                      strokeWidth={2}
                      stroke="#fff"
                    >
                      {revenueDebtPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ background: 'rgba(255,255,255,0.95)', border: 'none', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-between items-center mt-4 pt-4 border-t border-gray-100 gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-sm text-gray-600">Dự kiến (TKB):</span>
                  <span className="font-semibold text-blue-600">{formatCurrency(stats.expectedScheduleRevenue)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-teal-500"></div>
                  <span className="text-sm text-gray-600">Thực tế điểm danh:</span>
                  <span className="font-semibold text-teal-600">{formatCurrency(stats.totalRevenue)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <span className="text-sm text-gray-600">Nợ phí:</span>
                  <span className="font-semibold text-amber-600">{formatCurrency(stats.totalDebt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-sm text-gray-600">Nợ xấu:</span>
                  <span className="font-semibold text-red-600">{formatCurrency(stats.totalBadDebt)} ({stats.badDebtStudents} HV)</span>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Revenue-only Section - Lead/Admin/Ketoan can see revenue & health metrics */}
        {canSeeRevenue && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Left Column - Salary (Admin/KeToan only) & Health */}
          <div className="space-y-6">
            {/* Dự báo lương - ONLY Admin/KeToan can see ALL salary data */}
            {canSeeAllSalaries && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-slate-200/50 border border-white/60 overflow-hidden hover:shadow-xl hover:shadow-emerald-100/30 transition-all duration-300">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <Wallet className="text-white" size={20} />
                    </div>
                    <h3 className="font-bold text-white">Dự báo lương</h3>
                  </div>
                  <span className="text-sm text-white/80 bg-white/10 px-3 py-1 rounded-full">{currentMonth}</span>
                </div>
              </div>
              <div className="p-4">
                <table className="w-full text-sm">
                  <tbody>
                    {stats.salaryForecast.map((item, idx) => (
                      <tr key={idx} className={idx === stats.salaryForecast.length - 1 ? 'font-bold border-t-2 border-emerald-200' : 'border-b border-gray-100'}>
                        <td className="py-2.5 text-gray-700">{item.position}</td>
                        <td className="py-2.5 text-right font-semibold text-emerald-600">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-emerald-200 bg-emerald-50/50">
                      <td className="py-2.5 font-semibold text-gray-800">Chiếm tỉ lệ</td>
                      <td className="py-2.5 text-right font-bold text-emerald-600">{stats.salaryPercent}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            )}

            {/* Chỉ số sức khỏe doanh nghiệp */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-slate-200/50 border border-white/60 overflow-hidden hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300">
              <div className="bg-gradient-to-r from-slate-600 to-slate-800 p-4 text-center">
                <div className="flex items-center justify-center gap-3 mb-1">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Activity className="text-white" size={20} />
                  </div>
                  <h3 className="font-bold text-white">CHỈ SỐ SỨC KHỎE DOANH NGHIỆP</h3>
                </div>
                <p className="text-white/80 text-sm">{currentMonth}</p>
              </div>
              <div className="p-4">
                <table className="w-full text-sm">
                  <thead className="text-gray-500 border-b-2 border-slate-200">
                    <tr>
                      <th className="text-left py-2 font-medium">Hạng mục</th>
                      <th className="text-center py-2 font-medium">Số liệu</th>
                      <th className="text-right py-2 font-medium">Đánh giá</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.businessHealth.map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-slate-50/50 transition-colors">
                        <td className="py-2.5 text-gray-700">{item.metric}</td>
                        <td className="py-2.5 text-center font-medium">{item.value}%</td>
                        <td className={`py-2.5 text-right font-semibold ${
                          item.status === 'Tốt' ? 'text-emerald-600' : 
                          item.status === 'Khá' ? 'text-blue-600' :
                          item.status === 'Trung Bình' ? 'text-amber-500' : 
                          item.status === 'Yếu' ? 'text-rose-500' : 
                          item.status === 'Chưa có dữ liệu' ? 'text-gray-500' : 'text-rose-600'
                        }`}>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            item.status === 'Tốt' ? 'bg-emerald-100' : 
                            item.status === 'Khá' ? 'bg-blue-100' :
                            item.status === 'Trung Bình' ? 'bg-amber-100' : 
                            item.status === 'Yếu' ? 'bg-rose-100' : 
                            item.status === 'Chưa có dữ liệu' ? 'bg-gray-100' : 'bg-rose-200'
                          }`}>{item.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column - Stats only */}
          <div className="space-y-6">
            {/* THỐNG KÊ */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-slate-200/50 border border-white/60 overflow-hidden hover:shadow-xl hover:shadow-teal-100/30 transition-all duration-300">
              <div className="bg-gradient-to-r from-teal-500 to-cyan-600 p-4 text-center">
                <div className="flex items-center justify-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <BarChart3 className="text-white" size={20} />
                  </div>
                  <h3 className="font-bold text-white">THỐNG KÊ</h3>
                </div>
              </div>
              <div className="p-4">
                {/* Filter row - interactive */}
                <div className="grid grid-cols-2 gap-3 text-sm mb-4 p-4 bg-teal-50/50 rounded-xl border border-teal-100">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Xem theo tháng</span>
                    <select 
                      value={`${statsMonth}-${statsYear}`}
                      onChange={(e) => {
                        const [m, y] = e.target.value.split('-').map(Number);
                        setStatsMonth(m);
                        setStatsYear(y);
                      }}
                      className="text-teal-600 font-semibold bg-transparent border-none text-right cursor-pointer focus:outline-none"
                    >
                      {Array.from({ length: 12 }, (_, i) => {
                        const d = new Date();
                        d.setMonth(d.getMonth() - i);
                        const val = `${d.getMonth() + 1}-${d.getFullYear()}`;
                        const label = `${d.getMonth() + 1}/${d.getFullYear()}`;
                        return <option key={val} value={val}>{label}</option>;
                      })}
                    </select>
                  </div>
                  <div></div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Hạng mục</span>
                    <select
                      value={statsCategory}
                      onChange={(e) => setStatsCategory(e.target.value as 'salary' | 'students' | 'revenue')}
                      className="text-teal-600 font-semibold bg-transparent border-none text-right cursor-pointer focus:outline-none"
                    >
                      {canSeeAllSalaries && <option value="salary">Lương nhân viên</option>}
                      <option value="students">Số lượng học sinh</option>
                      <option value="revenue">Doanh thu</option>
                    </select>
                  </div>
                  <div></div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Kiểu xem</span>
                    <select
                      value={statsSortOrder}
                      onChange={(e) => setStatsSortOrder(e.target.value)}
                      className="text-teal-600 font-semibold bg-transparent border-none text-right cursor-pointer focus:outline-none"
                    >
                      <option value="asc">Từ thấp tới cao</option>
                      <option value="desc">Từ cao tới thấp</option>
                    </select>
                  </div>
                  <div></div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Hiển thị</span>
                    <select 
                      value={statsLimit}
                      onChange={(e) => setStatsLimit(Number(e.target.value))}
                      className="text-teal-600 font-semibold bg-transparent border-none text-right cursor-pointer focus:outline-none"
                    >
                      <option value={5}>TOP 5</option>
                      <option value={10}>TOP 10</option>
                      <option value={20}>TOP 20</option>
                    </select>
                  </div>
                </div>

                {/* Stats table - dynamic based on category */}
                <table className="w-full text-sm">
                  <thead className="bg-teal-50/50 border-b-2 border-teal-100">
                    <tr>
                      <th className="text-left py-2.5 px-3 font-medium text-gray-600">
                        {statsCategory === 'salary' ? 'Tên nhân viên' : statsCategory === 'students' ? 'Tên lớp' : 'Tên lớp'}
                      </th>
                      <th className="text-right py-2.5 px-3 font-medium text-gray-600">
                        {statsCategory === 'salary' ? 'Lương tạm tính' : statsCategory === 'students' ? 'Số học sinh' : 'Doanh thu'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Prepare data based on category
                      let tableData: { name: string; value: number }[] = [];

                      if (statsCategory === 'salary') {
                        tableData = salaryReportData.map(item => ({
                          name: item.staffName,
                          value: item.estimatedSalary
                        }));
                      } else if (statsCategory === 'students') {
                        tableData = stats.classStats?.map((c: any) => ({
                          name: c.name,
                          value: c.count || 0
                        })) || [];
                      } else if (statsCategory === 'revenue') {
                        // Use revenue by class (doanh thu theo lớp học)
                        tableData = stats.revenueByClass?.map(r => ({
                          name: r.name,
                          value: r.value || 0
                        })) || [];
                      }

                      // Sort and limit
                      const sortedData = [...tableData]
                        .sort((a, b) => statsSortOrder === 'asc' ? a.value - b.value : b.value - a.value)
                        .slice(0, statsLimit);

                      const emptyMessage = statsCategory === 'salary' ? 'Chưa có dữ liệu lương'
                        : statsCategory === 'students' ? 'Chưa có dữ liệu lớp học'
                        : 'Chưa có dữ liệu doanh thu';

                      return sortedData.length > 0 ? (
                        sortedData.map((item, idx) => (
                          <tr key={idx} className="border-b border-gray-100 hover:bg-teal-50/30 transition-colors">
                            <td className="py-2.5 px-3 text-gray-700">{item.name}</td>
                            <td className="py-2.5 px-3 text-right font-semibold text-teal-600">
                              {statsCategory === 'students' ? item.value : formatCurrency(item.value)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={2} className="py-6 text-center text-gray-400">
                            <BarChart3 size={32} className="mx-auto mb-2 opacity-30" />
                            {emptyMessage}
                          </td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Common Widgets Section - All office staff can see (not teachers) */}
        {!isTeacher && (
        <>
        {/* Phase 3: New Widgets Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
          {/* Widget 1: Số ngày công */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg shadow-slate-200/50 border border-white/60 hover:shadow-xl hover:shadow-emerald-100/30 transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/30">
                <CalendarCheck className="text-white" size={22} />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Ngày công tháng này</h3>
                <span className="text-xs text-gray-500">Đã xác nhận</span>
              </div>
            </div>
            <div className="text-center py-4">
              <span className="text-5xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">{stats.myWorkDays}</span>
              <span className="text-gray-500 ml-2 text-lg">ngày</span>
            </div>
          </div>

          {/* Widget 2: DS sắp hết phí */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-slate-200/50 border border-white/60 overflow-hidden hover:shadow-xl hover:shadow-amber-100/30 transition-all duration-300">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-white" size={18} />
                <h3 className="font-bold text-white text-sm">Sắp hết phí ({stats.studentsExpiringSoon.length})</h3>
              </div>
            </div>
            <div className="p-3 max-h-48 overflow-y-auto">
              {stats.studentsExpiringSoon.length > 0 ? (
                <table className="w-full text-xs">
                  <thead className="bg-amber-50 sticky top-0">
                    <tr>
                      <th className="text-left py-1.5 px-2">Học viên</th>
                      <th className="text-center py-1.5 px-2">Còn</th>
                      <th className="text-center py-1.5 px-2">Ngày BĐ HĐ</th>
                      <th className="text-right py-1.5 px-2">Dự kiến KT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.studentsExpiringSoon.slice(0, 10).map(s => (
                      <tr key={s.id} className="border-b border-gray-100 hover:bg-amber-50/50">
                        <td className="py-1.5 px-2 truncate max-w-[80px]" title={s.fullName}>{s.fullName}</td>
                        <td className="py-1.5 px-2 text-center font-bold text-amber-600">{s.remainingSessions}</td>
                        <td className="py-1.5 px-2 text-center text-gray-500">{s.contractStartDate || '-'}</td>
                        <td className="py-1.5 px-2 text-right text-gray-600">{s.expectedEndDate || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-6 text-gray-400">
                  <AlertTriangle size={24} className="mx-auto mb-1 opacity-30" />
                  <span className="text-xs">Không có HS sắp hết phí</span>
                </div>
              )}
            </div>
          </div>

          {/* Widget 3: DS Nợ Phí */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-slate-200/50 border border-white/60 overflow-hidden hover:shadow-xl hover:shadow-rose-100/30 transition-all duration-300">
            <div className="bg-gradient-to-r from-rose-500 to-red-500 p-3">
              <div className="flex items-center gap-2">
                <Clock className="text-white" size={18} />
                <h3 className="font-bold text-white text-sm">Nợ phí ({stats.studentsWithDebt.length})</h3>
              </div>
            </div>
            <div className="p-3 max-h-48 overflow-y-auto">
              {stats.studentsWithDebt.length > 0 ? (
                <table className="w-full text-xs">
                  <thead className="bg-rose-50 sticky top-0">
                    <tr>
                      <th className="text-left py-1.5 px-2">Học viên</th>
                      <th className="text-right py-1.5 px-2">Lớp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.studentsWithDebt.slice(0, 10).map(s => (
                      <tr key={s.id} className="border-b border-gray-100 hover:bg-rose-50/50">
                        <td className="py-1.5 px-2 truncate max-w-[120px]" title={s.fullName}>{s.fullName}</td>
                        <td className="py-1.5 px-2 text-right text-gray-500 truncate max-w-[80px]" title={s.className}>{s.className}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-6 text-gray-400">
                  <Clock size={24} className="mx-auto mb-1 opacity-30" />
                  <span className="text-xs">Không có HS nợ phí</span>
                </div>
              )}
            </div>
          </div>

          {/* Widget 4: Checklist công việc */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-slate-200/50 border border-white/60 overflow-hidden hover:shadow-xl hover:shadow-indigo-100/30 transition-all duration-300">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="text-white" size={18} />
                <h3 className="font-bold text-white text-sm">Việc cần làm hôm nay</h3>
              </div>
            </div>
            <div className="p-3">
              {checklistItems.length > 0 ? (
                <div className="space-y-2">
                  {checklistItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => {
                          setChecklistItems(prev =>
                            prev.map(i => i.id === item.id ? { ...i, done: !i.done } : i)
                          );
                        }}
                        className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                      />
                      <span className={`flex-1 text-xs ${item.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                        {item.task}
                      </span>
                      {item.count > 0 && (
                        <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-medium">
                          {item.count}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400">
                  <CheckSquare size={24} className="mx-auto mb-1 opacity-30" />
                  <span className="text-xs">Không có việc cần làm</span>
                </div>
              )}
            </div>
          </div>
        </div>

        </>
        )}

        {/* ================================================ */}
        {/* TEACHER DASHBOARD - Phase 4 */}
        {/* ================================================ */}
        {isTeacher && (
        <>
          {/* GV Header Stats */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-500 p-6 shadow-2xl shadow-indigo-500/20">
            <div className="absolute inset-0 opacity-10">
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <pattern id="teacher-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                    <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#teacher-grid)"/>
              </svg>
            </div>
            <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 backdrop-blur-sm rounded-2xl">
                  <GraduationCap className="text-white" size={28} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Dashboard Giáo Viên</h1>
                  <p className="text-white/70 text-sm">Tổng quan lớp học và hoạt động của bạn</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                {/* My Students */}
                <div className="group relative bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/20 hover:bg-white/20 transition-all duration-300">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-white/20 rounded-xl">
                      <Users className="text-white" size={22} />
                    </div>
                    <div>
                      <div className="text-white/70 text-xs font-medium uppercase tracking-wider">Học viên của tôi</div>
                      <div className="text-3xl font-bold text-white">{stats.myTotalStudents}</div>
                    </div>
                  </div>
                </div>
                {/* My Classes */}
                <div className="group relative bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/20 hover:bg-white/20 transition-all duration-300">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-white/20 rounded-xl">
                      <BookOpen className="text-white" size={22} />
                    </div>
                    <div>
                      <div className="text-white/70 text-xs font-medium uppercase tracking-wider">Lớp đang dạy</div>
                      <div className="text-3xl font-bold text-white">{stats.myClasses.length}</div>
                    </div>
                  </div>
                </div>
                {/* Average */}
                <div className="group relative bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/20 hover:bg-white/20 transition-all duration-300">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-white/20 rounded-xl">
                      <TrendingUp className="text-white" size={22} />
                    </div>
                    <div>
                      <div className="text-white/70 text-xs font-medium uppercase tracking-wider">Sĩ số TB</div>
                      <div className="text-3xl font-bold text-white">{stats.myAvgPerClass}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* GV Widgets Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Widget 2: Upcoming Classes */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-slate-200/50 border border-white/60 overflow-hidden hover:shadow-xl hover:shadow-blue-100/30 transition-all duration-300">
                <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <Clock className="text-white" size={20} />
                    </div>
                    <h3 className="font-bold text-white">Lớp học sắp diễn ra</h3>
                  </div>
                </div>
                <div className="p-4 max-h-64 overflow-y-auto">
                  {stats.upcomingClasses.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead className="bg-blue-50 sticky top-0">
                        <tr>
                          <th className="text-left py-2 px-3">Lớp</th>
                          <th className="text-right py-2 px-3">Thời gian</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.upcomingClasses.map((cls) => (
                          <tr key={cls.id} className="border-b border-gray-100 hover:bg-blue-50/50">
                            <td className="py-2.5 px-3 font-medium text-gray-700">{cls.className}</td>
                            <td className="py-2.5 px-3 text-right text-blue-600">{cls.time || cls.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <Clock size={32} className="mx-auto mb-2 opacity-30" />
                      <span>Không có lớp sắp diễn ra</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Widget 3: BTVN Reports Needed */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-slate-200/50 border border-white/60 overflow-hidden hover:shadow-xl hover:shadow-amber-100/30 transition-all duration-300">
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <FileText className="text-white" size={20} />
                    </div>
                    <h3 className="font-bold text-white">BTVN cần báo cáo ({stats.btvnNeedingReport.length})</h3>
                  </div>
                </div>
                <div className="p-4 max-h-48 overflow-y-auto">
                  {stats.btvnNeedingReport.length > 0 ? (
                    <div className="space-y-2">
                      {stats.btvnNeedingReport.map((cls) => (
                        <Link
                          key={cls.id}
                          to={`/training/homework?classId=${cls.id}`}
                          className="block p-3 rounded-xl bg-amber-50 hover:bg-amber-100 transition-colors"
                        >
                          <div className="font-medium text-gray-800">{cls.className}</div>
                          <div className="text-xs text-amber-600">{cls.lastClassDate}</div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-400">
                      <FileText size={32} className="mx-auto mb-2 opacity-30" />
                      <span>Đã báo cáo đầy đủ</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Widget 4: Student Alerts */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-slate-200/50 border border-white/60 overflow-hidden hover:shadow-xl hover:shadow-rose-100/30 transition-all duration-300">
                <div className="bg-gradient-to-r from-rose-500 to-red-500 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <AlertTriangle className="text-white" size={20} />
                    </div>
                    <h3 className="font-bold text-white">Báo Động Học Viên</h3>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  {/* Top Absent */}
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2 text-sm">Top 5 vắng nhiều</h4>
                    {stats.topAbsentStudents.length > 0 ? (
                      <div className="space-y-1">
                        {stats.topAbsentStudents.map((student, idx) => (
                          <div key={student.id} className="flex justify-between py-1.5 px-2 rounded-lg hover:bg-rose-50">
                            <span className="text-sm text-gray-700">{idx + 1}. {student.name}</span>
                            <span className="text-sm font-bold text-rose-600">{student.absences} lần</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-3 text-gray-400 text-sm">Không có học viên vắng nhiều</div>
                    )}
                  </div>
                  {/* Top Low Homework */}
                  {stats.topLowHomework.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2 text-sm">Top 5 ít làm BTVN</h4>
                      <div className="space-y-1">
                        {stats.topLowHomework.map((student, idx) => (
                          <div key={student.id} className="flex justify-between py-1.5 px-2 rounded-lg hover:bg-amber-50">
                            <span className="text-sm text-gray-700">{idx + 1}. {student.name}</span>
                            <span className="text-sm font-bold text-amber-600">{Math.round(student.completionRate * 100)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Widget 6: Monthly Salary */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-slate-200/50 border border-white/60 overflow-hidden hover:shadow-xl hover:shadow-emerald-100/30 transition-all duration-300">
                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <Wallet className="text-white" size={20} />
                    </div>
                    <h3 className="font-bold text-white">Lương tháng này</h3>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Đã xác nhận:</span>
                    <span className="text-lg font-bold text-emerald-600">{formatCurrency(stats.myConfirmedSalary)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Chờ xác nhận:</span>
                    <span className="text-lg font-bold text-amber-600">{formatCurrency(stats.myPendingSalary)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 bg-teal-50 rounded-xl px-3">
                    <span className="font-semibold text-gray-700">Tổng dự kiến:</span>
                    <span className="text-xl font-bold text-teal-600">{formatCurrency(stats.myConfirmedSalary + stats.myPendingSalary)}</span>
                  </div>
                  <div className="text-center text-xs text-gray-500 pt-2">
                    {stats.myConfirmedSessions} buổi xác nhận / {stats.myTotalSessions} tổng buổi
                  </div>
                </div>
              </div>

              {/* Widget 5: My Class Birthdays */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-slate-200/50 border border-white/60 overflow-hidden hover:shadow-xl hover:shadow-pink-100/30 transition-all duration-300">
                <div className="bg-gradient-to-r from-pink-500 to-rose-400 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <Cake className="text-white" size={20} />
                    </div>
                    <h3 className="font-bold text-white">Sinh nhật lớp tôi</h3>
                  </div>
                </div>
                <div className="p-4 max-h-48 overflow-y-auto">
                  {stats.myStudentBirthdays.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead className="bg-pink-50 sticky top-0">
                        <tr>
                          <th className="text-left py-2 px-3">Học viên</th>
                          <th className="text-right py-2 px-3">Ngày SN</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.myStudentBirthdays.map((student) => (
                          <tr key={student.id} className="border-b border-gray-100 hover:bg-pink-50/50">
                            <td className="py-2.5 px-3 text-gray-700">{student.name}</td>
                            <td className="py-2.5 px-3 text-right font-medium text-pink-600">{student.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center py-6 text-gray-400">
                      <Cake size={32} className="mx-auto mb-2 opacity-30" />
                      <span>Không có sinh nhật tháng này</span>
                    </div>
                  )}
                </div>
              </div>

              {/* My Classes List */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-slate-200/50 border border-white/60 overflow-hidden hover:shadow-xl hover:shadow-indigo-100/30 transition-all duration-300">
                <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <BookOpen className="text-white" size={20} />
                    </div>
                    <h3 className="font-bold text-white">Danh sách lớp của tôi</h3>
                  </div>
                </div>
                <div className="p-4 max-h-48 overflow-y-auto">
                  {stats.myClasses.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead className="bg-indigo-50 sticky top-0">
                        <tr>
                          <th className="text-left py-2 px-3">Lớp</th>
                          <th className="text-right py-2 px-3">Sĩ số</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.myClasses.map((cls) => (
                          <tr key={cls.id} className="border-b border-gray-100 hover:bg-indigo-50/50">
                            <td className="py-2.5 px-3 font-medium text-gray-700">{cls.name}</td>
                            <td className="py-2.5 px-3 text-right text-indigo-600 font-bold">{cls.studentCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center py-6 text-gray-400">
                      <BookOpen size={32} className="mx-auto mb-2 opacity-30" />
                      <span>Chưa được phân công lớp</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
        )}
      </div>

      {/* Dev Tools - Hidden (uncomment for development)
      <div className="fixed bottom-4 right-4 z-40 flex gap-2">
        <button
          onClick={handleSeedData}
          disabled={seeding}
          className="bg-teal-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium"
        >
          {seeding ? '⏳ Đang xử lý...' : '🌱 Seed Data'}
        </button>
        <button
          onClick={handleClearData}
          disabled={seeding}
          className="bg-rose-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-rose-700 disabled:opacity-50 text-sm font-medium"
        >
          {seeding ? '⏳ Đang xử lý...' : '🗑️ Xóa Data'}
        </button>
      </div>
      */}

      {/* Modal danh sách học viên */}
      {showStudentModal && selectedCategory && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b" style={{ backgroundColor: stats.studentsByStatus.find(s => s.name === selectedCategory)?.color || '#3b82f6' }}>
              <h2 className="text-lg font-bold text-white">
                Danh sách học viên: {selectedCategory}
              </h2>
              <button
                onClick={() => setShowStudentModal(false)}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {filteredStudents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Không có học viên trong danh mục này</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm text-gray-500 mb-3">
                    Tổng: {filteredStudents.length} học viên
                  </div>
                  <table className="w-full">
                    <thead className="bg-gray-50 text-xs text-gray-600">
                      <tr>
                        <th className="text-left p-2">STT</th>
                        <th className="text-left p-2">Họ tên</th>
                        <th className="text-left p-2">Lớp</th>
                        <th className="text-left p-2">Liên hệ</th>
                        <th className="text-left p-2">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {filteredStudents.map((student, idx) => (
                        <tr key={student.id} className="border-b hover:bg-gray-50">
                          <td className="p-2 text-gray-500">{idx + 1}</td>
                          <td className="p-2 font-medium">{student.fullName}</td>
                          <td className="p-2">{student.className || student.currentClassName || '-'}</td>
                          <td className="p-2">
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              {student.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {student.phone}
                                </span>
                              )}
                              {student.parentPhone && !student.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {student.parentPhone} (PH)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-2">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              student.hasDebt ? 'bg-red-100 text-red-700' :
                              student.status === 'Trial' || student.status === 'Học thử' ? 'bg-orange-100 text-orange-700' :
                              student.status === 'Reserved' || student.status === 'Bảo lưu' ? 'bg-yellow-100 text-yellow-700' :
                              student.status === 'Dropped' || student.status === 'Nghỉ học' ? 'bg-gray-100 text-gray-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {student.status || (student.hasDebt ? 'Nợ phí' : 'HV mới')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowStudentModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};
