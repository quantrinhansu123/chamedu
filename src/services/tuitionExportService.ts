import { supabase } from '../config/supabase';
import { AttendanceStatus, isBillableAttendanceStatus } from '../../types';
import { createAttendancePriceResolver } from './attendancePricingService';

type TuitionAttendanceRow = {
  id: string;
  student_id: string | null;
  student_name: string | null;
  student_code: string | null;
  class_id: string | null;
  class_name: string | null;
  date: string | null;
  session_number: number | null;
  status: string | null;
};

export interface MonthlyTuitionSummary {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  month: number;
  year: number;
  totalSessions: number;
  billableSessions: number;
  absentSessions: number;
  reservedSessions: number;
  tutoredSessions: number;
  unitPrice: number;
  totalAmount: number;
  rows: Array<{
    id: string;
    date: string;
    sessionNumber?: number;
    status: string;
    unitPrice: number;
    amount: number;
  }>;
}

const ABSENT_STATUSES = new Set<string>([AttendanceStatus.ABSENT, 'Vắng']);
const RESERVED_STATUSES = new Set<string>([
  AttendanceStatus.RESERVED,
  'Bảo lưu',
  'Nghỉ có phép',
]);
const TUTORED_STATUSES = new Set<string>([AttendanceStatus.TUTORED, 'Đã bồi']);

const toMonthRange = (month: number, year: number) => {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { startDate, endDate };
};

const toDateOnly = (value?: string | null): string => {
  if (!value) return '';
  return value.length >= 10 ? value.slice(0, 10) : value;
};

export async function getMonthlyTuitionSummary(params: {
  classId: string;
  studentId: string;
  month: number;
  year: number;
}): Promise<MonthlyTuitionSummary> {
  const { startDate, endDate } = toMonthRange(params.month, params.year);

  const { data: attendanceData, error: attendanceError } = await supabase
    .from('student_attendance')
    .select('id,student_id,student_name,student_code,class_id,class_name,date,session_number,status')
    .eq('class_id', params.classId)
    .eq('student_id', params.studentId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (attendanceError) {
    throw new Error('Không thể tải dữ liệu điểm danh học phí: ' + attendanceError.message);
  }

  const rows = ((attendanceData || []) as TuitionAttendanceRow[]).map((row) => ({
    ...row,
    date: toDateOnly(row.date),
  }));

  const { data: classData, error: classError } = await supabase
    .from('classes')
    .select('id,name,tuition_fee,total_sessions')
    .eq('id', params.classId)
    .maybeSingle();

  if (classError) {
    throw new Error('Không thể tải dữ liệu lớp học: ' + classError.message);
  }

  const classFallback = classData
    ? [{
        id: classData.id,
        tuition_fee: classData.tuition_fee || 0,
        total_sessions: classData.total_sessions || 1,
      }]
    : [];

  const resolveUnitPrice = await createAttendancePriceResolver(rows, classFallback);
  const detailRows = rows.map((row) => {
    const unitPrice = Math.round(resolveUnitPrice(row));
    const amount = isBillableAttendanceStatus(row.status) ? unitPrice : 0;
    return {
      id: row.id,
      date: row.date || '',
      sessionNumber: row.session_number ?? undefined,
      status: row.status || '',
      unitPrice,
      amount,
    };
  });

  const billableSessions = detailRows.filter((row) => row.amount > 0).length;
  const absentSessions = rows.filter((row) => ABSENT_STATUSES.has(row.status || '')).length;
  const reservedSessions = rows.filter((row) => RESERVED_STATUSES.has(row.status || '')).length;
  const tutoredSessions = rows.filter((row) => TUTORED_STATUSES.has(row.status || '')).length;
  const totalAmount = detailRows.reduce((sum, row) => sum + row.amount, 0);
  const firstBillableRow = detailRows.find((row) => row.unitPrice > 0);

  return {
    studentId: params.studentId,
    studentName: rows[0]?.student_name || '',
    classId: params.classId,
    className: classData?.name || rows[0]?.class_name || '',
    month: params.month,
    year: params.year,
    totalSessions: rows.length,
    billableSessions,
    absentSessions,
    reservedSessions,
    tutoredSessions,
    unitPrice: firstBillableRow?.unitPrice || 0,
    totalAmount,
    rows: detailRows,
  };
}
