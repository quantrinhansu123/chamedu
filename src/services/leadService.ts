import { supabase } from '../config/supabase';

export interface Lead {
  id?: string;
  name: string;
  phone: string;
  email?: string;
  childName?: string;
  childAge?: number;
  source: LeadSource;
  status: LeadStatus;
  assignedTo?: string;
  assignedToName?: string;
  // Support multiple campaigns
  campaignIds?: string[];
  campaignNames?: string[];
  // Legacy single campaign (for backward compatibility)
  campaignId?: string;
  campaignName?: string;
  note?: string;
  lastContactDate?: string;
  nextFollowUp?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type LeadStatus = 'Mới' | 'Đang liên hệ' | 'Quan tâm' | 'Hẹn test' | 'Đã test' | 'Đăng ký' | 'Từ chối';
export type LeadSource = 'Facebook' | 'Zalo' | 'Website' | 'Giới thiệu' | 'Walk-in' | 'Khác';

export class LeadService {
  static async getLeads(): Promise<Lead[]> {
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(this.mapRowToLead);
  }

  static async createLead(lead: Omit<Lead, 'id'>): Promise<Lead> {
    const payload = this.toInsertPayload(lead);
    const { data, error } = await supabase.from('leads').insert([payload]).select().single();
    if (error) throw error;
    return this.mapRowToLead(data);
  }

  static async updateLead(id: string, lead: Partial<Lead>): Promise<void> {
    const payload = this.toUpdatePayload(lead);
    const { error } = await supabase.from('leads').update(payload).eq('id', id);
    if (error) throw error;
  }

  static async deleteLead(id: string): Promise<void> {
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) throw error;
  }

  private static mapRowToLead(row: any): Lead {
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      childName: row.child_name,
      childAge: row.child_age,
      source: row.source as LeadSource,
      status: row.status as LeadStatus,
      assignedTo: row.assigned_to,
      assignedToName: row.assigned_to_name,
      campaignIds: row.campaign_ids || [],
      campaignNames: row.campaign_names || [],
      note: row.note,
      lastContactDate: row.last_contact_date,
      nextFollowUp: row.next_follow_up,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private static toInsertPayload(lead: Partial<Lead>): any {
    return {
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      child_name: lead.childName,
      child_age: lead.childAge,
      source: lead.source,
      status: lead.status || 'Mới',
      assigned_to: lead.assignedTo,
      assigned_to_name: lead.assignedToName,
      campaign_ids: lead.campaignIds || [],
      campaign_names: lead.campaignNames || [],
      note: lead.note,
      last_contact_date: lead.lastContactDate,
      next_follow_up: lead.nextFollowUp,
    };
  }

  private static toUpdatePayload(lead: Partial<Lead>): any {
    const payload: any = { updated_at: new Date().toISOString() };
    if (lead.name !== undefined) payload.name = lead.name;
    if (lead.phone !== undefined) payload.phone = lead.phone;
    if (lead.email !== undefined) payload.email = lead.email;
    if (lead.childName !== undefined) payload.child_name = lead.childName;
    if (lead.childAge !== undefined) payload.child_age = lead.childAge;
    if (lead.source !== undefined) payload.source = lead.source;
    if (lead.status !== undefined) payload.status = lead.status;
    if (lead.assignedTo !== undefined) payload.assigned_to = lead.assignedTo;
    if (lead.assignedToName !== undefined) payload.assigned_to_name = lead.assignedToName;
    if (lead.campaignIds !== undefined) payload.campaign_ids = lead.campaignIds;
    if (lead.campaignNames !== undefined) payload.campaign_names = lead.campaignNames;
    if (lead.note !== undefined) payload.note = lead.note;
    if (lead.lastContactDate !== undefined) payload.last_contact_date = lead.lastContactDate;
    if (lead.nextFollowUp !== undefined) payload.next_follow_up = lead.nextFollowUp;
    return payload;
  }
}
