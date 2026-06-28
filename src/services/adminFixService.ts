/** Auto-stub: Firebase removed. Migrate to Supabase. */
import { notMigrated } from '../utils/notMigrated';

export interface RecalculateResult {
    studentId: string;
    studentName: string;
    before: {
        attendedSessions: number;
        remainingSessions: number;
        registeredSessions: number;
        status: string;
    };
    after: {
        attendedSessions: number;
        remainingSessions: number;
        registeredSessions: number;
        status: string;
    };
    changed: boolean;
}
export interface ResetResult {
    classId: string;
    className: string;
    attendanceRecordsDeleted: number;
    studentAttendanceDeleted: number;
    sessionsReset: number;
    studentsRecalculated: number;
}
export interface RemoveStudentResult {
    studentId: string;
    studentName: string;
    attendanceDeleted: number;
    success: boolean;
    error?: string;
}

export const recalculateClassStudentData = async (..._args: any[]): Promise<RecalculateResult[]> => {
  console.warn('[stub] recalculateClassStudentData chưa migrate Supabase');
  return [];
};

export const resetClassAttendance = async (..._args: any[]): Promise<ResetResult> => {
  notMigrated('resetClassAttendance');
};

export const removeStudentFromClass = async (..._args: any[]): Promise<RemoveStudentResult> => {
  notMigrated('removeStudentFromClass');
};

export const fixStudentRegisteredSessions = async (..._args: any[]): Promise<void> => {
  notMigrated('fixStudentRegisteredSessions');
};

export const batchRecalculateClasses = async (..._args: any[]): Promise<RecalculateResult[]> => [];
export const updateLegacyAttendedSessions = async (..._args: any[]): Promise<void> => {
  notMigrated('updateLegacyAttendedSessions');
};

export const collection = async (..._args: any[]): Promise<any> => { notMigrated('collection'); };
export const doc = async (..._args: any[]): Promise<any> => { notMigrated('doc'); };
export const getDocs = async (..._args: any[]): Promise<any> => { console.warn('[stub] getDocs'); return null; };
export const getDoc = async (..._args: any[]): Promise<any> => { console.warn('[stub] getDoc'); return null; };
export const addDoc = async (..._args: any[]): Promise<any> => { notMigrated('addDoc'); };
export const setDoc = async (..._args: any[]): Promise<any> => { notMigrated('setDoc'); };
export const updateDoc = async (..._args: any[]): Promise<any> => { notMigrated('updateDoc'); };
export const deleteDoc = async (..._args: any[]): Promise<any> => { notMigrated('deleteDoc'); };
export const query = async (..._args: any[]): Promise<any> => { notMigrated('query'); };
export const where = async (..._args: any[]): Promise<any> => { notMigrated('where'); };
export const orderBy = async (..._args: any[]): Promise<any> => { notMigrated('orderBy'); };
export const limit = async (..._args: any[]): Promise<any> => { notMigrated('limit'); };
export const onSnapshot = async (..._args: any[]): Promise<any> => { notMigrated('onSnapshot'); };
export const writeBatch = async (..._args: any[]): Promise<any> => { notMigrated('writeBatch'); };
export const runTransaction = async (..._args: any[]): Promise<any> => { notMigrated('runTransaction'); };
export const arrayUnion = async (..._args: any[]): Promise<any> => { notMigrated('arrayUnion'); };
export const db = async (..._args: any[]): Promise<any> => { notMigrated('db'); };
