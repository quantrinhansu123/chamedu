import { collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, writeBatch, runTransaction, arrayUnion, Timestamp, db } from '@/src/utils/legacyFirestoreStub';
/**
 * DashboardCSKH
 * Dashboard for CSKH (Customer Service) staff
 *
 * Widgets based on Excel Specs:
 * - TN CSKH (Leader): All 8 widgets
 * - NV CSKH (Staff): 6 widgets (no Revenue, no Sales charts)
 */

import React, { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { usePermissions } from '../src/hooks/usePermissions';
import { useAuth } from '../src/hooks/useAuth';
import { formatCurrency } from '../src/utils/currencyUtils';
import { getRevenueSummary } from '../src/services/revenueService';
import { StudentService } from '../src/services/studentService';
import { ClassService } from '../src/services/classService';
import {
  DashboardStats,
  RevenueChart,
  SalesChart,
  BirthdayWidget,
  StudentDebtWidget,
  StudentExpiringSoonWidget,
  WorkDaysWidget,
  ChecklistWidget,
  type Center,
  type BirthdayPerson,
  type GiftStatus,
} from '../components/dashboard';

interface CSKHStats {
  // Student stats
  totalStudents: number;
  totalClasses: number;
  avgPerClass: number;
  studentsByStatus: { name: string; value: number; color: string }[];
  // Revenue (Leader only)
  salesData: { name: string; value: number; color: string }[];
  revenueData: { month: string; expected: number; actual: number }[];
  // Work days
  myWorkDays: number;
  // Lists
  studentsExpiringSoon: {
    id: string;
    fullName: string;
    className: string;
    remainingSessions: number;
    expectedEndDate?: string;
    contractStartDate?: string;
  }[];
  studentsWithDebt: { id: string; fullName: string; className: string; status: string }[];
  // Birthdays
  staffBirthdays: BirthdayPerson[];
  studentBirthdays: BirthdayPerson[];
}

const COLORS = {
  noPhi: '#0D9488',
  hocThu: '#F59E0B',
  baoLuu: '#6366F1',
  nghiHoc: '#EF4444',
  hvMoi: '#10B981',
};

const PIE_COLORS = ['#0D9488', '#FF6B5A', '#F59E0B', '#10B981', '#6366F1'];

export const DashboardCSKH: React.FC = () => {
  const { isCSKHLeader, staffId } = usePermissions();
  const { user } = useAuth();

  const [stats, setStats] = useState<CSKHStats>({
    totalStudents: 0,
    totalClasses: 0,
    avgPerClass: 0,
    studentsByStatus: [],
    salesData: [],
    revenueData: [],
    myWorkDays: 0,
    studentsExpiringSoon: [],
    studentsWithDebt: [],
    staffBirthdays: [],
    studentBirthdays: [],
  });

  const [checklistItems, setChecklistItems] = useState<{ id: string; task: string; count: number; done: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [centers, setCenters] = useState<Center[]>([]);
  const [giftStatus, setGiftStatus] = useState<Record<string, GiftStatus>>({});
  const [selectedBranch, setSelectedBranch] = useState('all');

  // Fetch centers
  useEffect(() => {
    const fetchCenters = async () => {
      try {
        const centersSnap = await getDocs(collection(null as any /* firebase removed */, 'centers'));
        const centerData = centersSnap.docs
          .filter(d => d.data().status === 'Active')
          .map(d => ({ id: d.id, name: d.data().name || '' }));
        setCenters(centerData);
      } catch (err) {
        console.error('Error fetching centers:', err);
      }
    };
    fetchCenters();
  }, []);

  // Load birthday gifts
  useEffect(() => {
    const thisYear = new Date().getFullYear();
    const thisMonth = new Date().getMonth() + 1;

    const unsubscribe = onSnapshot(
      query(collection(null as any /* firebase removed */, 'birthdayGifts'), where('year', '==', thisYear), where('month', '==', thisMonth)),
      (snapshot) => {
        const gifts: Record<string, GiftStatus> = {};
        snapshot.docs.forEach(docSnap => {
          const data = docSnap.data();
          gifts[data.studentId] = {
            giftPrepared: data.giftPrepared || false,
            giftGiven: data.giftGiven || false,
          };
        });
        setGiftStatus(gifts);
      }
    );
    return () => unsubscribe();
  }, []);

  // Toggle gift status
  const handleToggleGift = async (studentId: string, studentName: string, field: 'giftPrepared' | 'giftGiven') => {
    const thisYear = new Date().getFullYear();
    const thisMonth = new Date().getMonth() + 1;
    const docId = `${studentId}_${thisYear}_${thisMonth}`;
    const docRef = doc(null as any /* firebase removed */, 'birthdayGifts', docId);

    const currentStatus = giftStatus[studentId]?.[field] || false;
    const newStatus = !currentStatus;

    await setDoc(docRef, {
      studentId,
      studentName,
      year: thisYear,
      month: thisMonth,
      [field]: newStatus,
      [`${field === 'giftPrepared' ? 'preparedAt' : 'givenAt'}`]: newStatus ? new Date().toISOString() : null,
    }, { merge: true });
  };

  // Fetch dashboard data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const thisMonth = currentMonth + 1;

        // Branch filter helper
        const filterByBranch = (items: any[], branchFields = ['branch', 'center', 'centerName']) => {
          if (selectedBranch === 'all') return items;
          if (selectedBranch === 'unassigned') {
            return items.filter(item => {
              for (const field of branchFields) {
                if (item[field] && item[field].trim() !== '') return false;
              }
              return true;
            });
          }
          return items.filter(item => {
            for (const field of branchFields) {
              if (item[field] && item[field] === selectedBranch) return true;
            }
            return false;
          });
        };

        // Fetch students
        const allStudents = (await StudentService.getStudents()).map((student: any) => ({
          ...student,
          className: student.className || student.class,
          currentClassName: student.currentClassName || student.class,
          hasDebt: student.hasDebt || student.status === 'Nợ phí',
        }));
        const students = filterByBranch(allStudents);

        // Fetch classes
        const allClasses = await ClassService.getClasses();
        const classes = filterByBranch(allClasses);

        // Fetch staff
        const staffSnap = await getDocs(collection(null as any /* firebase removed */, 'staff'));
        const allStaff = staffSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const staffList = filterByBranch(allStaff);

        // Fetch work sessions
        const workSessionsSnap = await getDocs(collection(null as any /* firebase removed */, 'workSessions'));
        const workSessions = workSessionsSnap.docs.map(d => d.data());

        // Calculate student stats by status
        const statusCount = {
          'Đang học': 0,
          'Học thử': 0,
          'Bảo lưu': 0,
          'Nghỉ học': 0,
          'Nợ phí': 0,
        };
        students.forEach((s: any) => {
          const status = s.status || 'Đang học';
          if (status in statusCount) {
            statusCount[status as keyof typeof statusCount]++;
          }
        });

        const studentsByStatus = [
          { name: 'Đang học', value: statusCount['Đang học'], color: COLORS.hvMoi },
          { name: 'Nợ phí', value: statusCount['Nợ phí'], color: COLORS.noPhi },
          { name: 'Học thử', value: statusCount['Học thử'], color: COLORS.hocThu },
          { name: 'Bảo lưu', value: statusCount['Bảo lưu'], color: COLORS.baoLuu },
          { name: 'Nghỉ học', value: statusCount['Nghỉ học'], color: COLORS.nghiHoc },
        ];

        // Calculate work days for current user
        const currentUserId = staffId || user?.uid || '';
        const myWorkDays = workSessions.filter((ws: any) => {
          const wsDate = ws.date ? new Date(ws.date) : null;
          if (!wsDate) return false;
          return (
            ws.staffId === currentUserId &&
            ws.status === 'Đã xác nhận' &&
            wsDate.getMonth() === currentMonth &&
            wsDate.getFullYear() === currentYear
          );
        }).length;

        // Fetch contracts for latest contract date (filtered by student branch)
        const contractsSnap = await getDocs(collection(null as any /* firebase removed */, 'contracts'));
        const allContracts = contractsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const studentIds = new Set(students.map((s: any) => s.id));
        const contracts = selectedBranch === 'all'
          ? allContracts
          : allContracts.filter((c: any) => studentIds.has(c.studentId));

        // Build student -> latest contract map
        const studentLatestContract: Record<string, { startDate: string; category: string }> = {};
        contracts.forEach((c: any) => {
          if (!c.studentId || c.status === 'Đã hủy') return;

          // Get contract start date from items or contract level
          let contractStartDate = c.createdAt || '';
          if (c.items && c.items.length > 0) {
            // Find the most recent item start date
            const itemDates = c.items
              .filter((item: any) => item.startDate)
              .map((item: any) => item.startDate);
            if (itemDates.length > 0) {
              contractStartDate = itemDates.sort().pop() || contractStartDate;
            }
          }

          const existing = studentLatestContract[c.studentId];
          if (!existing || contractStartDate > existing.startDate) {
            studentLatestContract[c.studentId] = {
              startDate: contractStartDate,
              category: c.category || 'Hợp đồng mới',
            };
          }
        });

        // Students expiring soon (remainingSessions <= 5)
        const EXPIRY_THRESHOLD = 5;

        // Helper to get class days from schedule
        const getClassDaysOfWeek = (classData: any): number[] => {
          const days: number[] = [];

          // Try scheduleDetails first (more accurate)
          if (classData?.scheduleDetails && classData.scheduleDetails.length > 0) {
            classData.scheduleDetails.forEach((detail: any) => {
              const dayNum = parseInt(detail.dayOfWeek);
              if (!isNaN(dayNum)) {
                // Convert: 2=Mon(1), 3=Tue(2), ... 7=Sat(6), CN=Sun(0)
                days.push(dayNum === 7 ? 6 : dayNum - 1);
              } else if (detail.dayOfWeek === 'CN') {
                days.push(0);
              }
            });
            return days;
          }

          // Fallback to schedule string
          if (classData?.schedule) {
            const dayMap: Record<string, number> = {
              '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6,
            };
            const matches = classData.schedule.match(/\d/g);
            if (matches) {
              matches.forEach((d: string) => {
                if (dayMap[d] !== undefined) days.push(dayMap[d]);
              });
            }
          }

          return days.length > 0 ? days : [1, 3]; // Default: Mon, Wed
        };

        // Helper to calculate expected end date based on class schedule
        const calculateExpectedEndDate = (remainingSessions: number, classId?: string): string => {
          if (!remainingSessions || remainingSessions <= 0) return '-';

          const studentClass = classId ? classes.find((c: any) => c.id === classId) : null;
          const classDays = getClassDaysOfWeek(studentClass);

          // Calculate by counting actual class days
          let sessionsCount = 0;
          const endDate = new Date();
          const maxDays = 365; // Safety limit
          let dayCount = 0;

          while (sessionsCount < remainingSessions && dayCount < maxDays) {
            endDate.setDate(endDate.getDate() + 1);
            dayCount++;
            const dayOfWeek = endDate.getDay();
            if (classDays.includes(dayOfWeek)) {
              sessionsCount++;
            }
          }

          // Format as DD/MM/YYYY for clarity
          const day = String(endDate.getDate()).padStart(2, '0');
          const month = String(endDate.getMonth() + 1).padStart(2, '0');
          const year = endDate.getFullYear();
          return `${day}/${month}/${year}`;
        };

        // Helper to format contract start date
        const formatContractDate = (dateStr: string | undefined): string => {
          if (!dateStr) return '-';
          try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return '-';
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
          } catch {
            return '-';
          }
        };

        const studentsExpiringSoon = students
          .filter((s: any) =>
            s.status === 'Đang học' &&
            s.remainingSessions !== undefined &&
            s.remainingSessions <= EXPIRY_THRESHOLD &&
            s.remainingSessions > 0
          )
          .map((s: any) => {
            const latestContract = studentLatestContract[s.id];
            return {
              id: s.id,
              fullName: s.fullName || s.name || '',
              className: s.currentClassName || s.className || s.class || '-',
              remainingSessions: s.remainingSessions,
              expectedEndDate: calculateExpectedEndDate(s.remainingSessions, s.classId || s.classIds?.[0]),
              contractStartDate: formatContractDate(latestContract?.startDate || s.enrollmentDate || s.startDate),
            };
          })
          .sort((a: any, b: any) => a.remainingSessions - b.remainingSessions);

        // Students with debt
        const studentsWithDebt = students
          .filter((s: any) =>
            s.hasDebt === true || s.status === 'Nợ phí' ||
            (s.remainingSessions !== undefined && s.remainingSessions < 0)
          )
          .map((s: any) => ({
            id: s.id,
            fullName: s.fullName || s.name || '',
            className: s.currentClassName || s.className || s.class || '-',
            status: s.status || 'Nợ phí',
          }));

        // Staff birthdays this month
        const staffBirthdays = staffList
          .filter((s: any) => {
            if (!s.dob) return false;
            const dob = new Date(s.dob);
            return dob.getMonth() + 1 === thisMonth;
          })
          .map((s: any) => {
            const dob = new Date(s.dob);
            return {
              id: s.id,
              name: s.fullName || s.name || '',
              position: s.position || '',
              date: `${dob.getDate()}/${thisMonth}`,
              dayOfMonth: dob.getDate(),
              branch: s.centerName || s.branch || '',
            };
          })
          .sort((a, b) => a.dayOfMonth - b.dayOfMonth);

        // Student birthdays this month
        const studentBirthdays = students
          .filter((s: any) => {
            if (!s.dob) return false;
            const dob = new Date(s.dob);
            return dob.getMonth() + 1 === thisMonth && s.status === 'Đang học';
          })
          .map((s: any) => {
            const dob = new Date(s.dob);
            return {
              id: s.id,
              name: s.fullName || s.name || '',
              position: 'Học sinh',
              date: `${dob.getDate()}/${thisMonth}`,
              dayOfMonth: dob.getDate(),
              branch: s.centerName || s.branch || '',
            };
          })
          .sort((a, b) => a.dayOfMonth - b.dayOfMonth);

        let salesData: { name: string; value: number; color: string }[] = [];
        let revenueData: { month: string; expected: number; actual: number }[] = [];

        if (isCSKHLeader) {
          const revenueSummary = await getRevenueSummary(currentYear, selectedBranch, thisMonth);
          const currentMonthLabel = `T${thisMonth}`;
          const currentMonthRevenue = revenueSummary.byMonth.find((item) => item.month === currentMonthLabel);

          salesData = revenueSummary.byCategory.map((item) => ({
            name: item.category,
            value: item.amount,
            color: item.color,
          }));
          revenueData = currentMonthRevenue ? [
            { month: 'Kỳ vọng', expected: currentMonthRevenue.expectedRevenue, actual: 0 },
            { month: 'Thực tế', expected: 0, actual: currentMonthRevenue.totalRevenue },
            { month: 'Chênh lệch', expected: 0, actual: Math.max(currentMonthRevenue.expectedRevenue - currentMonthRevenue.totalRevenue, 0) },
          ] : [];
        }

        setStats({
          totalStudents: students.filter((s: any) => s.status === 'Đang học').length,
          totalClasses: classes.filter((c: any) => c.status !== 'Đã kết thúc').length,
          avgPerClass: classes.length > 0
            ? Math.round(students.filter((s: any) => s.status === 'Đang học').length / classes.length * 10) / 10
            : 0,
          studentsByStatus,
          salesData,
          revenueData,
          myWorkDays,
          studentsExpiringSoon,
          studentsWithDebt,
          staffBirthdays,
          studentBirthdays,
        });

        // Set checklist items
        setChecklistItems([
          { id: '1', task: 'Nhắc HS sắp hết phí', count: studentsExpiringSoon.length, done: false },
          { id: '2', task: 'Nhắc HS nợ phí', count: studentsWithDebt.length, done: false },
          { id: '3', task: 'Chúc mừng sinh nhật', count: studentBirthdays.length, done: false },
        ]);

        setLoading(false);
      } catch (error) {
        console.error('Error fetching CSKH dashboard data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, [isCSKHLeader, staffId, user?.uid, selectedBranch]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFFBF5] via-white to-teal-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-teal-100"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-teal-500 animate-spin"></div>
          </div>
          <p className="text-slate-700 mt-5 font-semibold">Đang tải Dashboard CSKH...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Work Days and Branch Filter */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard CSKH</h1>
          <p className="text-slate-500 text-sm">
            {isCSKHLeader ? 'Trưởng nhóm CSKH' : 'Nhân viên CSKH'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Branch Filter */}
          <div className="flex items-center gap-2 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full px-3 py-1.5">
            <MapPin className="text-white/80" size={14} />
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="bg-white/20 backdrop-blur-md text-white border border-white/30 rounded-full px-3 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/40 cursor-pointer hover:bg-white/30 transition-all appearance-none pr-6"
            >
              <option value="all" className="text-gray-800">Tất cả cơ sở</option>
              <option value="unassigned" className="text-gray-800">Chưa gán cơ sở</option>
              {centers.map(center => (
                <option key={center.id} value={center.name} className="text-gray-800">
                  {center.name}
                </option>
              ))}
            </select>
          </div>
          <WorkDaysWidget workDays={stats.myWorkDays} />
        </div>
      </div>

      {/* Row 1: Student Stats + Charts (Leader only) */}
      <div className="grid grid-cols-12 gap-6">
        <div className={isCSKHLeader ? "col-span-4" : "col-span-12"}>
          <DashboardStats studentsByStatus={stats.studentsByStatus} />
        </div>
        {isCSKHLeader && (
          <>
            <div className="col-span-4">
              <RevenueChart data={stats.salesData} />
            </div>
            <div className="col-span-4">
              <SalesChart
                data={stats.revenueData}
                totalRevenue={stats.salesData.reduce((sum, item) => sum + item.value, 0)}
              />
            </div>
          </>
        )}
      </div>

      {/* Row 2: Lists - Expiring + Debt */}
      <div className="grid grid-cols-2 gap-6">
        <StudentExpiringSoonWidget students={stats.studentsExpiringSoon} />
        <StudentDebtWidget students={stats.studentsWithDebt} />
      </div>

      {/* Row 3: Birthday + Checklist */}
      <div className="grid grid-cols-2 gap-6">
        <BirthdayWidget
          staffBirthdays={stats.staffBirthdays}
          studentBirthdays={stats.studentBirthdays}
          centers={centers}
          giftStatus={giftStatus}
          onToggleGift={handleToggleGift}
        />
        <ChecklistWidget
          items={checklistItems}
          onToggle={(id) => {
            setChecklistItems(prev =>
              prev.map(item =>
                item.id === id ? { ...item, done: !item.done } : item
              )
            );
          }}
        />
      </div>
    </div>
  );
};

export default DashboardCSKH;
