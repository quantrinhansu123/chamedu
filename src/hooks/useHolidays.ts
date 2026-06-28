/** Stub — holidays chưa có bảng Supabase */
import { useState, useEffect } from 'react';

export const useHolidays = () => {
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => setLoading(false), []);
  return {
    holidays,
    loading,
    createHoliday: async () => {
      throw new Error('Lịch nghỉ chưa migrate sang Supabase');
    },
    updateHoliday: async () => {
      throw new Error('Lịch nghỉ chưa migrate sang Supabase');
    },
    deleteHoliday: async () => {
      throw new Error('Lịch nghỉ chưa migrate sang Supabase');
    },
    refresh: async () => setHolidays([]),
  };
};
