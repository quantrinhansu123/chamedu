/**
 * Center Service — Supabase
 */

import { supabase } from '../config/supabase';

const SETTINGS_ID = 'center_settings';

export interface Center {
  id?: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  email?: string;
  manager?: string;
  workingHours?: string;
  signatureUrl?: string;
  isMain: boolean;
  status: 'Active' | 'Inactive';
  createdAt?: string;
  updatedAt?: string;
}

export interface CenterSettings {
  companyName: string;
  taxCode?: string;
  logo?: string;
  primaryColor?: string;
  defaultCenter?: string;
  currency: string;
  timezone: string;
}

type CenterRow = {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  manager: string | null;
  working_hours: string | null;
  signature_url: string | null;
  is_main: boolean | null;
  status: string | null;
  created_at: string;
  updated_at: string;
};

const mapRow = (row: CenterRow): Center => ({
  id: row.id,
  name: row.name,
  code: row.code || '',
  address: row.address || '',
  phone: row.phone || '',
  email: row.email || undefined,
  manager: row.manager || undefined,
  workingHours: row.working_hours || undefined,
  signatureUrl: row.signature_url || undefined,
  isMain: !!row.is_main,
  status: (row.status as Center['status']) || 'Active',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toInsert = (data: Omit<Center, 'id'>) => ({
  name: data.name,
  code: data.code || null,
  address: data.address,
  phone: data.phone,
  email: data.email || null,
  manager: data.manager || null,
  working_hours: data.workingHours || null,
  signature_url: data.signatureUrl || null,
  is_main: data.isMain ?? false,
  status: data.status || 'Active',
});

export const createCenter = async (data: Omit<Center, 'id'>): Promise<string> => {
  const { data: row, error } = await supabase.from('centers').insert(toInsert(data)).select('id').single();
  if (error) {
    console.error('Error creating center:', error);
    throw new Error(error.message || 'Không thể tạo trung tâm');
  }
  return row.id;
};

export const getCenters = async (): Promise<Center[]> => {
  const { data, error } = await supabase
    .from('centers')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Error getting centers:', error);
    throw new Error(error.message || 'Không thể tải danh sách trung tâm');
  }
  return (data as CenterRow[]).map(mapRow);
};

export const updateCenter = async (id: string, data: Partial<Center>): Promise<void> => {
  const payload: Record<string, unknown> = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.code !== undefined) payload.code = data.code;
  if (data.address !== undefined) payload.address = data.address;
  if (data.phone !== undefined) payload.phone = data.phone;
  if (data.email !== undefined) payload.email = data.email;
  if (data.manager !== undefined) payload.manager = data.manager;
  if (data.workingHours !== undefined) payload.working_hours = data.workingHours;
  if (data.signatureUrl !== undefined) payload.signature_url = data.signatureUrl;
  if (data.isMain !== undefined) payload.is_main = data.isMain;
  if (data.status !== undefined) payload.status = data.status;

  const { error } = await supabase.from('centers').update(payload).eq('id', id);
  if (error) {
    console.error('Error updating center:', error);
    throw new Error(error.message || 'Không thể cập nhật trung tâm');
  }
};

export const deleteCenter = async (id: string): Promise<void> => {
  const { error } = await supabase.from('centers').delete().eq('id', id);
  if (error) {
    console.error('Error deleting center:', error);
    throw new Error(error.message || 'Không thể xóa trung tâm');
  }
};

export const getSettings = async (): Promise<CenterSettings | null> => {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('id', SETTINGS_ID)
    .maybeSingle();
  if (error) {
    console.error('Error getting settings:', error);
    return null;
  }
  return (data?.value as CenterSettings) || null;
};

export const saveSettings = async (settings: CenterSettings): Promise<void> => {
  const { error } = await supabase.from('app_settings').upsert({
    id: SETTINGS_ID,
    value: settings,
  });
  if (error) {
    console.error('Error saving settings:', error);
    throw new Error(error.message || 'Không thể lưu cài đặt');
  }
};
