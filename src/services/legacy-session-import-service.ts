/** Auto-stub: Firebase removed. Migrate to Supabase. */
import { notMigrated } from '../utils/notMigrated';

export interface LegacyImportRow {
  code: string;
  fullName: string;
  legacySessions: number;
}
export interface LegacyImportPreview {
  row: LegacyImportRow;
  matched: boolean;
  studentId?: string;
  studentName?: string;
  currentLegacy: number;
  currentRemaining: number;
  newRemaining: number;
  error?: string;
}

export const parseExcelFile = async (..._args: any[]): Promise<any> => { console.warn('[stub] parseExcelFile'); return []; };
export const generateImportPreview = async (..._args: any[]): Promise<any> => { console.warn('[stub] generateImportPreview'); return []; };
export const applyLegacyImport = async (..._args: any[]): Promise<any> => { console.warn('[stub] applyLegacyImport'); return []; };
