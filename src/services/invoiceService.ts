import { supabase } from '../config/supabase';

export interface InvoiceItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}
export interface Invoice {
  id?: string;
  invoiceCode: string;
  customerName: string;
  customerPhone?: string;
  studentId?: string;
  studentName?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  total: number;
  status: InvoiceStatus;
  paymentMethod?: string;
  note?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  paidAt?: string;
}

export type InvoiceStatus = 'Chờ thanh toán' | 'Đã thanh toán' | 'Đã hủy';

export const getInvoices = async (): Promise<Invoice[]> => {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  
  return (data || []).map(row => ({
    id: row.id,
    invoiceCode: row.invoice_code,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    studentId: row.student_id,
    studentName: row.student_name,
    items: row.items || [],
    subtotal: row.subtotal,
    discount: row.discount,
    total: row.total,
    status: row.status as InvoiceStatus,
    paymentMethod: row.payment_method,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    paidAt: row.paid_at,
  }));
};

const generateInvoiceCode = async (): Promise<string> => {
  const timestamp = Date.now().toString().slice(-6);
  return `INV${timestamp}`;
};

export const createInvoice = async (data: Omit<Invoice, 'id' | 'invoiceCode'>): Promise<string> => {
  const code = await generateInvoiceCode();
  const payload = {
    invoice_code: code,
    customer_name: data.customerName,
    customer_phone: data.customerPhone,
    student_id: data.studentId,
    student_name: data.studentName,
    items: data.items,
    subtotal: data.subtotal,
    discount: data.discount,
    total: data.total,
    status: data.status,
    payment_method: data.paymentMethod,
    note: data.note,
    created_by: data.createdBy,
  };
  
  const { data: inserted, error } = await supabase
    .from('invoices')
    .insert(payload)
    .select('id')
    .single();
  if (error) throw error;
  return inserted.id;
};

export const updateInvoice = async (id: string, data: Partial<Invoice>): Promise<void> => {
  const payload: any = { updated_at: new Date().toISOString() };
  if (data.customerName !== undefined) payload.customer_name = data.customerName;
  if (data.customerPhone !== undefined) payload.customer_phone = data.customerPhone;
  if (data.studentId !== undefined) payload.student_id = data.studentId;
  if (data.studentName !== undefined) payload.student_name = data.studentName;
  if (data.items !== undefined) payload.items = data.items;
  if (data.subtotal !== undefined) payload.subtotal = data.subtotal;
  if (data.discount !== undefined) payload.discount = data.discount;
  if (data.total !== undefined) payload.total = data.total;
  if (data.status !== undefined) payload.status = data.status;
  if (data.paymentMethod !== undefined) payload.payment_method = data.paymentMethod;
  if (data.note !== undefined) payload.note = data.note;
  
  const { error } = await supabase.from('invoices').update(payload).eq('id', id);
  if (error) throw error;
};

export const markAsPaid = async (id: string): Promise<void> => {
  const { error } = await supabase.from('invoices').update({
    status: 'Đã thanh toán',
    paid_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).eq('id', id);
  if (error) throw error;
};

export const cancelInvoice = async (id: string): Promise<void> => {
  const { error } = await supabase.from('invoices').update({
    status: 'Đã hủy',
    updated_at: new Date().toISOString()
  }).eq('id', id);
  if (error) throw error;
};

export const deleteInvoice = async (id: string): Promise<void> => {
  const { error } = await supabase.from('invoices').delete().eq('id', id);
  if (error) throw error;
};

export const createBulkInvoices = async (invoices: Omit<Invoice, 'id' | 'invoiceCode'>[]): Promise<void> => {
  if (invoices.length === 0) return;

  const timestamp = Date.now().toString().slice(-6);
  
  const payloads = invoices.map((data, index) => ({
    invoice_code: `INV${timestamp}${index.toString().padStart(3, '0')}`,
    customer_name: data.customerName,
    customer_phone: data.customerPhone,
    student_id: data.studentId,
    student_name: data.studentName,
    items: data.items,
    subtotal: data.subtotal,
    discount: data.discount,
    total: data.total,
    status: data.status,
    payment_method: data.paymentMethod,
    note: data.note,
    created_by: data.createdBy,
  }));

  const { error } = await supabase.from('invoices').insert(payloads);
  if (error) throw error;
};
