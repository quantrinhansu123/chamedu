/** Auto-stub: Firebase removed. Migrate to Supabase. */
import { notMigrated } from '../utils/notMigrated';

export interface TestCommentData {
  id: string;
  testName: string;
  testDate: string;
  comment: string;
  score: number | null;
}
export interface HomeworkSummary {
  totalHomeworks: number;
  completedHomeworks: number;
  completionRate: number;
  homeworkDetails: Array<{
    sessionNumber: number;
    sessionDate: string;
    homeworkName: string;
    status: string;
  }>;
}
export interface MonthlyReportData {
  student: Student;
  month: number;
  year: number;
  generatedAt: string;
  
  // Overall stats (across all classes)
  overallStats: MonthlyReportStats;
  
  // Per-class data
  classReports: Array<{
    classId: string;
    className: string;
    stats: MonthlyReportStats;
    attendance: StudentAttendance[];
    comment: MonthlyComment | null;
    testComments: TestCommentData[];
    homeworkSummary: HomeworkSummary;
  }>;
  
  // All attendance records for history table
  allAttendance: StudentAttendance[];
}
export interface StudentPDFReportData {
  student: {
    fullName: string;
    code: string;
    className: string;
    branch?: string;
  };
  month: number;
  year: number;
  attendance: {
    totalSessions: number;
    attended: number;
    onTime: number;
    late: number;
    absent: number;
    rate: number;
  };
  homework: {
    total: number;
    completed: number;
    rate: number;
    avgScore?: number;
  };
  monthlyComment?: string;
  testResults: Array<{
    testName: string;
    score: number | null;
    comment?: string;
  }>;
}

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
export const useStudents = async (..._args: any[]): Promise<any> => { notMigrated('useStudents'); };
export const useClasses = async (..._args: any[]): Promise<any> => { notMigrated('useClasses'); };
export const generateMonthlyReport = async (..._args: any[]): Promise<any> => { console.warn('[stub] generateMonthlyReport'); return []; };
export const saveMonthlyComment = async (..._args: any[]): Promise<any> => { notMigrated('saveMonthlyComment'); };
export const generateAIComment = async (..._args: any[]): Promise<any> => { console.warn('[stub] generateAIComment'); return []; };
export const generateStudentPDF = async (..._args: any[]): Promise<any> => { console.warn('[stub] generateStudentPDF'); return []; };
export const downloadBlob = async (..._args: any[]): Promise<any> => { notMigrated('downloadBlob'); };
export const preparePDFReportData = async (..._args: any[]): Promise<any> => { notMigrated('preparePDFReportData'); };
