export interface LearningNoteItem {
  id: string;
  title: string;
  content: string;
}

export interface LearningMaterialRef {
  id: string;
  title: string;
}

export interface AttentionCardData {
  gradeBandId: string;
  gradeBandName: string;
  gradeId: string;
  gradeName: string;
  exerciseTypeId: string;
  exerciseTypeTitle: string;
  exerciseTypes?: Array<{ id: string; title: string }>;
  materialId?: string;
  materialTitle?: string;
  materials?: LearningMaterialRef[];
  selectedNotes: LearningNoteItem[];
}

export interface CheckExerciseTagsData {
  gradeBandId: string;
  gradeBandName: string;
  gradeId: string;
  gradeName: string;
  exerciseTypeId?: string;
  exerciseTypeTitle?: string;
  materials?: LearningMaterialRef[];
  /** Dữ liệu cũ — dạng bài không có chi tiết học liệu */
  exerciseTypes?: Array<{ id: string; title: string }>;
}

export interface LessonExerciseTagsData {
  gradeBandId: string;
  gradeBandName: string;
  gradeId: string;
  gradeName: string;
  exerciseTypes: Array<{ id: string; title: string }>;
}

export const parseExerciseNotes = (description?: string | null): LearningNoteItem[] => {
  if (!description?.trim()) return [];
  try {
    const parsed = JSON.parse(description);
    if (Array.isArray(parsed)) {
      return parsed.map((item, index) => ({
        id: String(item.id || `note-${index}`),
        title: String(item.title || item.name || ''),
        content: String(item.content || ''),
      }));
    }
  } catch {
    return [{ id: 'legacy-1', title: 'Ghi chú', content: description }];
  }
  return [];
};

export const serializeExerciseNotes = (notes: LearningNoteItem[]): string | null => {
  const cleaned = notes
    .map((note) => ({
      id: note.id,
      title: note.title.trim(),
      content: note.content.trim(),
    }))
    .filter((note) => note.title || note.content);
  return cleaned.length > 0 ? JSON.stringify(cleaned) : null;
};

export const parseAttentionCard = (value?: string | null): AttentionCardData | null => {
  if (!value?.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed?.exerciseTypeId || Array.isArray(parsed?.exerciseTypes)) {
      return {
        ...parsed,
        selectedNotes: Array.isArray(parsed.selectedNotes) ? parsed.selectedNotes : [],
        exerciseTypes: Array.isArray(parsed.exerciseTypes) ? parsed.exerciseTypes : [],
        materials: Array.isArray(parsed.materials) ? parsed.materials : [],
      } as AttentionCardData;
    }
  } catch {
    return {
      gradeBandId: '',
      gradeBandName: '',
      gradeId: '',
      gradeName: '',
      exerciseTypeId: '',
      exerciseTypeTitle: '',
      selectedNotes: [{ id: 'legacy', title: 'Thẻ chú ý', content: value }],
    };
  }
  return null;
};

export const serializeAttentionCard = (data: AttentionCardData | null): string => {
  const hasTypes = data?.exerciseTypes?.length || data?.exerciseTypeId;
  if (!hasTypes) return '';
  return JSON.stringify({
    ...data,
    selectedNotes: data?.selectedNotes || [],
    exerciseTypes: data?.exerciseTypes || [],
    materials: data?.materials || [],
  });
};

export const parseCheckExerciseTags = (value?: string | null): CheckExerciseTagsData | null => {
  if (!value?.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    if (
      parsed &&
      (parsed.exerciseTypeId ||
        Array.isArray(parsed.materials) ||
        Array.isArray(parsed.exerciseTypes))
    ) {
      return {
        ...parsed,
        materials: Array.isArray(parsed.materials) ? parsed.materials : [],
        exerciseTypes: Array.isArray(parsed.exerciseTypes) ? parsed.exerciseTypes : [],
      } as CheckExerciseTagsData;
    }
  } catch {
    return null;
  }
  return null;
};

export const serializeCheckExerciseTags = (data: CheckExerciseTagsData | null): string => {
  if (!data?.exerciseTypeId && !data?.materials?.length && !data?.exerciseTypes?.length) {
    return '';
  }
  return JSON.stringify(data);
};

export const parseLessonExerciseTags = (value?: string | null): LessonExerciseTagsData | null => {
  if (!value?.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed && Array.isArray(parsed.exerciseTypes)) {
      return {
        ...parsed,
        exerciseTypes: parsed.exerciseTypes,
      } as LessonExerciseTagsData;
    }
  } catch {
    return null;
  }
  return null;
};

export const serializeLessonExerciseTags = (data: LessonExerciseTagsData | null): string => {
  if (!data?.exerciseTypes?.length) return '';
  return JSON.stringify(data);
};

export const formatAttentionCardSummary = (value?: string): string => {
  const data = parseAttentionCard(value);
  if (!data) return 'Chưa chọn';
  const parts: string[] = [];
  if (data.exerciseTypes?.length) {
    parts.push(
      data.exerciseTypes.length <= 2
        ? data.exerciseTypes.map((item) => item.title).join(', ')
        : `${data.exerciseTypes.length} dạng bài`
    );
  } else if (data.exerciseTypeTitle) {
    parts.push(data.exerciseTypeTitle);
  }
  if (data.materials?.length) {
    parts.push(
      data.materials.length <= 2
        ? data.materials.map((item) => item.title).join(', ')
        : `${data.materials.length} học liệu`
    );
  } else if (data.materialTitle) {
    parts.push(data.materialTitle);
  }
  if (data.selectedNotes.length) parts.push(`${data.selectedNotes.length} thẻ`);
  return parts.length ? parts.join(' · ') : 'Chưa chọn';
};

export const formatCheckTagsSummary = (value?: string): string => {
  const data = parseCheckExerciseTags(value);
  if (!data) return 'Chưa gắn';
  if (data.materials?.length) {
    const prefix = data.exerciseTypeTitle ? `${data.exerciseTypeTitle} · ` : '';
    return `${prefix}${data.materials.length} học liệu`;
  }
  if (data.exerciseTypeTitle) return data.exerciseTypeTitle;
  if (data.exerciseTypes?.length) return `${data.exerciseTypes.length} dạng bài`;
  return 'Chưa gắn';
};

export const formatLessonExerciseTagsSummary = (value?: string): string => {
  const data = parseLessonExerciseTags(value);
  if (!data?.exerciseTypes?.length) return 'Chưa chọn';
  if (data.exerciseTypes.length <= 2) {
    return data.exerciseTypes.map((item) => item.title).join(' · ');
  }
  return `${data.exerciseTypes.length} dạng bài`;
};
export const hasAttentionCardSelection = (value?: string): boolean => {
  const data = parseAttentionCard(value);
  return !!(data?.exerciseTypeId || data?.exerciseTypes?.length);
};

export const hasCheckTagsSelection = (value?: string): boolean => {
  const data = parseCheckExerciseTags(value);
  return !!(data?.materials?.length || data?.exerciseTypes?.length || data?.exerciseTypeId);
};

export const hasLessonExerciseTagsSelection = (value?: string): boolean =>
  !!parseLessonExerciseTags(value)?.exerciseTypes?.length;

