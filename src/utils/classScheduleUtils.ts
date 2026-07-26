import { DayScheduleConfig } from '@/types';
import { parseScheduleDays } from './scheduleUtils';

type LegacyScheduleDetailsObject = {
  days?: number[];
  startTime?: string;
  endTime?: string;
};

const dowToDayKey = (dow: number): string => {
  if (dow === 0) return 'CN';
  return String(dow + 1);
};

const parseDaysFromScheduleText = (schedule: string): string[] => {
  const days: string[] = [];
  if (!schedule) return days;

  if (/chủ\s*nhật|cn/i.test(schedule)) days.push('CN');
  for (let i = 2; i <= 7; i++) {
    if (
      schedule.includes(`Thứ ${i}`) ||
      schedule.includes(`T${i}`) ||
      schedule.match(new RegExp(`(?:^|[,\\s])${i}(?:[,\\s]|$)`))
    ) {
      if (!days.includes(String(i))) days.push(String(i));
    }
  }

  if (days.length > 0) return days.sort((a, b) => {
    if (a === 'CN') return 1;
    if (b === 'CN') return -1;
    return parseInt(a, 10) - parseInt(b, 10);
  });

  return parseScheduleDays(schedule).map((day) => (day === 0 ? 'CN' : String(day)));
};

const parseTimeRangeFromScheduleText = (schedule: string): { startTime: string; endTime: string } | null => {
  if (!schedule) return null;
  const match = schedule.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  if (!match) return null;
  return { startTime: match[1], endTime: match[2] };
};

const getDayLabel = (day: string) => (day === 'CN' ? 'Chủ nhật' : `Thứ ${day}`);

const normalizeDayKey = (day: string): string => {
  const trimmed = (day || '').trim();
  if (!trimmed) return '';
  if (trimmed === 'CN' || /chủ\s*nhật/i.test(trimmed)) return 'CN';
  const thuMatch = trimmed.match(/thứ\s*(\d)/i) || trimmed.match(/^t(\d)$/i);
  if (thuMatch) return thuMatch[1];
  if (/^\d$/.test(trimmed)) return trimmed;
  return trimmed;
};

const isDayScheduleArray = (value: unknown): value is DayScheduleConfig[] =>
  Array.isArray(value) && value.length > 0;

const isLegacyScheduleObject = (value: unknown): value is LegacyScheduleDetailsObject =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const buildScheduleDetailsFromClass = (
  schedule?: string,
  scheduleDetails?: unknown
): { days: string[]; detailsByDay: Record<string, DayScheduleConfig>; startTime: string; endTime: string } => {
  const detailsByDay: Record<string, DayScheduleConfig> = {};
  let days: string[] = [];
  let startTime = '18:00';
  let endTime = '19:30';

  if (isDayScheduleArray(scheduleDetails)) {
    scheduleDetails.forEach((detail) => {
      const day = normalizeDayKey(detail.dayOfWeek);
      if (!day) return;
      detailsByDay[day] = {
        ...detail,
        dayOfWeek: day,
        dayLabel: detail.dayLabel || getDayLabel(day),
      };
      if (!days.includes(day)) days.push(day);
    });
    const first = scheduleDetails[0];
    startTime = first?.startTime || startTime;
    endTime = first?.endTime || endTime;
  } else if (isLegacyScheduleObject(scheduleDetails)) {
    startTime = scheduleDetails.startTime || startTime;
    endTime = scheduleDetails.endTime || endTime;
    days = (scheduleDetails.days || []).map(dowToDayKey).filter(Boolean);
    days.forEach((day) => {
      detailsByDay[day] = {
        dayOfWeek: day,
        dayLabel: getDayLabel(day),
        startTime,
        endTime,
      };
    });
  }

  if (schedule) {
    const parsedDays = parseDaysFromScheduleText(schedule);
    const parsedTime = parseTimeRangeFromScheduleText(schedule);
    if (parsedDays.length > 0) {
      days = parsedDays;
    }
    if (parsedTime) {
      startTime = parsedTime.startTime;
      endTime = parsedTime.endTime;
    }
  }

  days = [...new Set(days.map(normalizeDayKey).filter(Boolean))].sort((a, b) => {
    if (a === 'CN') return 1;
    if (b === 'CN') return -1;
    return parseInt(a, 10) - parseInt(b, 10);
  });

  days.forEach((day) => {
    if (!detailsByDay[day]) {
      detailsByDay[day] = {
        dayOfWeek: day,
        dayLabel: getDayLabel(day),
        startTime,
        endTime,
      };
    }
  });

  return { days, detailsByDay, startTime, endTime };
};

export const formatClassScheduleString = (details: DayScheduleConfig[]): string =>
  details
    .map((detail) => `${detail.startTime}-${detail.endTime} ${detail.dayLabel || getDayLabel(detail.dayOfWeek)}`)
    .join('; ');

/** Day-of-week number used on schedule grid: Thứ 2=2 … Thứ 7=7, CN=8 */
export const scheduleDayKeyToNumber = (day: string): number => (day === 'CN' ? 8 : parseInt(day, 10));

export const getClassScheduleDayNumbers = (schedule?: string, scheduleDetails?: unknown): number[] => {
  const { days } = buildScheduleDetailsFromClass(schedule, scheduleDetails);
  return days
    .map(scheduleDayKeyToNumber)
    .filter((dayNumber) => dayNumber >= 2 && dayNumber <= 8);
};

export type ClassGridScheduleEntry = {
  schedule: string;
  dayNumbers: number[];
};

/** Mở rộng lớp thành từng ô trên lưới TKB (cùng logic hiển thị) */
export const getClassGridScheduleEntries = (
  cls: { schedule?: string; scheduleDetails?: unknown }
): ClassGridScheduleEntry[] => {
  const parsed = buildScheduleDetailsFromClass(cls.schedule, cls.scheduleDetails);
  if (parsed.days.length === 0) {
    const dayNumbers = getClassScheduleDayNumbers(cls.schedule, cls.scheduleDetails);
    return dayNumbers.length > 0 ? [{ schedule: cls.schedule || '', dayNumbers }] : [];
  }

  return parsed.days.map((day) => {
    const detail = parsed.detailsByDay[day];
    const dayLabel = detail.dayLabel || getDayLabel(day);
    const schedule =
      detail.startTime && detail.endTime
        ? `${detail.startTime}-${detail.endTime} ${dayLabel}`
        : dayLabel;
    return {
      schedule,
      dayNumbers: [scheduleDayKeyToNumber(day)],
    };
  });
};
