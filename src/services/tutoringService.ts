/** Tutoring Service — stub (chưa migrate Supabase) */
import { notMigrated } from '../utils/notMigrated';

export type TutoringType = 'Nghỉ học' | 'Học yếu';
export type TutoringStatus =
  | 'Chưa bồi'
  | 'Đã hẹn'
  | 'Đã bồi'
  | 'Nghỉ tính phí'
  | 'Nghỉ bảo lưu'
  | 'Hủy';

export interface TutoringStatusHistoryEntry {
  status: TutoringStatus;
  changedAt: string;
  changedBy: string;
  reason?: string;
}

export interface TutoringData {
  id?: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  type: TutoringType;
  status: TutoringStatus;
  absentDate?: string;
  studentAttendanceId?: string;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  tutor?: string | null;
  tutorName?: string | null;
  completedAt?: string;
  completedBy?: string;
  chargedReason?: string;
  deletedAt?: string | null;
  deletedBy?: string | null;
  statusHistory?: TutoringStatusHistoryEntry[];
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const TERMINAL_STATUSES: TutoringStatus[] = ['Đã bồi', 'Nghỉ tính phí', 'Nghỉ bảo lưu'];

const write = async () => notMigrated('tutoring');

export const createTutoring = write;
export const getTutoring = async () => null;
export const getTutoringList = async () => [];
export const updateTutoring = write;
export const scheduleTutoring = write;
export const completeTutoring = write;
export const markChargedAbsence = write;
export const markReservedAbsence = write;
export const undoTutoring = write;
export const softDeleteTutoring = write;
export const restoreTutoring = write;
export const cancelTutoring = write;
export const deleteTutoring = write;
