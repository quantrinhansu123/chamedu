/** Thẻ nhận xét ý thức — chọn nhanh khi điểm danh */
export const ATTITUDE_COMMENT_TAGS = [
  'Ngoan, có ý thức làm bài',
  'Tinh thần học tập tốt',
  'Tập trung tốt trong buổi học',
  'Chăm chú nghe giảng',
  'Tích cực trả lời câu hỏi',
  'Làm bài đầy đủ, đúng hạn',
  'Có tiến bộ so với buổi trước',
  'Cần cố gắng hơn về ý thức',
  'Hay nói chuyện riêng trong giờ',
  'Đến muộn, cần điều chỉnh',
  'Thái độ học tập cần cải thiện',
] as const;

export const appendAttitudeTag = (current: string, tag: string): string => {
  const text = tag.trim();
  if (!text) return current;

  const lines = current
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const exists = lines.some(
    (line) => line.replace(/^\d+\.\s*/, '').toLowerCase() === text.toLowerCase()
  );
  if (exists) return current;

  if (lines.length === 0) return text;
  return `${current.trimEnd()}\n${text}`;
};
