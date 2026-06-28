/** Auto-stub: Firebase removed. Migrate to Supabase. */
import { notMigrated } from '../utils/notMigrated';

export interface SessionPreviewItem {
  className: string;
  classId: string;
  sessionCount: number;
}
export interface SessionPreviewResult {
  items: SessionPreviewItem[];
  totalSessions: number;
  totalClasses: number;
}

export const useHolidays = async (..._args: any[]): Promise<any> => { notMigrated('useHolidays'); };
export const useClasses = async (..._args: any[]): Promise<any> => { notMigrated('useClasses'); };
export const usePermissions = async (..._args: any[]): Promise<any> => { notMigrated('usePermissions'); };
export const applyHoliday = async (..._args: any[]): Promise<any> => { console.warn('[stub] applyHoliday'); return []; };
export const unapplyHoliday = async (..._args: any[]): Promise<any> => { notMigrated('unapplyHoliday'); };
export const getAffectedSessionsPreview = async (..._args: any[]): Promise<any> => { console.warn('[stub] getAffectedSessionsPreview'); return null; };
