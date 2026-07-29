import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export type TrainingRevenueParams = {
  year?: number;
  month?: number;
  branch?: string;
  classId?: string;
};

type ClassRow = {
  id: string;
  name: string;
  branch: string | null;
  schedule: string | null;
  schedule_details: unknown;
  status: string | null;
  tuition_fee: number | null;
  student_ids: string[] | null;
};

type StudentRow = {
  id: string;
  class_id: string | null;
  class_name: string | null;
  class_ids: string[] | null;
  status: string | null;
};

type AttendanceRow = {
  class_id: string | null;
  class_name: string | null;
  date: string | null;
  present: number | null;
  absent: number | null;
  reserved: number | null;
  tutored: number | null;
  unit_price: number | null;
  billable_students: number | null;
  session_amount: number | null;
  status: string | null;
};

const SKIPPED_STATUSES = new Set(['LỊCH NGHỈ CHUNG', 'Chưa điểm danh']);

const normalizeText = (value?: string | null) =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();

const formatDateLocal = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

const parseScheduleDays = (schedule: string): number[] => {
  const days: number[] = [];
  if (!schedule) return days;
  const thuMatches = schedule.match(/Thứ\s*(\d)/gi);
  thuMatches?.forEach((match) => {
    const num = parseInt(match.replace(/Thứ\s*/i, ''), 10);
    if (num >= 2 && num <= 7 && !days.includes(num)) days.push(num);
  });
  const tMatches = schedule.match(/T(\d)/gi);
  tMatches?.forEach((match) => {
    const num = parseInt(match.replace(/T/i, ''), 10);
    if (num >= 2 && num <= 7 && !days.includes(num)) days.push(num);
  });
  if (/chủ\s*nhật|cn/i.test(schedule) && !days.includes(8)) days.push(8);
  return days.sort((a, b) => a - b);
};

const parseDaysFromScheduleText = (schedule: string): string[] => {
  const days: string[] = [];
  if (!schedule) return days;
  if (/chủ\s*nhật|cn/i.test(schedule)) days.push('CN');
  for (let i = 2; i <= 7; i++) {
    if (
      schedule.includes(`Thứ ${i}`) ||
      schedule.includes(`T${i}`) ||
      schedule.match(new RegExp(`(?:^|[,\\s])${i}(?:[,\\s]|$)`))
    ) {
      if (!days.includes(String(i))) days.push(String(i));
    }
  }
  if (days.length > 0) {
    return days.sort((a, b) => {
      if (a === 'CN') return 1;
      if (b === 'CN') return -1;
      return parseInt(a, 10) - parseInt(b, 10);
    });
  }
  return parseScheduleDays(schedule).map((day) => (day === 8 ? 'CN' : String(day)));
};

const scheduleDayKeyToNumber = (day: string) => (day === 'CN' ? 8 : parseInt(day, 10));

const getClassGridDayNumbers = (cls: ClassRow): number[] => {
  const details = cls.schedule_details;
  if (Array.isArray(details) && details.length > 0) {
    return details
      .map((item: { dayOfWeek?: string }) => scheduleDayKeyToNumber(String(item.dayOfWeek || '')))
      .filter((n) => n >= 2 && n <= 8);
  }
  return parseDaysFromScheduleText(cls.schedule || '')
    .map(scheduleDayKeyToNumber)
    .filter((n) => n >= 2 && n <= 8);
};

const shouldCountClass = (status?: string | null) => {
  const normalized = normalizeText(status || '');
  return !['tam dung', 'paused', 'inactive', 'ket thuc', 'da ket thuc', 'ended', 'finished', 'completed'].includes(
    normalized
  );
};

const isRevenueStudent = (status?: string | null) => {
  const normalized = normalizeText(status || '');
  if (!normalized) return true;
  return !['inactive', 'nghi hoc', 'da nghi', 'bao luu', 'reserved', 'ended', 'ket thuc', 'da ket thuc'].includes(
    normalized
  );
};

const getClassStudentCount = (cls: ClassRow, students: StudentRow[]) => {
  const matched = students.filter((student) => {
    const inClass =
      student.class_id === cls.id ||
      student.class_name === cls.name ||
      student.class_ids?.includes(cls.id);
    return inClass && isRevenueStudent(student.status);
  });
  if (matched.length > 0) return matched.length;
  return cls.student_ids?.length || 0;
};

const countSessionsOnDate = (cls: ClassRow, date: Date) => {
  if (!shouldCountClass(cls.status)) return 0;
  const dayNumber = date.getDay() === 0 ? 8 : date.getDay() + 1;
  let count = 0;
  getClassGridDayNumbers(cls).forEach((n) => {
    if (n === dayNumber) count += 1;
  });
  return count;
};

const calculateExpected = (classes: ClassRow[], students: StudentRow[], monthDate: Date) => {
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const byClass = new Map<
    string,
    { classId: string; className: string; sessionCount: number; studentCount: number; revenue: number }
  >();
  let totalEstimatedRevenue = 0;
  let totalSessions = 0;

  classes.forEach((cls) => {
    const studentCount = getClassStudentCount(cls, students);
    const tuitionFee = parseMoney(cls.tuition_fee);
    if (!shouldCountClass(cls.status) || tuitionFee <= 0 || studentCount <= 0) return;

    const revenuePerSession = tuitionFee * studentCount;
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const sessionCount = countSessionsOnDate(cls, date);
      if (sessionCount <= 0) continue;
      for (let i = 0; i < sessionCount; i += 1) {
        totalSessions += 1;
        totalEstimatedRevenue += revenuePerSession;
        const current = byClass.get(cls.id) || {
          classId: cls.id,
          className: cls.name,
          sessionCount: 0,
          studentCount,
          revenue: 0,
        };
        current.sessionCount += 1;
        current.revenue += revenuePerSession;
        byClass.set(cls.id, current);
      }
    }
  });

  return {
    totalEstimatedRevenue,
    totalSessions,
    byClass: Array.from(byClass.values()).sort((a, b) => b.revenue - a.revenue),
  };
};

const getAttendanceRevenue = (row: AttendanceRow, tuitionFee = 0) => {
  const stored = Number(row.session_amount || 0);
  if (stored > 0) return stored;
  const unitPrice = Number(row.unit_price || 0) || tuitionFee;
  const billable = Number(row.billable_students ?? 0);
  if (billable > 0 && unitPrice > 0) return billable * unitPrice;
  const attended = (Number(row.present) || 0) + (Number(row.tutored) || 0);
  if (attended > 0 && unitPrice > 0) return attended * unitPrice;
  return attended > 0 && tuitionFee > 0 ? attended * tuitionFee : 0;
};

const filterClasses = (classes: ClassRow[], branch: string, classId?: string) => {
  let result = classes;
  if (classId) result = result.filter((cls) => cls.id === classId);
  if (branch === 'unassigned') result = result.filter((cls) => !cls.branch);
  else if (branch !== 'all') result = result.filter((cls) => cls.branch === branch);
  return result;
};

export async function buildTrainingRevenueSummary(
  supabase: SupabaseClient,
  params: TrainingRevenueParams = {}
) {
  const now = new Date();
  const year = params.year ?? now.getFullYear();
  const month = params.month ?? now.getMonth() + 1;
  const branch = params.branch ?? 'all';
  const { startDate, endDate, monthDate, label } = getMonthRange(year, month);

  const [classesRes, studentsRes, attendanceRes] = await Promise.all([
    supabase
      .from('classes')
      .select('id,name,branch,schedule,schedule_details,status,tuition_fee,student_ids'),
    supabase.from('students').select('id,class_id,class_name,class_ids,status'),
    supabase
      .from('attendance')
      .select(
        'class_id,class_name,date,present,absent,reserved,tutored,unit_price,billable_students,session_amount,status'
      )
      .gte('date', startDate)
      .lte('date', endDate),
  ]);

  if (classesRes.error) throw classesRes.error;
  if (studentsRes.error) throw studentsRes.error;
  if (attendanceRes.error) throw attendanceRes.error;

  const allClasses = (classesRes.data || []) as ClassRow[];
  const students = (studentsRes.data || []) as StudentRow[];
  const classes = filterClasses(allClasses, branch, params.classId);
  const classMap = new Map(classes.map((cls) => [cls.id, cls]));
  const classIds = new Set(classes.map((cls) => cls.id));

  const scheduleEstimate = calculateExpected(classes, students, monthDate);
  const expectedByClass = new Map(scheduleEstimate.byClass.map((item) => [item.classId, item]));
  const actualByClass = new Map<string, { actualRevenue: number; actualSessions: number }>();

  let actualRevenue = 0;
  let actualSessions = 0;

  ((attendanceRes.data || []) as AttendanceRow[]).forEach((row) => {
    if (!row.class_id || !row.date) return;
    if (SKIPPED_STATUSES.has(row.status || '')) return;
    if (!classIds.has(row.class_id)) return;
    if (row.date < startDate || row.date > endDate) return;

    const cls = classMap.get(row.class_id);
    const amount = getAttendanceRevenue(row, parseMoney(cls?.tuition_fee));
    if (amount <= 0) return;

    actualRevenue += amount;
    actualSessions += 1;
    const current = actualByClass.get(row.class_id) || { actualRevenue: 0, actualSessions: 0 };
    current.actualRevenue += amount;
    current.actualSessions += 1;
    actualByClass.set(row.class_id, current);
  });

  const allClassIds = new Set([...expectedByClass.keys(), ...actualByClass.keys()]);
  const byClass = Array.from(allClassIds)
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
    .sort((a, b) => b.expectedRevenue + b.actualRevenue - (a.expectedRevenue + a.actualRevenue));

  const expectedRevenue = scheduleEstimate.totalEstimatedRevenue;
  return {
    period: { year, month, startDate, endDate, label },
    expectedRevenue,
    actualRevenue,
    variance: actualRevenue - expectedRevenue,
    achievementRate: expectedRevenue > 0 ? (actualRevenue / expectedRevenue) * 100 : null,
    expectedSessions: scheduleEstimate.totalSessions,
    actualSessions,
    byClass,
    fetchedAt: new Date().toISOString(),
  };
}
