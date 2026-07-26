/**
 * Attendance Service — Supabase
 */

import { supabase } from '../config/supabase';
import { AttendanceRecord, StudentAttendance, AttendanceStatus, StudentStatus, isExcusedAttendanceStatus, isSessionRevenueAttendanceStatus } from '../../types';

type AttendanceRow = {
  id: string;
  class_id: string;
  class_name: string;
  date: string;
  session_number: number | null;
  session_id: string | null;
  total_students: number;
  present: number;
  absent: number;
  reserved: number;
  tutored: number;
  unit_price: number | null;
  billable_students: number | null;
  session_amount: number | null;
  status: string;
  holiday_id: string | null;
  holiday_name: string | null;
  attendance_type: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type StudentAttendanceRow = {
  id: string;
  attendance_id: string | null;
  session_id: string | null;
  student_id: string;
  student_name: string;
  student_code: string | null;
  class_id: string | null;
  class_name: string | null;
  date: string | null;
  session_number: number | null;
  status: string;
  note: string | null;
  attitude_comment: string | null;
  attention_card: string | null;
  homework_completion: number | null;
  test_name: string | null;
  score: number | null;
  bonus_points: number | null;
  punctuality: string | null;
  is_late: boolean | null;
  attendance_type: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

const PRESENT_STATUSES = [
  AttendanceStatus.ON_TIME,
  AttendanceStatus.LATE,
  AttendanceStatus.TUTORED,
  'Có mặt',
  'Đến trễ',
  'Đi trễ',
  'Đã bồi',
];

const toDateOnly = (value?: string | null): string | null => {
  if (!value) return null;
  return value.length >= 10 ? value.slice(0, 10) : value;
};

const mapAttendanceRow = (row: AttendanceRow): AttendanceRecord => ({
  id: row.id,
  classId: row.class_id,
  className: row.class_name,
  date: toDateOnly(row.date) || row.date,
  sessionNumber: row.session_number,
  sessionId: row.session_id,
  totalStudents: row.total_students,
  present: row.present,
  absent: row.absent,
  reserved: row.reserved,
  tutored: row.tutored,
  unitPrice: row.unit_price ?? 0,
  billableStudents: row.billable_students ?? row.present,
  sessionAmount: row.session_amount ?? 0,
  status: row.status as AttendanceRecord['status'],
  holidayId: row.holiday_id || undefined,
  holidayName: row.holiday_name || undefined,
  attendanceType: (row.attendance_type as AttendanceRecord['attendanceType']) || undefined,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapStudentAttendanceRow = (row: StudentAttendanceRow): StudentAttendance => {
  const meta = (row.metadata as Record<string, unknown>) || {};
  return {
    id: row.id,
    attendanceId: row.attendance_id || '',
    sessionId: row.session_id || undefined,
    studentId: row.student_id,
    studentName: row.student_name,
    studentCode: row.student_code || '',
    classId: row.class_id || undefined,
    className: row.class_name || undefined,
    date: toDateOnly(row.date) || undefined,
    sessionNumber: row.session_number ?? undefined,
    status: row.status as AttendanceStatus,
    note: row.note || undefined,
    attitudeComment: row.attitude_comment || undefined,
    attentionCard: row.attention_card || undefined,
    lessonExerciseTags: meta.lessonExerciseTags
      ? JSON.stringify(meta.lessonExerciseTags)
      : undefined,
    checkExerciseTags: meta.checkExerciseTags
      ? JSON.stringify(meta.checkExerciseTags)
      : undefined,
    task: typeof meta.task === 'string' ? meta.task : undefined,
    homeworkCompletion: row.homework_completion ?? undefined,
    testName: row.test_name || undefined,
    score: row.score ?? undefined,
    bonusPoints: row.bonus_points ?? undefined,
    punctuality: (row.punctuality as StudentAttendance['punctuality']) || undefined,
    isLate: row.is_late ?? undefined,
    attendanceType: (row.attendance_type as StudentAttendance['attendanceType']) || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const attendanceToInsert = (data: Omit<AttendanceRecord, 'id'>) => ({
  class_id: data.classId,
  class_name: data.className?.trim() || data.className,
  date: toDateOnly(data.date),
  session_number: data.sessionNumber ?? null,
  session_id: data.sessionId ?? null,
  total_students: data.totalStudents,
  present: data.present,
  absent: data.absent,
  reserved: data.reserved,
  tutored: data.tutored,
  unit_price: data.unitPrice ?? 0,
  billable_students: data.billableStudents ?? data.present,
  session_amount: data.sessionAmount ?? (data.unitPrice ?? 0) * (data.billableStudents ?? data.present),
  status: data.status,
  holiday_id: data.holidayId || null,
  holiday_name: data.holidayName || null,
  attendance_type: data.attendanceType || null,
  created_by: data.createdBy || null,
});

const studentToInsert = (
  attendanceId: string,
  student: Omit<StudentAttendance, 'id' | 'attendanceId'>,
  ctx: {
    classId?: string;
    className?: string;
    date?: string;
    sessionNumber?: number | null;
    sessionId?: string | null;
    attendanceType?: 'session' | 'makeup' | 'manual';
  }
) => {
  const row: Record<string, unknown> = {
    attendance_id: attendanceId,
    student_id: student.studentId,
    student_name: student.studentName,
    student_code: student.studentCode || null,
    class_id: ctx.classId || null,
    class_name: ctx.className || null,
    date: toDateOnly(ctx.date),
    session_number: ctx.sessionNumber ?? null,
    session_id: ctx.sessionId ?? null,
    status: student.status,
  };
  if (ctx.attendanceType) row.attendance_type = ctx.attendanceType;
  if (student.note) row.note = student.note;
  if (student.attitudeComment) row.attitude_comment = student.attitudeComment;
  if (student.attentionCard) row.attention_card = student.attentionCard;
  if (student.homeworkCompletion !== undefined) row.homework_completion = student.homeworkCompletion;
  if (student.testName) row.test_name = student.testName;
  if (student.score !== undefined) row.score = student.score;
  if (student.bonusPoints !== undefined) row.bonus_points = student.bonusPoints;
  if (student.punctuality) row.punctuality = student.punctuality;
  if (student.isLate !== undefined) row.is_late = student.isLate;
  const metadata: Record<string, unknown> = {};
  if ((student as { lessonExerciseTags?: string }).lessonExerciseTags) {
    try {
      metadata.lessonExerciseTags = JSON.parse((student as { lessonExerciseTags?: string }).lessonExerciseTags || '');
    } catch {
      metadata.lessonExerciseTags = (student as { lessonExerciseTags?: string }).lessonExerciseTags;
    }
  }
  if (student.checkExerciseTags) {
    try {
      metadata.checkExerciseTags = JSON.parse(student.checkExerciseTags);
    } catch {
      metadata.checkExerciseTags = student.checkExerciseTags;
    }
  }
  if (student.task !== undefined) {
    metadata.task = student.task.trim();
  }
  if (Object.keys(metadata).length > 0) row.metadata = metadata;
  return row;
};

export const createAttendanceRecord = async (data: Omit<AttendanceRecord, 'id'>): Promise<string> => {
  const { data: inserted, error } = await supabase
    .from('attendance')
    .insert(attendanceToInsert(data))
    .select('id')
    .single();
  if (error) throw new Error('Không thể tạo bản ghi điểm danh: ' + error.message);
  return inserted.id;
};

export const getAttendanceRecord = async (id: string): Promise<AttendanceRecord | null> => {
  const { data, error } = await supabase.from('attendance').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error('Không thể tải bản ghi điểm danh: ' + error.message);
  return data ? mapAttendanceRow(data as AttendanceRow) : null;
};

export const getAttendanceRecords = async (filters?: {
  classId?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
}): Promise<AttendanceRecord[]> => {
  let q = supabase.from('attendance').select('*').order('date', { ascending: false });
  if (filters?.classId) q = q.eq('class_id', filters.classId);
  if (filters?.date) q = q.eq('date', toDateOnly(filters.date));
  const { data, error } = await q;
  if (error) throw new Error('Không thể tải danh sách điểm danh: ' + error.message);

  let records = (data as AttendanceRow[]).map(mapAttendanceRow);
  if (filters?.startDate) records = records.filter((r) => r.date >= filters.startDate!);
  if (filters?.endDate) records = records.filter((r) => r.date <= filters.endDate!);
  return records;
};

export const checkExistingAttendance = async (
  classId: string,
  date: string
): Promise<AttendanceRecord | null> => {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('class_id', classId)
    .eq('date', toDateOnly(date))
    .maybeSingle();
  if (error) throw new Error('Lỗi kiểm tra điểm danh: ' + error.message);
  return data ? mapAttendanceRow(data as AttendanceRow) : null;
};

export const saveStudentAttendance = async (
  attendanceId: string,
  students: Omit<StudentAttendance, 'id' | 'attendanceId'>[],
  classId?: string,
  className?: string,
  date?: string,
  sessionNumber?: number,
  sessionId?: string,
  attendanceType?: 'session' | 'makeup' | 'manual'
): Promise<Map<string, string>> => {
  if (students.length === 0) return new Map();

  const { error: delError } = await supabase
    .from('student_attendance')
    .delete()
    .eq('attendance_id', attendanceId);
  if (delError) throw new Error('Không thể lưu điểm danh học sinh: ' + delError.message);

  const rows = students.map((student) =>
    studentToInsert(attendanceId, student, {
      classId,
      className,
      date,
      sessionNumber,
      sessionId,
      attendanceType,
    })
  );

  const { data, error } = await supabase.from('student_attendance').insert(rows).select('id, student_id');
  if (error) throw new Error('Không thể lưu điểm danh học sinh: ' + error.message);

  const idMap = new Map<string, string>();
  (data || []).forEach((row: { id: string; student_id: string }) => {
    idMap.set(row.student_id, row.id);
  });
  return idMap;
};

export const getStudentAttendance = async (attendanceId: string): Promise<StudentAttendance[]> => {
  const { data, error } = await supabase
    .from('student_attendance')
    .select('*')
    .eq('attendance_id', attendanceId);
  if (error) throw new Error('Không thể tải điểm danh chi tiết: ' + error.message);
  return (data as StudentAttendanceRow[]).map(mapStudentAttendanceRow);
};

export const getStudentAttendanceBySession = async (sessionId: string): Promise<StudentAttendance[]> => {
  const { data, error } = await supabase
    .from('student_attendance')
    .select('*')
    .eq('session_id', sessionId);
  if (error) throw new Error('Không thể tải điểm danh theo buổi học');
  return (data as StudentAttendanceRow[]).map(mapStudentAttendanceRow);
};

export const getStudentAttendanceByClassAndDate = async (
  classId: string,
  date: string
): Promise<StudentAttendance[]> => {
  const { data, error } = await supabase
    .from('student_attendance')
    .select('*')
    .eq('class_id', classId)
    .eq('date', toDateOnly(date));
  if (error) throw new Error('Không thể tải điểm danh theo ngày');
  return (data as StudentAttendanceRow[]).map(mapStudentAttendanceRow);
};

export const saveReviewStudentAttendance = async (data: {
  sessionId: string;
  classId: string;
  className: string;
  studentId: string;
  studentName: string;
  date: string;
  sessionNumber?: number;
  status: AttendanceStatus | string;
  note?: string;
  checkedBy?: string;
}): Promise<string> => {
  const now = new Date().toISOString();
  const { data: inserted, error } = await supabase
    .from('student_attendance')
    .insert({
      session_id: data.sessionId,
      class_id: data.classId,
      class_name: data.className,
      student_id: data.studentId,
      student_name: data.studentName,
      student_code: null,
      date: toDateOnly(data.date),
      session_number: data.sessionNumber ?? null,
      status: data.status,
      note: data.note || null,
      metadata: {
        checkedAt: now,
        checkedBy: data.checkedBy || 'Lễ tân',
        isReviewed: true,
        reviewedAt: now,
      },
    })
    .select('id')
    .single();
  if (error) throw new Error('Không thể lưu rà soát điểm danh');
  return inserted.id;
};

export const updateAttendanceRecord = async (
  id: string,
  data: Partial<AttendanceRecord>
): Promise<void> => {
  const payload: Record<string, unknown> = {};
  if (data.className !== undefined) payload.class_name = data.className;
  if (data.date !== undefined) payload.date = toDateOnly(data.date);
  if (data.sessionNumber !== undefined) payload.session_number = data.sessionNumber;
  if (data.sessionId !== undefined) payload.session_id = data.sessionId;
  if (data.totalStudents !== undefined) payload.total_students = data.totalStudents;
  if (data.present !== undefined) payload.present = data.present;
  if (data.absent !== undefined) payload.absent = data.absent;
  if (data.reserved !== undefined) payload.reserved = data.reserved;
  if (data.tutored !== undefined) payload.tutored = data.tutored;
  if (data.unitPrice !== undefined) payload.unit_price = data.unitPrice;
  if (data.billableStudents !== undefined) payload.billable_students = data.billableStudents;
  if (data.sessionAmount !== undefined) payload.session_amount = data.sessionAmount;
  if (data.status !== undefined) payload.status = data.status;
  if (data.attendanceType !== undefined) payload.attendance_type = data.attendanceType;
  if (data.createdBy !== undefined) payload.created_by = data.createdBy;

  const { error } = await supabase.from('attendance').update(payload).eq('id', id);
  if (error) throw new Error('Không thể cập nhật bản ghi điểm danh');
};

export const deleteAttendanceRecord = async (id: string): Promise<void> => {
  const { error: studentError } = await supabase
    .from('student_attendance')
    .delete()
    .eq('attendance_id', id);
  if (studentError) throw new Error('Khong the xoa chi tiet diem danh');

  const { error: sessionError } = await supabase
    .from('class_sessions')
    .update({ status: 'Chưa học', attendance_id: null })
    .eq('attendance_id', id);
  if (sessionError) throw new Error('Khong the cap nhat buoi hoc sau khi xoa diem danh');

  const { error } = await supabase.from('attendance').delete().eq('id', id);
  if (error) throw new Error('Khong the xoa ban ghi diem danh');
};

export const findStudentAttendanceRecord = async (
  studentId: string,
  classId: string,
  date: string
): Promise<{ id: string; status: AttendanceStatus } | null> => {
  const { data, error } = await supabase
    .from('student_attendance')
    .select('id, status')
    .eq('student_id', studentId)
    .eq('class_id', classId)
    .eq('date', toDateOnly(date))
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return { id: data.id, status: data.status as AttendanceStatus };
};

export const updateStudentAttendanceStatus = async (
  id: string,
  status: AttendanceStatus
): Promise<void> => {
  const { error } = await supabase.from('student_attendance').update({ status }).eq('id', id);
  if (error) throw new Error('Không thể cập nhật trạng thái điểm danh');
};

export const createTutoringFromAbsent = async (data: {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  absentDate: string;
  type: 'Nghỉ học' | 'Học yếu';
  studentAttendanceId?: string;
}): Promise<string> => {
  try {
    let attendanceId = data.studentAttendanceId;
    if (!attendanceId) {
      const record = await findStudentAttendanceRecord(data.studentId, data.classId, data.absentDate);
      attendanceId = record?.id;
    }

    const now = new Date().toISOString();
    const { data: inserted, error } = await supabase
      .from('tutoring')
      .insert({
        student_id: data.studentId,
        student_name: data.studentName,
        class_id: data.classId,
        class_name: data.className,
        absent_date: toDateOnly(data.absentDate),
        type: data.type,
        status: 'Đã hẹn',
        student_attendance_id: attendanceId || null,
        note: `Vắng buổi học ngày ${new Date(data.absentDate).toLocaleDateString('vi-VN')}`,
        metadata: {
          statusHistory: [
            {
              status: 'Đã hẹn',
              changedAt: now,
              changedBy: 'system',
              reason: 'Auto-created from attendance',
            },
          ],
        },
      })
      .select('id')
      .single();
    if (error) {
      console.warn('[createTutoringFromAbsent] Skipped — tutoring table may not exist:', error.message);
      return '';
    }
    return inserted.id;
  } catch (error) {
    console.warn('[createTutoringFromAbsent] Error:', error);
    return '';
  }
};

export const countStudentAttendedSessions = async (
  studentId: string,
  classId: string
): Promise<number> => {
  const { count, error } = await supabase
    .from('student_attendance')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('class_id', classId)
    .in('status', PRESENT_STATUSES);
  if (error) return 0;
  return count || 0;
};

export const checkAndUpdateStudentDebtStatus = async (
  studentId: string,
  classId: string,
  attendanceId?: string
): Promise<void> => {
  await recalculateStudentStatus(studentId, classId);
};

export const saveFullAttendance = async (
  attendanceData: Omit<AttendanceRecord, 'id'> & { sessionId?: string },
  students: Array<{
    studentId: string;
    studentName: string;
    studentCode: string;
    status: AttendanceStatus;
    note?: string;
    attitudeComment?: string;
    attentionCard?: string;
    lessonExerciseTags?: string;
    checkExerciseTags?: string;
    task?: string;
    homeworkCompletion?: number;
    testName?: string;
    score?: number;
    bonusPoints?: number;
    punctuality?: 'onTime' | 'late' | '';
    isLate?: boolean;
  }>
): Promise<string> => {
  const markedStudents = students.filter((s) => s.status && s.status !== ('' as AttendanceStatus));
  if (markedStudents.length === 0) {
    throw new Error('Vui lòng đánh dấu trạng thái cho ít nhất một học sinh trước khi lưu.');
  }

  const present = markedStudents.filter(
    (s) => s.status === AttendanceStatus.ON_TIME || s.status === AttendanceStatus.LATE
  ).length;
  const absent = markedStudents.filter((s) => s.status === AttendanceStatus.ABSENT).length;
  const reserved = markedStudents.filter((s) => isExcusedAttendanceStatus(s.status)).length;
  const tutored = markedStudents.filter((s) => s.status === AttendanceStatus.TUTORED).length;
  // Nghỉ có phép / Bảo lưu cũ không tính học phí buổi
  const billableStudents = markedStudents.filter((s) => isSessionRevenueAttendanceStatus(s.status)).length;
  const unitPrice = attendanceData.unitPrice ?? 0;
  const sessionAmount = unitPrice * billableStudents;

  const existing = await checkExistingAttendance(attendanceData.classId, attendanceData.date);
  let attendanceId: string;

  if (existing) {
    await updateAttendanceRecord(existing.id, {
      ...attendanceData,
      present,
      absent,
      reserved,
      tutored,
      billableStudents,
      sessionAmount,
      unitPrice,
      status: 'Đã điểm danh',
    });
    attendanceId = existing.id;
  } else {
    attendanceId = await createAttendanceRecord({
      ...attendanceData,
      present,
      absent,
      reserved,
      tutored,
      billableStudents,
      sessionAmount,
      unitPrice,
      status: 'Đã điểm danh',
    });
  }

  const studentAttendanceIdMap = await saveStudentAttendance(
    attendanceId,
    markedStudents,
    attendanceData.classId,
    attendanceData.className,
    attendanceData.date,
    attendanceData.sessionNumber ?? undefined,
    attendanceData.sessionId ?? undefined,
    attendanceData.attendanceType
  );

  const absentStudents = markedStudents.filter((s) => s.status === AttendanceStatus.ABSENT);
  for (const student of absentStudents) {
    await createTutoringFromAbsent({
      studentId: student.studentId,
      studentName: student.studentName,
      classId: attendanceData.classId,
      className: attendanceData.className,
      absentDate: attendanceData.date,
      type: 'Nghỉ học',
      studentAttendanceId: studentAttendanceIdMap.get(student.studentId),
    });
  }

  const uniqueStudentIds = [...new Set(markedStudents.map((s) => s.studentId))];
  for (const studentId of uniqueStudentIds) {
    try {
      await recalculateStudentStatus(studentId, attendanceData.classId);
    } catch (err) {
      console.warn('[saveFullAttendance] recalculateStudentStatus failed:', studentId, err);
    }
  }

  return attendanceId;
};

export const recalculateStudentStatus = async (
  studentId: string,
  classId?: string
): Promise<{ attended: number; registered: number; remaining: number; newStatus: string }> => {
  const { data: row, error } = await supabase.from('students').select('*').eq('id', studentId).maybeSingle();
  if (error || !row) throw new Error('Không tìm thấy học viên');

  const meta = (row.metadata as Record<string, unknown>) || {};
  const registeredSessions = row.registered_sessions || 0;
  const currentStatus = (row.status as StudentStatus) || StudentStatus.ACTIVE;
  const legacyAttended = (meta.legacyAttendedSessions as number) || 0;
  const existingClassProgress = (meta.classProgress as Record<string, unknown>) || {};

  let presentQuery = supabase
    .from('student_attendance')
    .select('*')
    .eq('student_id', studentId)
    .in('status', PRESENT_STATUSES);
  if (classId) presentQuery = presentQuery.eq('class_id', classId);

  const { data: presentRows, error: presentError } = await presentQuery;
  if (presentError) throw presentError;

  const classStats = new Map<string, { sessionAttended: number; makeupAttended: number }>();

  (presentRows as StudentAttendanceRow[]).forEach((record) => {
    const recordClassId = record.class_id || 'unknown';
    if (classId && recordClassId !== classId) return;

    if (!classStats.has(recordClassId)) {
      classStats.set(recordClassId, { sessionAttended: 0, makeupAttended: 0 });
    }
    const stats = classStats.get(recordClassId)!;
    if (record.session_id) {
      stats.sessionAttended++;
    } else {
      stats.sessionAttended++;
      stats.makeupAttended++;
    }
  });

  let totalSessionAttended = 0;
  let totalMakeupAttended = 0;
  classStats.forEach((stats) => {
    totalSessionAttended += stats.sessionAttended;
    totalMakeupAttended += stats.makeupAttended;
  });

  const attendedSessions = classId
    ? classStats.get(classId)?.sessionAttended || 0
    : totalSessionAttended;
  const makeupAttended = classId
    ? classStats.get(classId)?.makeupAttended || 0
    : totalMakeupAttended;
  const remainingSessions = registeredSessions - attendedSessions - legacyAttended;

  let newStatus = currentStatus;
  const updatePayload: Record<string, unknown> = {
    attended_sessions: classId ? attendedSessions : totalSessionAttended,
    remaining_sessions: remainingSessions,
  };

  const updatedClassProgress: Record<string, unknown> = { ...existingClassProgress };

  if (classId) {
    const classRegistered =
      (existingClassProgress[classId] as { registeredSessions?: number })?.registeredSessions ||
      registeredSessions;
    updatedClassProgress[classId] = {
      ...(existingClassProgress[classId] as object),
      registeredSessions: classRegistered,
      attendedSessions,
      makeupDone: (existingClassProgress[classId] as { makeupDone?: number })?.makeupDone || 0,
      makeupOwed: (existingClassProgress[classId] as { makeupOwed?: number })?.makeupOwed || 0,
      absentSessions: (existingClassProgress[classId] as { absentSessions?: number })?.absentSessions || 0,
      reservedSessions:
        (existingClassProgress[classId] as { reservedSessions?: number })?.reservedSessions || 0,
    };
  } else {
    classStats.forEach((stats, recordClassId) => {
      if (recordClassId === 'unknown') return;
      const classRegistered =
        (existingClassProgress[recordClassId] as { registeredSessions?: number })?.registeredSessions ||
        registeredSessions;
      updatedClassProgress[recordClassId] = {
        ...(existingClassProgress[recordClassId] as object),
        registeredSessions: classRegistered,
        attendedSessions: stats.sessionAttended,
        makeupDone: (existingClassProgress[recordClassId] as { makeupDone?: number })?.makeupDone || 0,
        makeupOwed: (existingClassProgress[recordClassId] as { makeupOwed?: number })?.makeupOwed || 0,
        absentSessions:
          (existingClassProgress[recordClassId] as { absentSessions?: number })?.absentSessions || 0,
        reservedSessions:
          (existingClassProgress[recordClassId] as { reservedSessions?: number })?.reservedSessions || 0,
      };
    });
  }

  updatePayload.metadata = {
    ...meta,
    classProgress: updatedClassProgress,
    makeupSessionsAttended: makeupAttended,
  };

  const skipStatuses = [StudentStatus.DROPPED, StudentStatus.RESERVED, StudentStatus.TRIAL];
  if (!skipStatuses.includes(currentStatus) && registeredSessions > 0) {
    if (remainingSessions < 0) {
      newStatus = StudentStatus.DEBT;
      updatePayload.status = StudentStatus.DEBT;
      updatePayload.debt_sessions = Math.abs(remainingSessions);
      if (!meta.debtStartDate) {
        (updatePayload.metadata as Record<string, unknown>).debtStartDate = new Date().toISOString();
      }
    } else if (remainingSessions === 0) {
      newStatus = StudentStatus.EXPIRED_FEE;
      updatePayload.status = StudentStatus.EXPIRED_FEE;
      updatePayload.debt_sessions = 0;
    } else if (currentStatus === StudentStatus.EXPIRED_FEE || currentStatus === StudentStatus.DEBT) {
      newStatus = StudentStatus.ACTIVE;
      updatePayload.status = StudentStatus.ACTIVE;
      updatePayload.debt_sessions = 0;
      (updatePayload.metadata as Record<string, unknown>).debtStartDate = null;
    }
  }

  const { error: updateError } = await supabase.from('students').update(updatePayload).eq('id', studentId);
  if (updateError) throw updateError;

  return {
    attended: attendedSessions,
    registered: registeredSessions,
    remaining: remainingSessions,
    newStatus,
  };
};
