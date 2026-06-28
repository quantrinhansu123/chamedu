import { ClassModel, ClassStatus, TeacherChangePayload } from '../../types';
import { supabase } from '../config/supabase';

type ClassRow = {
  id: string;
  code: string | null;
  name: string;
  branch: string | null;
  age_group: string | null;
  curriculum: string | null;
  schedule: string | null;
  schedule_details: unknown;
  room: string | null;
  start_date: string | null;
  end_date: string | null;
  progress: string | null;
  status: ClassStatus;
  total_sessions: number | null;
  tuition_fee: number | null;
  max_students: number | null;
  teacher: string | null;
  teacher_id: string | null;
  foreign_teacher: string | null;
  foreign_teacher_id: string | null;
  assistant: string | null;
  assistant_id: string | null;
  color: number | null;
  student_ids: string[] | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

const mapRowToClassModel = (row: ClassRow): ClassModel => ({
  id: row.id,
  code: row.code || '',
  name: row.name,
  branch: row.branch || '',
  ageGroup: row.age_group || '',
  curriculum: row.curriculum || '',
  schedule: row.schedule || '',
  scheduleDetails: (row.schedule_details as any) || undefined,
  room: row.room || '',
  startDate: row.start_date || '',
  endDate: row.end_date || '',
  progress: row.progress || '',
  status: row.status || ClassStatus.STUDYING,
  totalSessions: row.total_sessions || 0,
  tuitionFee: row.tuition_fee || 0,
  maxStudents: row.max_students || 20,
  teacher: row.teacher || '',
  teacherId: row.teacher_id || '',
  foreignTeacher: row.foreign_teacher || '',
  foreignTeacherId: row.foreign_teacher_id || '',
  assistant: row.assistant || '',
  assistantId: row.assistant_id || '',
  color: row.color ?? undefined,
  studentIds: row.student_ids || [],
  createdDate: (row.metadata?.createdDate as string | undefined) || toDateOnly(row.created_at) || '',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
} as ClassModel);

const toDateOnly = (value?: string | null): string | null => {
  if (!value) return null;
  if (value.length >= 10) return value.slice(0, 10);
  return value;
};

const toClassInsertPayload = (classData: Omit<ClassModel, 'id'>) => ({
  code: classData.code || null,
  name: classData.name?.trim() || classData.name || 'Lớp mới',
  branch: classData.branch || null,
  age_group: classData.ageGroup || null,
  curriculum: classData.curriculum || null,
  schedule: classData.schedule || null,
  schedule_details: classData.scheduleDetails || null,
  room: classData.room || null,
  start_date: toDateOnly(classData.startDate),
  end_date: toDateOnly(classData.endDate),
  progress: classData.progress || null,
  status: classData.status || ClassStatus.STUDYING,
  total_sessions: classData.totalSessions ?? 0,
  tuition_fee: classData.tuitionFee ?? 0,
  max_students: classData.maxStudents ?? 20,
  teacher: classData.teacher || null,
  teacher_id: classData.teacherId || null,
  foreign_teacher: classData.foreignTeacher || null,
  foreign_teacher_id: classData.foreignTeacherId || null,
  assistant: classData.assistant || null,
  assistant_id: classData.assistantId || null,
  color: classData.color ?? null,
  student_ids: classData.studentIds || [],
  metadata: {
    createdDate: toDateOnly(classData.createdDate) || new Date().toISOString().slice(0, 10),
  },
});

/**
 * Validate if totalSessions can be reduced
 * BLOCKS reduction if any sessions beyond new count have attendance
 */
export async function validateTotalSessionsChange(
  classId: string,
  currentTotal: number,
  newTotal: number
): Promise<{ valid: boolean; message: string }> {
  // Allow setting to 0 (unlimited) - always valid
  if (newTotal === 0) {
    return { valid: true, message: '' };
  }

  // Allow increase
  if (newTotal >= currentTotal) {
    return { valid: true, message: '' };
  }

  const { data, error } = await supabase
    .from('class_sessions')
    .select('id, attendance_id')
    .eq('class_id', classId)
    .gt('session_number', newTotal);
  if (error) throw error;
  const sessionsWithAttendance = (data || []).filter(s => !!s.attendance_id);

  if (sessionsWithAttendance.length > 0) {
    return {
      valid: false,
      message: `Không thể giảm số buổi vì có ${sessionsWithAttendance.length} buổi học (từ buổi ${newTotal + 1}) đã có điểm danh. Vui lòng xóa điểm danh trước.`
    };
  }

  return { valid: true, message: '' };
}

export class ClassService {
  
  // Get all classes with optional filters
  static async getClasses(filters?: {
    status?: ClassStatus;
    teacherId?: string;
    searchTerm?: string;
  }): Promise<ClassModel[]> {
    try {
      let q = supabase.from('classes').select('*').order('created_at', { ascending: false });
      if (filters?.status) q = q.eq('status', filters.status);
      if (filters?.teacherId) q = q.eq('teacher_id', filters.teacherId);
      const { data, error } = await q;
      if (error) throw error;
      let classes = ((data || []) as ClassRow[]).map(mapRowToClassModel);
      
      // Client-side search if searchTerm provided
      if (filters?.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        classes = classes.filter(c => 
          c.name.toLowerCase().includes(term)
        );
      }
      
      return classes;
    } catch (error) {
      console.error('Error getting classes:', error);
      throw error;
    }
  }
  
  // Get single class by ID
  static async getClassById(id: string): Promise<ClassModel | null> {
    try {
      const { data, error } = await supabase.from('classes').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? mapRowToClassModel(data as ClassRow) : null;
    } catch (error) {
      console.error('Error getting class:', error);
      throw error;
    }
  }
  
  // Create new class
  static async createClass(classData: Omit<ClassModel, 'id'>): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('classes')
        .insert(toClassInsertPayload(classData))
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    } catch (error) {
      console.error('Error creating class:', error);
      throw error;
    }
  }
  
  // Update class
  static async updateClass(id: string, updates: Partial<ClassModel> & Partial<TeacherChangePayload>): Promise<void> {
    try {
      const payload: Record<string, unknown> = {};
      if (updates.code !== undefined) payload.code = updates.code || null;
      if (updates.name !== undefined) payload.name = updates.name?.trim() || null;
      if (updates.branch !== undefined) payload.branch = updates.branch || null;
      if (updates.ageGroup !== undefined) payload.age_group = updates.ageGroup || null;
      if (updates.curriculum !== undefined) payload.curriculum = updates.curriculum || null;
      if (updates.schedule !== undefined) payload.schedule = updates.schedule || null;
      if (updates.scheduleDetails !== undefined) payload.schedule_details = updates.scheduleDetails || null;
      if (updates.room !== undefined) payload.room = updates.room || null;
      if (updates.startDate !== undefined) payload.start_date = toDateOnly(updates.startDate);
      if (updates.endDate !== undefined) payload.end_date = toDateOnly(updates.endDate);
      if (updates.progress !== undefined) payload.progress = updates.progress || null;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.totalSessions !== undefined) payload.total_sessions = Number(updates.totalSessions);
      if (updates.tuitionFee !== undefined) payload.tuition_fee = updates.tuitionFee;
      if (updates.maxStudents !== undefined) payload.max_students = updates.maxStudents;
      if (updates.teacher !== undefined) payload.teacher = updates.teacher || null;
      if (updates.teacherId !== undefined) payload.teacher_id = updates.teacherId || null;
      if (updates.foreignTeacher !== undefined) payload.foreign_teacher = updates.foreignTeacher || null;
      if (updates.foreignTeacherId !== undefined) payload.foreign_teacher_id = updates.foreignTeacherId || null;
      if (updates.assistant !== undefined) payload.assistant = updates.assistant || null;
      if (updates.assistantId !== undefined) payload.assistant_id = updates.assistantId || null;
      if (updates.color !== undefined) payload.color = updates.color ?? null;
      if (updates.studentIds !== undefined) payload.student_ids = updates.studentIds || [];
      if (updates.createdDate !== undefined) {
        const { data: existing, error: metaError } = await supabase
          .from('classes')
          .select('metadata')
          .eq('id', id)
          .maybeSingle();
        if (metaError) throw metaError;
        payload.metadata = {
          ...((existing?.metadata as Record<string, unknown>) || {}),
          createdDate: toDateOnly(updates.createdDate),
        };
      }
      const { error } = await supabase.from('classes').update(payload).eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Error updating class:', error);
      throw error;
    }
  }
  
  // Delete class with validation and cascade
  static async deleteClass(id: string, forceDelete: boolean = false): Promise<{
    success: boolean;
    message: string;
    cascadeResult?: { studentsUpdated: number; workSessionsUpdated: number };
  }> {
    try {
      if (!forceDelete) {
        const { count: studentCount, error: checkError } = await supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('class_id', id);
        if (checkError) throw checkError;
        if ((studentCount || 0) > 0) {
          return {
            success: false,
            message: `Lớp còn ${(studentCount || 0)} học viên. Chọn xóa bắt buộc để tiếp tục.`,
          };
        }
      }

      const { error: studentUpdateError } = await supabase
        .from('students')
        .update({ class_id: null, class_name: null })
        .eq('class_id', id);
      if (studentUpdateError) throw studentUpdateError;

      const { error: deleteError } = await supabase.from('classes').delete().eq('id', id);
      if (deleteError) throw deleteError;
      
      return {
        success: true,
        message: 'Đã xóa lớp học và cập nhật học viên liên quan.',
        cascadeResult: { studentsUpdated: 0, workSessionsUpdated: 0 },
      };
    } catch (error) {
      console.error('Error deleting class:', error);
      throw error;
    }
  }
  
  // Simple delete (backward compatibility)
  static async deleteClassSimple(id: string): Promise<void> {
    const result = await this.deleteClass(id, true);
    if (!result.success) {
      throw new Error(result.message);
    }
  }
  
  // Add history entry to class
  static async addClassHistory(
    classId: string, 
    historyEntry: {
      type: string;
      description: string;
      staffId: string;
      staffName: string;
    }
  ): Promise<void> {
    try {
      const newEntry = {
        id: `HIST_${Date.now()}`,
        date: new Date().toISOString(),
        ...historyEntry
      };

      const { data: cls, error: fetchError } = await supabase
        .from('classes')
        .select('metadata')
        .eq('id', classId)
        .maybeSingle();
      if (fetchError) throw fetchError;
      const metadata: any = cls?.metadata || {};
      const history = Array.isArray(metadata.history) ? metadata.history : [];
      metadata.history = [...history, newEntry];

      const { error } = await supabase.from('classes').update({ metadata }).eq('id', classId);
      if (error) throw error;
    } catch (error) {
      console.error('Error adding class history:', error);
      throw error;
    }
  }
  
  // Update class progress
  static async updateClassProgress(classId: string, progress: string): Promise<void> {
    try {
      await this.updateClass(classId, { progress });
      await this.addClassHistory(classId, {
        type: 'Cập nhật tiến độ',
        description: `Tiến độ cập nhật: ${progress}`,
        staffId: '',
        staffName: 'System'
      });
    } catch (error) {
      console.error('Error updating class progress:', error);
      throw error;
    }
  }
  
  // Get classes by teacher
  static async getClassesByTeacher(teacherId: string): Promise<ClassModel[]> {
    return this.getClasses({ teacherId });
  }
  
  // Get active classes
  static async getActiveClasses(): Promise<ClassModel[]> {
    return this.getClasses({ status: ClassStatus.STUDYING });
  }
}
