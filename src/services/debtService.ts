import { supabase } from '../config/supabase';
import { ContractStatus } from '../../types';
import { recordPayment, updateContract } from './contractService';

export interface DebtRecord {
  id: string;
  contractCode: string;
  studentId: string;
  studentName: string;
  classId?: string;
  className: string;
  parentName?: string;
  parentPhone?: string;
  totalAmount: number;
  paidAmount: number;
  debtAmount: number;
  dueDate?: string;
  createdAt: string;
  status: string;
  note?: string;
}

export const getDebtRecords = async (): Promise<DebtRecord[]> => {
  const { data: contracts, error } = await supabase
    .from('contracts')
    .select('*')
    .gt('remaining_amount', 0)
    .neq('status', ContractStatus.PAID)
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  
  return (contracts || []).map((c: any) => ({
    id: c.id,
    contractCode: c.code,
    studentId: c.student_id || '',
    studentName: c.student_name || '',
    classId: c.class_id,
    className: c.class_name || '',
    parentName: c.parent_name,
    parentPhone: c.parent_phone,
    totalAmount: c.total_amount || 0,
    paidAmount: c.paid_amount || 0,
    debtAmount: c.remaining_amount || 0,
    dueDate: c.next_payment_date,
    createdAt: c.created_at,
    status: c.status,
    note: c.notes
  }));
};

export const markAsPaid = async (id: string, amount?: number): Promise<void> => {
  if (amount) {
    await recordPayment(id, amount);
  }
};

export const updateDebtNote = async (id: string, note: string): Promise<void> => {
  await updateContract(id, { notes: note });
};
