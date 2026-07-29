import { useCallback, useEffect, useState } from 'react';
import {
  getTrainingRevenueSummary,
  type TrainingRevenueApiParams,
  type TrainingRevenueApiResponse,
} from '../services/trainingRevenueApiService';

interface UseTrainingRevenueReturn {
  data: TrainingRevenueApiResponse | null;
  loading: boolean;
  error: string | null;
  refresh: (params?: TrainingRevenueApiParams) => Promise<void>;
}

export const useTrainingRevenue = (
  initialParams?: TrainingRevenueApiParams
): UseTrainingRevenueReturn => {
  const [data, setData] = useState<TrainingRevenueApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<TrainingRevenueApiParams | undefined>(
    initialParams
  );

  const refresh = useCallback(async (nextParams?: TrainingRevenueApiParams) => {
    const query = nextParams ?? params ?? {};
    if (nextParams) setParams(nextParams);

    try {
      setLoading(true);
      setError(null);
      const result = await getTrainingRevenueSummary(query);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải doanh thu');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    refresh(initialParams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialParams?.year, initialParams?.month, initialParams?.branch, initialParams?.classId]);

  return { data, loading, error, refresh };
};
