/**
 * useStaff Hook — Supabase polling
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Staff } from '../../types';
import * as staffService from '../services/staffService';

interface UseStaffProps {
  department?: string;
  role?: string;
  status?: string;
}

interface UseStaffReturn {
  staff: Staff[];
  loading: boolean;
  error: string | null;
  createStaff: (data: Omit<Staff, 'id'>) => Promise<string>;
  updateStaff: (id: string, data: Partial<Staff>) => Promise<void>;
  deleteStaff: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export const useStaff = (props?: UseStaffProps): UseStaffReturn => {
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStaff = useCallback(async () => {
    try {
      setError(null);
      const data = await staffService.getStaff();
      setAllStaff(data);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách nhân viên');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchStaff();
    const timer = setInterval(fetchStaff, 15000);
    return () => clearInterval(timer);
  }, [fetchStaff]);

  const staff = useMemo(() => {
    let filtered = allStaff;
    if (props?.department) filtered = filtered.filter((s) => s.department === props.department);
    if (props?.role) filtered = filtered.filter((s) => s.role === props.role);
    if (props?.status) filtered = filtered.filter((s) => s.status === props.status);
    return filtered;
  }, [allStaff, props?.department, props?.role, props?.status]);

  const createStaff = async (data: Omit<Staff, 'id'>): Promise<string> => {
    const id = await staffService.createStaff(data);
    await fetchStaff();
    return id;
  };

  const updateStaff = async (id: string, data: Partial<Staff>): Promise<void> => {
    await staffService.updateStaff(id, data);
    await fetchStaff();
  };

  const deleteStaff = async (id: string): Promise<void> => {
    await staffService.deleteStaff(id);
    await fetchStaff();
  };

  return {
    staff,
    loading,
    error,
    createStaff,
    updateStaff,
    deleteStaff,
    refresh: fetchStaff,
  };
};
