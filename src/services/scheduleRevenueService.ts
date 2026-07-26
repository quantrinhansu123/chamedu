import { ClassModel, Holiday } from '../../types';
import { getClassGridScheduleEntries } from '../utils/classScheduleUtils';
import type { RevenueGrowthPoint } from './revenueService';

export interface ScheduleRevenueByClass {
  classId: string;
  className: string;
  sessionCount: number;
  studentCount: number;
  revenue: number;
}

export interface ScheduleRevenueEstimate {
  totalEstimatedRevenue: number;
  totalSessions: number;
  byClass: ScheduleRevenueByClass[];
}

type StudentLike = {
  id: string;
  classId?: string;
  class?: string;
  className?: string;
  classIds?: string[];
  status?: string;
};

const normalizeText = (value?: string) =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();

const formatDateLocal = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getMonthRange = (monthDate: Date) => {
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  return { start, end };
};

const parseMoneyValue = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const parsed = Number(value.replace(/[^\d]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const shouldCountClassInEstimates = (cls: ClassModel) => {
  const normalizedStatus = normalizeText(cls.status);
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

const isRevenueStudentStatus = (status?: string) => {
  const normalized = normalizeText(status);
  if (!normalized) return true;
  return ![
    'inactive',
    'nghi hoc',
    'da nghi',
    'bao luu',
    'reserved',
    'ended',
    'ket thuc',
    'da ket thuc',
  ].includes(normalized);
};

const getClassStudentCount = (cls: ClassModel, students: StudentLike[]) => {
  const studentIds = (cls as ClassModel & { studentIds?: string[] }).studentIds || [];
  const matchedStudents = students.filter((student) => {
    const inClass =
      student.classId === cls.id ||
      student.class === cls.name ||
      student.className === cls.name ||
      student.classIds?.includes(cls.id);
    if (!inClass) return false;
    return isRevenueStudentStatus(student.status);
  });

  if (matchedStudents.length > 0) return matchedStudents.length;
  if (studentIds.length > 0) return studentIds.length;

  const classWithCounts = cls as ClassModel & { currentStudents?: number };
  return (
    Number(classWithCounts.activeStudents) ||
    Number(classWithCounts.studentsCount) ||
    Number(classWithCounts.currentStudents) ||
    0
  );
};

const getHolidayForDate = (date: Date, holidays: Holiday[], classId?: string, branch?: string) => {
  const dateStr = formatDateLocal(date);

  for (const holiday of holidays) {
    if (holiday.status && holiday.status !== 'Đã áp dụng') continue;
    const endDate = holiday.endDate || holiday.startDate;
    if (dateStr < holiday.startDate || dateStr > endDate) continue;

    if (holiday.applyType === 'all_classes' || holiday.applyType === 'all_branches') {
      return holiday;
    }
    if (holiday.applyType === 'specific_branch' && branch && holiday.branch === branch) {
      return holiday;
    }
    if (holiday.applyType === 'specific_classes' && classId && holiday.classIds?.includes(classId)) {
      return holiday;
    }
    if (!holiday.applyType) return holiday;
  }

  return null;
};

const isClassScheduledOnDate = (
  cls: ClassModel,
  date: Date,
  holidays: Holiday[]
) => {
  if (!shouldCountClassInEstimates(cls)) return false;
  return getHolidayForDate(date, holidays, cls.id, cls.branch) === null;
};

const formatDayLabel = (date: Date) =>
  `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;

const toGrowthSeries = (points: Array<{ key: string; label: string; revenue: number }>): RevenueGrowthPoint[] => {
  let previous = 0;
  return points.map((point) => {
    const change = point.revenue - previous;
    const growthRate = previous > 0 ? (change / previous) * 100 : null;
    previous = point.revenue;
    return {
      key: point.key,
      label: point.label,
      revenue: point.revenue,
      change,
      growthRate,
    };
  });
};

const countClassSessionsOnDate = (
  cls: ClassModel,
  date: Date,
  holidays: Holiday[]
): number => {
  if (!shouldCountClassInEstimates(cls)) return 0;
  if (!isClassScheduledOnDate(cls, date, holidays)) return 0;

  const dayNumber = date.getDay() === 0 ? 8 : date.getDay() + 1;
  let count = 0;
  getClassGridScheduleEntries(cls).forEach((entry) => {
    if (entry.dayNumbers.includes(dayNumber)) count += 1;
  });
  return count;
};

const calculateRevenueOnDate = ({
  classes,
  students,
  date,
  holidays = [],
}: {
  classes: ClassModel[];
  students: StudentLike[];
  date: Date;
  holidays?: Holiday[];
}) => {
  let revenue = 0;

  classes.forEach((cls) => {
    const sessionCount = countClassSessionsOnDate(cls, date, holidays);
    if (sessionCount <= 0) return;

    const studentCount = getClassStudentCount(cls, students);
    const tuitionFee = parseMoneyValue(cls.tuitionFee);
    if (!shouldCountClassInEstimates(cls) || tuitionFee <= 0 || studentCount <= 0) return;

    revenue += tuitionFee * studentCount * sessionCount;
  });

  return revenue;
};

export const calculateScheduleRevenueGrowth = ({
  classes,
  students,
  monthDate = new Date(),
  holidays = [],
}: {
  classes: ClassModel[];
  students: StudentLike[];
  monthDate?: Date;
  holidays?: Holiday[];
}): { daily: RevenueGrowthPoint[]; monthly: RevenueGrowthPoint[]; yearly: RevenueGrowthPoint[] } => {
  const { start, end } = getMonthRange(monthDate);

  const dailyPoints: Array<{ key: string; label: string; revenue: number }> = [];
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const current = new Date(date);
    const key = formatDateLocal(current);
    dailyPoints.push({
      key,
      label: formatDayLabel(current),
      revenue: calculateRevenueOnDate({ classes, students, date: current, holidays }),
    });
  }

  const monthlyPoints: Array<{ key: string; label: string; revenue: number }> = [];
  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth() - offset, 1);
    const estimate = calculateMonthlyScheduleRevenue({ classes, students, monthDate: date, holidays });
    monthlyPoints.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: `T${date.getMonth() + 1}/${date.getFullYear()}`,
      revenue: estimate.totalEstimatedRevenue,
    });
  }

  const yearlyMap = new Map<string, number>();
  monthlyPoints.forEach((point) => {
    const year = point.key.slice(0, 4);
    yearlyMap.set(year, (yearlyMap.get(year) || 0) + point.revenue);
  });
  const yearlyPoints = Array.from(yearlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, revenue]) => ({ key: year, label: year, revenue }));

  return {
    daily: toGrowthSeries(dailyPoints),
    monthly: toGrowthSeries(monthlyPoints),
    yearly: toGrowthSeries(yearlyPoints),
  };
};

export const calculateMonthlyScheduleRevenue = ({
  classes,
  students,
  monthDate = new Date(),
  holidays = [],
}: {
  classes: ClassModel[];
  students: StudentLike[];
  monthDate?: Date;
  holidays?: Holiday[];
}): ScheduleRevenueEstimate => {
  const { start, end } = getMonthRange(monthDate);
  const classRevenueMap = new Map<string, ScheduleRevenueByClass>();
  let totalEstimatedRevenue = 0;
  let totalSessions = 0;

  classes.forEach((cls) => {
    const studentCount = getClassStudentCount(cls, students);
    const tuitionFee = parseMoneyValue(cls.tuitionFee);
    if (!shouldCountClassInEstimates(cls) || tuitionFee <= 0 || studentCount <= 0) return;

    const revenuePerSession = tuitionFee * studentCount;

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const sessionCount = countClassSessionsOnDate(cls, date, holidays);
      if (sessionCount <= 0) continue;

      for (let i = 0; i < sessionCount; i += 1) {
        totalSessions += 1;
        totalEstimatedRevenue += revenuePerSession;

        const current = classRevenueMap.get(cls.id) || {
          classId: cls.id,
          className: cls.name,
          sessionCount: 0,
          studentCount,
          revenue: 0,
        };
        current.sessionCount += 1;
        current.revenue += revenuePerSession;
        classRevenueMap.set(cls.id, current);
      }
    }
  });

  return {
    totalEstimatedRevenue,
    totalSessions,
    byClass: Array.from(classRevenueMap.values()).sort((a, b) => b.revenue - a.revenue),
  };
};
