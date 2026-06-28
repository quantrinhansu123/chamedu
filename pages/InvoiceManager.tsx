/**
 * Invoice Manager Page
 * Hóa đơn bán sách/sản phẩm
 */

import React, { useState } from 'react';
import { FileText, Plus, Search, X, Trash2, CheckCircle, XCircle, Printer, AlertTriangle } from 'lucide-react';
import { ModalPortal } from '@/components/modal-portal';
import { useInvoices } from '../src/hooks/useInvoices';
import { Invoice, InvoiceItem, InvoiceStatus } from '../src/services/invoiceService';
import { formatCurrency } from '../src/utils/currencyUtils';
import { usePermissions } from '../src/hooks/usePermissions';
import { generateMonthlyInvoicesPreview, CalculationMethod } from '../src/services/monthlyInvoiceService';

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  'Chờ thanh toán': 'bg-yellow-100 text-yellow-700',
  'Đã thanh toán': 'bg-green-100 text-green-700',
  'Đã hủy': 'bg-red-100 text-red-700',
};

export const InvoiceManager: React.FC = () => {
  const { invoices, loading, error, totalRevenue, pendingCount, createInvoice, createBulkInvoices, markAsPaid, cancelInvoice, deleteInvoice } = useInvoices();
  
  // Permissions
  const { canCreate, canDelete, requiresApproval, isAdmin } = usePermissions();
  const canCreateInvoice = canCreate('invoices');
  const canDeleteInvoice = canDelete('invoices');
  const needsApprovalToDelete = requiresApproval('invoices');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | ''>('');
  const [showModal, setShowModal] = useState(false);
  const [showMonthlyModal, setShowMonthlyModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [billInvoice, setBillInvoice] = useState<Invoice | null>(null);

  const handleMarkPaid = async (id: string) => {
    try {
      await markAsPaid(id);
    } catch (err) {
      alert('Không thể cập nhật');
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Hủy hóa đơn này?')) return;
    try {
      await cancelInvoice(id);
    } catch (err) {
      alert('Không thể hủy');
    }
  };

  const handleDelete = async (id: string) => {
    // CSKH needs admin approval to delete
    if (needsApprovalToDelete && !isAdmin) {
      setPendingDeleteId(id);
      alert('Yêu cầu xóa hóa đơn đã được gửi. Cần Admin duyệt để hoàn tất.');
      return;
    }
    
    if (!confirm('Xóa hóa đơn này?')) return;
    try {
      await deleteInvoice(id);
    } catch (err) {
      alert('Không thể xóa');
    }
  };

  // Filter invoices
  let filteredInvoices = invoices.filter(i => {
    const search = searchTerm.toLowerCase();
    const invoiceCode = (i.invoiceCode || '').toLowerCase();
    const customerName = (i.customerName || '').toLowerCase();
    const studentName = (i.studentName || '').toLowerCase();
    return invoiceCode.includes(search) || customerName.includes(search) || studentName.includes(search);
  });
  
  if (statusFilter) {
    filteredInvoices = filteredInvoices.filter(i => i.status === statusFilter);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-2 rounded-lg">
              <FileText className="text-blue-600" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Hóa đơn học phí</h2>
              <p className="text-sm text-gray-500">Quản lý hóa đơn học phí</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
              Doanh thu: {formatCurrency(totalRevenue)}
            </span>
            <span className="text-sm bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full font-medium">
              Chờ TT: {pendingCount}
            </span>
            {canCreateInvoice && (
              <>
                <button
                  onClick={() => setShowMonthlyModal(true)}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium"
                >
                  <Plus size={16} /> Tạo hóa đơn tháng
                </button>
                <button
                  onClick={() => setShowModal(true)}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  <Plus size={16} /> Tạo hóa đơn lẻ
                </button>
              </>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mt-4">
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Tìm theo mã HĐ, khách hàng..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | '')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="Chờ thanh toán">Chờ thanh toán</option>
            <option value="Đã thanh toán">Đã thanh toán</option>
            <option value="Đã hủy">Đã hủy</option>
          </select>
        </div>
      </div>

      {/* Invoice List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-600">
              <tr>
                <th className="px-4 py-3">Mã HĐ</th>
                <th className="px-4 py-3">Khách hàng</th>
                <th className="px-4 py-3">Sản phẩm</th>
                <th className="px-4 py-3 text-right">Tổng tiền</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                <th className="px-4 py-3">Ngày tạo</th>
                <th className="px-4 py-3 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                      Đang tải...
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-red-500">Lỗi: {error}</td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    <FileText size={48} className="mx-auto mb-2 opacity-20" />
                    Chưa có hóa đơn nào
                  </td>
                </tr>
              ) : filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                      {invoice.invoiceCode}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{invoice.customerName}</div>
                    {invoice.customerPhone && (
                      <div className="text-xs text-gray-500">{invoice.customerPhone}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-gray-600">
                      {invoice.items.slice(0, 2).map((item, idx) => (
                        <div key={idx}>{item.productName} x{item.quantity}</div>
                      ))}
                      {invoice.items.length > 2 && (
                        <div className="text-gray-400">+{invoice.items.length - 2} sản phẩm khác</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">
                    {formatCurrency(invoice.total)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[invoice.status]}`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString('vi-VN') : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setBillInvoice(invoice)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        title="In bill"
                      >
                        <Printer size={16} />
                      </button>
                      {invoice.status === 'Chờ thanh toán' && (
                        <>
                          <button
                            onClick={() => invoice.id && handleMarkPaid(invoice.id)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                            title="Thanh toán"
                          >
                            <CheckCircle size={16} />
                          </button>
                          <button
                            onClick={() => invoice.id && handleCancel(invoice.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Hủy"
                          >
                            <XCircle size={16} />
                          </button>
                        </>
                      )}
                      {(canDeleteInvoice || needsApprovalToDelete) && (
                        <button
                          onClick={() => invoice.id && handleDelete(invoice.id)}
                          className={`p-1 rounded ${needsApprovalToDelete && !isAdmin ? 'text-yellow-500 hover:text-yellow-600' : 'text-gray-400 hover:text-red-600'}`}
                          title={needsApprovalToDelete && !isAdmin ? "Xóa (cần Admin duyệt)" : "Xóa"}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <InvoiceModal
          onClose={() => setShowModal(false)}
          onSubmit={async (data) => {
            await createInvoice(data);
            setShowModal(false);
          }}
        />
      )}

      {/* Monthly Generator Modal */}
      {showMonthlyModal && (
        <MonthlyInvoiceModal
          onClose={() => setShowMonthlyModal(false)}
          onSubmit={async (invoices) => {
            await createBulkInvoices(invoices);
            setShowMonthlyModal(false);
          }}
        />
      )}

      {billInvoice && (
        <InvoiceBillModal
          invoice={billInvoice}
          onClose={() => setBillInvoice(null)}
        />
      )}
    </div>
  );
};

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const printInvoiceBill = (invoice: Invoice) => {
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    alert('Trình duyệt đang chặn cửa sổ in. Vui lòng cho phép popup và thử lại.');
    return;
  }

  const createdDate = invoice.createdAt
    ? new Date(invoice.createdAt).toLocaleDateString('vi-VN')
    : new Date().toLocaleDateString('vi-VN');
  const paidDate = invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString('vi-VN') : '-';
  const rows = invoice.items.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(item.productName)}</td>
      <td class="center">${item.quantity}</td>
      <td class="right">${formatCurrency(item.unitPrice)}</td>
      <td class="right">${formatCurrency(item.total)}</td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(invoice.invoiceCode || 'Bill')}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; background: #f3f4f6; color: #111827; font-family: Arial, sans-serif; }
          .actions { position: sticky; top: 0; padding: 12px; background: #111827; text-align: center; }
          .actions button { border: 0; border-radius: 8px; padding: 10px 16px; background: #2563eb; color: white; font-weight: 700; cursor: pointer; }
          .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 18mm; background: white; }
          .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #2563eb; padding-bottom: 16px; }
          .brand { display: flex; gap: 12px; align-items: center; }
          .logo { width: 64px; height: 64px; object-fit: contain; border-radius: 8px; }
          h1 { margin: 0; font-size: 26px; letter-spacing: 0; color: #1d4ed8; }
          h2 { margin: 0 0 6px; font-size: 18px; }
          .muted { color: #6b7280; font-size: 13px; line-height: 1.45; }
          .code { text-align: right; }
          .section { margin-top: 22px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 28px; }
          .label { color: #6b7280; font-size: 12px; text-transform: uppercase; margin-bottom: 3px; }
          .value { font-weight: 700; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #eff6ff; color: #1e40af; font-size: 12px; text-transform: uppercase; }
          th, td { border: 1px solid #d1d5db; padding: 10px; vertical-align: top; }
          .center { text-align: center; }
          .right { text-align: right; }
          .summary { width: 330px; margin-left: auto; margin-top: 16px; }
          .line { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #e5e7eb; }
          .total { font-size: 20px; color: #1d4ed8; font-weight: 800; border-bottom: 0; }
          .note { min-height: 72px; border: 1px solid #d1d5db; padding: 10px; margin-top: 8px; white-space: pre-wrap; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 44px; text-align: center; }
          .signature-space { height: 72px; }
          @media print {
            body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .actions { display: none; }
            .page { margin: 0; width: auto; min-height: auto; }
          }
        </style>
      </head>
      <body>
        <div class="actions"><button onclick="window.print()">In bill</button></div>
        <main class="page">
          <div class="header">
            <div class="brand">
              <img class="logo" src="/logo.jpg" alt="Logo" />
              <div>
                <h2>EDU MANAGER PRO</h2>
                <div class="muted">Phiếu thu / hóa đơn dịch vụ</div>
              </div>
            </div>
            <div class="code">
              <h1>BILL</h1>
              <div class="muted">Mã: <strong>${escapeHtml(invoice.invoiceCode || '-')}</strong></div>
              <div class="muted">Ngày: ${createdDate}</div>
            </div>
          </div>

          <section class="section grid">
            <div><div class="label">Khách hàng</div><div class="value">${escapeHtml(invoice.customerName || '-')}</div></div>
            <div><div class="label">Số điện thoại</div><div class="value">${escapeHtml(invoice.customerPhone || '-')}</div></div>
            <div><div class="label">Học sinh</div><div class="value">${escapeHtml(invoice.studentName || '-')}</div></div>
            <div><div class="label">Trạng thái</div><div class="value">${escapeHtml(invoice.status || '-')}</div></div>
            <div><div class="label">Hình thức thanh toán</div><div class="value">${escapeHtml(invoice.paymentMethod || '-')}</div></div>
            <div><div class="label">Ngày thanh toán</div><div class="value">${paidDate}</div></div>
          </section>

          <section class="section">
            <div class="label">Chi tiết</div>
            <table>
              <thead>
                <tr><th>STT</th><th>Nội dung</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </section>

          <section class="summary">
            <div class="line"><span>Tạm tính</span><strong>${formatCurrency(invoice.subtotal)}</strong></div>
            <div class="line"><span>Giảm giá</span><strong>${formatCurrency(invoice.discount || 0)}</strong></div>
            <div class="line total"><span>Tổng cộng</span><span>${formatCurrency(invoice.total)}</span></div>
          </section>

          <section class="section">
            <div class="label">Ghi chú</div>
            <div class="note">${escapeHtml(invoice.note || '')}</div>
          </section>

          <section class="signatures">
            <div><strong>Người lập phiếu</strong><div class="signature-space"></div><div class="muted">(Ký, ghi rõ họ tên)</div></div>
            <div><strong>Người nộp tiền</strong><div class="signature-space"></div><div class="muted">(Ký, ghi rõ họ tên)</div></div>
          </section>
        </main>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
};

interface InvoiceBillModalProps {
  invoice: Invoice;
  onClose: () => void;
}

const InvoiceBillModal: React.FC<InvoiceBillModalProps> = ({ invoice, onClose }) => {
  const createdDate = invoice.createdAt
    ? new Date(invoice.createdAt).toLocaleDateString('vi-VN')
    : new Date().toLocaleDateString('vi-VN');

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
          <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-800">Bill {invoice.invoiceCode}</h3>
              <p className="text-sm text-gray-500">Form bill đã điền sẵn thông tin hóa đơn</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto bg-gray-100">
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="flex justify-between gap-4 border-b-2 border-blue-600 pb-4">
                <div className="flex items-center gap-3">
                  <img src="/logo.jpg" alt="Edu Manager Pro" className="w-14 h-14 object-contain rounded-lg" />
                  <div>
                    <div className="font-bold text-gray-900">EDU MANAGER PRO</div>
                    <div className="text-sm text-gray-500">Phiếu thu / hóa đơn dịch vụ</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-blue-700">BILL</div>
                  <div className="text-sm text-gray-500">Mã: <span className="font-mono font-semibold text-gray-800">{invoice.invoiceCode}</span></div>
                  <div className="text-sm text-gray-500">Ngày: {createdDate}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 text-sm">
                <div><div className="text-xs uppercase text-gray-500">Khách hàng</div><div className="font-semibold text-gray-900">{invoice.customerName || '-'}</div></div>
                <div><div className="text-xs uppercase text-gray-500">Số điện thoại</div><div className="font-semibold text-gray-900">{invoice.customerPhone || '-'}</div></div>
                <div><div className="text-xs uppercase text-gray-500">Học sinh</div><div className="font-semibold text-gray-900">{invoice.studentName || '-'}</div></div>
                <div><div className="text-xs uppercase text-gray-500">Trạng thái</div><div className="font-semibold text-gray-900">{invoice.status}</div></div>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-sm border border-gray-200">
                  <thead className="bg-blue-50 text-blue-800">
                    <tr>
                      <th className="px-3 py-2 border border-gray-200 text-left">Nội dung</th>
                      <th className="px-3 py-2 border border-gray-200 text-center">SL</th>
                      <th className="px-3 py-2 border border-gray-200 text-right">Đơn giá</th>
                      <th className="px-3 py-2 border border-gray-200 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item, index) => (
                      <tr key={`${item.productId || item.productName}-${index}`}>
                        <td className="px-3 py-2 border border-gray-200">{item.productName}</td>
                        <td className="px-3 py-2 border border-gray-200 text-center">{item.quantity}</td>
                        <td className="px-3 py-2 border border-gray-200 text-right">{formatCurrency(item.unitPrice)}</td>
                        <td className="px-3 py-2 border border-gray-200 text-right font-semibold">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 ml-auto max-w-xs space-y-2 text-sm">
                <div className="flex justify-between"><span>Tạm tính</span><span className="font-semibold">{formatCurrency(invoice.subtotal)}</span></div>
                <div className="flex justify-between"><span>Giảm giá</span><span className="font-semibold">{formatCurrency(invoice.discount || 0)}</span></div>
                <div className="flex justify-between border-t border-gray-200 pt-2 text-lg font-extrabold text-blue-700">
                  <span>Tổng cộng</span>
                  <span>{formatCurrency(invoice.total)}</span>
                </div>
              </div>

              {invoice.note && (
                <div className="mt-5 text-sm">
                  <div className="text-xs uppercase text-gray-500 mb-1">Ghi chú</div>
                  <div className="border border-gray-200 rounded-lg p-3 text-gray-700">{invoice.note}</div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-gray-200 px-6 py-4 flex gap-3 justify-end bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={() => printInvoiceBill(invoice)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Printer size={16} /> In bill
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

// Invoice Modal
interface InvoiceModalProps {
  onClose: () => void;
  onSubmit: (data: Omit<Invoice, 'id' | 'invoiceCode'>) => Promise<void>;
}

const InvoiceModal: React.FC<InvoiceModalProps> = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    studentName: '',
    paymentMethod: 'Tiền mặt',
    note: '',
  });
  const [items, setItems] = useState<InvoiceItem[]>([
    { productId: '', productName: '', quantity: 1, unitPrice: 0, total: 0 }
  ]);
  const [discount, setDiscount] = useState(0);
  const [loading, setLoading] = useState(false);

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal - discount;

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'quantity' || field === 'unitPrice') {
      newItems[index].total = newItems[index].quantity * newItems[index].unitPrice;
    }
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { productId: '', productName: '', quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName) {
      alert('Vui lòng nhập tên khách hàng');
      return;
    }
    if (items.some(i => !i.productName)) {
      alert('Vui lòng nhập tên sản phẩm');
      return;
    }
    if (items.some(i => i.unitPrice <= 0)) {
      alert('Vui lòng nhập đơn giá cho tất cả sản phẩm');
      return;
    }
    setLoading(true);
    try {
      await onSubmit({
        ...formData,
        items,
        subtotal,
        discount,
        total,
        status: 'Chờ thanh toán',
      });
    } catch (err) {
      console.error('Invoice creation error:', err);
      alert(`Không thể tạo hoá đơn: ${err instanceof Error ? err.message : 'Lỗi không xác định'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="text-xl font-bold text-gray-800">Tạo hóa đơn mới</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Customer Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tên khách hàng <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SĐT</label>
              <input
                type="tel"
                value={formData.customerPhone}
                onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Items */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sản phẩm <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Tên sản phẩm"
                    value={item.productName}
                    onChange={(e) => updateItem(index, 'productName', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="number"
                    min={1}
                    placeholder="SL"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="Đơn giá"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(index, 'unitPrice', parseInt(e.target.value) || 0)}
                    className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <span className="w-28 text-right font-medium">{formatCurrency(item.total)}</span>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addItem}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              + Thêm sản phẩm
            </button>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span>Tạm tính:</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm items-center">
              <span>Giảm giá:</span>
              <input
                type="number"
                min={0}
                value={discount}
                onChange={(e) => setDiscount(parseInt(e.target.value) || 0)}
                className="w-28 px-2 py-1 border border-gray-300 rounded text-right text-sm"
              />
            </div>
            <div className="flex justify-between font-bold text-lg border-t border-gray-200 pt-2">
              <span>Tổng cộng:</span>
              <span className="text-blue-600">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Payment & Note */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hình thức TT</label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option>Tiền mặt</option>
                <option>Chuyển khoản</option>
                <option>Thẻ</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
              <input
                type="text"
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Đang tạo...' : 'Tạo hóa đơn'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
};

// Monthly Invoice Modal
interface MonthlyInvoiceModalProps {
  onClose: () => void;
  onSubmit: (invoices: Omit<Invoice, 'id' | 'invoiceCode'>[]) => Promise<void>;
}

const MonthlyInvoiceModal: React.FC<MonthlyInvoiceModalProps> = ({ onClose, onSubmit }) => {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [method, setMethod] = useState<CalculationMethod>('per_session');
  const [preview, setPreview] = useState<Omit<Invoice, 'id' | 'invoiceCode'>[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handlePreview = async () => {
    setLoading(true);
    try {
      const data = await generateMonthlyInvoicesPreview(month, year, method);
      setPreview(data);
      if (data.length === 0) {
        alert('Không tìm thấy dữ liệu điểm danh nào trong tháng này để tạo hóa đơn.');
      }
    } catch (err) {
      alert(`Lỗi: ${err instanceof Error ? err.message : 'Không xác định'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (preview.length === 0) return;
    setGenerating(true);
    try {
      await onSubmit(preview);
    } catch (err) {
      alert(`Lỗi: ${err instanceof Error ? err.message : 'Không xác định'}`);
    } finally {
      setGenerating(false);
    }
  };

  const totalEstimated = preview.reduce((sum, inv) => sum + inv.total, 0);

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-800">Tạo hóa đơn học phí hàng tháng</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
            <h4 className="font-semibold text-blue-800 mb-2">Cấu hình tạo hóa đơn</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-blue-900 mb-1">Tháng</label>
                <select
                  value={month}
                  onChange={(e) => setMonth(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: 12 }).map((_, i) => (
                    <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-900 mb-1">Năm</label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-900 mb-1">Cách tính học phí</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as CalculationMethod)}
                  className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="per_session">Tính theo số buổi học (Học phí / Tổng số buổi * Số buổi đi học)</option>
                  <option value="fixed_monthly">Học phí cố định (Lấy mức Học phí của lớp)</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={handlePreview}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
              >
                {loading ? 'Đang tải...' : 'Xem trước danh sách hóa đơn'}
              </button>
            </div>
          </div>

          {preview.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                <span className="font-semibold text-gray-700">Danh sách tạm tính ({preview.length} hóa đơn)</span>
                <span className="text-sm font-medium text-green-600">Tổng thu dự kiến: {formatCurrency(totalEstimated)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-2">Học sinh</th>
                      <th className="px-4 py-2">Chi tiết</th>
                      <th className="px-4 py-2 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.map((inv, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-900">{inv.studentName}</td>
                        <td className="px-4 py-2 text-gray-600 text-xs">
                          {inv.items.map((item, i) => (
                            <div key={i}>• {item.productName}</div>
                          ))}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-900">
                          {formatCurrency(inv.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 px-6 py-4 flex gap-3 justify-end bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={preview.length === 0 || generating}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {generating ? 'Đang lưu...' : 'Lưu tất cả hóa đơn'}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};
