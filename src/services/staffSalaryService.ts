/** Auto-stub: Firebase removed. Migrate to Supabase. */
import { notMigrated } from '../utils/notMigrated';

export interface StaffSalaryRecord {
  id?: string;
  staffId: string;
  staffName: string;
  position: string;
  month: number;
  year: number;
  baseSalary: number;
  positionBonus: number;      // Lead/Management bonus based on multiplier
  kpiBonus: number;           // KPI achievement bonus
  workDays: number;
  commission: number;
  commissionRate?: number;    // For Sale team (percentage)
  commissionBase?: number;    // Revenue base for commission calculation
  allowance: number;
  deduction: number;
  totalSalary: number;
  note?: string;
}
export interface StaffAttendanceLog {
  id?: string;
  staffId: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: 'Đúng giờ' | 'Đi muộn' | 'Về sớm' | 'Nghỉ phép' | 'Nghỉ không phép';
  note?: string;
  photoUrl?: string;  // Check-in photo URL
}

export const useState = async (..._args: any[]): Promise<any> => { notMigrated('useState'); };
export const useEffect = async (..._args: any[]): Promise<any> => { notMigrated('useEffect'); };
export const useCallback = async (..._args: any[]): Promise<any> => { notMigrated('useCallback'); };
export const getStaffSalaries = async (..._args: any[]): Promise<any> => { console.warn('[stub] getStaffSalaries'); return []; };
export const createStaffSalary = async (..._args: any[]): Promise<any> => { notMigrated('createStaffSalary'); };
export const updateStaffSalary = async (..._args: any[]): Promise<any> => { notMigrated('updateStaffSalary'); };
export const deleteStaffSalary = async (..._args: any[]): Promise<any> => { notMigrated('deleteStaffSalary'); };
export const getStaffAttendance = async (..._args: any[]): Promise<any> => { console.warn('[stub] getStaffAttendance'); return []; };
export const createAttendanceLog = async (..._args: any[]): Promise<any> => { notMigrated('createAttendanceLog'); };
export const updateAttendanceLog = async (..._args: any[]): Promise<any> => { notMigrated('updateAttendanceLog'); };
export const deleteAttendanceLog = async (..._args: any[]): Promise<any> => { notMigrated('deleteAttendanceLog'); };
