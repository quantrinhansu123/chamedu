import { supabase } from '../config/supabase';

export interface LearningGradeBand {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface LearningGrade {
  id: string;
  gradeBandId: string;
  gradeNumber: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface LearningClassGroup {
  id: string;
  gradeId: string;
  classId?: string | null;
  code: string;
  name: string;
  teacherName?: string | null;
  studentCount: number;
  sortOrder: number;
  isActive: boolean;
}

export interface LearningExerciseType {
  id: string;
  gradeId: string;
  code: string;
  title: string;
  subject?: string | null;
  difficulty: string;
  exerciseCount: number;
  description?: string | null;
  tags: string[];
  sortOrder: number;
  isActive: boolean;
}

export interface LearningMaterial {
  id: string;
  exerciseTypeId: string;
  title: string;
  contentType: string;
  fileUrl?: string | null;
  externalUrl?: string | null;
  thumbnailUrl?: string | null;
  estimatedMinutes?: number | null;
  questionCount?: number | null;
  isActive: boolean;
}

export interface LearningAssignment {
  id: string;
  exerciseTypeId?: string | null;
  materialId?: string | null;
  classGroupId?: string | null;
  classId?: string | null;
  className?: string | null;
  targetName?: string | null;
  assignedCount?: number | null;
  dueDate?: string | null;
  status: string;
  assignedByName?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface LearningMaterialsData {
  gradeBands: LearningGradeBand[];
  grades: LearningGrade[];
  classGroups: LearningClassGroup[];
  exerciseTypes: LearningExerciseType[];
  materials: LearningMaterial[];
  assignments: LearningAssignment[];
}

export interface CreateExerciseTypeInput {
  gradeId: string;
  title: string;
  subject?: string;
  difficulty?: string;
  exerciseCount?: number;
  description?: string;
}

export type UpdateExerciseTypeInput = Omit<CreateExerciseTypeInput, 'gradeId'>;

export interface CreateMaterialInput {
  exerciseTypeId: string;
  title: string;
  contentType?: string;
  fileUrl?: string;
  externalUrl?: string;
  estimatedMinutes?: number;
  questionCount?: number;
}

export interface CreateAssignmentInput {
  exerciseTypeId?: string;
  materialId?: string;
  classGroupId?: string;
  classId?: string;
  className?: string;
  targetName?: string;
  assignedCount?: number;
  dueDate?: string;
  assignedByName?: string;
  note?: string;
}

export interface UpdateGradeBandInput {
  name: string;
  description?: string;
  sortOrder?: number;
}

export interface UpdateGradeInput {
  name: string;
  gradeNumber: number;
  sortOrder?: number;
}

export interface UpdateClassGroupInput {
  code: string;
  name: string;
  teacherName?: string;
  studentCount?: number;
  sortOrder?: number;
}

type DbGradeBand = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

type DbGrade = {
  id: string;
  grade_band_id: string;
  grade_number: number;
  name: string;
  sort_order: number;
  is_active: boolean;
};

type DbClassGroup = {
  id: string;
  grade_id: string;
  class_id: string | null;
  code: string;
  name: string;
  teacher_name: string | null;
  student_count: number;
  sort_order: number;
  is_active: boolean;
};

type DbExerciseType = {
  id: string;
  grade_id: string;
  code: string;
  title: string;
  subject: string | null;
  difficulty: string;
  exercise_count: number;
  description: string | null;
  tags: string[] | null;
  sort_order: number;
  is_active: boolean;
};

type DbMaterial = {
  id: string;
  exercise_type_id: string;
  title: string;
  content_type: string;
  file_url: string | null;
  external_url: string | null;
  thumbnail_url: string | null;
  estimated_minutes: number | null;
  question_count: number | null;
  is_active: boolean;
};

type DbAssignment = {
  id: string;
  exercise_type_id: string | null;
  material_id: string | null;
  class_group_id: string | null;
  class_id: string | null;
  class_name: string | null;
  target_name: string | null;
  assigned_count: number | null;
  due_date: string | null;
  status: string;
  assigned_by_name: string | null;
  note: string | null;
  created_at: string;
};

const mapGradeBand = (row: DbGradeBand): LearningGradeBand => ({
  id: row.id,
  code: row.code,
  name: row.name,
  description: row.description,
  sortOrder: row.sort_order,
  isActive: row.is_active,
});

const mapGrade = (row: DbGrade): LearningGrade => ({
  id: row.id,
  gradeBandId: row.grade_band_id,
  gradeNumber: row.grade_number,
  name: row.name,
  sortOrder: row.sort_order,
  isActive: row.is_active,
});

const mapClassGroup = (row: DbClassGroup): LearningClassGroup => ({
  id: row.id,
  gradeId: row.grade_id,
  classId: row.class_id,
  code: row.code,
  name: row.name,
  teacherName: row.teacher_name,
  studentCount: row.student_count,
  sortOrder: row.sort_order,
  isActive: row.is_active,
});

const mapExerciseType = (row: DbExerciseType): LearningExerciseType => ({
  id: row.id,
  gradeId: row.grade_id,
  code: row.code,
  title: row.title,
  subject: row.subject,
  difficulty: row.difficulty,
  exerciseCount: row.exercise_count,
  description: row.description,
  tags: row.tags || [],
  sortOrder: row.sort_order,
  isActive: row.is_active,
});

const mapMaterial = (row: DbMaterial): LearningMaterial => ({
  id: row.id,
  exerciseTypeId: row.exercise_type_id,
  title: row.title,
  contentType: row.content_type,
  fileUrl: row.file_url,
  externalUrl: row.external_url,
  thumbnailUrl: row.thumbnail_url,
  estimatedMinutes: row.estimated_minutes,
  questionCount: row.question_count,
  isActive: row.is_active,
});

const mapAssignment = (row: DbAssignment): LearningAssignment => ({
  id: row.id,
  exerciseTypeId: row.exercise_type_id,
  materialId: row.material_id,
  classGroupId: row.class_group_id,
  classId: row.class_id,
  className: row.class_name,
  targetName: row.target_name,
  assignedCount: row.assigned_count,
  dueDate: row.due_date,
  status: row.status,
  assignedByName: row.assigned_by_name,
  note: row.note,
  createdAt: row.created_at,
});

const slugify = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);

export const getLearningMaterialsData = async (): Promise<LearningMaterialsData> => {
  const [bands, grades, classGroups, exerciseTypes, materials, assignments] = await Promise.all([
    supabase
      .from('learning_grade_bands')
      .select('id, code, name, description, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('learning_grades')
      .select('id, grade_band_id, grade_number, name, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('learning_class_groups')
      .select('id, grade_id, class_id, code, name, teacher_name, student_count, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('learning_exercise_types')
      .select('id, grade_id, code, title, subject, difficulty, exercise_count, description, tags, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('learning_materials')
      .select('id, exercise_type_id, title, content_type, file_url, external_url, thumbnail_url, estimated_minutes, question_count, is_active')
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
    supabase
      .from('learning_assignments')
      .select('id, exercise_type_id, material_id, class_group_id, class_id, class_name, target_name, assigned_count, due_date, status, assigned_by_name, note, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const error = bands.error || grades.error || classGroups.error || exerciseTypes.error || materials.error || assignments.error;
  if (error) throw error;

  return {
    gradeBands: ((bands.data || []) as DbGradeBand[]).map(mapGradeBand),
    grades: ((grades.data || []) as DbGrade[]).map(mapGrade),
    classGroups: ((classGroups.data || []) as DbClassGroup[]).map(mapClassGroup),
    exerciseTypes: ((exerciseTypes.data || []) as DbExerciseType[]).map(mapExerciseType),
    materials: ((materials.data || []) as DbMaterial[]).map(mapMaterial),
    assignments: ((assignments.data || []) as DbAssignment[]).map(mapAssignment),
  };
};

export const createLearningExerciseType = async (input: CreateExerciseTypeInput): Promise<LearningExerciseType> => {
  const title = input.title.trim();
  const code = `${slugify(title) || 'hoc-lieu'}-${Date.now().toString(36)}`;
  const { data, error } = await supabase
    .from('learning_exercise_types')
    .insert({
      grade_id: input.gradeId,
      code,
      title,
      subject: input.subject?.trim() || 'Toán',
      difficulty: input.difficulty || 'Cơ bản',
      exercise_count: input.exerciseCount || 0,
      description: input.description?.trim() || null,
    })
    .select('id, grade_id, code, title, subject, difficulty, exercise_count, description, tags, sort_order, is_active')
    .single();

  if (error) throw error;
  return mapExerciseType(data as DbExerciseType);
};

export const updateLearningExerciseType = async (
  id: string,
  input: UpdateExerciseTypeInput
): Promise<LearningExerciseType> => {
  const { data, error } = await supabase
    .from('learning_exercise_types')
    .update({
      title: input.title.trim(),
      subject: input.subject?.trim() || 'Toán',
      difficulty: input.difficulty || 'Cơ bản',
      exercise_count: input.exerciseCount || 0,
      description: input.description?.trim() || null,
    })
    .eq('id', id)
    .select('id, grade_id, code, title, subject, difficulty, exercise_count, description, tags, sort_order, is_active')
    .single();

  if (error) throw error;
  return mapExerciseType(data as DbExerciseType);
};

export const deleteLearningExerciseType = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('learning_exercise_types')
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw error;
};

export const createLearningMaterial = async (input: CreateMaterialInput): Promise<LearningMaterial> => {
  const { data, error } = await supabase
    .from('learning_materials')
    .insert({
      exercise_type_id: input.exerciseTypeId,
      title: input.title.trim(),
      content_type: input.contentType || 'worksheet',
      file_url: input.fileUrl?.trim() || null,
      external_url: input.externalUrl?.trim() || null,
      estimated_minutes: input.estimatedMinutes || null,
      question_count: input.questionCount || null,
    })
    .select('id, exercise_type_id, title, content_type, file_url, external_url, thumbnail_url, estimated_minutes, question_count, is_active')
    .single();

  if (error) throw error;
  return mapMaterial(data as DbMaterial);
};

export const createLearningAssignment = async (input: CreateAssignmentInput): Promise<LearningAssignment> => {
  const { data, error } = await supabase
    .from('learning_assignments')
    .insert({
      exercise_type_id: input.exerciseTypeId || null,
      material_id: input.materialId || null,
      class_group_id: input.classGroupId || null,
      class_id: input.classId || null,
      class_name: input.className || null,
      target_name: input.targetName || input.className || null,
      assigned_count: input.assignedCount || null,
      due_date: input.dueDate || null,
      status: 'Đã giao',
      assigned_by_name: input.assignedByName || null,
      note: input.note?.trim() || null,
    })
    .select('id, exercise_type_id, material_id, class_group_id, class_id, class_name, target_name, assigned_count, due_date, status, assigned_by_name, note, created_at')
    .single();

  if (error) throw error;
  return mapAssignment(data as DbAssignment);
};

export const updateLearningGradeBand = async (
  id: string,
  input: UpdateGradeBandInput
): Promise<LearningGradeBand> => {
  const { data, error } = await supabase
    .from('learning_grade_bands')
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      sort_order: input.sortOrder || 0,
    })
    .eq('id', id)
    .select('id, code, name, description, sort_order, is_active')
    .single();

  if (error) throw error;
  return mapGradeBand(data as DbGradeBand);
};

export const updateLearningGrade = async (id: string, input: UpdateGradeInput): Promise<LearningGrade> => {
  const { data, error } = await supabase
    .from('learning_grades')
    .update({
      grade_number: input.gradeNumber,
      name: input.name.trim(),
      sort_order: input.sortOrder || input.gradeNumber,
    })
    .eq('id', id)
    .select('id, grade_band_id, grade_number, name, sort_order, is_active')
    .single();

  if (error) throw error;
  return mapGrade(data as DbGrade);
};

export const updateLearningClassGroup = async (
  id: string,
  input: UpdateClassGroupInput
): Promise<LearningClassGroup> => {
  const { data, error } = await supabase
    .from('learning_class_groups')
    .update({
      code: input.code.trim(),
      name: input.name.trim(),
      teacher_name: input.teacherName?.trim() || null,
      student_count: input.studentCount || 0,
      sort_order: input.sortOrder || 0,
    })
    .eq('id', id)
    .select('id, grade_id, class_id, code, name, teacher_name, student_count, sort_order, is_active')
    .single();

  if (error) throw error;
  return mapClassGroup(data as DbClassGroup);
};
