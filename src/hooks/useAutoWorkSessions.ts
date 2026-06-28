/** Auto-stub: Firebase removed */
import { useState, useEffect } from 'react';

export const useAutoWorkSessions = (..._args: any[]) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setLoading(false); }, []);
  return { data, loading, error, refresh: async () => setData([]) };
};
