import { useState, useEffect, useCallback } from 'react';
import { getCurriculums, Curriculum, CurriculumStatus } from '../services/curriculumService';

export const useCurriculums = (filters?: { status?: CurriculumStatus }) => {
  const [curriculums, setCurriculums] = useState<Curriculum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCurriculums();
      setCurriculums(
        filters?.status ? data.filter((c) => c.status === filters.status) : data
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách gói học');
    } finally {
      setLoading(false);
    }
  }, [filters?.status]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { curriculums, loading, error, refresh };
};
