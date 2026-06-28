import { supabase } from '../config/supabase';

export interface HomeworkStatusConfig {
  value: string;
  label: string;
  color: string;
  textColor: string;
}

export interface HomeworkItem {
  id: string;
  name: string;
  statuses?: HomeworkStatusConfig[];
}

export interface StudentHomeworkRecord {
  studentId: string;
  studentName: string;
  homeworks: {
    [homeworkId: string]: {
      status: string;
      score: number | null;
    };
  };
  note: string;
}

export interface HomeworkSessionRecord {
  id?: string;
  classId: string;
  className: string;
  sessionId: string;
  sessionNumber: number;
  sessionDate: string;
  homeworks: HomeworkItem[];
  studentRecords: StudentHomeworkRecord[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

const HOMEWORK_STATUS_KEY = 'homework_statuses';
const homeworkRecordKey = (classId: string, sessionId: string) =>
  `homework_record_${classId}_${sessionId}`;

const readSetting = async <T>(id: string): Promise<T | null> => {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data?.value as T) || null;
};

const writeSetting = async (id: string, value: unknown): Promise<void> => {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ id, value, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) throw error;
};

export const getHomeworkStatuses = async <T>(fallback: T): Promise<T> => {
  const value = await readSetting<{ statuses?: T }>(HOMEWORK_STATUS_KEY);
  return value?.statuses || fallback;
};

export const saveHomeworkStatuses = async (statuses: HomeworkStatusConfig[]): Promise<void> => {
  await writeSetting(HOMEWORK_STATUS_KEY, { statuses });
};

export const getHomeworkRecord = async (
  classId: string,
  sessionId: string
): Promise<HomeworkSessionRecord | null> => {
  const id = homeworkRecordKey(classId, sessionId);
  const value = await readSetting<Omit<HomeworkSessionRecord, 'id'>>(id);
  return value ? { id, ...value } : null;
};

export const saveHomeworkRecord = async (
  record: Omit<HomeworkSessionRecord, 'id'>,
  id?: string | null
): Promise<string> => {
  const settingId = id || homeworkRecordKey(record.classId, record.sessionId);
  await writeSetting(settingId, record);
  return settingId;
};
