/** Auto-stub: Firebase removed */
import { useState, useEffect } from 'react';

export const useSettlementInvoices = (..._args: any[]) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setLoading(false); }, []);
  return { data, invoices: data, loading, error, refresh: async () => setData([]) };
};
