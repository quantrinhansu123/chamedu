import { collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, writeBatch, runTransaction, arrayUnion, Timestamp, db } from '@/src/utils/legacyFirestoreStub';
/**
 * Contract Creation Page
 * Form tạo hợp đồng với tính toán tự động
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FileText, Plus, X, Calculator, DollarSign,
  User, Calendar, Save, FileCheck, Printer, Download
} from 'lucide-react';
import { downloadContractAsPdf, printContract, ContractCenterInfo } from '../src/utils/contract-pdf-generator';
import {
  Contract, ContractType, ContractCategory, ContractItem, PaymentMethod,
  Student, Course, Product, ContractStatus, Discount, ClassStatus, AppliedDiscount
} from '../types';
import { recalculateStudentStatus } from '../src/services/attendanceService';
import { useAuth } from '../src/hooks/useAuth';
import { useStudents } from '../src/hooks/useStudents';
import { useContracts } from '../src/hooks/useContracts';
import { useCurriculums } from '../src/hooks/useCurriculums';
import { useProducts } from '../src/hooks/useProducts';
import { useClasses } from '../src/hooks/useClasses';
import {
  formatCurrency,
  numberToWords,
  calculateDiscount
} from '../src/utils/currencyUtils';
import { isValidDateRange, getDateRangeErrorMessage } from '../src/utils/validators';
import { SearchableSelect, SelectOption } from '../components/SearchableSelect';
import { getCenters, Center } from '../src/services/centerService';
import { ModalPortal } from '@/components/modal-portal';

// Center Info for Invoice
interface CenterInfo {
  centerName: string;
  representative: string;
  address: string;
  phone: string;
  email: string;
  signatureUrl?: string;
  branches?: string[];
  logoUrl?: string;
}

const DEFAULT_CENTER_INFO: CenterInfo = {
  centerName: 'TRUNG TÂM ANH NGỮ BRISKY',
  representative: 'Nguyễn Văn A - Giám đốc',
  address: 'Tây Mỗ, Nam Từ Liêm, Hà Nội',
  phone: '0912.345.678',
  email: 'contact@brisky.edu.vn',
  signatureUrl: '/signature-party-a.png',
};

// Contract Preview Component
interface ContractPreviewProps {
  contract: Partial<Contract>;
  onClose: () => void;
  onPrint: () => void;
  centerInfo: CenterInfo;
  onCenterInfoChange: (info: CenterInfo) => void;
}

const ContractPreview: React.FC<ContractPreviewProps> = ({
  contract, onClose, onPrint, centerInfo, onCenterInfoChange
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Use shared printContract utility which converts signature to base64 for proper rendering
  const handlePrint = async () => {
    if (isPrinting) return;
    setIsPrinting(true);
    try {
      await printContract(contract as Contract, centerInfo);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-green-50">
          <h3 className="text-xl font-bold text-green-800 flex items-center gap-2">
            <FileCheck size={24} />
            Hợp đồng đã được tạo thành công!
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div ref={printRef}>
            {/* Company Header */}
            <div className="header text-center mb-8">
              <h1 className="text-2xl font-bold text-indigo-800">{centerInfo.centerName}</h1>
              <p className="text-gray-600">Địa chỉ: {centerInfo.address}</p>
              <p className="text-gray-600">Hotline: {centerInfo.phone} | Email: {centerInfo.email}</p>
            </div>

            {/* Contract Title */}
            <div className="contract-title text-center my-8">
              <h2 className="text-xl font-bold uppercase">HỢP ĐỒNG ĐĂNG KÝ KHÓA HỌC</h2>
              <p className="text-gray-600 mt-2">Số: <strong>{contract.code || 'BRISKY-XXX'}</strong></p>
              <p className="text-gray-600">Ngày: {new Date(contract.contractDate || '').toLocaleDateString('vi-VN')}</p>
            </div>

            {/* Party A - Center (Editable) */}
            <div className="section mb-6">
              <div className="section-title font-bold border-b border-gray-300 pb-2 mb-3 flex items-center justify-between">
                <span>BÊN A: {centerInfo.centerName}</span>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-normal flex items-center gap-1 print:hidden"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                    Sửa
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-200 print:hidden">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Tên trung tâm</label>
                      <input
                        type="text"
                        value={centerInfo.centerName}
                        onChange={(e) => onCenterInfoChange({ ...centerInfo, centerName: e.target.value })}
                        className="w-full px-2 py-1 text-sm border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Đại diện</label>
                      <input
                        type="text"
                        value={centerInfo.representative}
                        onChange={(e) => onCenterInfoChange({ ...centerInfo, representative: e.target.value })}
                        className="w-full px-2 py-1 text-sm border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Địa chỉ</label>
                      <input
                        type="text"
                        value={centerInfo.address}
                        onChange={(e) => onCenterInfoChange({ ...centerInfo, address: e.target.value })}
                        className="w-full px-2 py-1 text-sm border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Điện thoại</label>
                      <input
                        type="text"
                        value={centerInfo.phone}
                        onChange={(e) => onCenterInfoChange({ ...centerInfo, phone: e.target.value })}
                        className="w-full px-2 py-1 text-sm border rounded"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-600 mb-1">Email</label>
                      <input
                        type="email"
                        value={centerInfo.email}
                        onChange={(e) => onCenterInfoChange({ ...centerInfo, email: e.target.value })}
                        className="w-full px-2 py-1 text-sm border rounded"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                  >
                    Xong
                  </button>
                </div>
              ) : (
                <div className="space-y-1 text-sm">
                  <p><strong>Đại diện:</strong> {centerInfo.representative}</p>
                  <p><strong>Địa chỉ:</strong> {centerInfo.address}</p>
                  <p><strong>Điện thoại:</strong> {centerInfo.phone}</p>
                </div>
              )}
            </div>

            {/* Party B - Customer */}
            <div className="section mb-6">
              <div className="section-title font-bold border-b border-gray-300 pb-2 mb-3">BÊN B: PHỤ HUYNH / HỌC VIÊN</div>
              <div className="space-y-1 text-sm">
                <p><strong>Học viên:</strong> {contract.studentName || '---'}</p>
                <p><strong>Ngày sinh:</strong> {contract.studentDOB ? new Date(contract.studentDOB).toLocaleDateString('vi-VN') : '---'}</p>
                <p><strong>Phụ huynh:</strong> {contract.parentName || '---'}</p>
                <p><strong>Điện thoại:</strong> {contract.parentPhone || '---'}</p>
              </div>
            </div>

            {/* Contract Items */}
            <div className="section mb-6">
              <div className="section-title font-bold border-b border-gray-300 pb-2 mb-3">NỘI DUNG HỢP ĐỒNG</div>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-3 py-2 text-left">STT</th>
                    <th className="border border-gray-300 px-3 py-2 text-left">Nội dung</th>
                    <th className="border border-gray-300 px-3 py-2 text-right">Đơn giá</th>
                    <th className="border border-gray-300 px-3 py-2 text-center">SL</th>
                    <th className="border border-gray-300 px-3 py-2 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {contract.items?.map((item, idx) => (
                    <tr key={idx}>
                      <td className="border border-gray-300 px-3 py-2">{idx + 1}</td>
                      <td className="border border-gray-300 px-3 py-2">{item.name}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="border border-gray-300 px-3 py-2 text-center">{item.quantity}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency(item.finalPrice)}</td>
                    </tr>
                  ))}
                  <tr className="total-row bg-gray-50 font-bold">
                    <td colSpan={4} className="border border-gray-300 px-3 py-2 text-right">TỔNG CỘNG:</td>
                    <td className="border border-gray-300 px-3 py-2 text-right text-indigo-700">{formatCurrency(contract.totalAmount || 0)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="amount-words bg-indigo-50 p-3 rounded mt-3 text-sm">
                <strong>Bằng chữ:</strong> <em>{contract.totalAmountInWords}</em>
              </div>
            </div>

            {/* Payment Info */}
            <div className="section mb-6">
              <div className="section-title font-bold border-b border-gray-300 pb-2 mb-3">THÔNG TIN THANH TOÁN</div>
              <div className="space-y-1 text-sm">
                <p><strong>Hình thức:</strong> {contract.paymentMethod}</p>
                <p><strong>Trạng thái:</strong> <span className={contract.status === ContractStatus.PAID ? 'text-green-600 font-bold' : 'text-orange-600'}>{contract.status}</span></p>
                <p><strong>Đã thanh toán:</strong> {formatCurrency(contract.paidAmount || 0)}</p>
                <p><strong>Còn lại:</strong> {formatCurrency(contract.remainingAmount || 0)}</p>
              </div>
            </div>

            {/* Terms */}
            <div className="section mb-6">
              <div className="section-title font-bold border-b border-gray-300 pb-2 mb-3">ĐIỀU KHOẢN HỢP ĐỒNG</div>
              <ol className="list-decimal list-inside text-sm space-y-2">
                <li>Bên B cam kết thanh toán đầy đủ học phí theo thỏa thuận.</li>
                <li>Bên A cam kết cung cấp dịch vụ giảng dạy theo chương trình đã đăng ký.</li>
                <li>Học phí đã đóng không được hoàn trả, trừ trường hợp bất khả kháng.</li>
                <li>Bên B có quyền bảo lưu khóa học trong thời gian tối đa 3 tháng.</li>
                <li>Hợp đồng có hiệu lực kể từ ngày ký.</li>
              </ol>
            </div>

            {/* Signatures with Party A signature image */}
            <div className="signatures flex justify-between mt-12">
              <div className="signature-box text-center" style={{ width: '200px' }}>
                <p className="font-bold">ĐẠI DIỆN BÊN A</p>
                <p className="text-sm text-gray-500">(Ký, ghi rõ họ tên)</p>
                <div className="flex items-center justify-center my-4" style={{ minHeight: '60px' }}>
                  <img
                    src={centerInfo.signatureUrl || '/signature-party-a.png'}
                    alt="Chữ ký bên A"
                    className="h-12 max-w-[150px] object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
                <div className="signature-line border-t border-gray-400 pt-2 font-medium">
                  {centerInfo.representative.split(' - ')[0] || ''}
                </div>
              </div>
              <div className="signature-box text-center" style={{ width: '200px' }}>
                <p className="font-bold">ĐẠI DIỆN BÊN B</p>
                <p className="text-sm text-gray-500">(Ký, ghi rõ họ tên)</p>
                <div style={{ minHeight: '60px' }} className="my-4"></div>
                <div className="signature-line border-t border-gray-400 pt-2"></div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
          >
            Đóng
          </button>
          <button
            onClick={() => downloadContractAsPdf(contract, centerInfo)}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Download size={18} />
            Tải PDF
          </button>
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50"
          >
            <Printer size={18} />
            {isPrinting ? 'Đang xử lý...' : 'In hợp đồng'}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

export const ContractCreation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { students } = useStudents();
  const { createContract } = useContracts();
  const { curriculums } = useCurriculums({ status: 'Active' });
  const { products } = useProducts({ status: 'Kích hoạt' });
  const { classes } = useClasses();
  
  // Get studentId from navigation state (from TrialStudents page)
  const preSelectedStudentId = (location.state as any)?.studentId;

  // Form state
  const [contractType, setContractType] = useState<ContractType>(ContractType.STUDENT);
  const [contractCategory, setContractCategory] = useState<ContractCategory>(ContractCategory.NEW);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const studentSearchRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<ContractItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.FULL);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showContractPreview, setShowContractPreview] = useState(false);
  const [createdContract, setCreatedContract] = useState<Partial<Contract> | null>(null);
  const [centerInfo, setCenterInfo] = useState<CenterInfo>(DEFAULT_CENTER_INFO);
  const [centers, setCenters] = useState<Center[]>([]);
  const [selectedCenterId, setSelectedCenterId] = useState<string>(''); // For Party A selection
  const [showPartialPaymentModal, setShowPartialPaymentModal] = useState(false);
  const [partialPaidAmount, setPartialPaidAmount] = useState<number>(0);
  const [partialPaymentDate, setPartialPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [nextPaymentDate, setNextPaymentDate] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>('');
  const [contractDate, setContractDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Discounts from configuration
  const [discounts, setDiscounts] = useState<Discount[]>([]);

  // Fetch active discounts
  useEffect(() => {
    const q = query(collection(null as any /* firebase removed */, 'discounts'), where('status', '==', 'Kích hoạt'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Discount));
      setDiscounts(data);
    });
    return () => unsubscribe();
  }, []);

  // Fetch centers list
  useEffect(() => {
    const loadCenters = async () => {
      try {
        const centersList = await getCenters();
        setCenters(centersList);
        // Always use hardcoded branches from DEFAULT_CENTER_INFO (CS1, CS2, CS3 in correct order)
        const branches = DEFAULT_CENTER_INFO.branches || [];
        // Set default center info from main center
        const mainCenter = centersList.find(c => c.isMain) || centersList[0];
        if (mainCenter) {
          setCenterInfo({
            centerName: DEFAULT_CENTER_INFO.centerName, // Always use company name
            representative: mainCenter.manager || DEFAULT_CENTER_INFO.representative,
            address: mainCenter.address || DEFAULT_CENTER_INFO.address,
            phone: DEFAULT_CENTER_INFO.phone, // Use company hotline
            email: mainCenter.email || DEFAULT_CENTER_INFO.email,
            signatureUrl: mainCenter.signatureUrl || '',
            branches,
            logoUrl: '/logo.jpg',
          });
        }
      } catch (error) {
        console.error('Error loading centers:', error);
      }
    };
    loadCenters();
  }, []);

  // Update center info when student changes (based on student's branch)
  useEffect(() => {
    if (!selectedStudent?.branch || centers.length === 0) return;

    // Always use hardcoded branches from DEFAULT_CENTER_INFO (CS1, CS2, CS3 in correct order)
    const branches = DEFAULT_CENTER_INFO.branches || [];

    // Find center matching student's branch
    const studentCenter = centers.find(c =>
      c.name === selectedStudent.branch ||
      c.code === selectedStudent.branch ||
      c.name?.includes(selectedStudent.branch) ||
      selectedStudent.branch?.includes(c.name)
    );

    if (studentCenter) {
      setCenterInfo({
        centerName: DEFAULT_CENTER_INFO.centerName, // Always use company name
        representative: studentCenter.manager || DEFAULT_CENTER_INFO.representative,
        address: studentCenter.address || DEFAULT_CENTER_INFO.address,
        phone: DEFAULT_CENTER_INFO.phone, // Use company hotline
        email: studentCenter.email || DEFAULT_CENTER_INFO.email,
        signatureUrl: studentCenter.signatureUrl || '',
        branches,
        logoUrl: '/logo.jpg',
      });
    }
  }, [selectedStudent?.branch, centers]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  // Smart filtering: Filter classes by status and student's branch
  const filteredClasses = useMemo(() => {
    return classes.filter(c => {
      // 1. Must be studying or pending (opening soon)
      if (c.status !== ClassStatus.STUDYING && c.status !== ClassStatus.PENDING) return false;

      // 2. Branch filter: show classes if:
      //    - Student has no branch (show all)
      //    - Class has no branch (can accept any student)
      //    - Both have branch and they match
      if (selectedStudent?.branch && c.branch && c.branch !== selectedStudent.branch) {
        return false;
      }

      return true;
    });
  }, [classes, selectedStudent]);

  // Convert filtered classes to SelectOption format for SearchableSelect
  const classOptions: SelectOption[] = useMemo(() => {
    return filteredClasses.map(cls => ({
      value: cls.id,
      label: cls.code ? `${cls.name} (${cls.code})` : cls.name,
      sublabel: cls.branch || undefined,
    }));
  }, [filteredClasses]);

  // Date format helper (ISO -> dd/mm/yyyy for display)
  const isoToVN = (isoDate: string) => {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
  };

  // Convert curriculums to course format for contract
  const availableCourses: Course[] = curriculums.map(c => {
    const totalSessions = c.totalSessions || 1;
    const tuitionFee = c.tuitionFee || 0;
    return {
      id: c.id || '',
      code: c.code,
      name: c.name,
      totalSessions: totalSessions,
      pricePerSession: totalSessions > 0 ? Math.round(tuitionFee / totalSessions) : 0,
      totalPrice: tuitionFee,
      status: (c.status === 'Active' || c.status === 'Inactive' ? c.status : 'Active') as 'Active' | 'Inactive',
      createdAt: c.createdAt || '',
      updatedAt: c.updatedAt || '',
    };
  });

  // Convert products to expected format
  const availableProducts: Product[] = products.map(p => ({
    id: p.id || '',
    name: p.name,
    price: p.price,
    category: p.category,
    stock: p.stock,
    status: (p.status === 'Kích hoạt' || p.status === 'Tạm khoá' ? p.status : 'Kích hoạt') as 'Kích hoạt' | 'Tạm khoá',
  }));

  // Auto-select student if coming from TrialStudents page
  useEffect(() => {
    if (preSelectedStudentId && students.length > 0) {
      const student = students.find(s => s.id === preSelectedStudentId);
      if (student) {
        setSelectedStudent(student);
      }
    }
  }, [preSelectedStudentId, students]);

  // Click outside handler for student search
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (studentSearchRef.current && !studentSearchRef.current.contains(e.target as Node)) {
        setShowStudentDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter students for search
  const filteredStudents = useMemo(() => {
    if (!studentSearchTerm.trim()) return [];
    const term = studentSearchTerm.toLowerCase();
    return students.filter(s => 
      s.fullName?.toLowerCase().includes(term) ||
      s.code?.toLowerCase().includes(term) ||
      s.parentName?.toLowerCase().includes(term) ||
      s.phone?.includes(term)
    ).slice(0, 50);
  }, [students, studentSearchTerm]);

  // Auto-calculate end date based on total sessions and class schedule
  useEffect(() => {
    if (!startDate || items.length === 0) {
      setEndDate('');
      return;
    }

    const totalSessions = items
      .filter(item => item.type === 'course')
      .reduce((sum, item) => sum + (item.quantity || 0), 0);

    if (totalSessions <= 0) {
      setEndDate('');
      return;
    }

    // Get selected class schedule to calculate sessions per week
    const selectedClass = classes.find(c => c.id === selectedClassId);
    let sessionsPerWeek = 2; // Default: 2 sessions per week

    if (selectedClass?.schedule) {
      // Count number of unique days in class schedule
      // schedule format: "T2, T4" or "Thứ 2, Thứ 4" etc.
      const scheduleDays = selectedClass.schedule.split(',').filter(d => d.trim()).length;
      if (scheduleDays > 0) {
        sessionsPerWeek = scheduleDays;
      }
    }

    // Calculate end date: startDate + (totalSessions / sessionsPerWeek) weeks
    const weeksNeeded = Math.ceil(totalSessions / sessionsPerWeek);
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(start.getDate() + (weeksNeeded * 7));
    setEndDate(end.toISOString().split('T')[0]);
  }, [startDate, items, selectedClassId, classes]);

  // Calculate totals
  const calculations = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    const totalDiscount = items.reduce((sum, item) => sum + ((item.subtotal || 0) - (item.finalPrice || 0)), 0);
    const totalAmount = items.reduce((sum, item) => sum + (item.finalPrice || 0), 0);
    const totalAmountInWords = numberToWords(totalAmount || 0);

    return { 
      subtotal: subtotal || 0, 
      totalDiscount: totalDiscount || 0, 
      totalAmount: totalAmount || 0, 
      totalAmountInWords: totalAmountInWords || '0 đồng' 
    };
  }, [items]);

  // Add course item
  const addCourseItem = (course: Course) => {
    const unitPrice = course.pricePerSession || 0;
    const quantity = course.totalSessions || 1;
    const subtotal = unitPrice * quantity;
    const newItem: ContractItem = {
      type: 'course',
      id: course.id,
      name: course.name,
      unitPrice: unitPrice,
      quantity: quantity,
      subtotal: subtotal,
      discount: 0,
      finalPrice: subtotal,
    };
    setItems([...items, newItem]);
  };

  // Add product item
  const addProductItem = (product: Product) => {
    const unitPrice = product.price || 0;
    const newItem: ContractItem = {
      type: 'product',
      id: product.id,
      name: product.name,
      unitPrice: unitPrice,
      quantity: 1,
      subtotal: unitPrice,
      discount: 0,
      finalPrice: unitPrice,
    };
    setItems([...items, newItem]);
  };

  // Update item
  const updateItem = (index: number, field: keyof ContractItem, value: any) => {
    const newItems = [...items];
    const item = { ...newItems[index] };
    
    if (field === 'quantity' || field === 'unitPrice') {
      const numValue = Number(value) || 0;
      item[field] = numValue;
      item.subtotal = (item.quantity || 0) * (item.unitPrice || 0);
      item.finalPrice = calculateDiscount(item.subtotal || 0, item.discount || 0);
    } else if (field === 'discount') {
      const numValue = Number(value) || 0;
      item.discount = numValue;
      item.finalPrice = calculateDiscount(item.subtotal || 0, numValue);
    } else {
      (item as any)[field] = value;
    }
    
    newItems[index] = item;
    setItems(newItems);
  };

  // Remove item
  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Toggle discount on/off for an item (supports multiple discounts)
  const toggleDiscount = (itemIndex: number, discount: Discount, checked: boolean) => {
    const newItems = [...items];
    const item = { ...newItems[itemIndex] };

    let appliedDiscounts = [...(item.appliedDiscounts || [])];

    if (checked) {
      // Add discount - calculate amount based on type (from original subtotal for parallel calc)
      const amount = discount.type === 'percent'
        ? item.subtotal * (discount.value / 100)
        : Math.min(discount.value, item.subtotal); // Fixed amount can't exceed subtotal

      appliedDiscounts.push({
        discountId: discount.id!,
        name: discount.name,
        type: discount.type,
        value: discount.value,
        amount: Math.round(amount),
      });
    } else {
      // Remove discount
      appliedDiscounts = appliedDiscounts.filter(ad => ad.discountId !== discount.id);
    }

    // Recalculate totals (parallel = sum of all discounts from original price)
    const totalDiscountAmount = appliedDiscounts.reduce((sum, ad) => sum + ad.amount, 0);

    item.appliedDiscounts = appliedDiscounts;
    item.discount = item.subtotal > 0 ? Math.min(totalDiscountAmount / item.subtotal, 1) : 0;
    item.finalPrice = Math.max(item.subtotal - totalDiscountAmount, 0);

    newItems[itemIndex] = item;
    setItems(newItems);
  };

  // Add custom discount (supports both % and fixed amount)
  const addCustomDiscount = (itemIndex: number, value: number, type: 'percent' | 'fixed') => {
    if (value <= 0) return;

    const newItems = [...items];
    const item = { ...newItems[itemIndex] };

    let appliedDiscounts = [...(item.appliedDiscounts || [])];

    // Remove any existing custom discount
    appliedDiscounts = appliedDiscounts.filter(ad => !ad.discountId.startsWith('custom-'));

    // Calculate amount
    const amount = type === 'percent'
      ? item.subtotal * (value / 100)
      : Math.min(value, item.subtotal);

    // Add new custom discount
    appliedDiscounts.push({
      discountId: `custom-${Date.now()}`,
      name: type === 'percent' ? `Tùy chỉnh ${value}%` : `Giảm ${formatCurrency(value)}`,
      type,
      value,
      amount: Math.round(amount),
    });

    // Recalculate totals
    const totalDiscountAmount = appliedDiscounts.reduce((sum, ad) => sum + ad.amount, 0);

    item.appliedDiscounts = appliedDiscounts;
    item.discount = item.subtotal > 0 ? Math.min(totalDiscountAmount / item.subtotal, 1) : 0;
    item.finalPrice = Math.max(item.subtotal - totalDiscountAmount, 0);

    newItems[itemIndex] = item;
    setItems(newItems);
  };

  // Remove a specific discount from an item
  const removeDiscount = (itemIndex: number, discountId: string) => {
    const newItems = [...items];
    const item = { ...newItems[itemIndex] };

    let appliedDiscounts = (item.appliedDiscounts || []).filter(ad => ad.discountId !== discountId);

    const totalDiscountAmount = appliedDiscounts.reduce((sum, ad) => sum + ad.amount, 0);

    item.appliedDiscounts = appliedDiscounts;
    item.discount = item.subtotal > 0 ? Math.min(totalDiscountAmount / item.subtotal, 1) : 0;
    item.finalPrice = Math.max(item.subtotal - totalDiscountAmount, 0);

    newItems[itemIndex] = item;
    setItems(newItems);
  };

  // Handle submit
  const handleSubmit = async (status: ContractStatus) => {
    if (!user) {
      alert('Bạn cần đăng nhập để tạo hợp đồng');
      return;
    }

    if (contractType === ContractType.STUDENT && !selectedStudent) {
      alert('Vui lòng chọn học viên');
      return;
    }

    if (items.length === 0) {
      alert('Vui lòng thêm ít nhất một khóa học hoặc sản phẩm');
      return;
    }

    // Validate date range
    if (!isValidDateRange(startDate, endDate)) {
      const error = getDateRangeErrorMessage(startDate, endDate);
      alert(error || 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc');
      return;
    }

    try {
      setLoading(true);

      // Calculate paid amount based on status
      let paidAmount = 0;
      let remainingAmount = calculations.totalAmount;
      
      if (status === ContractStatus.PAID) {
        paidAmount = calculations.totalAmount;
        remainingAmount = 0;
      } else if (status === ContractStatus.PARTIAL) {
        // Validate partial payment amount
        if (partialPaidAmount > calculations.totalAmount) {
          alert('Số tiền thanh toán không thể vượt quá tổng tiền hợp đồng');
          return;
        }
        paidAmount = partialPaidAmount;
        remainingAmount = calculations.totalAmount - partialPaidAmount;
      }

      // Calculate total sessions and price per session
      const totalSessions = items
        .filter(item => item.type === 'course')
        .reduce((sum, item) => sum + (item.sessions || 0) * (item.quantity || 1), 0);
      const pricePerSession = totalSessions > 0 ? Math.round(calculations.totalAmount / totalSessions) : 0;

      // Get selected class info
      const selectedClass = classes.find(c => c.id === selectedClassId);

      // Add startDate/endDate/className to each item for PDF display
      const itemsWithDates = items.map(item => ({
        ...item,
        startDate: item.startDate || startDate,
        endDate: item.endDate || endDate,
        className: item.className || selectedClass?.name || '',
      }));

      const contractData: Partial<Contract> = {
        type: contractType,
        category: contractCategory,
        studentId: selectedStudent?.id,
        studentName: selectedStudent?.fullName,
        studentDOB: selectedStudent?.dob,
        parentName: selectedStudent?.parentName,
        parentPhone: selectedStudent?.parentPhone || selectedStudent?.phone, // Prefer parentPhone, fallback to phone
        branch: selectedStudent?.branch || selectedClass?.branch, // Lưu cơ sở từ học viên hoặc lớp
        items: itemsWithDates,
        subtotal: calculations.subtotal,
        totalDiscount: calculations.totalDiscount,
        totalAmount: calculations.totalAmount,
        totalAmountInWords: calculations.totalAmountInWords,
        paymentMethod,
        paidAmount,
        remainingAmount,
        contractDate: contractDate ? new Date(contractDate).toISOString() : new Date().toISOString(),
        startDate: startDate || new Date().toISOString().split('T')[0],
        endDate: endDate || undefined, // Ngày kết thúc dự kiến
        classId: selectedClassId || undefined,
        className: selectedClass?.name || undefined,
        totalSessions,
        pricePerSession,
        paymentDate: status === ContractStatus.PAID ? new Date().toISOString() :
                     status === ContractStatus.PARTIAL ? partialPaymentDate : undefined,
        nextPaymentDate: status === ContractStatus.PARTIAL && nextPaymentDate ? nextPaymentDate : undefined,
        status,
        notes,
        createdBy: user.uid || user.email || 'unknown',
      };

      const contractId = await createContract(contractData);
      const contractCode = contractId ? `Brisky${String(Date.now()).slice(-3)}` : 'Brisky001';
      
      // NOTE: Enrollment record is created by Firestore trigger (contractTriggers.ts)
      // to ensure data integrity and avoid duplicate records
      // Trigger will check if enrollment already exists before creating
      
      // Directly update student for PARTIAL payment (sync with DebtManagement)
      if (status === ContractStatus.PARTIAL && selectedStudent?.id) {
        try {
          await updateDoc(doc(null as any /* firebase removed */, 'students', selectedStudent.id), {
            status: 'Nợ hợp đồng',
            contractDebt: remainingAmount,
            nextPaymentDate: nextPaymentDate || null,
          });
          console.log('Updated student debt info directly');
        } catch (err) {
          console.error('Error updating student debt:', err);
        }
      }
      
      if (status === ContractStatus.PAID || status === ContractStatus.PARTIAL) {
        // Sau khi hợp đồng đã được lưu, tính lại số buổi & trạng thái cho học viên này
        if (selectedStudent?.id) {
          try {
            await recalculateStudentStatus(selectedStudent.id);
          } catch (err) {
            console.error('Error recalculating student status after contract:', err);
          }
        }
        // Show preview for paid/partial contracts
        setCreatedContract({
          ...contractData,
          id: contractId,
          code: contractCode,
        });
        setShowContractPreview(true);
        // Reset partial payment modal
        setShowPartialPaymentModal(false);
        setPartialPaidAmount(0);
      } else {
        // Draft: just show success and redirect
        alert('Đã lưu hợp đồng nháp thành công!');
        navigate('/finance/contracts');
      }
    } catch (error: any) {
      console.error('Error creating contract:', error);
      alert(`Không thể tạo hợp đồng: ${error.message || 'Vui lòng thử lại.'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <FileText className="text-indigo-600" size={28} />
              Tạo hợp đồng mới
            </h2>
            <p className="text-sm text-gray-500 mt-1">Mã hợp đồng sẽ được tạo tự động (Brisky001-999)</p>
          </div>
          <div className="text-sm text-gray-500">
            Ngày tạo: <span className="font-semibold text-gray-800">{isoToVN(contractDate)}</span>
            <input
              type="date"
              value={contractDate}
              onChange={(e) => setContractDate(e.target.value)}
              className="ml-2 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Contract Type */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-bold text-gray-800 mb-4">Loại hợp đồng</h3>
        <div className="flex gap-4">
          <button
            onClick={() => setContractType(ContractType.STUDENT)}
            className={`flex-1 p-4 border-2 rounded-lg transition-all ${
              contractType === ContractType.STUDENT
                ? 'border-indigo-600 bg-indigo-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <User className="mx-auto mb-2" size={24} />
            <p className="font-semibold">Học viên</p>
          </button>
          <button
            onClick={() => setContractType(ContractType.PRODUCT)}
            className={`flex-1 p-4 border-2 rounded-lg transition-all ${
              contractType === ContractType.PRODUCT
                ? 'border-indigo-600 bg-indigo-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <FileText className="mx-auto mb-2" size={24} />
            <p className="font-semibold">Học liệu</p>
          </button>
        </div>

        {/* Contract Category - only for student type */}
        {contractType === ContractType.STUDENT && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="font-medium text-gray-700 mb-3">Phân loại hợp đồng</h4>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setContractCategory(ContractCategory.NEW)}
                className={`p-3 border-2 rounded-lg text-sm transition-all ${
                  contractCategory === ContractCategory.NEW
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-semibold">Hợp đồng mới</p>
                <p className="text-xs text-gray-500 mt-1">Học sinh mới đăng ký</p>
              </button>
              <button
                onClick={() => setContractCategory(ContractCategory.RENEWAL)}
                className={`p-3 border-2 rounded-lg text-sm transition-all ${
                  contractCategory === ContractCategory.RENEWAL
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-semibold">Hợp đồng tái phí</p>
                <p className="text-xs text-gray-500 mt-1">Gia hạn/Đăng ký thêm</p>
              </button>
              <button
                onClick={() => setContractCategory(ContractCategory.MIGRATION)}
                className={`p-3 border-2 rounded-lg text-sm transition-all ${
                  contractCategory === ContractCategory.MIGRATION
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-semibold">Hợp đồng liên kết</p>
                <p className="text-xs text-gray-500 mt-1">Chuyển từ hệ thống cũ</p>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Center/Branch Selection for Party A */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-bold text-gray-800 mb-4">Chi nhánh thực hiện (Bên A)</h3>
        <select
          value={selectedCenterId}
          onChange={(e) => {
            const center = centers.find(c => c.id === e.target.value);
            setSelectedCenterId(e.target.value);
            if (center) {
              // Always use hardcoded branches from DEFAULT_CENTER_INFO
              const branches = DEFAULT_CENTER_INFO.branches || [];
              setCenterInfo({
                centerName: DEFAULT_CENTER_INFO.centerName,
                representative: center.manager || DEFAULT_CENTER_INFO.representative,
                address: center.address || DEFAULT_CENTER_INFO.address,
                phone: center.phone || DEFAULT_CENTER_INFO.phone,
                email: center.email || DEFAULT_CENTER_INFO.email,
                signatureUrl: center.signatureUrl || '',
                branches,
                logoUrl: '/logo.jpg',
              });
            }
          }}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          <option value="">-- Chọn chi nhánh --</option>
          {centers.filter(c => c.status === 'Active').map(c => (
            <option key={c.id} value={c.id}>
              {c.name} - {c.address}
            </option>
          ))}
        </select>
        {selectedCenterId && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm space-y-1">
            <p><span className="text-gray-500">Đại diện:</span> {centerInfo.representative}</p>
            <p><span className="text-gray-500">Địa chỉ:</span> {centerInfo.address}</p>
            <p><span className="text-gray-500">SĐT:</span> {centerInfo.phone}</p>
          </div>
        )}
      </div>

      {/* Student Selection (only if type is STUDENT) */}
      {contractType === ContractType.STUDENT && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-gray-800 mb-4">Thông tin học viên</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chọn học viên <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Dropdown chọn từ danh sách */}
                <div>
                  <select
                    value={selectedStudent?.id || ''}
                    onChange={(e) => {
                      const student = students.find(s => s.id === e.target.value);
                      setSelectedStudent(student || null);
                      setStudentSearchTerm('');
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">-- Chọn từ danh sách ({students.length} HV) --</option>
                    {students.map(student => (
                      <option key={student.id} value={student.id}>
                        {student.fullName} ({student.code}) - {student.parentName}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Ô tìm kiếm */}
                <div className="relative" ref={studentSearchRef}>
                  <input
                    type="text"
                    value={studentSearchTerm}
                    onChange={(e) => {
                      setStudentSearchTerm(e.target.value);
                      setShowStudentDropdown(true);
                    }}
                    onFocus={() => setShowStudentDropdown(true)}
                    placeholder="Hoặc gõ tên để tìm nhanh..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  {showStudentDropdown && studentSearchTerm.trim() && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
                      {filteredStudents.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-500">Không tìm thấy học viên</div>
                      ) : (
                        <>
                          {filteredStudents.map(student => (
                            <div
                              key={student.id}
                              onClick={() => {
                                setSelectedStudent(student);
                                setStudentSearchTerm('');
                                setShowStudentDropdown(false);
                              }}
                              className="px-4 py-2 hover:bg-indigo-50 cursor-pointer border-b border-gray-100 last:border-0"
                            >
                              <div className="font-medium text-gray-800">{student.fullName} ({student.code})</div>
                              <div className="text-xs text-gray-500">
                                PH: {student.parentName} | SĐT: {student.phone}
                              </div>
                            </div>
                          ))}
                          {filteredStudents.length >= 50 && (
                            <div className="px-4 py-2 text-xs text-center text-gray-400 bg-gray-50">
                              Hiển thị 50 kết quả đầu tiên
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {selectedStudent && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Ngày sinh</p>
                    <p className="font-semibold">
                      {new Date(selectedStudent.dob).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Phụ huynh</p>
                    <p className="font-semibold">{selectedStudent.parentName}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Điện thoại</p>
                    <p className="font-semibold">{selectedStudent.phone}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Lớp học hiện tại</p>
                    <p className="font-semibold">{selectedStudent.class || '---'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Ngày bắt đầu, Ngày kết thúc & Lớp học */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ngày bắt đầu <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ngày kết thúc dự kiến
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Tự động tính từ số buổi + lịch lớp
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Thêm vào lớp
                </label>
                <SearchableSelect
                  options={classOptions}
                  value={selectedClassId}
                  onChange={setSelectedClassId}
                  placeholder="-- Chọn lớp (không bắt buộc) --"
                  emptyMessage="Không tìm thấy lớp phù hợp"
                />
                {classOptions.length === 0 && selectedStudent && (
                  <p className="mt-1 text-sm text-yellow-600">
                    Không có lớp phù hợp với chi nhánh {selectedStudent.branch || 'của học sinh'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Items Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800">Khóa học / Sản phẩm</h3>
          <div className="flex gap-2">
            <select
              onChange={(e) => {
                const course = availableCourses.find(c => c.id === e.target.value);
                if (course) {
                  addCourseItem(course);
                  e.target.value = '';
                }
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">+ Thêm khóa học</option>
              {availableCourses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.name} - {formatCurrency(course.totalPrice)}
                </option>
              ))}
            </select>
            <select
              onChange={(e) => {
                const product = availableProducts.find(p => p.id === e.target.value);
                if (product) {
                  addProductItem(product);
                  e.target.value = '';
                }
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">+ Thêm sản phẩm</option>
              {availableProducts.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name} - {formatCurrency(product.price)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FileText size={48} className="mx-auto mb-2 opacity-20" />
            <p>Chưa có khóa học hoặc sản phẩm nào</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">Tên</th>
                  <th className="px-4 py-3 text-right">Đơn giá</th>
                  <th className="px-4 py-3 text-center">Số lượng</th>
                  <th className="px-4 py-3 text-right">Tổng tiền</th>
                  <th className="px-4 py-3 text-left">Ưu đãi</th>
                  <th className="px-4 py-3 text-right">Thành tiền</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded text-xs mb-1 ${
                        item.type === 'course' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {item.type === 'course' ? 'Khóa học' : 'Sản phẩm'}
                      </span>
                      <p className="font-medium">{item.name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={item.unitPrice || 0}
                        onChange={(e) => updateItem(index, 'unitPrice', parseInt(e.target.value) || 0)}
                        className="w-28 px-2 py-1 border border-gray-300 rounded text-right"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatCurrency(item.subtotal)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-2">
                        {/* Checkbox list for available discounts */}
                        {discounts.filter(d => d.status === 'Kích hoạt').map(d => {
                          const isSelected = (item.appliedDiscounts || [])
                            .some(ad => ad.discountId === d.id);
                          return (
                            <label key={d.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => toggleDiscount(index, d, e.target.checked)}
                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="flex-1">{d.name}</span>
                              <span className="text-gray-500">
                                {d.type === 'percent' ? `${d.value}%` : `-${formatCurrency(d.value)}`}
                              </span>
                            </label>
                          );
                        })}

                        {/* Custom discount input */}
                        <div className="flex items-center gap-1 pt-2 border-t border-gray-200">
                          <span className="text-xs text-gray-500">Tùy chỉnh:</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="Giá trị"
                            className="w-16 px-1 py-0.5 text-xs border border-gray-300 rounded"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const target = e.target as HTMLInputElement;
                                const value = parseFloat(target.value) || 0;
                                const typeSelect = target.nextElementSibling as HTMLSelectElement;
                                const type = typeSelect?.value as 'percent' | 'fixed';
                                if (value > 0) {
                                  addCustomDiscount(index, value, type);
                                  target.value = '';
                                }
                              }
                            }}
                          />
                          <select
                            className="text-xs border border-gray-300 rounded px-1 py-0.5"
                            defaultValue="percent"
                          >
                            <option value="percent">%</option>
                            <option value="fixed">VND</option>
                          </select>
                          <button
                            type="button"
                            onClick={(e) => {
                              const container = (e.target as HTMLElement).parentElement;
                              const input = container?.querySelector('input') as HTMLInputElement;
                              const select = container?.querySelector('select') as HTMLSelectElement;
                              const value = parseFloat(input?.value) || 0;
                              const type = select?.value as 'percent' | 'fixed';
                              if (value > 0) {
                                addCustomDiscount(index, value, type);
                                input.value = '';
                              }
                            }}
                            className="text-xs bg-indigo-500 text-white px-2 py-0.5 rounded hover:bg-indigo-600"
                          >
                            +
                          </button>
                        </div>

                        {/* Show applied discounts breakdown */}
                        {(item.appliedDiscounts?.length || 0) > 0 && (
                          <div className="text-xs p-2 bg-green-50 rounded border border-green-200 mt-2">
                            <div className="font-medium text-green-800 mb-1">Ưu đãi đã áp dụng:</div>
                            {item.appliedDiscounts!.map((ad) => (
                              <div key={ad.discountId} className="flex justify-between items-center text-green-700">
                                <span className="flex items-center gap-1">
                                  {ad.name}
                                  <button
                                    type="button"
                                    onClick={() => removeDiscount(index, ad.discountId)}
                                    className="text-red-400 hover:text-red-600"
                                  >
                                    <X size={12} />
                                  </button>
                                </span>
                                <span>-{formatCurrency(ad.amount)}</span>
                              </div>
                            ))}
                            <div className="border-t border-green-300 mt-1 pt-1 font-medium flex justify-between text-green-800">
                              <span>Tổng giảm</span>
                              <span>-{formatCurrency(item.subtotal - item.finalPrice)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-600">
                      {formatCurrency(item.finalPrice)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => removeItem(index)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <X size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Financial Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Calculator size={20} />
          Tổng kết tài chính
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Tổng tiền:</span>
            <span className="font-semibold text-lg">{formatCurrency(calculations.subtotal)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Ưu đãi:</span>
            <span className="font-semibold text-orange-600">- {formatCurrency(calculations.totalDiscount)}</span>
          </div>
          <div className="h-px bg-gray-200"></div>
          <div className="flex justify-between items-center">
            <span className="text-gray-800 font-bold">Số tiền cần thanh toán:</span>
            <span className="font-bold text-2xl text-indigo-600">{formatCurrency(calculations.totalAmount)}</span>
          </div>
          <div className="bg-indigo-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Số tiền bằng chữ:</p>
            <p className="font-medium text-indigo-900 italic">{calculations.totalAmountInWords}</p>
          </div>
        </div>
      </div>

      {/* Payment Method */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-bold text-gray-800 mb-4">Hình thức thanh toán</h3>
        <div className="grid grid-cols-2 gap-3">
          {Object.values(PaymentMethod).map(method => (
            <button
              key={method}
              onClick={() => setPaymentMethod(method)}
              className={`p-4 border-2 rounded-lg transition-all ${
                paymentMethod === method
                  ? 'border-indigo-600 bg-indigo-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <DollarSign className="mx-auto mb-2" size={20} />
              <p className="font-medium">{method}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-bold text-gray-800 mb-4">Ghi chú</h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          placeholder="Nhập ghi chú cho hợp đồng..."
        />
      </div>

      {/* Action Buttons (Fixed at bottom) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex gap-3 justify-end">
          <button
            onClick={() => navigate(-1)}
            disabled={loading}
            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            onClick={() => handleSubmit(ContractStatus.DRAFT)}
            disabled={loading || items.length === 0}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Save size={18} />
            Lưu nháp
          </button>
          <button
            onClick={() => {
              // Pre-fill with full amount for convenience
              setPartialPaidAmount(calculations.totalAmount);
              setShowPartialPaymentModal(true);
            }}
            disabled={loading || items.length === 0}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <FileCheck size={18} />
            Thanh toán
          </button>
        </div>
      </div>

      {/* Payment Modal - Unified flow for full/partial payment */}
      {showPartialPaymentModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Xác nhận thanh toán</h3>

            {/* Tổng tiền */}
            <div className="bg-indigo-50 p-3 rounded-lg mb-4">
              <p className="text-sm text-gray-600">
                Tổng tiền hợp đồng: <span className="font-bold text-indigo-600">{formatCurrency(calculations.totalAmount)}</span>
              </p>
            </div>

            {/* Ngày thanh toán */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ngày thanh toán
              </label>
              <input
                type="date"
                value={partialPaymentDate}
                onChange={(e) => setPartialPaymentDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Số tiền thanh toán */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Số tiền thanh toán
              </label>
              <input
                type="number"
                min="0"
                max={calculations.totalAmount}
                step="10000"
                value={partialPaidAmount}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0;
                  // Cap at totalAmount to prevent overpayment
                  setPartialPaidAmount(Math.min(value, calculations.totalAmount));
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Nhập số tiền thanh toán..."
              />
              {/* Quick buttons */}
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setPartialPaidAmount(calculations.totalAmount)}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    partialPaidAmount === calculations.totalAmount
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Thanh toán đủ
                </button>
                <button
                  type="button"
                  onClick={() => setPartialPaidAmount(Math.round(calculations.totalAmount / 2))}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    partialPaidAmount === Math.round(calculations.totalAmount / 2)
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  50%
                </button>
                <button
                  type="button"
                  onClick={() => setPartialPaidAmount(0)}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    partialPaidAmount === 0
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Chưa thanh toán
                </button>
              </div>
            </div>

            {/* Còn nợ - only show if not fully paid */}
            {partialPaidAmount < calculations.totalAmount && (
              <div className="bg-red-50 p-3 rounded-lg mb-4">
                <p className="text-sm text-gray-600">
                  Còn nợ: <span className="font-bold text-red-600">{formatCurrency(calculations.totalAmount - partialPaidAmount)}</span>
                </p>
              </div>
            )}

            {/* Thanh toán đủ indicator */}
            {partialPaidAmount >= calculations.totalAmount && (
              <div className="bg-green-50 p-3 rounded-lg mb-4">
                <p className="text-sm text-green-700 font-medium flex items-center gap-2">
                  <FileCheck size={16} />
                  Thanh toán đủ - Hợp đồng sẽ được đánh dấu hoàn tất
                </p>
              </div>
            )}

            {/* Ngày hẹn thanh toán tiếp theo - only show if partial payment */}
            {partialPaidAmount < calculations.totalAmount && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ngày hẹn thanh toán tiếp theo <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={nextPaymentDate}
                  onChange={(e) => setNextPaymentDate(e.target.value)}
                  min={partialPaymentDate}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Thông tin này sẽ được đồng bộ với Quản lý công nợ
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowPartialPaymentModal(false);
                  setPartialPaidAmount(0);
                  setNextPaymentDate('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  // Auto-determine status based on payment amount
                  if (partialPaidAmount >= calculations.totalAmount) {
                    handleSubmit(ContractStatus.PAID);
                  } else {
                    handleSubmit(ContractStatus.PARTIAL);
                  }
                }}
                disabled={loading || (partialPaidAmount < calculations.totalAmount && !nextPaymentDate)}
                className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 flex items-center gap-2 ${
                  partialPaidAmount >= calculations.totalAmount
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-orange-500 hover:bg-orange-600'
                }`}
              >
                {loading ? 'Đang xử lý...' : (
                  partialPaidAmount >= calculations.totalAmount ? 'Xác nhận thanh toán' : 'Xác nhận nợ hợp đồng'
                )}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Contract Preview Modal */}
      {showContractPreview && createdContract && (
        <ContractPreview
          contract={createdContract}
          onClose={() => {
            setShowContractPreview(false);
            navigate('/finance/contracts');
          }}
          onPrint={() => {}}
          centerInfo={centerInfo}
          onCenterInfoChange={setCenterInfo}
        />
      )}
    </div>
  );
};
