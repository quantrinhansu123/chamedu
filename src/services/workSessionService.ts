/** Work Session Service — stub */
import { notMigrated } from '../utils/notMigrated';

export type WorkStatus = 'Chờ xác nhận' | 'Đã xác nhận' | 'Từ chối';
export type WorkType = 'Dạy chính' | 'Trợ giảng' | 'Nhận xét' | 'Dạy thay' | 'Bồi bài';
export type SubstituteReason = 'Nghỉ phép' | 'Nghỉ ốm' | 'Bận việc đột xuất' | 'Nghỉ không lương' | 'Khác';

export interface WorkSession {
  id?: string;
  staffId?: string;
  staffName: string;
  position: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  classId?: string;
  className?: string;
  type: WorkType;
  status: WorkStatus;
  studentCount?: number;
  salary?: number;
  note?: string;
  substituteForStaffName?: string;
  substituteReason?: SubstituteReason;
  confirmedAt?: string;
  confirmedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkSessionAuditLog {
  id?: string;
  workSessionId: string;
  action: 'create' | 'update' | 'delete' | 'confirm' | 'unconfirm';
  performedBy: string;
  performedByRole: string;
  performedAt: string;
  previousData?: Partial<WorkSession>;
  newData?: Partial<WorkSession>;
  reason?: string;
}

const write = async () => notMigrated('workSession');

export const createWorkSession = write;
export const getWorkSessions = async () => [];
export const updateWorkSession = write;
export const confirmWorkSession = write;
export const confirmAllWorkSessions = write;
export const deleteWorkSession = write;
export const createAuditLog = write;
export const updateWorkSessionWithAudit = write;
export const deleteWorkSessionWithAudit = write;
export const getWorkSessionAuditLogs = async () => [];
