/**
 * Date/timestamp utilities (legacy name kept for imports)
 */

export const convertTimestamp = (value: unknown): string => {
  if (!value) return '';

  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const dateValue = (value as { toDate: () => Date }).toDate();
    return dateValue.toISOString();
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return '';
};

export const convertTimestampToDate = (value: unknown): string => {
  const iso = convertTimestamp(value);
  return iso ? iso.split('T')[0] : '';
};

export const formatVietnameseDate = (value: unknown): string => {
  const iso = convertTimestamp(value);
  if (!iso) return '';

  const date = new Date(iso);
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};
