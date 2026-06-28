/**
 * Contract List Page
 * Danh sách hợp đồng với filter và actions
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Search, Eye, Trash2, DollarSign, Filter, X, CreditCard, Printer, Download } from 'lucide-react';
import { ModalPortal } from '@/components/modal-portal';
import { Contract, ContractStatus, ContractType, PaymentMethod, ContractItem, StudentStatus } from '../types';
import { useContracts } from '../src/hooks/useContracts';
import { formatCurrency, numberToWords } from '../src/utils/currencyUtils';
import { ImportExportButtons } from '../components/ImportExportButtons';
import {
  CONTRACT_FIELDS,
  CONTRACT_MAPPING,
  prepareContractExport,
} from '../src/utils/excelUtils';
import { printContract, downloadContractAsPdf, ContractCenterInfo, DEFAULT_CENTER_INFO } from '../src/utils/contract-pdf-generator';
import { updateContract } from '../src/services/contractService';
import { createEnrollment } from '../src/services/enrollmentService';
import { useAuth } from '../src/hooks/useAuth';
import { useStaff } from '../src/hooks/useStaff';
import { getCenters, Center } from '../src/services/centerService';
import { supabase } from '../src/config/supabase';

/**
 * Enrich contract items with className for PDF display.
 * Prioritizes: item.className > item.classId lookup > student's current class
 */
const enrichContractItemsWithClassName = async (contract: Contract): Promise<Contract> => {
  if (!contract.items?.length) return contract;

  // Check if any item needs className
  const needsEnrichment = contract.items.some(item => !item.className && item.classId);
  if (!needsEnrichment) {
    // All items have className or no classId to lookup - use student fallback if needed
    if (contract.items.every(item => item.className)) return contract;
  }

  // Collect unique classIds needing lookup
  const classIdsToFetch = new Set<string>();
  contract.items.forEach(item => {
    if (!item.className && item.classId) classIdsToFetch.add(item.classId);
  });
  if (contract.classId && !contract.className) classIdsToFetch.add(contract.classId);

  // Batch fetch all classes
  const classNameMap: Record<string, string> = {};
  await Promise.all(
    Array.from(classIdsToFetch).map(async (classId) => {
      try {
        const { data, error } = await supabase
          .from('classes')
          .select('name')
          .eq('id', classId)
          .maybeSingle();
        if (!error && data?.name) {
          classNameMap[classId] = data.name;
        }
      } catch (e) {
        console.error('Error fetching class:', classId, e);
      }
    })
  );

  // Get fallback from student if still needed
  let fallbackClassName = contract.className || classNameMap[contract.classId || ''] || '';
  if (!fallbackClassName && contract.studentId) {
    try {
      const student = await getStudentByIdLite(contract.studentId);
      fallbackClassName = student?.class || '';
    } catch (e) {
      console.error('Error fetching student:', e);
    }
  }

  // Enrich items
  const updatedItems = contract.items.map(item => {
    if (item.className) return item;
    const className = classNameMap[item.classId || ''] || fallbackClassName;
    return className ? { ...item, className } : item;
  });

  return { ...contract, items: updatedItems };
};

type StudentLite = {
  id: string;
  fullName: string;
  code?: string;
  class?: string;
  classId?: string;
  branch?: string;
  dob?: string;
  parentName?: string;
  parentPhone?: string;
  phone?: string;
};

const mapStudentLite = (row: any): StudentLite => ({
  id: row.id,
  fullName: row.full_name || '',
  code: row.code || '',
  class: row.class_name || '',
  classId: row.class_id || '',
  branch: row.branch || '',
  dob: row.dob || '',
  parentName: row.parent_name || '',
  parentPhone: row.parent_phone || '',
  phone: row.phone || '',
});

const getStudentByIdLite = async (id: string): Promise<StudentLite | null> => {
  if (!id) return null;
  const { data, error } = await supabase
    .from('students')
    .select('id, full_name, code, class_name, class_id, branch, dob, parent_name, parent_phone, phone')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return mapStudentLite(data);
};

const getStudentsLite = async (): Promise<StudentLite[]> => {
  const { data, error } = await supabase
    .from('students')
    .select('id, full_name, code, class_name, class_id, branch, dob, parent_name, parent_phone, phone')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(mapStudentLite);
};

export const ContractList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<ContractStatus | ''>('');
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [centers, setCenters] = useState<Center[]>([]);
  const { staff } = useStaff();

  // Create staff lookup map (email/uid -> name)
  const staffMap = React.useMemo(() => {
    const map = new Map<string, string>();
    staff.forEach(s => {
      if (s.email) map.set(s.email, s.name);
      if (s.id) map.set(s.id, s.name);
    });
    return map;
  }, [staff]);

  // Fetch centers for printing contracts
  useEffect(() => {
    const loadCenters = async () => {
      try {
        const centersList = await getCenters();
        setCenters(centersList);
      } catch (error) {
        console.error('Error loading centers:', error);
      }
    };
    loadCenters();
  }, []);

  // Get center info for a specific contract (based on student's branch)
  const getCenterInfoForContract = async (contract: Contract): Promise<ContractCenterInfo> => {
    try {
      // Always use hardcoded branches from DEFAULT_CENTER_INFO (CS1, CS2, CS3 in correct order)
      const branches = DEFAULT_CENTER_INFO.branches || [];
      console.log('[DEBUG] getCenterInfo - centers loaded:', centers.length, centers.map(c => ({ code: c.code, signatureUrl: c.signatureUrl })));

      // If contract has studentId, lookup student's branch
      if (contract.studentId) {
        const student = await getStudentByIdLite(contract.studentId);
        console.log('[DEBUG] getCenterInfo - student branch:', student?.branch);
        if (student?.branch) {
          const studentCenter = centers.find(c =>
            c.name === student.branch ||
            c.code === student.branch ||
            c.name?.includes(student.branch) ||
            student.branch?.includes(c.name)
          );
          if (studentCenter) {
            return {
              centerName: DEFAULT_CENTER_INFO.centerName, // Always use company name
              representative: studentCenter.manager || DEFAULT_CENTER_INFO.representative,
              address: studentCenter.address || DEFAULT_CENTER_INFO.address,
              phone: DEFAULT_CENTER_INFO.phone, // Use company hotline
              email: studentCenter.email || DEFAULT_CENTER_INFO.email,
              signatureUrl: studentCenter.signatureUrl || '',
              branches,
              logoUrl: '/logo.jpg',
            };
          }
        }
      }
      // Fallback to main center
      const mainCenter = centers.find(c => c.isMain) || centers[0];
      console.log('[DEBUG] getCenterInfo - fallback to mainCenter:', mainCenter?.code, 'signatureUrl:', mainCenter?.signatureUrl);
      if (mainCenter) {
        return {
          centerName: DEFAULT_CENTER_INFO.centerName, // Always use company name
          representative: mainCenter.manager || DEFAULT_CENTER_INFO.representative,
          address: mainCenter.address || DEFAULT_CENTER_INFO.address,
          phone: DEFAULT_CENTER_INFO.phone, // Use company hotline
          email: mainCenter.email || DEFAULT_CENTER_INFO.email,
          signatureUrl: mainCenter.signatureUrl || '',
          branches,
          logoUrl: '/logo.jpg',
        };
      }
    } catch (error) {
      console.error('Error getting center info for contract:', error);
    }
    return DEFAULT_CENTER_INFO;
  };

  // Handle print contract with correct center info and latest student data
  const handlePrintContract = async (contract: Contract) => {
    const centerInfo = await getCenterInfoForContract(contract);
    console.log('[DEBUG] Print - centerInfo:', centerInfo);
    console.log('[DEBUG] Print - signatureUrl:', centerInfo.signatureUrl);

    // Get latest student data for phone number (in case contract was created without it)
    let contractWithLatestData = { ...contract };
    if (contract.studentId && !contract.parentPhone) {
      try {
        const student = await getStudentByIdLite(contract.studentId);
        if (student) {
          contractWithLatestData = {
            ...contract,
            parentPhone: student.parentPhone || student.phone || contract.parentPhone,
            parentName: contract.parentName || student.parentName,
          };
        }
      } catch (error) {
        console.error('Error fetching student data for print:', error);
      }
    }

    // Enrich items with className for PDF display
    contractWithLatestData = await enrichContractItemsWithClassName(contractWithLatestData);

    await printContract(contractWithLatestData, centerInfo);
  };

  // Handle download contract with correct center info and latest student data
  const handleDownloadContract = async (contract: Contract) => {
    const centerInfo = await getCenterInfoForContract(contract);
    console.log('[DEBUG] Download - centerInfo:', centerInfo);
    console.log('[DEBUG] Download - signatureUrl:', centerInfo.signatureUrl);

    // Get latest student data for phone number (in case contract was created without it)
    let contractWithLatestData = { ...contract };
    if (contract.studentId && !contract.parentPhone) {
      try {
        const student = await getStudentByIdLite(contract.studentId);
        if (student) {
          contractWithLatestData = {
            ...contract,
            parentPhone: student.parentPhone || student.phone || contract.parentPhone,
            parentName: contract.parentName || student.parentName,
          };
        }
      } catch (error) {
        console.error('Error fetching student data for download:', error);
      }
    }

    // Enrich items with className for PDF display
    contractWithLatestData = await enrichContractItemsWithClassName(contractWithLatestData);

    await downloadContractAsPdf(contractWithLatestData, centerInfo);
  };

  const { contracts, loading, error, deleteContract, updateStatus, refresh, createContract } = useContracts(
    statusFilter ? { status: statusFilter } : undefined
  );

  const mapImportStatus = (value?: string): ContractStatus => {
    const v = (value || '').trim().toLowerCase();
    if (!v) return ContractStatus.PENDING;
    const entries = Object.values(ContractStatus) as string[];
    const exact = entries.find(s => s.toLowerCase() === v);
    if (exact) return exact as ContractStatus;
    if (v.includes('thanh toan') && !v.includes('no')) return ContractStatus.PAID;
    if (v.includes('no')) return ContractStatus.PARTIAL;
    if (v.includes('huy')) return ContractStatus.CANCELLED;
    if (v.includes('nhap')) return ContractStatus.DRAFT;
    if (v.includes('cho')) return ContractStatus.PENDING;
    return ContractStatus.PENDING;
  };

  const mapImportPaymentMethod = (value?: string): PaymentMethod => {
    const v = (value || '').trim().toLowerCase();
    if (!v) return PaymentMethod.CASH;
    const entries = Object.values(PaymentMethod) as string[];
    const exact = entries.find(s => s.toLowerCase() === v);
    if (exact) return exact as PaymentMethod;
    if (v.includes('chuyen')) return PaymentMethod.TRANSFER;
    if (v.includes('gop')) return PaymentMethod.INSTALLMENT;
    if (v.includes('toan bo')) return PaymentMethod.FULL;
    return PaymentMethod.CASH;
  };

  const handleImportContracts = async (
    data: Record<string, any>[]
  ): Promise<{ success: number; errors: string[] }> => {
    const errors: string[] = [];
    let success = 0;
    const students = await getStudentsLite();
    const createdBy = user?.email || user?.uid || 'import';

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowLabel = row.studentName || row.studentCode || `Dòng ${i + 1}`;
      try {
        if (!row.studentName && !row.studentCode) {
          errors.push(`Dòng ${i + 1}: Thiếu học viên hoặc mã học viên`);
          continue;
        }

        const student = students.find(
          s =>
            (row.studentCode && s.code === String(row.studentCode).trim()) ||
            (row.studentName &&
              s.fullName?.trim().toLowerCase() === String(row.studentName).trim().toLowerCase())
        );

        const sessions = Number(row.sessions) || 0;
        const unitPrice = Number(row.unitPrice) || 0;
        const subtotal =
          Number(row.totalAmount) > 0 ? Number(row.totalAmount) : sessions * unitPrice;
        const paidAmount = Number(row.paidAmount) || 0;
        const remainingAmount =
          row.remainingAmount !== undefined && row.remainingAmount !== ''
            ? Number(row.remainingAmount)
            : Math.max(0, subtotal - paidAmount);

        let status = mapImportStatus(row.status);
        if (!row.status) {
          status = remainingAmount <= 0 ? ContractStatus.PAID : paidAmount > 0 ? ContractStatus.PARTIAL : ContractStatus.PENDING;
        }

        const item: ContractItem = {
          type: 'course',
          id: `import-${Date.now()}-${i}`,
          name: row.courseName || 'Khóa học',
          className: row.className || student?.class || '',
          classId: student?.classId || undefined,
          unitPrice,
          quantity: sessions,
          subtotal,
          discount: 0,
          finalPrice: subtotal,
        };

        await createContract({
          type: ContractType.STUDENT,
          studentId: student?.id || '',
          studentName: row.studentName || student?.fullName || '',
          studentDOB: student?.dob || '',
          parentName: row.parentName || student?.parentName || '',
          parentPhone: row.parentPhone || student?.parentPhone || student?.phone || '',
          className: row.className || student?.class || '',
          classId: student?.classId || undefined,
          branch: row.branch || student?.branch || '',
          items: [item],
          subtotal,
          totalDiscount: 0,
          totalAmount: subtotal,
          totalAmountInWords: numberToWords(subtotal),
          paymentMethod: mapImportPaymentMethod(row.paymentMethod),
          paidAmount,
          remainingAmount,
          contractDate: row.contractDate || new Date().toISOString().split('T')[0],
          totalSessions: sessions,
          pricePerSession: unitPrice || (sessions > 0 ? Math.round(subtotal / sessions) : 0),
          status,
          notes: row.notes || '',
          createdBy,
        });

        success++;
      } catch (err: any) {
        errors.push(`${rowLabel}: ${err.message || 'Lỗi'}`);
      }
    }

    await refresh();
    return { success, errors };
  };

  // Compute actual status based on payment amounts (fixes data inconsistency)
  const getComputedStatus = (contract: Contract): ContractStatus => {
    if (contract.status === ContractStatus.CANCELLED) return ContractStatus.CANCELLED;
    if (contract.status === ContractStatus.DRAFT) return ContractStatus.DRAFT;
    if ((contract.remainingAmount || 0) <= 0) return ContractStatus.PAID;
    // Has remaining debt - always show as PARTIAL regardless of paidAmount
    if ((contract.remainingAmount || 0) > 0) return ContractStatus.PARTIAL;
    return contract.status;
  };

  // Create center lookup map for flexible branch matching
  const centerMap = React.useMemo(() => {
    const map = new Map<string, Center>();
    centers.forEach(c => {
      if (c.name) map.set(c.name.toLowerCase(), c);
      if (c.code) map.set(c.code.toLowerCase(), c);
    });
    return map;
  }, [centers]);

  const filteredContracts = contracts.filter(c => {
    const matchesSearch = !searchTerm || (
      c.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.studentName?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    // Flexible branch matching: match by name or code, with fallback to direct comparison
    let matchesBranch = !branchFilter;
    if (branchFilter) {
      if (!c.branch) {
        // Contract has no branch - don't match when filtering by branch
        matchesBranch = false;
      } else {
        const contractBranch = c.branch.toLowerCase();
        const filterBranch = branchFilter.toLowerCase();
        const selectedCenter = centers.find(center => center.name === branchFilter);

        if (selectedCenter) {
          // Match by center name or code
          matchesBranch = contractBranch === selectedCenter.name?.toLowerCase() ||
                         contractBranch === selectedCenter.code?.toLowerCase() ||
                         selectedCenter.name?.toLowerCase().includes(contractBranch) ||
                         contractBranch.includes(selectedCenter.name?.toLowerCase() || '');
        } else {
          // Fallback: direct string comparison when center not found
          matchesBranch = contractBranch === filterBranch ||
                         contractBranch.includes(filterBranch) ||
                         filterBranch.includes(contractBranch);
        }
      }
    }
    return matchesSearch && matchesBranch;
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa hợp đồng này?')) return;
    try {
      await deleteContract(id);
    } catch (err) {
      alert('Không thể xóa hợp đồng');
    }
  };

  const handleMarkPaid = async (id: string) => {
    try {
      await updateStatus(id, ContractStatus.PAID);
    } catch (err) {
      alert('Không thể cập nhật trạng thái');
    }
  };

  const handleAddPayment = async () => {
    if (!selectedContract?.id || paymentAmount <= 0) return;
    
    setPaymentLoading(true);
    try {
      const currentPaid = selectedContract.paidAmount || 0;
      const newPaidAmount = currentPaid + paymentAmount;
      const totalAmount = selectedContract.totalAmount || 0;
      const newRemainingAmount = totalAmount - newPaidAmount;
      
      const newStatus = newRemainingAmount <= 0 ? ContractStatus.PAID : ContractStatus.PARTIAL;
      
      await updateContract(selectedContract.id, {
        paidAmount: newPaidAmount,
        remainingAmount: Math.max(0, newRemainingAmount),
        status: newStatus,
      });
      
      // Calculate total sessions from contract items
      const totalSessions = (selectedContract.items || [])
        .filter(item => item.type === 'course')
        .reduce((sum, item) => sum + (item.quantity || 0), 0);
      
      // Calculate new paid sessions based on new payment ratio
      const newPaidSessions = newStatus === ContractStatus.PAID
        ? totalSessions
        : Math.floor(totalSessions * (newPaidAmount / totalAmount));
      
      if (selectedContract.studentId) {
        const { StudentService } = await import('../src/services/studentService');
        const { getContracts } = await import('../src/services/contractService');
        const student = await StudentService.getStudentById(selectedContract.studentId);
        if (student) {
          const oldPaidSessions = Math.floor(totalSessions * (currentPaid / totalAmount));
          const sessionDiff = newPaidSessions - oldPaidSessions;
          const debtContracts = await getContracts({
            studentId: selectedContract.studentId,
            status: ContractStatus.DEBT,
          });
          let totalDebt = debtContracts
            .filter((c) => c.id !== selectedContract.id)
            .reduce((sum, c) => sum + (c.remainingAmount || 0), 0);
          if (newStatus === ContractStatus.PARTIAL) {
            totalDebt += newRemainingAmount;
          }
          await StudentService.updateStudent(selectedContract.studentId, {
            registeredSessions: (student.registeredSessions || 0) + sessionDiff,
            status: totalDebt > 0 ? StudentStatus.CONTRACT_DEBT : StudentStatus.ACTIVE,
            ...(totalDebt > 0 ? { contractDebt: totalDebt } : { contractDebt: 0 }),
          } as any);
          if (sessionDiff > 0) {
            await createEnrollment({
              studentId: selectedContract.studentId,
              studentName: selectedContract.studentName || '',
              sessions: sessionDiff,
              type: 'Thanh toán thêm',
              contractCode: selectedContract.code || '',
              finalAmount: paymentAmount,
              createdDate: new Date().toLocaleDateString('vi-VN'),
              createdBy: user?.displayName || user?.email || 'Unknown',
              note: `Thanh toán thêm HĐ ${selectedContract.code} - ${formatCurrency(paymentAmount)} (${sessionDiff} buổi)`,
            });
          }
        }
      }
      
      setShowPaymentModal(false);
      setSelectedContract(null);
      setPaymentAmount(0);
      refresh?.();
      alert('Ghi nhận thanh toán thành công!');
    } catch (err) {
      alert('Không thể ghi nhận thanh toán');
    } finally {
      setPaymentLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      [ContractStatus.DRAFT]: 'bg-gray-100 text-gray-700',
      [ContractStatus.PENDING]: 'bg-yellow-100 text-yellow-700',
      [ContractStatus.PAID]: 'bg-green-100 text-green-700',
      [ContractStatus.PARTIAL]: 'bg-orange-100 text-orange-700',
      [ContractStatus.CANCELLED]: 'bg-red-100 text-red-700',
    };
    return styles[status] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <FileText className="text-indigo-600" size={24} />
          Danh sách hợp đồng
        </h2>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <ImportExportButtons
            data={filteredContracts}
            prepareExport={prepareContractExport}
            exportFileName="DanhSachHopDong"
            fields={CONTRACT_FIELDS}
            mapping={CONTRACT_MAPPING}
            onImport={handleImportContracts}
            templateFileName="MauNhapHopDong"
            entityName="hợp đồng"
          />
          <button
            onClick={() => navigate('/finance/contracts/create')}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium"
          >
            <Plus size={16} /> Tạo hợp đồng
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Tìm theo mã HĐ, tên học viên..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ContractStatus | '')}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">Tất cả trạng thái</option>
            <option value={ContractStatus.DRAFT}>Lưu nháp</option>
            <option value={ContractStatus.PENDING}>Chờ thanh toán</option>
            <option value={ContractStatus.PAID}>Đã thanh toán</option>
            <option value={ContractStatus.PARTIAL}>Nợ hợp đồng</option>
            <option value={ContractStatus.CANCELLED}>Đã hủy</option>
          </select>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">Tất cả cơ sở</option>
            {centers.filter(c => c.status === 'Active').map(center => (
              <option key={center.id} value={center.name}>{center.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 font-semibold text-gray-700">Mã HĐ</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Học viên</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Ngày tạo</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Người tạo</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-right">Tổng tiền</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-right">Còn nợ</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center">Trạng thái</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                    Đang tải...
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-red-500">
                  Lỗi: {error}
                </td>
              </tr>
            ) : filteredContracts.length > 0 ? (
              filteredContracts.map((contract) => {
                const computedStatus = getComputedStatus(contract);
                return (
                <tr key={contract.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-indigo-600">
                    {contract.code || `HĐ-${contract.id?.slice(0, 6)}`}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{contract.studentName || '---'}</div>
                    <div className="text-xs text-gray-500">{contract.parentPhone}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {contract.contractDate
                      ? new Date(contract.contractDate).toLocaleDateString('vi-VN')
                      : '---'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {staffMap.get(contract.createdBy) || contract.createdBy || '---'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatCurrency(contract.totalAmount || 0)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">
                    {formatCurrency(contract.remainingAmount || 0)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusBadge(computedStatus)}`}>
                      {computedStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setSelectedContract(contract)}
                        className="text-gray-400 hover:text-indigo-600 p-1"
                        title="Xem chi tiết"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => handlePrintContract(contract)}
                        className="text-gray-400 hover:text-blue-600 p-1"
                        title="In hợp đồng"
                      >
                        <Printer size={16} />
                      </button>
                      <button
                        onClick={() => handleDownloadContract(contract)}
                        className="text-gray-400 hover:text-green-600 p-1"
                        title="Tải PDF"
                      >
                        <Download size={16} />
                      </button>
                      {computedStatus === ContractStatus.PARTIAL && (
                        <button
                          onClick={() => {
                            setSelectedContract(contract);
                            setPaymentAmount(contract.remainingAmount || 0);
                            setShowPaymentModal(true);
                          }}
                          className="text-gray-400 hover:text-green-600 p-1"
                          title="Thanh toán thêm"
                        >
                          <CreditCard size={16} />
                        </button>
                      )}
                      {computedStatus === ContractStatus.DRAFT && (
                        <button
                          onClick={() => contract.id && handleMarkPaid(contract.id)}
                          className="text-gray-400 hover:text-green-600 p-1"
                          title="Đánh dấu đã thanh toán"
                        >
                          <DollarSign size={16} />
                        </button>
                      )}
                      {(computedStatus === ContractStatus.DRAFT || computedStatus === ContractStatus.CANCELLED) && (
                        <button
                          onClick={() => contract.id && handleDelete(contract.id)}
                          className="text-gray-400 hover:text-red-600 p-1"
                          title="Xóa"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );})
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                  <FileText size={48} className="mx-auto mb-2 opacity-20" />
                  Không tìm thấy hợp đồng nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      {!loading && filteredContracts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-500">Tổng số HĐ</p>
              <p className="text-xl font-bold text-gray-800">{filteredContracts.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Đã thanh toán</p>
              <p className="text-xl font-bold text-green-600">
                {filteredContracts.filter(c => c.status === ContractStatus.PAID).length}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Nợ hợp đồng</p>
              <p className="text-xl font-bold text-orange-600">
                {filteredContracts.filter(c => c.status === ContractStatus.PARTIAL).length}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Tổng doanh thu</p>
              <p className="text-xl font-bold text-indigo-600">
                {formatCurrency(
                  filteredContracts
                    .filter(c => c.status === ContractStatus.PAID || c.status === ContractStatus.PARTIAL)
                    .reduce((sum, c) => sum + (c.paidAmount || c.totalAmount || 0), 0)
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Contract Detail Modal */}
      {selectedContract && !showPaymentModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-bold text-gray-800">Chi tiết hợp đồng</h3>
              <button onClick={() => setSelectedContract(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Contract Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Mã hợp đồng</p>
                  <p className="font-semibold text-indigo-600">{selectedContract.code}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Loại hợp đồng</p>
                  <p className="font-medium">{selectedContract.category || selectedContract.type || '---'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ngày tạo</p>
                  <p className="font-medium">{selectedContract.contractDate ? new Date(selectedContract.contractDate).toLocaleDateString('vi-VN') : '---'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Học viên</p>
                  <p className="font-medium">{selectedContract.studentName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phụ huynh</p>
                  <p className="font-medium">{selectedContract.parentName} - {selectedContract.parentPhone}</p>
                </div>
                {selectedContract.className && (
                  <div>
                    <p className="text-sm text-gray-500">Lớp học</p>
                    <p className="font-medium">{selectedContract.className}</p>
                  </div>
                )}
                {selectedContract.branch && (
                  <div>
                    <p className="text-sm text-gray-500">Cơ sở</p>
                    <p className="font-medium">{selectedContract.branch}</p>
                  </div>
                )}
                {selectedContract.totalSessions && (
                  <div>
                    <p className="text-sm text-gray-500">Số buổi</p>
                    <p className="font-medium">{selectedContract.totalSessions} buổi{selectedContract.pricePerSession ? ` (${formatCurrency(selectedContract.pricePerSession)}/buổi)` : ''}</p>
                  </div>
                )}
                {selectedContract.startDate && (
                  <div>
                    <p className="text-sm text-gray-500">Ngày bắt đầu</p>
                    <p className="font-medium">{new Date(selectedContract.startDate).toLocaleDateString('vi-VN')}</p>
                  </div>
                )}
                {selectedContract.endDate && (
                  <div>
                    <p className="text-sm text-gray-500">Ngày kết thúc (dự kiến)</p>
                    <p className="font-medium">{new Date(selectedContract.endDate).toLocaleDateString('vi-VN')}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-500">Phương thức thanh toán</p>
                  <p className="font-medium">{selectedContract.paymentMethod || '---'}</p>
                </div>
              </div>

              {/* Items */}
              {selectedContract.items && selectedContract.items.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Danh sách sản phẩm/khóa học</p>
                  <table className="w-full text-sm border rounded-lg overflow-hidden">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Tên</th>
                        <th className="px-3 py-2 text-right">Đơn giá</th>
                        <th className="px-3 py-2 text-right">SL</th>
                        <th className="px-3 py-2 text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedContract.items.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-3 py-2">{item.name}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(item.unitPrice || 0)}</td>
                          <td className="px-3 py-2 text-right">{item.quantity}</td>
                          <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.finalPrice || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Payment Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Tổng tiền</p>
                    <p className="text-lg font-bold">{formatCurrency(selectedContract.totalAmount || 0)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Trạng thái</p>
                    <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${getStatusBadge(selectedContract.status)}`}>
                      {selectedContract.status}
                    </span>
                  </div>
                  {selectedContract.totalDiscount > 0 && (
                    <div>
                      <p className="text-sm text-gray-500">Giảm giá</p>
                      <p className="text-lg font-bold text-orange-600">-{formatCurrency(selectedContract.totalDiscount)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-500">Đã thanh toán</p>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(selectedContract.paidAmount || 0)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Còn nợ</p>
                    <p className="text-lg font-bold text-red-600">{formatCurrency(selectedContract.remainingAmount || 0)}</p>
                  </div>
                </div>
              </div>

              {selectedContract.notes && (
                <div>
                  <p className="text-sm text-gray-500">Ghi chú</p>
                  <p className="text-gray-700">{selectedContract.notes}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              {selectedContract.status === ContractStatus.PARTIAL && (
                <button
                  onClick={() => {
                    setPaymentAmount(selectedContract.remainingAmount || 0);
                    setShowPaymentModal(true);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <CreditCard size={16} /> Thanh toán thêm
                </button>
              )}
              <button
                onClick={() => setSelectedContract(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedContract && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-bold text-gray-800">Thanh toán thêm</h3>
              <button onClick={() => { setShowPaymentModal(false); setPaymentAmount(0); }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-500">Hợp đồng: <span className="font-medium text-indigo-600">{selectedContract.code}</span></p>
                <p className="text-sm text-gray-500">Học viên: <span className="font-medium">{selectedContract.studentName}</span></p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Đã thanh toán</p>
                  <p className="text-lg font-bold text-blue-600">{formatCurrency(selectedContract.paidAmount || 0)}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Còn nợ</p>
                  <p className="text-lg font-bold text-red-600">{formatCurrency(selectedContract.remainingAmount || 0)}</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số tiền thanh toán</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  max={selectedContract.remainingAmount || 0}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Còn lại sau khi thanh toán: {formatCurrency(Math.max(0, (selectedContract.remainingAmount || 0) - paymentAmount))}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => { setShowPaymentModal(false); setPaymentAmount(0); }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                onClick={handleAddPayment}
                disabled={paymentLoading || paymentAmount <= 0 || paymentAmount > (selectedContract.remainingAmount || 0)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {paymentLoading ? 'Đang xử lý...' : 'Xác nhận thanh toán'}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};
