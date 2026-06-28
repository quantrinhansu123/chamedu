/**
 * Session Service — Supabase (class_sessions)
 */

import { supabase } from '../config/supabase';

export interface ClassSession {
  id?: string;
  classId: string;
  className: string;
  sessionNumber: number;
  date: string;
  dayOfWeek: string;
  time?: string;
  room?: string;
  teacherId?: string;
  teacherName?: string;
  status: 'Chưa học' | 'Đã học' | 'Nghỉ' | 'Học bù';
  attendanceId?: string;
  holidayId?: string;
  holidayName?: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

type SessionRow = {
  id: string;
  class_id: string;
  class_name: string | null;
  session_number: number;
  date: string;
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  teacher: string | null;
  assistant: string | null;
  room: string | null;
  status: string | null;
  attendance_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

const DAY_MAP: Record<string, number> = {
  'chủ nhật': 0, cn: 0,
  'thứ 2': 1, 'thứ hai': 1, t2: 1,
  'thứ 3': 2, 'thứ ba': 2, t3: 2,
  'thứ 4': 3, 'thứ tư': 3, t4: 3,
  'thứ 5': 4, 'thứ năm': 4, t5: 4,
  'thứ 6': 5, 'thứ sáu': 5, t6: 5,
  'thứ 7': 6, 'thứ bảy': 6, t7: 6,
};

const DAY_NAMES = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toDateOnly = (value: string): string => (value.length >= 10 ? value.slice(0, 10) : value);

const mapRow = (row: SessionRow): ClassSession => {
  const meta = row.metadata || {};
  const time =
    row.start_time && row.end_time
      ? `${row.start_time}-${row.end_time}`
      : row.start_time || undefined;
  return {
    id: row.id,
    classId: row.class_id,
    className: row.class_name || '',
    sessionNumber: row.session_number,
    date: row.date,
    dayOfWeek:
      typeof row.day_of_week === 'number' ? DAY_NAMES[row.day_of_week] : String(row.day_of_week || ''),
    time,
    room: row.room || undefined,
    teacherName: row.teacher || undefined,
    status: (row.status as ClassSession['status']) || 'Chưa học',
    attendanceId: row.attendance_id || undefined,
    holidayId: meta.holidayId as string | undefined,
    holidayName: meta.holidayName as string | undefined,
    note: meta.note as string | undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const toInsert = (session: ClassSession) => {
  const [start, end] = (session.time || '').split('-').map((s) => s.trim());
  return {
    class_id: session.classId,
    class_name: session.className,
    session_number: session.sessionNumber,
    date: session.date,
    day_of_week: DAY_NAMES.findIndex((d) => d === session.dayOfWeek),
    start_time: start || null,
    end_time: end || null,
    teacher: session.teacherName || null,
    room: session.room || null,
    status: session.status,
    attendance_id: session.attendanceId || null,
    metadata: {
      holidayId: session.holidayId,
      holidayName: session.holidayName,
      note: session.note,
      teacherId: session.teacherId,
    },
  };
};

export const parseScheduleDays = (schedule: string): number[] => {
  if (!schedule) return [];
  const scheduleLower = schedule.toLowerCase();
  const days: Set<number> = new Set();
  for (const [dayName, dayNum] of Object.entries(DAY_MAP)) {
    if (scheduleLower.includes(dayName)) days.add(dayNum);
  }
  const numberMatches = schedule.match(/\b([2-7])\b/g);
  if (numberMatches) {
    numberMatches.forEach((num) => {
      const n = parseInt(num, 10);
      if (n === 7) days.add(6);
      else if (n >= 2 && n <= 6) days.add(n - 1);
    });
  }
  return Array.from(days).sort();
};

export const parseScheduleTime = (schedule: string): string | null => {
  const match = schedule.match(/(\d{1,2})[h:](\d{0,2})\s*[-–]\s*(\d{1,2})[h:](\d{0,2})/i);
  if (!match) return null;
  const pad = (h: string, m: string) => `${h.padStart(2, '0')}:${(m || '00').padStart(2, '0')}`;
  return `${pad(match[1], match[2])}-${pad(match[3], match[4])}`;
};

export const generateSessionsForClass = async (
  classData: {
    id: string;
    name: string;
    schedule?: string;
    startDate?: string;
    endDate?: string;
    room?: string;
    teacherId?: string;
    teacherName?: string;
    totalSessions?: number;
  },
  options?: { fromDate?: Date; toDate?: Date; maxSessions?: number }
): Promise<ClassSession[]> => {
  const { schedule, startDate, endDate } = classData;
  if (!schedule) return [];
  const scheduleDays = parseScheduleDays(schedule);
  if (scheduleDays.length === 0) return [];
  const time = parseScheduleTime(schedule);
  const fromDate = options?.fromDate || (startDate ? parseLocalDate(startDate) : new Date());
  const toDate =
    options?.toDate ||
    (endDate ? parseLocalDate(endDate) : new Date(fromDate.getTime() + 90 * 24 * 60 * 60 * 1000));
  const maxSessions = options?.maxSessions || classData.totalSessions || 50;
  const sessions: ClassSession[] = [];
  let currentDate = new Date(fromDate);
  let sessionNumber = 1;
  while (currentDate <= toDate && sessionNumber <= maxSessions) {
    const dayOfWeek = currentDate.getDay();
    if (scheduleDays.includes(dayOfWeek)) {
      sessions.push({
        classId: classData.id,
        className: classData.name,
        sessionNumber,
        date: formatLocalDate(currentDate),
        dayOfWeek: DAY_NAMES[dayOfWeek],
        time: time || undefined,
        room: classData.room,
        teacherId: classData.teacherId,
        teacherName: classData.teacherName,
        status: 'Chưa học',
        createdAt: new Date().toISOString(),
      });
      sessionNumber++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return sessions;
};

export const saveSessionsToFirestore = async (sessions: ClassSession[]): Promise<number> => {
  if (!sessions.length) return 0;
  const rows = sessions.map(toInsert);
  const { error } = await supabase.from('class_sessions').insert(rows);
  if (error) throw error;
  return sessions.length;
};

export const getSessionsByClass = async (
  classId: string,
  options?: {
    status?: ClassSession['status'];
    fromDate?: string;
    toDate?: string;
    limit?: number;
  }
): Promise<ClassSession[]> => {
  const { data, error } = await supabase.from('class_sessions').select('*').eq('class_id', classId);
  if (error) throw error;
  let sessions = (data as SessionRow[]).map(mapRow).filter((s) => s.sessionNumber > 0);
  sessions.sort((a, b) => a.date.localeCompare(b.date));
  if (options?.status) sessions = sessions.filter((s) => s.status === options.status);
  if (options?.fromDate) sessions = sessions.filter((s) => s.date >= options.fromDate!);
  if (options?.toDate) sessions = sessions.filter((s) => s.date <= options.toDate!);
  if (options?.limit) sessions = sessions.slice(0, options.limit);
  return sessions;
};

export const getUpcomingSessions = async (classId: string, limit = 10): Promise<ClassSession[]> =>
  getSessionsByClass(classId, { status: 'Chưa học', limit });

export const getAllPendingSessions = async (options?: {
  classIds?: string[];
  fromDate?: string;
  toDate?: string;
}): Promise<ClassSession[]> => {
  const today = options?.fromDate || formatLocalDate(new Date());
  const { data, error } = await supabase
    .from('class_sessions')
    .select('*')
    .eq('status', 'Chưa học')
    .gte('date', today)
    .order('date', { ascending: true });
  if (error) throw error;
  let sessions = (data as SessionRow[]).map(mapRow);
  if (options?.classIds?.length) {
    sessions = sessions.filter((s) => options.classIds!.includes(s.classId));
  }
  if (options?.toDate) sessions = sessions.filter((s) => s.date <= options.toDate!);
  return sessions;
};

export const updateSessionStatus = async (
  sessionId: string,
  status: ClassSession['status'],
  attendanceId?: string
): Promise<void> => {
  const { error } = await supabase
    .from('class_sessions')
    .update({ status, attendance_id: attendanceId || null })
    .eq('id', sessionId);
  if (error) throw error;
};

export const deleteSessionsByClass = async (classId: string): Promise<number> => {
  const { data, error } = await supabase.from('class_sessions').select('id').eq('class_id', classId);
  if (error) throw error;
  if (!data?.length) return 0;
  const { error: delError } = await supabase.from('class_sessions').delete().eq('class_id', classId);
  if (delError) throw delError;
  return data.length;
};

export const renumberSessionsByDate = async (classId: string): Promise<number> => {
  const sessions = await getSessionsByClass(classId);
  let updateCount = 0;
  for (let i = 0; i < sessions.length; i++) {
    const correct = i + 1;
    if (sessions[i].sessionNumber !== correct && sessions[i].id) {
      const { error } = await supabase
        .from('class_sessions')
        .update({ session_number: correct })
        .eq('id', sessions[i].id!);
      if (error) throw error;
      updateCount++;
    }
  }
  return updateCount;
};

export const getSessionByClassAndDate = async (
  classId: string,
  date: string
): Promise<ClassSession | null> => {
  const { data, error } = await supabase
    .from('class_sessions')
    .select('*')
    .eq('class_id', classId)
    .eq('date', date)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as SessionRow) : null;
};

export const getSessionsByDate = async (date: string): Promise<ClassSession[]> => {
  const { data, error } = await supabase
    .from('class_sessions')
    .select('*')
    .eq('date', toDateOnly(date));
  if (error) throw error;
  return (data as SessionRow[]).map(mapRow);
};

export const createReviewSession = async (params: {
  classId: string;
  className: string;
  date: string;
  time?: string;
  room?: string;
  note?: string;
  createdBy?: string;
}): Promise<string> => {
  const sessions = await getSessionsByClass(params.classId);
  const maxSessionNum = sessions.reduce((max, s) => Math.max(max, s.sessionNumber || 0), 0);
  const dayOfWeek = parseLocalDate(params.date).getDay();
  const session: ClassSession = {
    classId: params.classId,
    className: params.className,
    sessionNumber: maxSessionNum + 1,
    date: params.date,
    dayOfWeek: DAY_NAMES[dayOfWeek],
    time: params.time,
    room: params.room,
    status: 'Chưa học',
    note: params.note || 'Tạo tự động từ Rà soát điểm danh',
    createdAt: new Date().toISOString(),
  };
  const meta = {
    holidayId: session.holidayId,
    holidayName: session.holidayName,
    note: session.note,
    teacherId: session.teacherId,
    createdBy: params.createdBy || 'Lễ tân',
  };
  const { data, error } = await supabase
    .from('class_sessions')
    .insert({ ...toInsert(session), metadata: meta })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
};

export const addMakeupSession = async (
  classData: { id: string; name: string; teacherId?: string; teacherName?: string; room?: string },
  date: string,
  time?: string,
  note?: string
): Promise<string> => {
  const dayOfWeek = parseLocalDate(date).getDay();
  const sessions = await getSessionsByClass(classData.id);
  const maxSessionNum = sessions.reduce((max, s) => Math.max(max, s.sessionNumber || 0), 0);
  const session: ClassSession = {
    classId: classData.id,
    className: classData.name,
    sessionNumber: maxSessionNum + 1,
    date,
    dayOfWeek: DAY_NAMES[dayOfWeek],
    time,
    room: classData.room,
    teacherId: classData.teacherId,
    teacherName: classData.teacherName,
    status: 'Học bù',
    note: note || 'Buổi học bù',
    createdAt: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('class_sessions').insert(toInsert(session)).select('id').single();
  if (error) throw error;
  return data.id;
};
