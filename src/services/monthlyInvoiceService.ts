import { supabase } from '../config/supabase';
import { Invoice } from './invoiceService';
import { createAttendancePriceResolver } from './attendancePricingService';

export type CalculationMethod = 'per_session' | 'fixed_monthly';

interface ClassInfo {
  id: string;
  name: string;
  tuitionFee: number;
  totalSessions: number;
}

type AttendanceInvoiceRow = {
  student_id: string;
  student_name: string;
  class_id: string | null;
  class_name: string | null;
  date: string | null;
  status: string | null;
};

type AttendanceClassSummary = {
  attendedCount: number;
  attendanceAmount: number;
};

export const generateMonthlyInvoicesPreview = async (
  month: number,
  year: number,
  method: CalculationMethod
): Promise<Omit<Invoice, 'id' | 'invoiceCode'>[]> => {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { data: attendanceData, error: attendanceError } = await supabase
    .from('student_attendance')
    .select('student_id, student_name, class_id, class_name, date, status')
    .gte('date', startDate)
    .lte('date', endDate)
    .in('status', ['ÄÃºng giá»', 'Trá»… giá»', 'ÄÃ£ bá»“i']);

  if (attendanceError) {
    throw new Error('Lá»—i khi táº£i dá»¯ liá»‡u Ä‘iá»ƒm danh: ' + attendanceError.message);
  }

  const attendanceRows = (attendanceData || []) as AttendanceInvoiceRow[];
  if (attendanceRows.length === 0) {
    return [];
  }

  const classIds = [...new Set(attendanceRows.map((a) => a.class_id).filter(Boolean))] as string[];
  const { data: classData, error: classError } = await supabase
    .from('classes')
    .select('id, name, tuition_fee, total_sessions')
    .in('id', classIds);

  if (classError) {
    throw new Error('Lá»—i khi táº£i dá»¯ liá»‡u lá»›p há»c: ' + classError.message);
  }

  const classMap = new Map<string, ClassInfo>();
  (classData || []).forEach((c) => {
    classMap.set(c.id, {
      id: c.id,
      name: c.name,
      tuitionFee: c.tuition_fee || 0,
      totalSessions: c.total_sessions || 1,
    });
  });

  const resolveUnitPrice = await createAttendancePriceResolver(attendanceRows, classData || []);
  const studentMap = new Map<string, { studentName: string; classes: Map<string, AttendanceClassSummary> }>();

  attendanceRows.forEach((record) => {
    if (!record.class_id) return;

    if (!studentMap.has(record.student_id)) {
      studentMap.set(record.student_id, {
        studentName: record.student_name,
        classes: new Map<string, AttendanceClassSummary>(),
      });
    }

    const studentInfo = studentMap.get(record.student_id)!;
    const current = studentInfo.classes.get(record.class_id) || { attendedCount: 0, attendanceAmount: 0 };
    studentInfo.classes.set(record.class_id, {
      attendedCount: current.attendedCount + 1,
      attendanceAmount: current.attendanceAmount + resolveUnitPrice(record),
    });
  });

  const invoices: Omit<Invoice, 'id' | 'invoiceCode'>[] = [];

  studentMap.forEach((info, studentId) => {
    const items: any[] = [];
    let subtotal = 0;

    info.classes.forEach((attendanceSummary, classId) => {
      const cls = classMap.get(classId);
      if (!cls) return;

      let amount = 0;
      let note = '';
      if (method === 'per_session') {
        amount = Math.round(attendanceSummary.attendanceAmount);
        note = `Há»c phÃ­ lá»›p ${cls.name} (${attendanceSummary.attendedCount} buá»•i)`;
      } else {
        amount = cls.tuitionFee;
        note = `Há»c phÃ­ lá»›p ${cls.name} (thÃ¡ng ${month}/${year})`;
      }

      if (amount >= 0) {
        items.push({
          productId: classId,
          productName: note,
          quantity: 1,
          unitPrice: amount,
          total: amount,
        });
        subtotal += amount;
      }
    });

    if (items.length > 0) {
      invoices.push({
        customerName: info.studentName,
        studentId,
        studentName: info.studentName,
        items,
        subtotal,
        discount: 0,
        total: subtotal,
        status: 'Chá» thanh toÃ¡n',
        paymentMethod: 'Tiá»n máº·t',
        note: `HÃ³a Ä‘Æ¡n há»c phÃ­ thÃ¡ng ${month}/${year}`,
        createdBy: 'Há»‡ thá»‘ng',
      });
    }
  });

  return invoices;
};
