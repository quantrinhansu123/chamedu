/** Auto-stub: Firebase removed. Migrate to Supabase. */
import { notMigrated } from '../utils/notMigrated';

export interface FinancialTransaction {
  id?: string;
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM
  type: TransactionType;
  category: RevenueCategory;
  amount: number;
  description?: string;
  studentId?: string;
  studentName?: string;
  contractId?: string;
  invoiceId?: string;
  createdAt?: string;
  createdBy?: string;
}
export interface RevenueByCategory {
  category: RevenueCategory;
  amount: number;
  percentage: number;
  color: string;
}
export interface MonthlyRevenue {
  month: string;
  expected: number;
  actual: number;
  difference: number;
}
export interface FinancialSummary {
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
  revenueByCategory: RevenueByCategory[];
  monthlyRevenue: MonthlyRevenue[];
  debtAmount: number;
}

export type RevenueCategory = 'Học phí' | 'Sách vở' | 'Đồng phục' | 'Khác';
export type TransactionType = 'income' | 'expense';

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
export const formatCurrency = async (..._args: any[]): Promise<any> => { notMigrated('formatCurrency'); };
export const getRevenueSummary = async (..._args: any[]): Promise<any> => { console.warn('[stub] getRevenueSummary'); return null; };
