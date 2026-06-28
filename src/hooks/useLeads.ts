import { useState, useEffect } from 'react';
import { Lead, LeadService } from '../services/leadService';
import { supabase } from '../config/supabase';

export const useLeads = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchLeads = async () => {
    try {
      setLoading(true);
      const data = await LeadService.getLeads();
      setLeads(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải danh sách leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
    
    // Subscribe to realtime changes
    const channel = supabase.channel('public:leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchLeads();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const stats = {
    total: leads.length,
    new: leads.filter(l => l.status === 'Mới').length,
    contacted: leads.filter(l => l.status === 'Đang liên hệ' || l.status === 'Quan tâm').length,
    converted: leads.filter(l => l.status === 'Đăng ký').length
  };

  return {
    leads,
    stats,
    loading,
    error,
    createLead: async (data: any) => {
      const newLead = await LeadService.createLead(data);
      await fetchLeads();
      return newLead;
    },
    updateLead: async (id: string, data: any) => {
      await LeadService.updateLead(id, data);
      await fetchLeads();
    },
    updateStatus: async (id: string, status: any) => {
      await LeadService.updateLead(id, { status });
      await fetchLeads();
    },
    deleteLead: async (id: string) => {
      await LeadService.deleteLead(id);
      await fetchLeads();
    },
    refresh: fetchLeads,
  };
};
