/**
 * Contract Service
 * Handle contract CRUD operations with Supabase
 */

import { Contract, ContractStatus, ContractType, PaymentMethod, EnrollmentRecord } from '../../types';
import * as enrollmentService from './enrollmentService';
import { supabase } from '../config/supabase';

type ContractRow = {
  id: string;
  code: string;
  type: ContractType;
  student_id: string | null;
  student_name: string | null;
  student_dob: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  class_id: string | null;
  class_name: string | null;
  branch: string | null;
  subtotal: number;
  total_discount: number;
  total_amount: number;
  total_amount_in_words: string | null;
  payment_method: PaymentMethod;
  paid_amount: number;
  remaining_amount: number;
  contract_date: string;
  start_date: string | null;
  end_date: string | null;
  payment_date: string | null;
  next_payment_date: string | null;
  total_sessions: number | null;
  price_per_session: number | null;
  status: ContractStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type ContractItemRow = {
  id: string;
  contract_id: string;
  type: 'course' | 'product';
  item_ref_id: string | null;
  name: string;
  class_id: string | null;
  class_name: string | null;
  unit_price: number;
  quantity: number;
  subtotal: number;
  discount: number;
  final_price: number;
  debt_sessions: number | null;
  start_date: string | null;
  end_date: string | null;
  applied_discounts: unknown;
};

const toIsoDate = (value?: string | null): string | null => {
  if (!value) return null;
  if (value.includes('T')) return value;
  return `${value}T00:00:00.000Z`;
};

const toDateOnly = (value?: string | null): string | null => {
  if (!value) return null;
  if (value.length >= 10) return value.slice(0, 10);
  return value;
};

const mapContractRowToModel = (row: ContractRow, items: ContractItemRow[]): Contract => ({
  id: row.id,
  code: row.code,
  type: row.type,
  studentId: row.student_id || '',
  studentName: row.student_name || '',
  studentDOB: row.student_dob || '',
  parentName: row.parent_name || '',
  parentPhone: row.parent_phone || '',
  classId: row.class_id || '',
  className: row.class_name || '',
  branch: row.branch || '',
  items: items.map(item => ({
    type: item.type,
    id: item.item_ref_id || item.id,
    name: item.name,
    classId: item.class_id || undefined,
    className: item.class_name || undefined,
    unitPrice: item.unit_price || 0,
    quantity: item.quantity || 0,
    subtotal: item.subtotal || 0,
    discount: item.discount || 0,
    appliedDiscounts: Array.isArray(item.applied_discounts) ? item.applied_discounts as any[] : undefined,
    finalPrice: item.final_price || 0,
    debtSessions: item.debt_sessions || undefined,
    startDate: toDateOnly(item.start_date) || undefined,
    endDate: toDateOnly(item.end_date) || undefined,
  })),
  subtotal: row.subtotal || 0,
  totalDiscount: row.total_discount || 0,
  totalAmount: row.total_amount || 0,
  totalAmountInWords: row.total_amount_in_words || '',
  paymentMethod: row.payment_method || PaymentMethod.CASH,
  paidAmount: row.paid_amount || 0,
  remainingAmount: row.remaining_amount || 0,
  contractDate: row.contract_date,
  startDate: toDateOnly(row.start_date) || undefined,
  endDate: toDateOnly(row.end_date) || undefined,
  paymentDate: toDateOnly(row.payment_date) || undefined,
  nextPaymentDate: toDateOnly(row.next_payment_date) || undefined,
  totalSessions: row.total_sessions || 0,
  pricePerSession: row.price_per_session || 0,
  status: row.status,
  notes: row.notes || '',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  createdBy: row.created_by || 'unknown',
});

const toContractInsert = (contractData: Partial<Contract>, code: string) => ({
  code,
  type: contractData.type || ContractType.STUDENT,
  student_id: contractData.studentId || null,
  student_name: contractData.studentName || null,
  student_dob: toDateOnly(contractData.studentDOB),
  parent_name: contractData.parentName || null,
  parent_phone: contractData.parentPhone || null,
  class_id: contractData.classId || null,
  class_name: contractData.className || null,
  branch: contractData.branch || null,
  subtotal: contractData.subtotal || 0,
  total_discount: contractData.totalDiscount || 0,
  total_amount: contractData.totalAmount || 0,
  total_amount_in_words: contractData.totalAmountInWords || '',
  payment_method: contractData.paymentMethod || PaymentMethod.CASH,
  paid_amount: contractData.paidAmount || 0,
  remaining_amount: contractData.remainingAmount || 0,
  contract_date: toDateOnly(contractData.contractDate || new Date().toISOString().slice(0, 10)),
  start_date: toDateOnly(contractData.startDate),
  end_date: toDateOnly(contractData.endDate),
  payment_date: toDateOnly(contractData.paymentDate),
  next_payment_date: toDateOnly(contractData.nextPaymentDate),
  total_sessions: contractData.totalSessions || 0,
  price_per_session: contractData.pricePerSession || 0,
  status: contractData.status || ContractStatus.DRAFT,
  notes: contractData.notes || '',
  created_by: contractData.createdBy || 'unknown',
});

/**
 * Generate contract code (Brisky01-999)
 */
export const generateContractCode = async (): Promise<string> => {
  try {
    const { data, error } = await supabase
      .from('contracts')
      .select('code')
      .order('created_at', { ascending: false })
      .limit(3000);

    if (error) throw error;
    if (!data || data.length === 0) {
      return 'Brisky001';
    }

    let maxNumber = 0;
    data.forEach(row => {
      const code = row.code || '';
      const match = code.match(/\d+/);
      if (match) {
        const num = parseInt(match[0]) || 0;
        if (num > maxNumber) maxNumber = num;
      }
    });
    
    const nextNumber = maxNumber + 1;
    
    if (nextNumber > 999) {
      throw new Error('Đã đạt giới hạn mã hợp đồng (999)');
    }
    
    return `Brisky${nextNumber.toString().padStart(3, '0')}`;
  } catch (error) {
    console.error('Error generating contract code:', error);
    // Fallback to timestamp-based code
    const timestamp = Date.now().toString().slice(-6);
    return `Brisky${timestamp}`;
  }
};

/**
 * Create new contract
 */
export const createContract = async (contractData: Partial<Contract>): Promise<string> => {
  try {
    const code = await generateContractCode();

    const { data: inserted, error } = await supabase
      .from('contracts')
      .insert(toContractInsert(contractData, code))
      .select('id')
      .single();
    if (error) throw error;

    const contractId = inserted.id as string;

    if (contractData.items?.length) {
      const itemRows = contractData.items.map(item => ({
        contract_id: contractId,
        type: item.type || 'course',
        item_ref_id: item.id || null,
        name: item.name || 'Khóa học',
        class_id: item.classId || contractData.classId || null,
        class_name: item.className || contractData.className || null,
        unit_price: item.unitPrice || 0,
        quantity: item.quantity || 0,
        subtotal: item.subtotal || 0,
        discount: item.discount || 0,
        final_price: item.finalPrice || 0,
        debt_sessions: item.debtSessions || 0,
        start_date: toDateOnly(item.startDate) || null,
        end_date: toDateOnly(item.endDate) || null,
        applied_discounts: item.appliedDiscounts || [],
      }));
      const { error: itemError } = await supabase.from('contract_items').insert(itemRows);
      if (itemError) throw itemError;
    }
    
    // Auto-create enrollment record for tracking
    try {
      const totalSessions = (contractData.items || []).reduce((sum, item) => {
        if (item.type === 'course') {
          return sum + (item.quantity || 0);
        }
        return sum;
      }, 0);
      
      // Determine enrollment type based on existing contracts
      const existingContracts = await getContracts({ studentId: contractData.studentId });
      const enrollmentType: EnrollmentRecord['type'] = 
        existingContracts.length > 1 ? 'Hợp đồng tái phí' : 'Hợp đồng mới';
      
      const enrollmentData: Omit<EnrollmentRecord, 'id'> = {
        studentName: contractData.studentName || '',
        studentId: contractData.studentId || '',
        sessions: totalSessions,
        type: enrollmentType,
        contractCode: code,
        contractId: contractId,
        originalAmount: contractData.subtotal || 0,
        finalAmount: contractData.totalAmount || 0,
        createdDate: new Date().toLocaleDateString('vi-VN'),
        createdBy: contractData.createdBy || 'unknown',
        staff: contractData.createdBy || 'unknown',
        note: contractData.notes || '',
      };
      
      await enrollmentService.createEnrollment(enrollmentData);
    } catch (enrollError) {
      console.warn('Failed to create enrollment record:', enrollError);
      // Don't fail contract creation if enrollment fails
    }
    
    return contractId;
  } catch (error: any) {
    console.error('Error creating contract:', error);
    throw new Error(error.message || 'Không thể tạo hợp đồng');
  }
};

/**
 * Get contract by ID
 */
export const getContract = async (id: string): Promise<Contract | null> => {
  try {
    const { data: contractRow, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!contractRow) {
      return null;
    }

    const { data: itemRows, error: itemError } = await supabase
      .from('contract_items')
      .select('*')
      .eq('contract_id', id);
    if (itemError) throw itemError;

    return mapContractRowToModel(contractRow as ContractRow, (itemRows || []) as ContractItemRow[]);
  } catch (error) {
    console.error('Error getting contract:', error);
    throw new Error('Không thể tải hợp đồng');
  }
};

/**
 * Get all contracts with filters
 * Note: Filters are applied client-side to avoid Firestore composite index requirements
 */
export const getContracts = async (filters?: {
  studentId?: string;
  status?: ContractStatus;
  type?: ContractType;
}): Promise<Contract[]> => {
  try {
    let q = supabase.from('contracts').select('*').order('created_at', { ascending: false });

    if (filters?.studentId) {
      q = q.eq('student_id', filters.studentId);
    }
    const { data: rows, error } = await q;
    if (error) throw error;

    let filteredRows = (rows || []) as ContractRow[];
    if (filters?.status) {
      filteredRows = filteredRows.filter(c => c.status === filters.status);
    }
    if (filters?.type) {
      filteredRows = filteredRows.filter(c => c.type === filters.type);
    }

    const ids = filteredRows.map(r => r.id);
    if (!ids.length) return [];

    const { data: itemRows, error: itemError } = await supabase
      .from('contract_items')
      .select('*')
      .in('contract_id', ids);
    if (itemError) throw itemError;

    const itemsByContract = new Map<string, ContractItemRow[]>();
    ((itemRows || []) as ContractItemRow[]).forEach(item => {
      const list = itemsByContract.get(item.contract_id) || [];
      list.push(item);
      itemsByContract.set(item.contract_id, list);
    });

    return filteredRows.map(row =>
      mapContractRowToModel(row, itemsByContract.get(row.id) || [])
    );
  } catch (error) {
    console.error('Error getting contracts:', error);
    throw new Error('Không thể tải danh sách hợp đồng');
  }
};

const buildContractUpdatePayload = (data: Partial<Contract>) => {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (data.type !== undefined) payload.type = data.type;
  if (data.studentId !== undefined) payload.student_id = data.studentId || null;
  if (data.studentName !== undefined) payload.student_name = data.studentName || null;
  if (data.studentDOB !== undefined) payload.student_dob = toDateOnly(data.studentDOB);
  if (data.parentName !== undefined) payload.parent_name = data.parentName || null;
  if (data.parentPhone !== undefined) payload.parent_phone = data.parentPhone || null;
  if (data.classId !== undefined) payload.class_id = data.classId || null;
  if (data.className !== undefined) payload.class_name = data.className || null;
  if (data.branch !== undefined) payload.branch = data.branch || null;
  if (data.subtotal !== undefined) payload.subtotal = data.subtotal;
  if (data.totalDiscount !== undefined) payload.total_discount = data.totalDiscount;
  if (data.totalAmount !== undefined) payload.total_amount = data.totalAmount;
  if (data.totalAmountInWords !== undefined) payload.total_amount_in_words = data.totalAmountInWords;
  if (data.paymentMethod !== undefined) payload.payment_method = data.paymentMethod;
  if (data.paidAmount !== undefined) payload.paid_amount = data.paidAmount;
  if (data.remainingAmount !== undefined) payload.remaining_amount = data.remainingAmount;
  if (data.contractDate !== undefined) payload.contract_date = toDateOnly(data.contractDate);
  if (data.startDate !== undefined) payload.start_date = toDateOnly(data.startDate);
  if (data.endDate !== undefined) payload.end_date = toDateOnly(data.endDate);
  if (data.paymentDate !== undefined) payload.payment_date = toDateOnly(data.paymentDate);
  if (data.nextPaymentDate !== undefined) payload.next_payment_date = toDateOnly(data.nextPaymentDate);
  if (data.totalSessions !== undefined) payload.total_sessions = data.totalSessions;
  if (data.pricePerSession !== undefined) payload.price_per_session = data.pricePerSession;
  if (data.status !== undefined) payload.status = data.status;
  if (data.notes !== undefined) payload.notes = data.notes;
  if (data.createdBy !== undefined) payload.created_by = data.createdBy;
  return payload;
};

/**
 * Update contract
 */
export const updateContract = async (id: string, data: Partial<Contract>): Promise<void> => {
  try {
    const payload = buildContractUpdatePayload(data);
    const { error } = await supabase.from('contracts').update(payload).eq('id', id);
    if (error) throw error;

    if (data.items) {
      const { error: deleteItemsError } = await supabase.from('contract_items').delete().eq('contract_id', id);
      if (deleteItemsError) throw deleteItemsError;
      if (data.items.length > 0) {
        const itemRows = data.items.map(item => ({
          contract_id: id,
          type: item.type || 'course',
          item_ref_id: item.id || null,
          name: item.name || 'Khóa học',
          class_id: item.classId || null,
          class_name: item.className || null,
          unit_price: item.unitPrice || 0,
          quantity: item.quantity || 0,
          subtotal: item.subtotal || 0,
          discount: item.discount || 0,
          final_price: item.finalPrice || 0,
          debt_sessions: item.debtSessions || 0,
          start_date: toDateOnly(item.startDate) || null,
          end_date: toDateOnly(item.endDate) || null,
          applied_discounts: item.appliedDiscounts || [],
        }));
        const { error: insertItemsError } = await supabase.from('contract_items').insert(itemRows);
        if (insertItemsError) throw insertItemsError;
      }
    }
  } catch (error) {
    console.error('Error updating contract:', error);
    throw new Error('Không thể cập nhật hợp đồng');
  }
};

/**
 * Delete contract (with cascade delete enrollment)
 */
export const deleteContract = async (id: string): Promise<void> => {
  try {
    // Get contract first to get the code
    const contract = await getContract(id);
    const { error } = await supabase.from('contracts').delete().eq('id', id);
    if (error) throw error;
    
    // Cascade delete enrollment record
    if (contract?.code) {
      try {
        await enrollmentService.deleteEnrollmentByContractCode(contract.code);
      } catch (enrollError) {
        console.warn('Failed to delete enrollment record:', enrollError);
      }
    }
  } catch (error) {
    console.error('Error deleting contract:', error);
    throw new Error('Không thể xóa hợp đồng');
  }
};

/**
 * Update contract status
 */
export const updateContractStatus = async (
  id: string,
  status: ContractStatus
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('contracts')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  } catch (error) {
    console.error('Error updating contract status:', error);
    throw new Error('Không thể cập nhật trạng thái hợp đồng');
  }
};

/**
 * Record payment for contract
 */
export const recordPayment = async (
  id: string,
  amount: number,
  paymentDate?: string
): Promise<void> => {
  try {
    const contract = await getContract(id);
    if (!contract) {
      throw new Error('Hợp đồng không tồn tại');
    }
    
    const newPaidAmount = contract.paidAmount + amount;
    const newRemainingAmount = contract.totalAmount - newPaidAmount;
    
    const { error } = await supabase
      .from('contracts')
      .update({
        paid_amount: newPaidAmount,
        remaining_amount: newRemainingAmount,
        payment_date: toDateOnly(paymentDate || new Date().toISOString()),
        status: newRemainingAmount === 0 ? ContractStatus.PAID : ContractStatus.PARTIAL,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;
  } catch (error) {
    console.error('Error recording payment:', error);
    throw new Error('Không thể ghi nhận thanh toán');
  }
};
