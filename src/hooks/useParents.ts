/** Supabase: parents derived from students */
import { useState, useEffect, useCallback } from 'react';
import { Parent } from '../../types';
import {
  ParentWithChildren,
  createParent,
  deleteParent,
  getParentsWithChildren,
  updateParent,
} from '../services/parentService';

export const useParents = (searchTerm?: string) => {
  const [parents, setParents] = useState<ParentWithChildren[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setParents(await getParentsWithChildren(searchTerm));
    } catch (err: any) {
      setError(err.message || 'Khong the tai phu huynh');
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreateParent = useCallback(async (data: Omit<Parent, 'id'>) => {
    const id = await createParent(data);
    await refresh();
    return id;
  }, [refresh]);

  const handleUpdateParent = useCallback(async (id: string, data: Partial<Parent>) => {
    await updateParent(id, data);
    await refresh();
  }, [refresh]);

  const handleDeleteParent = useCallback(async (id: string) => {
    await deleteParent(id);
    await refresh();
  }, [refresh]);

  return {
    parents,
    loading,
    error,
    refresh,
    createParent: handleCreateParent,
    updateParent: handleUpdateParent,
    deleteParent: handleDeleteParent,
  };
};
