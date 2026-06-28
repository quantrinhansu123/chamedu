import { collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, writeBatch, runTransaction, arrayUnion, Timestamp, db } from '@/src/utils/legacyFirestoreStub';
/**
 * Debt Management Page
 * Hiển thị danh sách học viên:
 * 1. Chuẩn bị hết phí (còn <= 6 buổi)
 * 2. Đang nợ phí (học vượt số buổi đăng ký)
 * 3. Nợ hợp đồng (thanh toán trả góp)
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, CreditCard, Phone, Calendar, ChevronDown, ChevronUp, User, BookOpen, RefreshCw, History, ShieldOff } from 'lucide-react';
import { useStudents } from '../src/hooks/useStudents';
import { useClasses } from '../src/hooks/useClasses';
import { useSettlementInvoices } from '../src/hooks/useSettlementInvoices';
import { usePermissions } from '../src/hooks/usePermissions';
import { formatCurrency } from '../src/utils/currencyUtils';
import { Student } from '../types';
import { SettlementModal, SettlementHistoryTable } from '../src/features/debt/components';
import { getStudentSessionData } from '../src/utils/student-session-utils';

const SESSIONS_WARNING_THRESHOLD = 6; // Cảnh báo khi còn <= 6 buổi

// Helper to format date as DD/MM/YYYY
const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  } catch { return '-'; }
};

export const DebtManagement: React.FC = () => {
  const navigate = useNavigate();
  const { canView } = usePermissions();
  const { students, loading } = useStudents();
  const { classes } = useClasses({});

  // Contract data for start dates
  const [contractMap, setContractMap] = useState<Record<string, { startDate: string; category: string }>>({});
  
  const [expandedSections, setExpandedSections] = useState({
    almostOut: true,
    debt: true,
    contractDebt: true,
    centerDebt: true, // Công nợ trung tâm nợ học viên
  });
  
  const [editingPaymentDate, setEditingPaymentDate] = useState<string | null>(null);
  const [paymentDateValue, setPaymentDateValue] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [settlementStudent, setSettlementStudent] = useState<Student | null>(null);
  const [activeTab, setActiveTab] = useState<'debt' | 'history'>('debt');

  // Settlement history data
  const { invoices: settlementInvoices, loading: settlementLoading } = useSettlementInvoices();

  // Fetch contracts to get start dates
  useEffect(() => {
    const fetchContracts = async () => {
      try {
        const contractsSnap = await getDocs(collection(null as any /* firebase removed */, 'contracts'));
        const map: Record<string, { startDate: string; category: string }> = {};

        contractsSnap.docs.forEach(doc => {
          const c = doc.data();
          if (!c.studentId || c.status === 'Đã hủy') return;

          // Get contract start date from items or contract level
          let contractStartDate = c.createdAt || '';
          if (c.items && c.items.length > 0) {
            const itemDates = c.items
              .filter((item: any) => item.startDate)
              .map((item: any) => item.startDate);
            if (itemDates.length > 0) {
              contractStartDate = itemDates.sort().pop() || contractStartDate;
            }
          }

          const existing = map[c.studentId];
          if (!existing || contractStartDate > existing.startDate) {
            map[c.studentId] = {
              startDate: contractStartDate,
              category: c.category || 'Hợp đồng mới',
            };
          }
        });

        setContractMap(map);
      } catch (err) {
        console.error('Error fetching contracts:', err);
      }
    };
    fetchContracts();
  }, []);

  // Helper to calculate expected end date based on class schedule
  const calculateExpectedEndDate = (remainingSessions: number, classId?: string): string => {
    if (!remainingSessions || remainingSessions <= 0) return '-';

    const studentClass = classId ? classes.find(c => c.id === classId) : null;

    // Get class days from schedule
    const getClassDays = (): number[] => {
      const days: number[] = [];
      if (studentClass?.scheduleDetails && studentClass.scheduleDetails.length > 0) {
        studentClass.scheduleDetails.forEach((detail: any) => {
          const dayNum = parseInt(detail.dayOfWeek);
          if (!isNaN(dayNum)) {
            days.push(dayNum === 7 ? 6 : dayNum - 1);
          } else if (detail.dayOfWeek === 'CN') {
            days.push(0);
          }
        });
        return days;
      }
      if (studentClass?.schedule) {
        const dayMap: Record<string, number> = { '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6 };
        const matches = studentClass.schedule.match(/\d/g);
        if (matches) {
          matches.forEach((d: string) => {
            if (dayMap[d] !== undefined) days.push(dayMap[d]);
          });
        }
      }
      return days.length > 0 ? days : [1, 3]; // Default: Mon, Wed
    };

    const classDays = getClassDays();
    let sessionsCount = 0;
    const endDate = new Date();
    let dayCount = 0;

    while (sessionsCount < remainingSessions && dayCount < 365) {
      endDate.setDate(endDate.getDate() + 1);
      dayCount++;
      if (classDays.includes(endDate.getDay())) sessionsCount++;
    }

    return formatDate(endDate.toISOString());
  };

  // Sync contract debt from contracts collection to students
  const syncContractDebt = async () => {
    setSyncing(true);
    try {
      // Get all contracts with "Nợ hợp đồng" status
      const contractsQuery = query(
        collection(null as any /* firebase removed */, 'contracts'),
        where('status', '==', 'Nợ hợp đồng')
      );
      const contractsSnap = await getDocs(contractsQuery);
      
      // Group contracts by studentId and sum debt
      const studentDebts: Record<string, { 
        totalDebt: number; 
        nextPaymentDate: string | null;
        contractCount: number;
      }> = {};
      
      for (const contractDoc of contractsSnap.docs) {
        const contract = contractDoc.data();
        if (!contract.studentId) continue;
        
        const studentId = contract.studentId;
        if (!studentDebts[studentId]) {
          studentDebts[studentId] = { totalDebt: 0, nextPaymentDate: null, contractCount: 0 };
        }
        
        // Sum debt from all contracts
        studentDebts[studentId].totalDebt += (contract.remainingAmount || 0);
        studentDebts[studentId].contractCount++;
        
        // Get earliest nextPaymentDate
        if (contract.nextPaymentDate) {
          if (!studentDebts[studentId].nextPaymentDate || 
              contract.nextPaymentDate < studentDebts[studentId].nextPaymentDate) {
            studentDebts[studentId].nextPaymentDate = contract.nextPaymentDate;
          }
        }
      }
      
      // Update students
      let updated = 0;
      for (const [studentId, debt] of Object.entries(studentDebts)) {
        try {
          await updateDoc(doc(null as any /* firebase removed */, 'students', studentId), {
            status: 'Nợ hợp đồng',
            contractDebt: debt.totalDebt,
            nextPaymentDate: debt.nextPaymentDate,
          });
          updated++;
          console.log(`Updated ${studentId}: ${debt.contractCount} contracts, total debt: ${debt.totalDebt}`);
        } catch (err) {
          console.error(`Error updating student ${studentId}:`, err);
        }
      }
      
      alert(`Đã đồng bộ ${updated} học viên (${contractsSnap.size} hợp đồng). Vui lòng refresh trang.`);
      window.location.reload();
    } catch (err) {
      console.error('Error syncing:', err);
      alert('Có lỗi khi đồng bộ. Vui lòng thử lại.');
    } finally {
      setSyncing(false);
    }
  };

  // 1. Học viên chuẩn bị hết phí (còn <= 6 buổi, đang học)
  const almostOutStudents = useMemo(() => {
    return students.filter(s => {
      const remaining = (s.registeredSessions || 0) - (s.attendedSessions || 0) - (s.legacyAttendedSessions || 0);
      return remaining > 0 && remaining <= SESSIONS_WARNING_THRESHOLD && s.status === 'Đang học';
    }).sort((a, b) => {
      const remainA = (a.registeredSessions || 0) - (a.attendedSessions || 0) - (a.legacyAttendedSessions || 0);
      const remainB = (b.registeredSessions || 0) - (b.attendedSessions || 0) - (b.legacyAttendedSessions || 0);
      return remainA - remainB; // Ít buổi hơn lên trước
    });
  }, [students]);

  // 2. Học viên đang nợ phí (học vượt số buổi đăng ký)
  const debtStudents = useMemo(() => {
    return students.filter(s => {
      const exceeded = (s.attendedSessions || 0) + (s.legacyAttendedSessions || 0) - (s.registeredSessions || 0);
      return exceeded > 0 && s.status === 'Nợ phí';
    }).sort((a, b) => {
      const exceedA = (a.attendedSessions || 0) + (a.legacyAttendedSessions || 0) - (a.registeredSessions || 0);
      const exceedB = (b.attendedSessions || 0) + (b.legacyAttendedSessions || 0) - (b.registeredSessions || 0);
      return exceedB - exceedA; // Nợ nhiều hơn lên trước
    });
  }, [students]);

  // 3. Học viên nợ hợp đồng (trả góp chưa thanh toán hết)
  const contractDebtStudents = useMemo(() => {
    return students.filter(s => 
      s.status === 'Nợ hợp đồng' && (s.contractDebt || 0) > 0
    ).sort((a, b) => (b.contractDebt || 0) - (a.contractDebt || 0));
  }, [students]);

  // 4. Công nợ trung tâm nợ học viên (buổi học còn lại đã đóng tiền)
  // = Số buổi đăng ký - Số buổi đã học (khi > 0)
  const PRICE_PER_SESSION = 150000; // Giá trung bình 1 buổi

  const centerDebtByClass = useMemo(() => {
    // Group students by class
    const classMap: Record<string, { 
      className: string; 
      students: { id: string; name: string; remaining: number }[];
      totalSessions: number;
      totalAmount: number;
    }> = {};

    students.forEach(s => {
      if (!s.classId || s.status === 'Nghỉ học' || s.status === 'Bảo lưu') return;
      
      const remaining = (s.registeredSessions || 0) - (s.attendedSessions || 0) - (s.legacyAttendedSessions || 0);
      if (remaining <= 0) return; // Chỉ tính khi còn buổi
      
      if (!classMap[s.classId]) {
        const cls = classes.find(c => c.id === s.classId);
        classMap[s.classId] = {
          className: cls?.name || 'Không xác định',
          students: [],
          totalSessions: 0,
          totalAmount: 0,
        };
      }
      
      classMap[s.classId].students.push({
        id: s.id,
        name: s.fullName,
        remaining,
      });
      classMap[s.classId].totalSessions += remaining;
      classMap[s.classId].totalAmount += remaining * PRICE_PER_SESSION;
    });

    return Object.entries(classMap)
      .map(([classId, data]) => ({ classId, ...data }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [students]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getClassName = (classId?: string) => {
    if (!classId) return '---';
    const cls = classes.find(c => c.id === classId);
    return cls?.name || '---';
  };

  const handleSavePaymentDate = async (studentId: string) => {
    if (!paymentDateValue) return;
    try {
      await updateDoc(doc(null as any /* firebase removed */, 'students', studentId), {
        nextPaymentDate: paymentDateValue,
      });
      setEditingPaymentDate(null);
      setPaymentDateValue('');
    } catch (err) {
      console.error('Error saving payment date:', err);
      alert('Không thể lưu ngày hẹn thanh toán');
    }
  };

  const SectionHeader = ({ 
    title, 
    icon: Icon, 
    count, 
    color, 
    expanded, 
    onToggle 
  }: { 
    title: string; 
    icon: React.ElementType; 
    count: number; 
    color: string; 
    expanded: boolean; 
    onToggle: () => void;
  }) => (
    <button
      onClick={onToggle}
      className={`w-full flex items-center justify-between p-4 rounded-t-xl ${color} text-white font-semibold`}
    >
      <div className="flex items-center gap-3">
        <Icon size={20} />
        <span>{title}</span>
        <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm">{count}</span>
      </div>
      {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
    </button>
  );

  // Permission check - after all hooks
  if (!canView('debt')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-500">
        <ShieldOff className="w-16 h-16 mb-4 text-red-400" />
        <h2 className="text-xl font-semibold mb-2">Không có quyền truy cập</h2>
        <p className="text-gray-400">Bạn không có quyền xem trang Quản lý công nợ.</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Về trang chủ
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <CreditCard className="text-red-500" size={24} />
              Quản lý công nợ
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Theo dõi học viên chuẩn bị hết phí, đang nợ phí và nợ hợp đồng
            </p>
          </div>
          <button
            onClick={syncContractDebt}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
            title="Đồng bộ dữ liệu nợ hợp đồng từ danh sách hợp đồng"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Đang đồng bộ...' : 'Đồng bộ HĐ'}
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('debt')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'debt'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <CreditCard size={16} className="inline mr-2" />
            Quản lý công nợ
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <History size={16} className="inline mr-2" />
            Lịch sử tất toán
            {settlementInvoices.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full text-xs">
                {settlementInvoices.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab Content: Debt Management */}
      {activeTab === 'debt' && (
      <>
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={20} />
            <span className="font-medium">Chuẩn bị hết phí</span>
          </div>
          <p className="text-3xl font-bold">{almostOutStudents.length}</p>
          <p className="text-sm opacity-80">Còn ≤ {SESSIONS_WARNING_THRESHOLD} buổi</p>
        </div>
        
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={20} />
            <span className="font-medium">Đang nợ phí</span>
          </div>
          <p className="text-3xl font-bold">{debtStudents.length}</p>
          <p className="text-sm opacity-80">
            {formatCurrency(debtStudents.reduce((sum, s) => {
              const exceeded = (s.attendedSessions || 0) + (s.legacyAttendedSessions || 0) - (s.registeredSessions || 0);
              return sum + exceeded * 150000;
            }, 0))}
          </p>
        </div>
        
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard size={20} />
            <span className="font-medium">Nợ hợp đồng</span>
          </div>
          <p className="text-3xl font-bold">{contractDebtStudents.length}</p>
          <p className="text-sm opacity-80">
            {formatCurrency(contractDebtStudents.reduce((sum, s) => sum + (s.contractDebt || 0), 0))}
          </p>
        </div>
      </div>

      {/* Section 1: Chuẩn bị hết phí */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <SectionHeader
          title="Danh sách học viên chuẩn bị hết phí"
          icon={Clock}
          count={almostOutStudents.length}
          color="bg-orange-500"
          expanded={expandedSections.almostOut}
          onToggle={() => toggleSection('almostOut')}
        />
        
        {expandedSections.almostOut && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Học viên</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Lớp</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Đã học</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Đăng ký</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Còn lại</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Ngày BĐ HĐ</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Dự kiến KT</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Phụ huynh</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {almostOutStudents.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                      Không có học viên nào chuẩn bị hết phí
                    </td>
                  </tr>
                ) : almostOutStudents.map(student => {
                  const { registered, attended, remaining } = getStudentSessionData(student);
                  const contractData = contractMap[student.id];
                  return (
                    <tr key={student.id} className="hover:bg-orange-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User size={16} className="text-gray-400" />
                          <span className="font-medium">{student.fullName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{getClassName(student.classId)}</td>
                      <td className="px-4 py-3 text-center">{attended}</td>
                      <td className="px-4 py-3 text-center">{registered}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          remaining <= 3 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                          {remaining} buổi
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600 text-xs">
                        {formatDate(contractData?.startDate)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                          {calculateExpectedEndDate(remaining, student.classId)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-gray-600">
                          <Phone size={14} />
                          <span>{student.parentPhone || '---'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => navigate(`/customers/student-detail/${student.id}?tab=finance`)}
                          className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                        >
                          Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 2: Đang nợ phí */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <SectionHeader
          title="Danh sách học viên đang nợ phí"
          icon={AlertTriangle}
          count={debtStudents.length}
          color="bg-red-500"
          expanded={expandedSections.debt}
          onToggle={() => toggleSection('debt')}
        />
        
        {expandedSections.debt && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Học viên</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Lớp</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Đã học</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Đăng ký</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Vượt</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Số tiền nợ</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Phụ huynh</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {debtStudents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                      Không có học viên nào đang nợ phí
                    </td>
                  </tr>
                ) : debtStudents.map(student => {
                  const { registered, attended, remaining } = getStudentSessionData(student);
                  const exceeded = -remaining; // remaining âm = nợ
                  const debtAmount = exceeded * 150000;
                  return (
                    <tr key={student.id} className="hover:bg-red-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User size={16} className="text-gray-400" />
                          <span className="font-medium">{student.fullName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{getClassName(student.classId)}</td>
                      <td className="px-4 py-3 text-center">{attended}</td>
                      <td className="px-4 py-3 text-center">{registered}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                          +{exceeded} buổi
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-red-600">
                        {formatCurrency(debtAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-gray-600">
                          <Phone size={14} />
                          <span>{student.parentPhone || '---'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSettlementStudent(student)}
                            className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                          >
                            Tất toán
                          </button>
                          <button
                            onClick={() => navigate(`/customers/student-detail/${student.id}?tab=finance`)}
                            className="text-indigo-600 hover:text-indigo-800 text-sm"
                          >
                            Chi tiết
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 3: Nợ hợp đồng */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <SectionHeader
          title="Danh sách học viên nợ hợp đồng"
          icon={CreditCard}
          count={contractDebtStudents.length}
          color="bg-purple-500"
          expanded={expandedSections.contractDebt}
          onToggle={() => toggleSection('contractDebt')}
        />
        
        {expandedSections.contractDebt && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Học viên</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Lớp</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Số tiền nợ HĐ</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Ngày hẹn TT</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Phụ huynh</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {contractDebtStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      Không có học viên nào nợ hợp đồng
                    </td>
                  </tr>
                ) : contractDebtStudents.map(student => (
                  <tr key={student.id} className="hover:bg-purple-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <User size={16} className="text-gray-400" />
                        <span className="font-medium">{student.fullName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{getClassName(student.classId)}</td>
                    <td className="px-4 py-3 text-right font-bold text-purple-600">
                      {formatCurrency(student.contractDebt || 0)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {editingPaymentDate === student.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="date"
                            value={paymentDateValue}
                            onChange={(e) => setPaymentDateValue(e.target.value)}
                            className="px-2 py-1 border rounded text-xs"
                          />
                          <button
                            onClick={() => handleSavePaymentDate(student.id)}
                            className="text-green-600 hover:text-green-800 text-xs"
                          >
                            Lưu
                          </button>
                          <button
                            onClick={() => setEditingPaymentDate(null)}
                            className="text-gray-400 hover:text-gray-600 text-xs"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          {student.nextPaymentDate ? (
                            <span className={`px-2 py-1 rounded text-xs ${
                              new Date(student.nextPaymentDate) < new Date() 
                                ? 'bg-red-100 text-red-700' 
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {new Date(student.nextPaymentDate).toLocaleDateString('vi-VN')}
                            </span>
                          ) : (
                            <span className="text-gray-400">Chưa hẹn</span>
                          )}
                          <button
                            onClick={() => {
                              setEditingPaymentDate(student.id);
                              setPaymentDateValue(student.nextPaymentDate || '');
                            }}
                            className="text-indigo-600 hover:text-indigo-800"
                            title="Đặt ngày hẹn"
                          >
                            <Calendar size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Phone size={14} />
                        <span>{student.parentPhone || '---'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSettlementStudent(student)}
                          className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
                        >
                          Tất toán
                        </button>
                        <button
                          onClick={() => navigate(`/customers/student-detail/${student.id}?tab=finance`)}
                          className="text-indigo-600 hover:text-indigo-800 text-sm"
                        >
                          Chi tiết
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 4: Công nợ trung tâm nợ học viên */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <SectionHeader
          title="Công nợ buổi học còn lại (Trung tâm nợ học viên)"
          icon={BookOpen}
          count={centerDebtByClass.reduce((sum, c) => sum + c.students.length, 0)}
          color="bg-indigo-500"
          expanded={expandedSections.centerDebt}
          onToggle={() => toggleSection('centerDebt')}
        />
        
        {expandedSections.centerDebt && (
          <div className="p-4">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-indigo-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-indigo-600">
                  {centerDebtByClass.reduce((sum, c) => sum + c.totalSessions, 0)}
                </p>
                <p className="text-xs text-gray-500">Tổng buổi còn lại</p>
              </div>
              <div className="bg-indigo-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-indigo-600">
                  {formatCurrency(centerDebtByClass.reduce((sum, c) => sum + c.totalAmount, 0))}
                </p>
                <p className="text-xs text-gray-500">Tổng giá trị (~150k/buổi)</p>
              </div>
              <div className="bg-indigo-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-indigo-600">
                  {centerDebtByClass.length}
                </p>
                <p className="text-xs text-gray-500">Số lớp</p>
              </div>
              <div className="bg-indigo-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-indigo-600">
                  {centerDebtByClass.reduce((sum, c) => sum + c.students.length, 0)}
                </p>
                <p className="text-xs text-gray-500">Số học viên</p>
              </div>
            </div>

            {/* Table by class */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Lớp</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Số HS</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Tổng buổi còn</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Giá trị</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Chi tiết HS</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {centerDebtByClass.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                        Không có công nợ buổi học
                      </td>
                    </tr>
                  ) : centerDebtByClass.map(cls => (
                    <tr key={cls.classId} className="hover:bg-indigo-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{cls.className}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-bold">
                          {cls.students.length}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-indigo-600">
                        {cls.totalSessions} buổi
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-indigo-600">
                        {formatCurrency(cls.totalAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {cls.students.slice(0, 5).map((s, i) => (
                            <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                              {s.name} ({s.remaining})
                            </span>
                          ))}
                          {cls.students.length > 5 && (
                            <span className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded text-xs">
                              +{cls.students.length - 5} khác
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      </>
      )}

      {/* Tab Content: Settlement History */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <History size={18} className="text-indigo-600" />
              Lịch sử tất toán
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Danh sách các phiếu tất toán đã tạo
            </p>
          </div>
          <SettlementHistoryTable
            invoices={settlementInvoices}
            loading={settlementLoading}
            showStudentName={true}
          />
        </div>
      )}

      {/* Settlement Modal */}
      {settlementStudent && (
        <SettlementModal
          student={settlementStudent}
          className={getClassName(settlementStudent.classId)}
          onClose={() => setSettlementStudent(null)}
          onSuccess={() => setSettlementStudent(null)}
        />
      )}
    </div>
  );
};
