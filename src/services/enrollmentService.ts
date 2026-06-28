/**
 * Enrollment Service
 * Supabase operations for enrollment records
 */

import { EnrollmentRecord } from '../../types';
import { supabase } from '../config/supabase';

type EnrollmentRow = {
  id: string;
  student_name: string;
  student_id: string | null;
  class_id: string | null;
  class_name: string | null;
  sessions: number;
  type: EnrollmentRecord['type'];
  contract_code: string | null;
  contract_id: string | null;
  original_amount: number | null;
  final_amount: number | null;
  created_date: string | null;
  created_by: string;
  staff: string | null;
  note: string | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
};

const mapRowToEnrollment = (row: EnrollmentRow): EnrollmentRecord => ({
  id: row.id,
  studentName: row.student_name,
  studentId: row.student_id || undefined,
  classId: row.class_id || undefined,
  className: row.class_name || undefined,
  sessions: row.sessions || 0,
  type: row.type,
  contractCode: row.contract_code || undefined,
  contractId: row.contract_id || undefined,
  originalAmount: row.original_amount || undefined,
  finalAmount: row.final_amount || undefined,
  createdDate: row.created_date || undefined,
  createdAt: row.created_at || undefined,
  updatedAt: row.updated_at || undefined,
  createdBy: row.created_by,
  staff: row.staff || undefined,
  note: row.note || undefined,
  notes: row.note || undefined,
  reason: row.reason || undefined,
});

const toInsertPayload = (data: Omit<EnrollmentRecord, 'id'>) => ({
  student_name: data.studentName,
  student_id: data.studentId || null,
  class_id: data.classId || null,
  class_name: data.className || null,
  sessions: data.sessions || 0,
  type: data.type,
  contract_code: data.contractCode || null,
  contract_id: data.contractId || null,
  original_amount: data.originalAmount || 0,
  final_amount: data.finalAmount || 0,
  created_date: data.createdDate || new Date().toLocaleDateString('vi-VN'),
  created_by: data.createdBy,
  staff: data.staff || data.createdBy || null,
  note: data.note || data.notes || null,
  reason: data.reason || null,
});

/**
 * Check if enrollment already exists for student + contract combination
 * Returns existing enrollment if found, null otherwise
 */
export const checkDuplicateEnrollment = async (
  studentId: string | undefined,
  contractId: string | undefined
): Promise<EnrollmentRecord | null> => {
  // Skip check if no contractId (manual enrollments allowed to be multiple)
  if (!studentId || !contractId) return null;

  try {
    const { data, error } = await supabase
      .from('enrollments')
      .select('*')
      .eq('student_id', studentId)
      .eq('contract_id', contractId)
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return mapRowToEnrollment(data as EnrollmentRow);
  } catch (error) {
    console.error('Error checking duplicate enrollment:', error);
    return null; // Fail-safe: allow creation if check fails
  }
};

export const getEnrollments = async (filters?: {
  type?: string;
  month?: number;
  year?: number;
}): Promise<EnrollmentRecord[]> => {
  try {
    const { data, error } = await supabase
      .from('enrollments')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    let records = ((data || []) as EnrollmentRow[]).map(mapRowToEnrollment);

    // Client-side filtering for type, month, year
    if (filters?.type && filters.type !== 'ALL') {
      records = records.filter(r => r.type === filters.type);
    }
    
    if (filters?.month && filters?.year) {
      records = records.filter(r => {
        const date = new Date(r.createdDate.split('/').reverse().join('-'));
        return date.getMonth() + 1 === filters.month && date.getFullYear() === filters.year;
      });
    }

    return records;
  } catch (error) {
    console.error('Error fetching enrollments:', error);
    throw error;
  }
};

export const createEnrollment = async (data: Omit<EnrollmentRecord, 'id'>): Promise<string> => {
  try {
    // Check for duplicate enrollment (by studentId + contractId)
    const existing = await checkDuplicateEnrollment(data.studentId, data.contractId);
    if (existing) {
      console.warn(
        `Enrollment already exists for student ${data.studentId} + contract ${data.contractId}. ` +
        `Skipping creation. Existing ID: ${existing.id}`
      );
      return existing.id;
    }

    const { data: inserted, error } = await supabase
      .from('enrollments')
      .insert(toInsertPayload(data))
      .select('id')
      .single();
    if (error) throw error;
    return inserted.id as string;
  } catch (error) {
    console.error('Error creating enrollment:', error);
    throw error;
  }
};

export const updateEnrollment = async (id: string, data: Partial<EnrollmentRecord>): Promise<void> => {
  try {
    const payload: Record<string, unknown> = {};
    if (data.studentName !== undefined) payload.student_name = data.studentName;
    if (data.studentId !== undefined) payload.student_id = data.studentId || null;
    if (data.classId !== undefined) payload.class_id = data.classId || null;
    if (data.className !== undefined) payload.class_name = data.className || null;
    if (data.sessions !== undefined) payload.sessions = data.sessions;
    if (data.type !== undefined) payload.type = data.type;
    if (data.contractCode !== undefined) payload.contract_code = data.contractCode || null;
    if (data.contractId !== undefined) payload.contract_id = data.contractId || null;
    if (data.originalAmount !== undefined) payload.original_amount = data.originalAmount;
    if (data.finalAmount !== undefined) payload.final_amount = data.finalAmount;
    if (data.createdDate !== undefined) payload.created_date = data.createdDate;
    if (data.createdBy !== undefined) payload.created_by = data.createdBy;
    if (data.staff !== undefined) payload.staff = data.staff || null;
    if (data.note !== undefined || data.notes !== undefined) payload.note = data.note || data.notes || null;
    if (data.reason !== undefined) payload.reason = data.reason || null;

    const { error } = await supabase.from('enrollments').update(payload).eq('id', id);
    if (error) throw error;
  } catch (error) {
    console.error('Error updating enrollment:', error);
    throw error;
  }
};

export const deleteEnrollment = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase.from('enrollments').delete().eq('id', id);
    if (error) throw error;
  } catch (error) {
    console.error('Error deleting enrollment:', error);
    throw error;
  }
};

/**
 * Check if enrollment exists for a contract
 */
export const getEnrollmentByContractCode = async (contractCode: string): Promise<EnrollmentRecord | null> => {
  try {
    const { data, error } = await supabase
      .from('enrollments')
      .select('*')
      .eq('contract_code', contractCode)
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return mapRowToEnrollment(data as EnrollmentRow);
  } catch (error) {
    console.error('Error finding enrollment by contract:', error);
    return null;
  }
};

/**
 * Delete enrollment by contract code (for cascade delete)
 */
export const deleteEnrollmentByContractCode = async (contractCode: string): Promise<void> => {
  try {
    const enrollment = await getEnrollmentByContractCode(contractCode);
    if (enrollment) {
      await deleteEnrollment(enrollment.id);
    }
  } catch (error) {
    console.error('Error deleting enrollment by contract:', error);
  }
};
