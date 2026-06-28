import { supabase } from '../config/supabase';

export type AttendancePricingRecord = {
  student_id: string | null;
  class_id: string | null;
  date?: string | null;
};

export type ClassPriceFallback = {
  id: string;
  tuition_fee: number | null;
  total_sessions: number | null;
};

type ContractPriceRow = {
  id: string;
  student_id: string | null;
  class_id: string | null;
  price_per_session: number | null;
  total_sessions: number | null;
  total_amount: number | null;
  contract_date: string | null;
  created_at: string | null;
  status: string | null;
};

type ContractItemPriceRow = {
  contract_id: string;
  type: string | null;
  class_id: string | null;
  unit_price: number | null;
  quantity: number | null;
  final_price: number | null;
  start_date: string | null;
  end_date: string | null;
};

type EnrollmentPriceRow = {
  student_id: string | null;
  class_id: string | null;
  sessions: number | null;
  final_amount: number | null;
  original_amount: number | null;
  created_date: string | null;
  created_at: string | null;
};

type PriceCandidate = {
  studentId: string;
  classId: string;
  price: number;
  effectiveDate: string;
};

const keyFor = (studentId: string, classId: string) => `${studentId}|${classId}`;

const toDateOnly = (value?: string | null): string => {
  if (!value) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [day, month, year] = value.split('/');
    return `${year}-${month}-${day}`;
  }
  return value.length >= 10 ? value.slice(0, 10) : value;
};

const addCandidate = (map: Map<string, PriceCandidate[]>, candidate: PriceCandidate) => {
  if (!candidate.studentId || !candidate.classId || candidate.price <= 0) return;
  const key = keyFor(candidate.studentId, candidate.classId);
  const list = map.get(key) || [];
  list.push(candidate);
  map.set(key, list);
};

const chooseCandidate = (candidates: PriceCandidate[] | undefined, date?: string | null): number | null => {
  if (!candidates?.length) return null;
  const attendanceDate = toDateOnly(date);
  const sorted = [...candidates].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));

  if (attendanceDate) {
    const beforeOrSame = sorted.filter((candidate) => !candidate.effectiveDate || candidate.effectiveDate <= attendanceDate);
    if (beforeOrSame.length > 0) return beforeOrSame[beforeOrSame.length - 1].price;
  }

  return sorted[0].price;
};

export const createAttendancePriceResolver = async (
  records: AttendancePricingRecord[],
  classFallbacks: ClassPriceFallback[]
): Promise<(record: AttendancePricingRecord) => number> => {
  const studentIds = [...new Set(records.map((record) => record.student_id).filter(Boolean))] as string[];
  const classIds = [...new Set(records.map((record) => record.class_id).filter(Boolean))] as string[];

  const fallbackByClass = new Map<string, number>();
  classFallbacks.forEach((cls) => {
    const totalSessions = cls.total_sessions && cls.total_sessions > 0 ? cls.total_sessions : 1;
    const price = Math.round((cls.tuition_fee || 0) / totalSessions);
    if (price > 0) fallbackByClass.set(cls.id, price);
  });

  if (studentIds.length === 0 || classIds.length === 0) {
    return (record) => (record.class_id ? fallbackByClass.get(record.class_id) || 0 : 0);
  }

  const { data: contractData, error: contractError } = await supabase
    .from('contracts')
    .select('id,student_id,class_id,price_per_session,total_sessions,total_amount,contract_date,created_at,status')
    .in('student_id', studentIds);
  if (contractError) throw contractError;

  const contracts = (contractData || []) as ContractPriceRow[];
  const contractIds = contracts.map((contract) => contract.id);
  const contractById = new Map(contracts.map((contract) => [contract.id, contract]));
  const candidates = new Map<string, PriceCandidate[]>();

  if (contractIds.length > 0) {
    const { data: itemData, error: itemError } = await supabase
      .from('contract_items')
      .select('contract_id,type,class_id,unit_price,quantity,final_price,start_date,end_date')
      .in('contract_id', contractIds);
    if (itemError) throw itemError;

    ((itemData || []) as ContractItemPriceRow[]).forEach((item) => {
      if (item.type && item.type !== 'course') return;
      const contract = contractById.get(item.contract_id);
      if (!contract?.student_id) return;
      const itemClassId = item.class_id || contract.class_id;
      if (!itemClassId || !classIds.includes(itemClassId)) return;

      const quantity = item.quantity && item.quantity > 0 ? item.quantity : 0;
      const unitPrice =
        item.unit_price && item.unit_price > 0
          ? item.unit_price
          : quantity > 0
            ? Math.round((item.final_price || 0) / quantity)
            : 0;

      addCandidate(candidates, {
        studentId: contract.student_id,
        classId: itemClassId,
        price: unitPrice,
        effectiveDate: toDateOnly(item.start_date || contract.contract_date || contract.created_at),
      });
    });
  }

  contracts.forEach((contract) => {
    if (!contract.student_id || !contract.class_id || !classIds.includes(contract.class_id)) return;
    const totalSessions = contract.total_sessions && contract.total_sessions > 0 ? contract.total_sessions : 0;
    const price =
      contract.price_per_session && contract.price_per_session > 0
        ? contract.price_per_session
        : totalSessions > 0
          ? Math.round((contract.total_amount || 0) / totalSessions)
          : 0;

    addCandidate(candidates, {
      studentId: contract.student_id,
      classId: contract.class_id,
      price,
      effectiveDate: toDateOnly(contract.contract_date || contract.created_at),
    });
  });

  const { data: enrollmentData, error: enrollmentError } = await supabase
    .from('enrollments')
    .select('student_id,class_id,sessions,final_amount,original_amount,created_date,created_at')
    .in('student_id', studentIds)
    .in('class_id', classIds);
  if (enrollmentError) throw enrollmentError;

  ((enrollmentData || []) as EnrollmentPriceRow[]).forEach((enrollment) => {
    if (!enrollment.student_id || !enrollment.class_id) return;
    const sessions = enrollment.sessions && enrollment.sessions > 0 ? enrollment.sessions : 0;
    const amount = enrollment.final_amount || enrollment.original_amount || 0;
    const price = sessions > 0 ? Math.round(amount / sessions) : 0;

    addCandidate(candidates, {
      studentId: enrollment.student_id,
      classId: enrollment.class_id,
      price,
      effectiveDate: toDateOnly(enrollment.created_date || enrollment.created_at),
    });
  });

  return (record) => {
    if (!record.student_id || !record.class_id) return 0;
    return chooseCandidate(candidates.get(keyFor(record.student_id, record.class_id)), record.date)
      || fallbackByClass.get(record.class_id)
      || 0;
  };
};
