import { supabase } from '../config/supabase';

export interface RevenueByMonth {
  month: string;
  year: number;
  totalRevenue: number;
  expectedRevenue: number;
  paidCount: number;
  debtAmount: number;
  debtCount: number;
}

export interface RevenueByClass {
  classId: string;
  className: string;
  totalRevenue: number;
  studentCount: number;
}

export interface RevenueByCategory {
  category: string;
  amount: number;
  percentage: number;
  color: string;
}

export interface RevenueGrowthPoint {
  key: string;
  label: string;
  revenue: number;
  change: number;
  growthRate: number | null;
}

export interface RevenueSummary {
  totalRevenue: number;
  totalAttendanceRevenue: number;
  paidRevenue: number;
  debtAmount: number;
  totalContracts: number;
  paidContracts: number;
  debtContracts: number;
  byMonth: RevenueByMonth[];
  byClass: RevenueByClass[];
  byCategory: RevenueByCategory[];
  growth: {
    daily: RevenueGrowthPoint[];
    monthly: RevenueGrowthPoint[];
    yearly: RevenueGrowthPoint[];
  };
}

type ContractRow = {
  id: string;
  total_amount: number | null;
  paid_amount: number | null;
  remaining_amount: number | null;
  status: string | null;
  contract_date: string | null;
  payment_date: string | null;
  created_at: string | null;
  class_id: string | null;
  class_name: string | null;
  student_id: string | null;
  branch: string | null;
};

type AttendanceSessionRow = {
  class_id: string | null;
  class_name: string | null;
  present: number | null;
  status: string | null;
};

type ClassRevenueRow = {
  id: string;
  name: string;
  branch: string | null;
  tuition_fee: number | null;
};

const CATEGORY_COLORS = ['#0D9488', '#FF6B5A', '#F59E0B', '#10B981', '#6366F1', '#8B5CF6', '#06B6D4'];
const PAID_STATUS = new Set(['Da thanh toan', 'Paid']);
const CANCELLED_STATUS = new Set(['Da huy', 'Cancelled']);
const normalize = (value: string | null | undefined) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');

const isPaid = (status: string | null | undefined) => PAID_STATUS.has(normalize(status));
const isCancelled = (status: string | null | undefined) => CANCELLED_STATUS.has(normalize(status));
const toMonthKey = (dateString: string) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  return {
    key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    label: `T${date.getMonth() + 1}`,
    year: date.getFullYear(),
  };
};

const getContractDate = (row: ContractRow) => row.payment_date || row.contract_date || row.created_at || '';

const formatDayLabel = (dateString: string) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString.slice(0, 10);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const addToMap = (map: Map<string, { label: string; revenue: number }>, key: string, label: string, amount: number) => {
  const current = map.get(key) || { label, revenue: 0 };
  current.revenue += amount;
  map.set(key, current);
};

const toGrowthSeries = (map: Map<string, { label: string; revenue: number }>): RevenueGrowthPoint[] => {
  let previous = 0;
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => {
      const change = value.revenue - previous;
      const growthRate = previous > 0 ? (change / previous) * 100 : null;
      previous = value.revenue;
      return {
        key,
        label: value.label,
        revenue: value.revenue,
        change,
        growthRate,
      };
    });
};

const toCategoryData = (items: Array<[string, number]>): RevenueByCategory[] => {
  const total = items.reduce((sum, [, amount]) => sum + amount, 0);
  return items.map(([category, amount], index) => ({
    category,
    amount,
    percentage: total > 0 ? (amount / total) * 100 : 0,
    color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
  }));
};

const getAttendanceRevenueByClass = async (
  year: number,
  branch: string,
  month = new Date().getMonth() + 1
): Promise<Array<[string, number]>> => {
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  const { data: attendanceRows, error: attendanceError } = await supabase
    .from('attendance')
    .select('class_id,class_name,present,status')
    .gte('date', startDate)
    .lt('date', endDate);
  if (attendanceError) throw attendanceError;

  const sessionRows = ((attendanceRows || []) as AttendanceSessionRow[]).filter(
    (row) => row.class_id && row.status !== 'LỊCH NGHỈ CHUNG' && row.status !== 'Chưa điểm danh'
  );
  if (sessionRows.length === 0) return [];

  const classIds = [...new Set(sessionRows.map((row) => row.class_id).filter(Boolean))] as string[];
  const { data: classRows, error: classError } = await supabase
    .from('classes')
    .select('id,name,branch,tuition_fee')
    .in('id', classIds);
  if (classError) throw classError;

  const classMap = new Map<string, ClassRevenueRow>();
  ((classRows || []) as ClassRevenueRow[]).forEach((row) => {
    if (branch === 'unassigned' && row.branch) return;
    if (branch !== 'all' && branch !== 'unassigned' && row.branch !== branch) return;
    classMap.set(row.id, row);
  });

  const revenueByClass = new Map<string, number>();
  sessionRows.forEach((row) => {
    if (!row.class_id) return;
    const cls = classMap.get(row.class_id);
    if (!cls) return;

    const tuitionFee = Number(cls.tuition_fee || 0);
    const present = Number(row.present || 0);
    if (tuitionFee <= 0 || present <= 0) return;

    const className = cls.name || row.class_name || 'Chưa gán lớp';
    revenueByClass.set(className, (revenueByClass.get(className) || 0) + present * tuitionFee);
  });

  return Array.from(revenueByClass.entries()).sort((a, b) => b[1] - a[1]);
};

export const getRevenueSummary = async (
  year = new Date().getFullYear(),
  branch = 'all',
  month = new Date().getMonth() + 1
): Promise<RevenueSummary> => {
  let contractsQuery = supabase
    .from('contracts')
    .select('id,total_amount,paid_amount,remaining_amount,status,contract_date,payment_date,created_at,class_id,class_name,student_id,branch')
    .gte('contract_date', `${year}-01-01`)
    .lt('contract_date', `${year + 1}-01-01`)
    .order('contract_date', { ascending: true });

  if (branch !== 'all' && branch !== 'unassigned') {
    contractsQuery = contractsQuery.eq('branch', branch);
  }

  const { data: contractRows, error: contractsError } = await contractsQuery;
  if (contractsError) throw contractsError;

  let contracts = ((contractRows || []) as ContractRow[]).filter((row) => !isCancelled(row.status));
  if (branch === 'unassigned') {
    contracts = contracts.filter((row) => !row.branch);
  }

  const byMonth = new Map<string, RevenueByMonth>();
  const byClass = new Map<string, { classId: string; className: string; totalRevenue: number; studentIds: Set<string> }>();
  const growthDaily = new Map<string, { label: string; revenue: number }>();
  const growthMonthly = new Map<string, { label: string; revenue: number }>();
  const growthYearly = new Map<string, { label: string; revenue: number }>();

  let paidRevenue = 0;
  let debtAmount = 0;
  let paidContracts = 0;
  let debtContracts = 0;

  contracts.forEach((contract) => {
    const paidAmount = Number(contract.paid_amount || 0);
    const totalAmount = Number(contract.total_amount || 0);
    const remainingAmount = Math.max(Number(contract.remaining_amount || 0), totalAmount - paidAmount);
    const actualRevenue = paidAmount > 0 ? paidAmount : isPaid(contract.status) ? totalAmount : 0;

    if (actualRevenue > 0) {
      paidRevenue += actualRevenue;
      paidContracts += 1;
    }

    if (totalAmount > 0) {
      const revenueDate = getContractDate(contract);
      const date = new Date(revenueDate);
      if (!Number.isNaN(date.getTime())) {
        const dayKey = revenueDate.slice(0, 10);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const yearKey = String(date.getFullYear());
        addToMap(growthDaily, dayKey, formatDayLabel(revenueDate), totalAmount);
        addToMap(growthMonthly, monthKey, `T${date.getMonth() + 1}/${date.getFullYear()}`, totalAmount);
        addToMap(growthYearly, yearKey, yearKey, totalAmount);
      }
    }
    if (remainingAmount > 0) {
      debtAmount += remainingAmount;
      debtContracts += 1;
    }

    const month = toMonthKey(getContractDate(contract));
    if (month) {
      const existing = byMonth.get(month.key) || {
        month: month.label,
        year: month.year,
        totalRevenue: 0,
        expectedRevenue: 0,
        paidCount: 0,
        debtAmount: 0,
        debtCount: 0,
      };
      existing.totalRevenue += actualRevenue;
      existing.expectedRevenue += totalAmount;
      existing.debtAmount += remainingAmount;
      if (actualRevenue > 0) existing.paidCount += 1;
      if (remainingAmount > 0) existing.debtCount += 1;
      byMonth.set(month.key, existing);
    }

    const classId = contract.class_id || 'unassigned';
    const className = contract.class_name || 'Chưa gán lớp';
    const classSummary = byClass.get(classId) || {
      classId,
      className,
      totalRevenue: 0,
      studentIds: new Set<string>(),
    };
    classSummary.totalRevenue += actualRevenue;
    if (contract.student_id) classSummary.studentIds.add(contract.student_id);
    byClass.set(classId, classSummary);
  });

  const attendanceRevenueByClass = await getAttendanceRevenueByClass(year, branch, month);
  const byCategory = toCategoryData(attendanceRevenueByClass);
  const totalAttendanceRevenue = byCategory.reduce((sum, item) => sum + item.amount, 0);

  return {
    totalRevenue: paidRevenue,
    totalAttendanceRevenue,
    paidRevenue,
    debtAmount,
    totalContracts: contracts.length,
    paidContracts,
    debtContracts,
    byMonth: Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, value]) => value),
    byClass: Array.from(byClass.values())
      .map((value) => ({
        classId: value.classId,
        className: value.className,
        totalRevenue: value.totalRevenue,
        studentCount: value.studentIds.size,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue),
    byCategory,
    growth: {
      daily: toGrowthSeries(growthDaily),
      monthly: toGrowthSeries(growthMonthly),
      yearly: toGrowthSeries(growthYearly),
    },
  };
};
