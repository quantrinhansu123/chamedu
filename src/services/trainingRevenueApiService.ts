/**
 * Training Revenue API
 * Tổng doanh thu dự kiến (theo TKB) và doanh thu thực tế (theo điểm danh).
 *
 * Công thức dự kiến: học phí × sĩ số × số buổi TKB trong kỳ
 * Công thức thực tế: ưu tiên session_amount; fallback billable × unit_price hoặc (có mặt + bồi) × học phí
 */

import { AttendanceRecord, ClassModel, Holiday } from '../../types';
import { ClassService } from './classService';
import { StudentService } from './studentService';
import { getAttendanceRecords } from './attendanceService';
import { calculateMonthlyScheduleRevenue } from './scheduleRevenueService';

export interface TrainingRevenueApiParams {
  /** Năm (mặc định: năm hiện tại) */
  year?: number;
  /** Tháng 1–12 (mặc định: tháng hiện tại) */
  month?: number;
  /** Lọc cơ sở: 'all' | tên cơ sở | 'unassigned' */
  branch?: string;
  /** Lọc một lớp cụ thể */
  classId?: string;
  /** Lịch nghỉ (tùy chọn — mặc định không có) */
  holidays?: Holiday[];
}

export interface TrainingRevenueByClass {
  classId: string;
  className: string;
  branch: string;
  expectedRevenue: number;
  actualRevenue: number;
  variance: number;
  expectedSessions: number;
  actualSessions: number;
  studentCount: number;
}

export interface TrainingRevenueApiResponse {
  period: {
    year: number;
    month: number;
    startDate: string;
    endDate: string;
    label: string;
  };
  /** Doanh thu dự kiến theo TKB */
  expectedRevenue: number;
  /** Doanh thu thực tế theo điểm danh */
  actualRevenue: number;
  /** actual - expected */
  variance: number;
  /** % đạt so với dự kiến (null nếu expected = 0) */
  achievementRate: number | null;
  expectedSessions: number;
  actualSessions: number;
  byClass: TrainingRevenueByClass[];
  fetchedAt: string;
}

const SKIPPED_ATTENDANCE_STATUSES = new Set(['LỊCH NGHỈ CHUNG', 'Chưa điểm danh']);

const formatDateLocal = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getMonthRange = (year: number, month: number) => {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    startDate: formatDateLocal(start),
    endDate: formatDateLocal(end),
    monthDate: start,
    label: `T${month}/${year}`,
  };
};

const parseMoney = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const parsed = Number(value.replace(/[^\d]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const filterClasses = (
  classes: ClassModel[],
  branch: string,
  classId?: string
): ClassModel[] => {
  let result = classes;
  if (classId) {
    result = result.filter((cls) => cls.id === classId);
  }
  if (branch === 'unassigned') {
    result = result.filter((cls) => !cls.branch);
  } else if (branch !== 'all') {
    result = result.filter((cls) => cls.branch === branch);
  }
  return result;
};

/** Tính doanh thu thực tế từ một bản ghi điểm danh */
export const getAttendanceRecordRevenue = (
  record: AttendanceRecord,
  tuitionFee = 0
): number => {
  const storedAmount = Number(record.sessionAmount || 0);
  if (storedAmount > 0) return storedAmount;

  const unitPrice = Number(record.unitPrice || 0) || tuitionFee;
  const billable = Number(record.billableStudents ?? 0);
  if (billable > 0 && unitPrice > 0) return billable * unitPrice;

  const attended = (Number(record.present) || 0) + (Number(record.tutored) || 0);
  if (attended > 0 && unitPrice > 0) return attended * unitPrice;

  return attended > 0 && tuitionFee > 0 ? attended * tuitionFee : 0;
};

const isCountableAttendance = (record: AttendanceRecord) => {
  if (!record.classId || !record.date) return false;
  if (SKIPPED_ATTENDANCE_STATUSES.has(record.status)) return false;

  const hasActivity =
    (Number(record.present) || 0) +
      (Number(record.tutored) || 0) +
      (Number(record.absent) || 0) +
      (Number(record.reserved) || 0) +
      (Number(record.sessionAmount) || 0) >
    0;

  return hasActivity;
};

/**
 * API chính: lấy tổng doanh thu dự kiến và thực tế theo tháng.
 */
export async function getTrainingRevenueSummary(
  params: TrainingRevenueApiParams = {}
): Promise<TrainingRevenueApiResponse> {
  const now = new Date();
  const year = params.year ?? now.getFullYear();
  const month = params.month ?? now.getMonth() + 1;
  const branch = params.branch ?? 'all';
  const { startDate, endDate, monthDate, label } = getMonthRange(year, month);

  const [allClasses, allStudents, attendanceRecords] = await Promise.all([
    ClassService.getClasses(),
    StudentService.getStudents(),
    getAttendanceRecords({ startDate, endDate }),
  ]);

  const classes = filterClasses(allClasses, branch, params.classId);
  const classMap = new Map(classes.map((cls) => [cls.id, cls]));
  const classIds = new Set(classes.map((cls) => cls.id));

  const studentRows = allStudents.map((student) => ({
    id: student.id,
    classId: student.classId,
    class: student.class,
    className: student.className || student.class,
    classIds: student.classIds,
    status: student.status,
  }));

  const scheduleEstimate = calculateMonthlyScheduleRevenue({
    classes,
    students: studentRows,
    monthDate,
    holidays: params.holidays ?? [],
  });

  const expectedByClass = new Map(
    scheduleEstimate.byClass.map((item) => [item.classId, item])
  );

  const actualByClass = new Map<
    string,
    { actualRevenue: number; actualSessions: number }
  >();

  let actualRevenue = 0;
  let actualSessions = 0;

  attendanceRecords.forEach((record) => {
    if (!isCountableAttendance(record)) return;
    if (!classIds.has(record.classId)) return;
    if (record.date < startDate || record.date > endDate) return;

    const cls = classMap.get(record.classId);
    const amount = getAttendanceRecordRevenue(record, parseMoney(cls?.tuitionFee));
    if (amount <= 0) return;

    actualRevenue += amount;
    actualSessions += 1;

    const current = actualByClass.get(record.classId) || {
      actualRevenue: 0,
      actualSessions: 0,
    };
    current.actualRevenue += amount;
    current.actualSessions += 1;
    actualByClass.set(record.classId, current);
  });

  const allClassIds = new Set([
    ...expectedByClass.keys(),
    ...actualByClass.keys(),
  ]);

  const byClass: TrainingRevenueByClass[] = Array.from(allClassIds)
    .map((classId) => {
      const cls = classMap.get(classId);
      const expected = expectedByClass.get(classId);
      const actual = actualByClass.get(classId);
      const expectedRevenue = expected?.revenue ?? 0;
      const actualRevenueValue = actual?.actualRevenue ?? 0;

      return {
        classId,
        className: cls?.name || expected?.className || 'Không rõ',
        branch: cls?.branch || '',
        expectedRevenue,
        actualRevenue: actualRevenueValue,
        variance: actualRevenueValue - expectedRevenue,
        expectedSessions: expected?.sessionCount ?? 0,
        actualSessions: actual?.actualSessions ?? 0,
        studentCount: expected?.studentCount ?? 0,
      };
    })
    .sort(
      (a, b) =>
        b.expectedRevenue + b.actualRevenue - (a.expectedRevenue + a.actualRevenue)
    );

  const expectedRevenue = scheduleEstimate.totalEstimatedRevenue;
  const variance = actualRevenue - expectedRevenue;

  return {
    period: { year, month, startDate, endDate, label },
    expectedRevenue,
    actualRevenue,
    variance,
    achievementRate:
      expectedRevenue > 0 ? (actualRevenue / expectedRevenue) * 100 : null,
    expectedSessions: scheduleEstimate.totalSessions,
    actualSessions,
    byClass,
    fetchedAt: new Date().toISOString(),
  };
}
