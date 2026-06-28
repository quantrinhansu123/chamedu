import { collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, writeBatch, runTransaction, arrayUnion, Timestamp, db } from '@/src/utils/legacyFirestoreStub';
/**
 * SettlementModal Component
 * Modal for settling student fee debt
 * Allows payment or marking as bad debt
 */

import React, { useState } from 'react';
import { X, CreditCard, AlertTriangle, DollarSign, FileText, CheckCircle, Eye } from 'lucide-react';
import { Student, SettlementInvoice, SettlementStatus } from '../../../../types';
import { downloadSettlementInvoicePDF, previewSettlementInvoice } from '../../../services/settlementInvoicePdfService';
import { formatCurrency } from '../../../utils/currencyUtils';
import { ModalPortal } from '@/components/modal-portal';

interface SettlementModalProps {
  student: Student;
  className: string;          // Class name for display
  courseName?: string;        // Curriculum name
  onClose: () => void;
  onSuccess?: () => void;
  staffName?: string;         // Current staff name
}

const PRICE_PER_SESSION = 150000;

export const SettlementModal: React.FC<SettlementModalProps> = ({
  student,
  className,
  courseName,
  onClose,
  onSuccess,
  staffName,
}) => {
  // Calculate debt
  const attendedSessions = student.attendedSessions || 0;
  const registeredSessions = student.registeredSessions || 0;
  const debtSessions = Math.max(0, attendedSessions - registeredSessions);
  const totalAmount = debtSessions * PRICE_PER_SESSION;

  // Form state
  const [settlementType, setSettlementType] = useState<SettlementStatus>('Đã thanh toán');
  const [paymentMethod, setPaymentMethod] = useState<'Tiền mặt' | 'Chuyển khoản'>('Tiền mặt');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Success state with created invoice
  const [successInvoice, setSuccessInvoice] = useState<SettlementInvoice | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation: No debt to settle
    if (debtSessions <= 0) {
      alert('Học viên không có nợ phí để tất toán.');
      return;
    }

    // Sanitize note input (remove potential script tags)
    const sanitizedNote = note.replace(/<[^>]*>/g, '').trim();

    const confirmMsg = settlementType === 'Đã thanh toán'
      ? `Xác nhận thu ${formatCurrency(totalAmount)} từ học viên ${student.fullName}?`
      : `Xác nhận ghi nợ xấu ${formatCurrency(totalAmount)} cho học viên ${student.fullName}?`;

    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      // Use transaction for atomic operations
      const createdInvoice = await runTransaction(null as any /* firebase removed */, async (transaction) => {
        // 1. Get current student state
        const studentRef = doc(null as any /* firebase removed */, 'students', student.id);
        const studentSnap = await transaction.get(studentRef);

        if (!studentSnap.exists()) {
          throw new Error('Học viên không tồn tại');
        }

        // 2. Prepare invoice data
        const invoiceData: Omit<SettlementInvoice, 'id' | 'invoiceCode' | 'createdAt'> = {
          invoiceDate: new Date().toISOString(),
          studentId: student.id,
          studentCode: student.code || '',
          studentName: student.fullName,
          ...(student.phone && { studentPhone: student.phone }),
          ...(student.dob && { studentDob: student.dob }),
          ...(student.parentName && { parentName: student.parentName }),
          courseName: courseName || 'Khóa học tiếng Anh',
          className: className,
          totalSessions: registeredSessions,
          attendedSessions: attendedSessions,
          debtSessions: debtSessions,
          ...(student.startDate && { startDate: student.startDate }),
          pricePerSession: PRICE_PER_SESSION,
          totalAmount: totalAmount,
          paidAmount: settlementType === 'Đã thanh toán' ? totalAmount : 0,
          remainingAmount: settlementType === 'Đã thanh toán' ? 0 : totalAmount,
          status: settlementType,
          ...(settlementType === 'Đã thanh toán' && { paymentMethod }),
          ...(staffName && { collectedByName: staffName }),
          ...(sanitizedNote && { note: sanitizedNote }),
        };

        // 3. Generate invoice code and create document reference
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const invoiceCode = `STL-${dateStr}-${random}`;

        // Create a new document reference (generates ID without writing)
        const invoiceRef = doc(collection(null as any /* firebase removed */, 'settlementInvoices'));
        const invoiceId = invoiceRef.id;

        // 4. Build full invoice data
        const fullInvoiceData: Omit<SettlementInvoice, 'id'> = {
          ...invoiceData,
          invoiceCode,
          createdAt: now.toISOString(),
        };

        // 5. Build full invoice for success state (for PDF export)
        const fullInvoice: SettlementInvoice = {
          ...fullInvoiceData,
          id: invoiceId,
        };

        // 5. Prepare student update
        const studentUpdate: Record<string, unknown> = {
          status: 'Nghỉ học',
          classId: null,
          classIds: [],
          class: null,
        };

        // Clear bad debt fields when PAID
        if (settlementType === 'Đã thanh toán') {
          studentUpdate.badDebt = false;
          studentUpdate.badDebtSessions = 0;
          studentUpdate.badDebtAmount = 0;
          studentUpdate.badDebtDate = null;
          studentUpdate.badDebtNote = null;
        }

        // Set bad debt fields when NOT PAID
        if (settlementType === 'Nợ xấu') {
          studentUpdate.badDebt = true;
          studentUpdate.badDebtSessions = debtSessions;
          studentUpdate.badDebtAmount = totalAmount;
          studentUpdate.badDebtDate = new Date().toISOString();
          studentUpdate.badDebtNote = sanitizedNote || `Nợ ${debtSessions} buổi - Tất toán`;
        }

        // 6. Update student atomically
        transaction.update(studentRef, studentUpdate);

        // 7. Create invoice atomically (inside transaction)
        transaction.set(invoiceRef, fullInvoiceData);

        // 8. Return invoice for success state
        return fullInvoice;
      });

      // Set success state with created invoice
      setSuccessInvoice(createdInvoice);
      onSuccess?.();
    } catch (err) {
      console.error('Settlement error:', err);
      alert('Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // Handle PDF download
  const handleDownloadPDF = async () => {
    if (!successInvoice) return;

    setPdfLoading(true);
    try {
      await downloadSettlementInvoicePDF(successInvoice);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('Có lỗi khi tạo PDF. Vui lòng thử lại.');
    } finally {
      setPdfLoading(false);
    }
  };

  // Success View - after settlement completed
  if (successInvoice) {
    const isPaid = successInvoice.status === 'Đã thanh toán';

    return (
      <ModalPortal>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
          {/* Success Header */}
          <div className={`p-6 rounded-t-xl text-center ${isPaid ? 'bg-green-500' : 'bg-amber-500'}`}>
            <CheckCircle size={48} className="mx-auto text-white mb-3" />
            <h3 className="text-xl font-bold text-white">
              {isPaid ? 'Tất toán thành công!' : 'Đã ghi nợ xấu!'}
            </h3>
            <p className="text-white/90 text-sm mt-1">
              Học viên đã chuyển sang trạng thái Nghỉ học
            </p>
          </div>

          {/* Invoice Summary */}
          <div className="p-4 space-y-3">
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <div className="flex justify-between mb-2">
                <span className="text-gray-500">Mã phiếu:</span>
                <span className="font-mono font-medium">{successInvoice.invoiceCode}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-500">Học viên:</span>
                <span className="font-medium">{successInvoice.studentName}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-500">Số buổi nợ:</span>
                <span className="font-medium text-red-600">+{successInvoice.debtSessions} buổi</span>
              </div>
              <div className="flex justify-between border-t pt-2 mt-2">
                <span className="font-semibold">Tổng tiền:</span>
                <span className={`font-bold ${isPaid ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(successInvoice.totalAmount)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => previewSettlementInvoice(successInvoice)}
                className="flex-1 px-3 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
              >
                <Eye size={18} />
                Xem trước
              </button>
              <button
                onClick={handleDownloadPDF}
                disabled={pdfLoading}
                className="flex-1 px-3 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <FileText size={18} />
                {pdfLoading ? 'Đang tạo...' : 'Tải PDF'}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      </div>
      </ModalPortal>
    );
  }

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-red-500 to-red-600 rounded-t-xl">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <CreditCard size={20} />
            Tất toán hợp đồng
          </h3>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-3 space-y-3 overflow-y-auto flex-1">
          {/* Student Info */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Học viên:</span>
                <span className="ml-2 font-medium">{student.fullName}</span>
              </div>
              <div>
                <span className="text-gray-500">Mã:</span>
                <span className="ml-2 font-medium">{student.code || '---'}</span>
              </div>
              <div>
                <span className="text-gray-500">Phụ huynh:</span>
                <span className="ml-2 font-medium">{student.parentName || '---'}</span>
              </div>
              <div>
                <span className="text-gray-500">Lớp:</span>
                <span className="ml-2 font-medium">{className}</span>
              </div>
            </div>
          </div>

          {/* Debt Calculation */}
          <div className="bg-red-50 rounded-lg p-3 border border-red-200">
            <h4 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
              <AlertTriangle size={16} />
              Chi tiết nợ phí
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Số buổi đăng ký:</span>
                <span className="font-medium">{registeredSessions} buổi</span>
              </div>
              <div className="flex justify-between">
                <span>Số buổi đã học:</span>
                <span className="font-medium">{attendedSessions} buổi</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>Số buổi nợ:</span>
                <span className="font-bold">+{debtSessions} buổi</span>
              </div>
              <div className="flex justify-between">
                <span>Đơn giá:</span>
                <span>{formatCurrency(PRICE_PER_SESSION)}/buổi</span>
              </div>
              <div className="border-t border-red-200 pt-2 mt-2 flex justify-between text-lg">
                <span className="font-semibold text-red-800">TỔNG TIỀN NỢ:</span>
                <span className="font-bold text-red-600">{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Settlement Type */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Hình thức tất toán:
            </label>

            {/* Option 1: Pay */}
            <label className={`flex items-start gap-3 p-2.5 rounded-lg border-2 cursor-pointer transition-colors ${
              settlementType === 'Đã thanh toán'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input
                type="radio"
                name="settlementType"
                value="Đã thanh toán"
                checked={settlementType === 'Đã thanh toán'}
                onChange={(e) => setSettlementType(e.target.value as SettlementStatus)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="font-medium text-green-700 flex items-center gap-2">
                  <DollarSign size={16} />
                  Thanh toán đầy đủ
                </div>
                {settlementType === 'Đã thanh toán' && (
                  <div className="mt-2">
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as 'Tiền mặt' | 'Chuyển khoản')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="Tiền mặt">Tiền mặt</option>
                      <option value="Chuyển khoản">Chuyển khoản</option>
                    </select>
                  </div>
                )}
              </div>
            </label>

            {/* Option 2: Bad Debt */}
            <label className={`flex items-start gap-3 p-2.5 rounded-lg border-2 cursor-pointer transition-colors ${
              settlementType === 'Nợ xấu'
                ? 'border-red-500 bg-red-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input
                type="radio"
                name="settlementType"
                value="Nợ xấu"
                checked={settlementType === 'Nợ xấu'}
                onChange={(e) => setSettlementType(e.target.value as SettlementStatus)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="font-medium text-red-700 flex items-center gap-2">
                  <AlertTriangle size={16} />
                  Ghi nhận nợ xấu
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Phụ huynh không thanh toán, ghi nhận vào danh sách nợ xấu
                </p>
              </div>
            </label>
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ghi chú
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Ghi chú thêm (nếu có)..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading || debtSessions === 0}
              className={`flex-1 px-4 py-2 rounded-lg text-white font-medium ${
                settlementType === 'Đã thanh toán'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              } disabled:opacity-50`}
            >
              {loading ? 'Đang xử lý...' : 'Xác nhận tất toán'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
};

export default SettlementModal;
