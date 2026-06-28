/**
 * Staff Service — Supabase
 */

import { supabase } from '../config/supabase';
import { Staff } from '../../types';

type StaffRow = {
  id: string;
  code: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  dob: string | null;
  address: string | null;
  department: string | null;
  position: string | null;
  role: string | null;
  roles: string[] | null;
  branch: string | null;
  status: string | null;
  start_date: string | null;
  uid: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

const mapRow = (row: StaffRow): Staff =>
  ({
    id: row.id,
    code: row.code || '',
    name: row.name,
    phone: row.phone || '',
    email: row.email || '',
    dob: row.dob || '',
    address: row.address || '',
    department: row.department || '',
    position: row.position || '',
    role: row.role || '',
    roles: row.roles || [],
    branch: row.branch || '',
    status: row.status || 'Đang làm việc',
    startDate: row.start_date || '',
    uid: row.uid || '',
    ...(row.metadata || {}),
  }) as Staff;

const toInsert = (data: Omit<Staff, 'id'>) => ({
  code: data.code || null,
  name: data.name,
  phone: data.phone || null,
  email: data.email || null,
  dob: data.dob ? data.dob.slice(0, 10) : null,
  address: (data as any).address || null,
  department: data.department || null,
  position: data.position || null,
  role: data.role || null,
  roles: data.roles || [],
  branch: data.branch || null,
  status: data.status || 'Đang làm việc',
  start_date: data.startDate ? data.startDate.slice(0, 10) : null,
  uid: data.uid || null,
});

export class StaffService {
  static async getStaff(filters?: {
    department?: string;
    role?: string;
    status?: string;
  }): Promise<Staff[]> {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;

    let staffList = (data as StaffRow[]).map(mapRow);
    if (filters?.department) {
      staffList = staffList.filter((s) => s.department === filters.department);
    }
    if (filters?.role) {
      staffList = staffList.filter((s) => s.role === filters.role);
    }
    if (filters?.status) {
      staffList = staffList.filter((s) => s.status === filters.status);
    }
    return staffList;
  }

  static async getStaffById(id: string): Promise<Staff | null> {
    const { data, error } = await supabase.from('staff').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? mapRow(data as StaffRow) : null;
  }

  static async createStaff(data: Omit<Staff, 'id'>): Promise<string> {
    const { data: row, error } = await supabase.from('staff').insert(toInsert(data)).select('id').single();
    if (error) throw error;
    return row.id;
  }

  static async updateStaff(id: string, data: Partial<Staff>): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (data.code !== undefined) payload.code = data.code;
    if (data.name !== undefined) payload.name = data.name;
    if (data.phone !== undefined) payload.phone = data.phone;
    if (data.email !== undefined) payload.email = data.email;
    if (data.dob !== undefined) payload.dob = data.dob ? data.dob.slice(0, 10) : null;
    if (data.department !== undefined) payload.department = data.department;
    if (data.position !== undefined) payload.position = data.position;
    if (data.role !== undefined) payload.role = data.role;
    if (data.roles !== undefined) payload.roles = data.roles;
    if (data.branch !== undefined) payload.branch = data.branch;
    if (data.status !== undefined) payload.status = data.status;
    if (data.startDate !== undefined) payload.start_date = data.startDate ? data.startDate.slice(0, 10) : null;
    if (data.uid !== undefined) payload.uid = data.uid;

    const { error } = await supabase.from('staff').update(payload).eq('id', id);
    if (error) throw error;
  }

  static async deleteStaff(id: string): Promise<void> {
    const { error } = await supabase.from('staff').delete().eq('id', id);
    if (error) throw error;
  }

  static async getTeachers(): Promise<Staff[]> {
    const allStaff = await this.getStaff();
    return allStaff.filter(
      (s) =>
        s.role === 'Giáo viên' ||
        s.position === 'Giáo Viên Việt' ||
        s.position === 'Giáo Viên Nước Ngoài'
    );
  }

  static async getAssistants(): Promise<Staff[]> {
    const allStaff = await this.getStaff();
    return allStaff.filter((s) => s.role === 'Trợ giảng' || s.position === 'Trợ Giảng');
  }
}

export const getStaff = StaffService.getStaff.bind(StaffService);
export const getStaffById = StaffService.getStaffById.bind(StaffService);
export const createStaff = StaffService.createStaff.bind(StaffService);
export const updateStaff = StaffService.updateStaff.bind(StaffService);
export const deleteStaff = StaffService.deleteStaff.bind(StaffService);
export const getTeachers = StaffService.getTeachers.bind(StaffService);
export const getAssistants = StaffService.getAssistants.bind(StaffService);
