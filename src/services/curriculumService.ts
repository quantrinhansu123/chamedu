/**
 * Curriculum Service - Supabase
 */

import { supabase } from '../config/supabase';

const PROGRAM_TYPES_SETTING_ID = 'program_types';

export interface Curriculum {
  id?: string;
  name: string;
  code: string;
  description?: string;
  level: CurriculumLevel;
  ageRange?: string;
  duration: number;
  totalSessions: number;
  sessionDuration: number;
  tuitionFee: number;
  materials?: string[];
  objectives?: string[];
  status: CurriculumStatus;
  createdAt?: string;
  updatedAt?: string;
}

export type CurriculumLevel = string;
export type CurriculumStatus = 'Active' | 'Inactive' | 'Draft';

type CurriculumRow = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  level: string | null;
  age_range: string | null;
  duration: number | null;
  total_sessions: number | null;
  session_duration: number | null;
  tuition_fee: number | null;
  materials: string[] | null;
  objectives: string[] | null;
  status: string | null;
  created_at: string;
  updated_at: string;
};

const mapRow = (row: CurriculumRow): Curriculum => ({
  id: row.id,
  name: row.name,
  code: row.code || '',
  description: row.description || undefined,
  level: row.level || 'Beginner',
  ageRange: row.age_range || undefined,
  duration: row.duration ?? 0,
  totalSessions: row.total_sessions ?? 0,
  sessionDuration: row.session_duration ?? 0,
  tuitionFee: row.tuition_fee ?? 0,
  materials: row.materials || undefined,
  objectives: row.objectives || undefined,
  status: (row.status as CurriculumStatus) || 'Active',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toInsert = (data: Omit<Curriculum, 'id'>) => ({
  name: data.name,
  code: data.code || null,
  description: data.description || null,
  level: data.level || null,
  age_range: data.ageRange || null,
  duration: data.duration ?? 0,
  total_sessions: data.totalSessions ?? 0,
  session_duration: data.sessionDuration ?? 0,
  tuition_fee: data.tuitionFee ?? 0,
  materials: data.materials || null,
  objectives: data.objectives || null,
  status: data.status || 'Active',
});

export const getCurriculums = async (): Promise<Curriculum[]> => {
  const { data, error } = await supabase
    .from('curriculums')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error getting curriculums:', error);
    throw new Error(error.message || 'Khong the tai danh sach goi hoc');
  }

  return ((data || []) as CurriculumRow[]).map(mapRow);
};

export const createCurriculum = async (data: Omit<Curriculum, 'id'>): Promise<string> => {
  const { data: row, error } = await supabase
    .from('curriculums')
    .insert(toInsert(data))
    .select('id')
    .single();

  if (error) {
    console.error('Error creating curriculum:', error);
    throw new Error(error.message || 'Khong the tao goi hoc');
  }

  return row.id;
};

export const updateCurriculum = async (id: string, data: Partial<Curriculum>): Promise<void> => {
  const payload: Record<string, unknown> = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.code !== undefined) payload.code = data.code || null;
  if (data.description !== undefined) payload.description = data.description || null;
  if (data.level !== undefined) payload.level = data.level || null;
  if (data.ageRange !== undefined) payload.age_range = data.ageRange || null;
  if (data.duration !== undefined) payload.duration = data.duration;
  if (data.totalSessions !== undefined) payload.total_sessions = data.totalSessions;
  if (data.sessionDuration !== undefined) payload.session_duration = data.sessionDuration;
  if (data.tuitionFee !== undefined) payload.tuition_fee = data.tuitionFee;
  if (data.materials !== undefined) payload.materials = data.materials || null;
  if (data.objectives !== undefined) payload.objectives = data.objectives || null;
  if (data.status !== undefined) payload.status = data.status;

  const { error } = await supabase.from('curriculums').update(payload).eq('id', id);

  if (error) {
    console.error('Error updating curriculum:', error);
    throw new Error(error.message || 'Khong the cap nhat goi hoc');
  }
};

export const deleteCurriculum = async (id: string): Promise<void> => {
  const { error } = await supabase.from('curriculums').delete().eq('id', id);

  if (error) {
    console.error('Error deleting curriculum:', error);
    throw new Error(error.message || 'Khong the xoa goi hoc');
  }
};

export const getProgramTypes = async (): Promise<string[] | null> => {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('id', PROGRAM_TYPES_SETTING_ID)
    .maybeSingle();

  if (error) {
    console.error('Error getting program types:', error);
    throw new Error(error.message || 'Khong the tai cau hinh chuong trinh');
  }

  const value = data?.value as { types?: unknown } | null;
  return Array.isArray(value?.types) ? value.types.filter((type): type is string => typeof type === 'string') : null;
};

export const saveProgramTypes = async (types: string[]): Promise<void> => {
  const { error } = await supabase.from('app_settings').upsert({
    id: PROGRAM_TYPES_SETTING_ID,
    value: { types },
  });

  if (error) {
    console.error('Error saving program types:', error);
    throw new Error(error.message || 'Khong the luu cau hinh chuong trinh');
  }
};
