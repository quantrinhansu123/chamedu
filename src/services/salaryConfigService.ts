/** Salary Config Service — stub */
import { notMigrated } from '../utils/notMigrated';

export type SalaryMethod = 'Theo ca' | 'Theo giờ' | 'Nhận xét' | 'Cố định';
export type WorkMethod = 'Cố định' | 'Theo sĩ số';
export type RangeType = 'Teaching' | 'AssistantFeedback';

export interface SalaryRule {
  id?: string;
  staffId: string;
  staffName: string;
  position: string;
  classId?: string;
  className?: string;
  classCode?: string;
  salaryMethod: SalaryMethod;
  baseRate: number;
  workMethod: WorkMethod;
  avgStudents?: number;
  ratePerSession: number;
  ratePerMinute?: number;
  allowance?: number;
  kpiBonus?: number;
  note?: string;
  salaryCycle?: string;
  effectiveDate: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SalaryRangeConfig {
  id?: string;
  type: RangeType;
  rangeLabel: string;
  minStudents?: number;
  maxStudents?: number;
  method?: string;
  amount: number;
  effectiveDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

const write = async () => notMigrated('salaryConfig');

export const createSalaryRule = write;
export const getSalaryRules = async () => [];
export const updateSalaryRule = write;
export const deleteSalaryRule = write;
export const createSalaryRange = write;
export const getSalaryRanges = async () => [];
export const updateSalaryRange = write;
export const deleteSalaryRange = write;
export const calculateSalary = () => 0;
