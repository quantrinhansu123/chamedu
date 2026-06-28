/**
 * useInvoices Hook
 */

import { useState, useEffect } from 'react';
import * as invoiceService from '../services/invoiceService';
import { Invoice, InvoiceStatus } from '../services/invoiceService';

interface UseInvoicesReturn {
  invoices: Invoice[];
  loading: boolean;
  error: string | null;
  totalRevenue: number;
  pendingCount: number;
  createInvoice: (data: Omit<Invoice, 'id' | 'invoiceCode'>) => Promise<string>;
  createBulkInvoices: (data: Omit<Invoice, 'id' | 'invoiceCode'>[]) => Promise<void>;
  updateInvoice: (id: string, data: Partial<Invoice>) => Promise<void>;
  markAsPaid: (id: string) => Promise<void>;
  cancelInvoice: (id: string) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export const useInvoices = (): UseInvoicesReturn => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await invoiceService.getInvoices();
      setInvoices(data);
    } catch (err: any) {
      setError(err?.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const totalRevenue = invoices
    .filter(i => i.status === 'Đã thanh toán')
    .reduce((sum, i) => sum + i.total, 0);
  
  const pendingCount = invoices.filter(i => i.status === 'Chờ thanh toán').length;

  const createInvoice = async (data: Omit<Invoice, 'id' | 'invoiceCode'>): Promise<string> => {
    const id = await invoiceService.createInvoice(data);
    await fetchInvoices();
    return id;
  };

  const updateInvoice = async (id: string, data: Partial<Invoice>): Promise<void> => {
    await invoiceService.updateInvoice(id, data);
    await fetchInvoices();
  };

  const markAsPaid = async (id: string): Promise<void> => {
    await invoiceService.markAsPaid(id);
    await fetchInvoices();
  };

  const cancelInvoice = async (id: string): Promise<void> => {
    await invoiceService.cancelInvoice(id);
    await fetchInvoices();
  };

  const deleteInvoice = async (id: string): Promise<void> => {
    await invoiceService.deleteInvoice(id);
    await fetchInvoices();
  };

  const createBulkInvoices = async (data: Omit<Invoice, 'id' | 'invoiceCode'>[]): Promise<void> => {
    await invoiceService.createBulkInvoices(data);
    await fetchInvoices();
  };

  return {
    invoices,
    loading,
    error,
    totalRevenue,
    pendingCount,
    createInvoice,
    createBulkInvoices,
    updateInvoice,
    markAsPaid,
    cancelInvoice,
    deleteInvoice,
    refresh: fetchInvoices,
  };
};
