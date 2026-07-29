import { describe, expect, it } from 'vitest';
import { getAttendanceRecordRevenue } from '../services/trainingRevenueApiService';
import type { AttendanceRecord } from '../../types';

const baseRecord: AttendanceRecord = {
  id: '1',
  classId: 'c1',
  className: 'Lớp A',
  date: '2026-07-01',
  totalStudents: 10,
  present: 8,
  absent: 1,
  reserved: 1,
  tutored: 0,
  status: 'Đã điểm danh',
};

describe('getAttendanceRecordRevenue', () => {
  it('uses sessionAmount when available', () => {
    expect(
      getAttendanceRecordRevenue({ ...baseRecord, sessionAmount: 1_200_000 })
    ).toBe(1_200_000);
  });

  it('uses billableStudents × unitPrice as fallback', () => {
    expect(
      getAttendanceRecordRevenue({
        ...baseRecord,
        sessionAmount: 0,
        billableStudents: 7,
        unitPrice: 150_000,
      })
    ).toBe(1_050_000);
  });

  it('uses present + tutored × tuition when no stored amounts', () => {
    expect(
      getAttendanceRecordRevenue(
        { ...baseRecord, sessionAmount: 0, billableStudents: 0, unitPrice: 0, tutored: 2 },
        100_000
      )
    ).toBe(1_000_000);
  });
});
