/**
 * Student Service — Supabase
 */

import { supabase } from '../config/supabase';
import { Student, StudentStatus, CareLog } from '../../types';
import { findParentByPhone } from './parentService';

type StudentRow = {
  id: string;
  code: string | null;
  full_name: string;
  dob: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  parent_phone_2: string | null;
  address: string | null;
  branch: string | null;
  class_id: string | null;
  class_name: string | null;
  class_ids: string[] | null;
  status: string | null;
  registered_sessions: number | null;
  attended_sessions: number | null;
  remaining_sessions: number | null;
  debt_sessions: number | null;
  has_debt: boolean | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

const mapRow = (row: StudentRow): Student => {
  const meta = row.metadata || {};
  return {
    id: row.id,
    code: row.code || '',
    fullName: row.full_name,
    dob: row.dob || '',
    gender: (row.gender as Student['gender']) || 'Nam',
    phone: row.phone || '',
    parentName: row.parent_name || '',
    parentPhone: row.parent_phone || '',
    status: (row.status as StudentStatus) || StudentStatus.ACTIVE,
    careHistory: (meta.careHistory as CareLog[]) || [],
    branch: row.branch || '',
    class: row.class_name || '',
    classId: row.class_id || '',
    classIds: row.class_ids || [],
    registeredSessions: row.registered_sessions ?? 0,
    attendedSessions: row.attended_sessions ?? 0,
    remainingSessions: row.remaining_sessions ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(meta as object),
  } as Student;
};

const toInsert = (data: Partial<Student>) => ({
  code: data.code || null,
  full_name: data.fullName || '',
  dob: data.dob ? data.dob.slice(0, 10) : null,
  gender: data.gender || null,
  phone: data.phone || null,
  parent_name: data.parentName || null,
  parent_phone: data.parentPhone || null,
  branch: data.branch || null,
  class_id: data.classId || null,
  class_name: data.class || null,
  class_ids: data.classIds || [],
  status: data.status || StudentStatus.ACTIVE,
  registered_sessions: data.registeredSessions ?? 0,
  attended_sessions: data.attendedSessions ?? 0,
  remaining_sessions: data.remainingSessions ?? 0,
  metadata: {
    careHistory: data.careHistory || [],
    parentId: data.parentId,
  },
});

export class StudentService {
  static async getStudents(filters?: {
    status?: StudentStatus;
    classId?: string;
    searchTerm?: string;
    parentId?: string;
  }): Promise<Student[]> {
    let q = supabase.from('students').select('*').order('created_at', { ascending: false });
    if (filters?.status) q = q.eq('status', filters.status);
    if (filters?.classId) q = q.eq('class_id', filters.classId);

    const { data, error } = await q;
    if (error) throw error;

    let students = (data as StudentRow[]).map(mapRow);

    if (filters?.parentId) {
      students = students.filter((s) => s.parentId === filters.parentId);
    }
    if (filters?.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      students = students.filter(
        (s) =>
          s.fullName.toLowerCase().includes(term) ||
          s.code.toLowerCase().includes(term) ||
          s.phone?.includes(term) ||
          s.parentName?.toLowerCase().includes(term)
      );
    }
    return students;
  }

  static async getStudentById(id: string): Promise<Student | null> {
    const { data, error } = await supabase.from('students').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? mapRow(data as StudentRow) : null;
  }

  static async createStudent(
    studentData: Omit<Student, 'id'> & { parentPhone?: string; parentName?: string }
  ): Promise<string> {
    if (studentData.parentPhone) {
      await findParentByPhone(studentData.parentPhone);
    }
    const { data, error } = await supabase
      .from('students')
      .insert(toInsert(studentData))
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  }

  static async updateStudent(
    id: string,
    updates: Partial<Student> & { parentPhone?: string; parentName?: string }
  ): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (updates.fullName !== undefined) payload.full_name = updates.fullName;
    if (updates.code !== undefined) payload.code = updates.code;
    if (updates.dob !== undefined) payload.dob = updates.dob ? updates.dob.slice(0, 10) : null;
    if (updates.gender !== undefined) payload.gender = updates.gender;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.parentName !== undefined) payload.parent_name = updates.parentName;
    if (updates.parentPhone !== undefined) payload.parent_phone = updates.parentPhone;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.branch !== undefined) payload.branch = updates.branch;
    if (updates.classId !== undefined) payload.class_id = updates.classId || null;
    if (updates.class !== undefined) payload.class_name = updates.class || null;
    if (updates.classIds !== undefined) payload.class_ids = updates.classIds;
    if (updates.registeredSessions !== undefined) payload.registered_sessions = updates.registeredSessions;
    if (updates.attendedSessions !== undefined) payload.attended_sessions = updates.attendedSessions;
    if (updates.remainingSessions !== undefined) payload.remaining_sessions = updates.remainingSessions;

    const { error } = await supabase.from('students').update(payload).eq('id', id);
    if (error) throw error;
  }

  static async deleteStudent(id: string): Promise<void> {
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) throw error;
  }

  static async addCareLog(studentId: string, careLog: Omit<CareLog, 'id'>): Promise<void> {
    const student = await this.getStudentById(studentId);
    if (!student) throw new Error('Học viên không tồn tại');
    const careHistory = [...(student.careHistory || []), { ...careLog, id: crypto.randomUUID() }];
    const { error } = await supabase
      .from('students')
      .update({ metadata: { ...(student as any), careHistory } })
      .eq('id', studentId);
    if (error) throw error;
  }

  static async getStudentsByBirthdayMonth(month: number): Promise<Student[]> {
    const students = await this.getStudents();
    return students.filter((s) => {
      if (!s.dob) return false;
      return new Date(s.dob).getMonth() + 1 === month;
    });
  }

  static async bulkUpdateStudentStatus(ids: string[], status: StudentStatus): Promise<void> {
    const { error } = await supabase.from('students').update({ status }).in('id', ids);
    if (error) throw error;
  }
}
