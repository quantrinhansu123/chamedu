/**
 * Feedback Service — Supabase
 */

import { supabase } from '../config/supabase';

export interface FeedbackRecord {
  id?: string;
  date: string;
  type: FeedbackType;
  studentId?: string;
  studentName: string;
  classId?: string;
  className: string;
  teacher?: string;
  teacherScore?: number;
  curriculumScore?: number;
  careScore?: number;
  facilitiesScore?: number;
  averageScore?: number;
  caller?: string;
  content?: string;
  status: FeedbackStatus;
  parentId?: string;
  parentName?: string;
  parentPhone?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type FeedbackType = 'Call' | 'Form';
export type FeedbackStatus = string;

export const DEFAULT_CALL_STATUSES = ['Hài lòng', 'Không hài lòng'] as const;

type FeedbackRow = {
  id: string;
  date: string;
  type: string;
  student_id: string | null;
  student_name: string;
  class_id: string | null;
  class_name: string;
  teacher: string | null;
  teacher_score: number | null;
  curriculum_score: number | null;
  care_score: number | null;
  facilities_score: number | null;
  average_score: number | null;
  caller: string | null;
  content: string | null;
  status: string;
  parent_id: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  created_at: string;
  updated_at: string;
};

const calcAverage = (data: Partial<FeedbackRecord>): number | null => {
  const scores = [
    data.teacherScore,
    data.curriculumScore,
    data.careScore,
    data.facilitiesScore,
  ].filter((s): s is number => typeof s === 'number' && !Number.isNaN(s));
  if (scores.length === 0) return null;
  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
};

const mapRow = (row: FeedbackRow): FeedbackRecord => ({
  id: row.id,
  date: row.date,
  type: row.type as FeedbackType,
  studentId: row.student_id || undefined,
  studentName: row.student_name,
  classId: row.class_id || undefined,
  className: row.class_name,
  teacher: row.teacher || undefined,
  teacherScore: row.teacher_score ?? undefined,
  curriculumScore: row.curriculum_score ?? undefined,
  careScore: row.care_score ?? undefined,
  facilitiesScore: row.facilities_score ?? undefined,
  averageScore: row.average_score ?? undefined,
  caller: row.caller || undefined,
  content: row.content || undefined,
  status: row.status as FeedbackStatus,
  parentId: row.parent_id || undefined,
  parentName: row.parent_name || undefined,
  parentPhone: row.parent_phone || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toInsert = (data: Omit<FeedbackRecord, 'id'>) => {
  const averageScore =
    data.type === 'Form' ? calcAverage(data) ?? data.averageScore ?? null : data.averageScore ?? null;

  return {
    date: data.date,
    type: data.type,
    student_id: data.studentId || null,
    student_name: data.studentName,
    class_id: data.classId || null,
    class_name: data.className,
    teacher: data.teacher || null,
    teacher_score: data.teacherScore ?? null,
    curriculum_score: data.curriculumScore ?? null,
    care_score: data.careScore ?? null,
    facilities_score: data.facilitiesScore ?? null,
    average_score: averageScore,
    caller: data.caller || null,
    content: data.content || null,
    status: data.status,
    parent_id: data.parentId || null,
    parent_name: data.parentName || null,
    parent_phone: data.parentPhone || null,
  };
};

export const getFeedbacks = async (filters?: {
  type?: FeedbackType;
  status?: FeedbackStatus;
  studentId?: string;
}): Promise<FeedbackRecord[]> => {
  let query = supabase.from('feedbacks').select('*').order('date', { ascending: false });

  if (filters?.type) query = query.eq('type', filters.type);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.studentId) query = query.eq('student_id', filters.studentId);

  const { data, error } = await query;
  if (error) {
    console.error('Error getting feedbacks:', error);
    throw new Error(error.message || 'Không thể tải danh sách phản hồi');
  }

  return ((data || []) as FeedbackRow[]).map(mapRow);
};

export const createFeedback = async (data: Omit<FeedbackRecord, 'id'>): Promise<string> => {
  const { data: row, error } = await supabase
    .from('feedbacks')
    .insert(toInsert(data))
    .select('id')
    .single();

  if (error) {
    console.error('Error creating feedback:', error);
    throw new Error(error.message || 'Không thể tạo phản hồi');
  }

  return row.id;
};

export const updateFeedback = async (id: string, data: Partial<FeedbackRecord>): Promise<void> => {
  const payload: Record<string, unknown> = {};
  if (data.date !== undefined) payload.date = data.date;
  if (data.type !== undefined) payload.type = data.type;
  if (data.studentId !== undefined) payload.student_id = data.studentId || null;
  if (data.studentName !== undefined) payload.student_name = data.studentName;
  if (data.classId !== undefined) payload.class_id = data.classId || null;
  if (data.className !== undefined) payload.class_name = data.className;
  if (data.teacher !== undefined) payload.teacher = data.teacher || null;
  if (data.teacherScore !== undefined) payload.teacher_score = data.teacherScore ?? null;
  if (data.curriculumScore !== undefined) payload.curriculum_score = data.curriculumScore ?? null;
  if (data.careScore !== undefined) payload.care_score = data.careScore ?? null;
  if (data.facilitiesScore !== undefined) payload.facilities_score = data.facilitiesScore ?? null;
  if (data.caller !== undefined) payload.caller = data.caller || null;
  if (data.content !== undefined) payload.content = data.content || null;
  if (data.status !== undefined) payload.status = data.status;
  if (data.parentId !== undefined) payload.parent_id = data.parentId || null;
  if (data.parentName !== undefined) payload.parent_name = data.parentName || null;
  if (data.parentPhone !== undefined) payload.parent_phone = data.parentPhone || null;

  if (
    data.teacherScore !== undefined ||
    data.curriculumScore !== undefined ||
    data.careScore !== undefined ||
    data.facilitiesScore !== undefined
  ) {
    payload.average_score = calcAverage(data);
  } else if (data.averageScore !== undefined) {
    payload.average_score = data.averageScore ?? null;
  }

  const { error } = await supabase.from('feedbacks').update(payload).eq('id', id);
  if (error) {
    console.error('Error updating feedback:', error);
    throw new Error(error.message || 'Không thể cập nhật phản hồi');
  }
};

export const updateFeedbackStatus = async (id: string, status: FeedbackStatus): Promise<void> => {
  const { error } = await supabase.from('feedbacks').update({ status }).eq('id', id);
  if (error) {
    console.error('Error updating feedback status:', error);
    throw new Error(error.message || 'Không thể cập nhật trạng thái');
  }
};

export const deleteFeedback = async (id: string): Promise<void> => {
  const { error } = await supabase.from('feedbacks').delete().eq('id', id);
  if (error) {
    console.error('Error deleting feedback:', error);
    throw new Error(error.message || 'Không thể xóa phản hồi');
  }
};
