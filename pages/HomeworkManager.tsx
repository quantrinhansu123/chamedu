import React, { useState, useEffect, useMemo } from 'react';
import { BookOpen, Plus, X, Save, Trash2, Settings, FileText, AlertCircle, Pencil, Printer } from 'lucide-react';
import { printExerciseNotes } from '../src/utils/commentSlipPrint';
import { useSearchParams } from 'react-router-dom';
import { ModalPortal } from '@/components/modal-portal';
import { useClasses } from '../src/hooks/useClasses';
import { useStudents } from '../src/hooks/useStudents';
import { useAuth } from '../src/hooks/useAuth';
import { usePermissions } from '../src/hooks/usePermissions';
import { useHolidays } from '../src/hooks/useHolidays';
import { getSessionsByClass, type ClassSession } from '../src/services/sessionService';
import {
  getHomeworkRecord,
  getHomeworkStatuses,
  saveHomeworkRecord,
  saveHomeworkStatuses,
} from '../src/services/homeworkService';
import {
  createLearningAssignment,
  createLearningExerciseType,
  createLearningMaterial,
  deleteLearningExerciseType,
  getLearningMaterialsData,
  updateLearningClassGroup,
  updateLearningGrade,
  updateLearningGradeBand,
  updateLearningExerciseType,
  type LearningAssignment,
  type LearningClassGroup,
  type LearningExerciseType,
  type LearningGrade,
  type LearningGradeBand,
  type LearningMaterial,
} from '../src/services/learningMaterialService';
import {
  parseExerciseNotes,
  serializeExerciseNotes,
  type ExerciseNoteItem,
} from '../src/utils/learningMaterialNotes';
import { ClassModel, Student } from '../types';

// Default homework statuses with colors
const DEFAULT_HOMEWORK_STATUSES = [
  { value: 'completed', label: 'Đã làm', color: 'bg-green-500', textColor: 'text-white' },
  { value: 'not_completed', label: 'Chưa làm', color: 'bg-red-500', textColor: 'text-white' },
  { value: 'no_homework', label: 'Không có bài', color: 'bg-yellow-400', textColor: 'text-gray-800' },
  { value: 'absent', label: 'Nghỉ học', color: 'bg-blue-400', textColor: 'text-white' },
];

interface HomeworkStatus {
  value: string;
  label: string;
  color: string;
  textColor: string;
}

interface Homework {
  id: string;
  name: string;
  statuses?: HomeworkStatus[];
}

interface StudentHomeworkRecord {
  studentId: string;
  studentName: string;
  homeworks: {
    [homeworkId: string]: {
      status: string;
      score: number | null;
    };
  };
  note: string;
}

interface HomeworkSession {
  id?: string;
  classId: string;
  className: string;
  sessionId: string;
  sessionNumber: number;
  sessionDate: string;
  homeworks: Homework[];
  studentRecords: StudentHomeworkRecord[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

const SCHEDULE_DETAIL_DAY_INDEX: Record<string, number> = {
  CN: 0,
  '2': 1,
  '3': 2,
  '4': 3,
  '5': 4,
  '6': 5,
  '7': 6,
};

const DAY_NAMES = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

const parseLocalDate = (value?: string): Date => {
  if (!value) return new Date();
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
};

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

const parseScheduleDays = (schedule = ''): number[] => {
  const normalized = normalizeText(schedule);
  const days = new Set<number>();
  let match: RegExpExecArray | null;
  const thuPattern = /thu\s*(hai|2|ba|3|tu|4|nam|5|sau|6|bay|7)/g;
  const dayMap: Record<string, number> = {
    hai: 1,
    '2': 1,
    ba: 2,
    '3': 2,
    tu: 3,
    '4': 3,
    nam: 4,
    '5': 4,
    sau: 5,
    '6': 5,
    bay: 6,
    '7': 6,
  };

  while ((match = thuPattern.exec(normalized)) !== null) {
    days.add(dayMap[match[1]]);
  }

  if (normalized.includes('chu nhat') || /\bcn\b/.test(normalized)) {
    days.add(0);
  }

  return Array.from(days).sort();
};

const parseScheduleTime = (schedule = ''): string | undefined => {
  const match = schedule.match(/(\d{1,2})(?::|h)(\d{0,2})\s*[-–]\s*(\d{1,2})(?::|h)(\d{0,2})/i);
  if (!match) return undefined;
  const formatTime = (hour: string, minute: string) =>
    `${hour.padStart(2, '0')}:${(minute || '00').padStart(2, '0')}`;
  return `${formatTime(match[1], match[2])}-${formatTime(match[3], match[4])}`;
};

const withStableSessionIds = (classId: string, sessions: ClassSession[]): ClassSession[] =>
  sessions
    .map((session) => ({
      ...session,
      id: session.id || `schedule_${classId}_${session.sessionNumber}_${session.date}`,
    }))
    .sort((a, b) => a.sessionNumber - b.sessionNumber);

const buildSessionsFromScheduleDetails = (classData?: ClassModel): ClassSession[] => {
  if (!classData?.id || !classData.scheduleDetails?.length) return [];

  const detailsByDay = new Map(
    classData.scheduleDetails
      .map((detail) => [SCHEDULE_DETAIL_DAY_INDEX[detail.dayOfWeek], detail] as const)
      .filter(([dayIndex]) => typeof dayIndex === 'number')
  );

  if (detailsByDay.size === 0) return [];

  const fromDate = parseLocalDate(classData.startDate);
  const maxSessions = classData.totalSessions || 120;
  const endDate = classData.endDate
    ? parseLocalDate(classData.endDate)
    : new Date(fromDate.getTime() + 365 * 24 * 60 * 60 * 1000);
  const sessions: ClassSession[] = [];
  const currentDate = new Date(fromDate);
  let sessionNumber = 1;

  while (currentDate <= endDate && sessionNumber <= maxSessions) {
    const detail = detailsByDay.get(currentDate.getDay());

    if (detail) {
      const date = formatLocalDate(currentDate);
      sessions.push({
        id: `schedule_${classData.id}_${sessionNumber}_${date}`,
        classId: classData.id,
        className: classData.name,
        sessionNumber,
        date,
        dayOfWeek: detail.dayLabel || DAY_NAMES[currentDate.getDay()],
        time: detail.startTime && detail.endTime ? `${detail.startTime}-${detail.endTime}` : undefined,
        room: detail.room || classData.room,
        teacherId: detail.teacherId || classData.teacherId,
        teacherName: detail.teacher || classData.teacher,
        status: 'Chưa học',
        createdAt: new Date().toISOString(),
      });
      sessionNumber++;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return sessions;
};

const buildSessionsFromScheduleText = (classData?: ClassModel): ClassSession[] => {
  if (!classData?.id || !classData.schedule) return [];

  const scheduleDays = parseScheduleDays(classData.schedule);
  if (scheduleDays.length === 0) return [];

  const fromDate = parseLocalDate(classData.startDate);
  const maxSessions = classData.totalSessions || 120;
  const endDate = classData.endDate
    ? parseLocalDate(classData.endDate)
    : new Date(fromDate.getTime() + 365 * 24 * 60 * 60 * 1000);
  const time = parseScheduleTime(classData.schedule);
  const sessions: ClassSession[] = [];
  const currentDate = new Date(fromDate);
  let sessionNumber = 1;

  while (currentDate <= endDate && sessionNumber <= maxSessions) {
    const dayOfWeek = currentDate.getDay();

    if (scheduleDays.includes(dayOfWeek)) {
      const date = formatLocalDate(currentDate);
      sessions.push({
        id: `schedule_${classData.id}_${sessionNumber}_${date}`,
        classId: classData.id,
        className: classData.name,
        sessionNumber,
        date,
        dayOfWeek: DAY_NAMES[dayOfWeek],
        time,
        room: classData.room,
        teacherId: classData.teacherId,
        teacherName: classData.teacher,
        status: 'Chưa học',
        createdAt: new Date().toISOString(),
      });
      sessionNumber++;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return sessions;
};

const mergeStoredSessionsIntoSchedule = (
  scheduleSessions: ClassSession[],
  storedSessions: ClassSession[]
): ClassSession[] => {
  const storedByDate = new Map(storedSessions.map((session) => [session.date, session]));
  const storedByNumber = new Map(storedSessions.map((session) => [session.sessionNumber, session]));

  return scheduleSessions.map((scheduleSession) => {
    const stored = storedByDate.get(scheduleSession.date) || storedByNumber.get(scheduleSession.sessionNumber);
    if (!stored) return scheduleSession;

    return {
      ...scheduleSession,
      id: stored.id || scheduleSession.id,
      status: stored.status || scheduleSession.status,
      attendanceId: stored.attendanceId,
      holidayId: stored.holidayId,
      holidayName: stored.holidayName,
      note: stored.note,
      createdAt: stored.createdAt || scheduleSession.createdAt,
      updatedAt: stored.updatedAt,
    };
  });
};

const getClassSessionsWithScheduleFallback = async (classData?: ClassModel): Promise<ClassSession[]> => {
  if (!classData?.id) return [];

  const storedSessions = await getSessionsByClass(classData.id);
  const detailSessions = buildSessionsFromScheduleDetails(classData);
  const scheduleSessions = detailSessions.length > 0 ? detailSessions : buildSessionsFromScheduleText(classData);

  if (scheduleSessions.length > 0) {
    return mergeStoredSessionsIntoSchedule(scheduleSessions, storedSessions);
  }

  return withStableSessionIds(classData.id, storedSessions);
};

const dbErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message?: unknown }).message);
  }
  return 'Không tải được dữ liệu học liệu.';
};

const StatPill: React.FC<{ label: string; value: number | string }> = ({ label, value }) => (
  <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
    <p className="text-xs text-gray-500">{label}</p>
    <p className="text-lg font-semibold text-gray-900">{value}</p>
  </div>
);

const EmptyPanel: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
    <FileText size={28} className="mx-auto mb-3 text-gray-300" />
    <p className="font-medium text-gray-700">{title}</p>
    <p className="mt-1 text-sm text-gray-500">{description}</p>
  </div>
);

const LearningMaterialsTab: React.FC<{ assignedByName: string }> = ({ assignedByName }) => {
  const [gradeBands, setGradeBands] = useState<LearningGradeBand[]>([]);
  const [grades, setGrades] = useState<LearningGrade[]>([]);
  const [classGroups, setClassGroups] = useState<LearningClassGroup[]>([]);
  const [exerciseTypes, setExerciseTypes] = useState<LearningExerciseType[]>([]);
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [assignments, setAssignments] = useState<LearningAssignment[]>([]);
  const [selectedBandId, setSelectedBandId] = useState('');
  const [selectedGradeId, setSelectedGradeId] = useState('');
  const [selectedClassGroupId, setSelectedClassGroupId] = useState('');
  const [selectedExerciseTypeId, setSelectedExerciseTypeId] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [loadingMaterials, setLoadingMaterials] = useState(true);
  const [savingMaterial, setSavingMaterial] = useState(false);
  const [materialsError, setMaterialsError] = useState('');
  const [formMode, setFormMode] = useState<'exercise' | 'material' | 'assignment' | 'gradeBand' | 'grade' | 'classGroup' | null>(null);
  const [editingGradeBandId, setEditingGradeBandId] = useState('');
  const [editingGradeId, setEditingGradeId] = useState('');
  const [editingClassGroupId, setEditingClassGroupId] = useState('');
  const [editingExerciseTypeId, setEditingExerciseTypeId] = useState('');

  const [exerciseForm, setExerciseForm] = useState({
    title: '',
    subject: 'Toán',
    difficulty: 'Cơ bản',
    exerciseCount: '0',
    description: '',
  });

  const [materialForm, setMaterialForm] = useState({
    title: '',
    contentType: 'worksheet',
    externalUrl: '',
    fileUrl: '',
    estimatedMinutes: '',
    questionCount: '',
  });

  const [assignmentForm, setAssignmentForm] = useState({
    dueDate: '',
    assignedCount: '',
    note: '',
  });

  const [exerciseNotes, setExerciseNotes] = useState<ExerciseNoteItem[]>([]);
  const [selectedExerciseNoteIds, setSelectedExerciseNoteIds] = useState<Set<string>>(new Set());
  const [savingExerciseNote, setSavingExerciseNote] = useState(false);

  const [gradeBandForm, setGradeBandForm] = useState({
    name: '',
    description: '',
    sortOrder: '0',
  });

  const [gradeForm, setGradeForm] = useState({
    name: '',
    gradeNumber: '',
    sortOrder: '',
  });

  const [classGroupForm, setClassGroupForm] = useState({
    code: '',
    name: '',
    teacherName: '',
    studentCount: '',
    sortOrder: '',
  });

  const loadLearningData = async () => {
    setLoadingMaterials(true);
    setMaterialsError('');
    try {
      const data = await getLearningMaterialsData();
      setGradeBands(data.gradeBands);
      setGrades(data.grades);
      setClassGroups(data.classGroups);
      setExerciseTypes(data.exerciseTypes);
      setMaterials(data.materials);
      setAssignments(data.assignments);
      setSelectedBandId((current) => current || data.gradeBands[0]?.id || '');
    } catch (error) {
      setMaterialsError(dbErrorMessage(error));
    } finally {
      setLoadingMaterials(false);
    }
  };

  useEffect(() => {
    loadLearningData();
  }, []);

  const visibleGrades = useMemo(
    () => grades.filter((grade) => grade.gradeBandId === selectedBandId),
    [grades, selectedBandId]
  );

  const visibleClassGroups = useMemo(
    () => classGroups.filter((group) => group.gradeId === selectedGradeId),
    [classGroups, selectedGradeId]
  );

  const visibleExerciseTypes = useMemo(
    () => exerciseTypes.filter((exercise) => exercise.gradeId === selectedGradeId),
    [exerciseTypes, selectedGradeId]
  );

  const selectedClassGroup = useMemo(
    () => classGroups.find((group) => group.id === selectedClassGroupId),
    [classGroups, selectedClassGroupId]
  );

  const selectedExerciseType = useMemo(
    () => exerciseTypes.find((exercise) => exercise.id === selectedExerciseTypeId),
    [exerciseTypes, selectedExerciseTypeId]
  );

  const visibleMaterials = useMemo(
    () => materials.filter((material) => material.exerciseTypeId === selectedExerciseTypeId),
    [materials, selectedExerciseTypeId]
  );

  const visibleAssignments = useMemo(
    () =>
      assignments.filter((assignment) => {
        if (selectedExerciseTypeId && assignment.exerciseTypeId !== selectedExerciseTypeId) return false;
        if (selectedClassGroupId && assignment.classGroupId !== selectedClassGroupId) return false;
        return true;
      }),
    [assignments, selectedClassGroupId, selectedExerciseTypeId]
  );

  useEffect(() => {
    if (!selectedGradeId && visibleGrades[0]) {
      setSelectedGradeId(visibleGrades[0].id);
    }
    if (selectedGradeId && !visibleGrades.some((grade) => grade.id === selectedGradeId)) {
      setSelectedGradeId(visibleGrades[0]?.id || '');
    }
  }, [selectedGradeId, visibleGrades]);

  useEffect(() => {
    setSelectedClassGroupId((current) =>
      visibleClassGroups.some((group) => group.id === current) ? current : visibleClassGroups[0]?.id || ''
    );
    setSelectedExerciseTypeId((current) =>
      visibleExerciseTypes.some((exercise) => exercise.id === current) ? current : visibleExerciseTypes[0]?.id || ''
    );
  }, [visibleClassGroups, visibleExerciseTypes]);

  useEffect(() => {
    setSelectedMaterialId((current) =>
      visibleMaterials.some((material) => material.id === current) ? current : visibleMaterials[0]?.id || ''
    );
  }, [visibleMaterials]);

  useEffect(() => {
    setExerciseNotes(parseExerciseNotes(selectedExerciseType?.description));
    setSelectedExerciseNoteIds(new Set());
  }, [selectedExerciseTypeId, selectedExerciseType?.description]);

  const handleSaveExerciseNotes = async (notes = exerciseNotes) => {
    if (!selectedExerciseType) return;
    setSavingExerciseNote(true);
    setMaterialsError('');
    try {
      await updateLearningExerciseType(selectedExerciseType.id, {
        title: selectedExerciseType.title,
        subject: selectedExerciseType.subject || 'Toán',
        difficulty: selectedExerciseType.difficulty,
        exerciseCount: selectedExerciseType.exerciseCount,
        description: serializeExerciseNotes(notes) || undefined,
      });
      await loadLearningData();
    } catch (error) {
      setMaterialsError(dbErrorMessage(error));
    } finally {
      setSavingExerciseNote(false);
    }
  };

  const handleAddExerciseNote = () => {
    setExerciseNotes((prev) => [...prev, { id: crypto.randomUUID(), title: '', content: '' }]);
  };

  const handleUpdateExerciseNote = (id: string, field: 'title' | 'content', value: string) => {
    setExerciseNotes((prev) => prev.map((note) => (note.id === id ? { ...note, [field]: value } : note)));
  };

  const handleRemoveExerciseNote = async (id: string) => {
    const nextNotes = exerciseNotes.filter((note) => note.id !== id);
    setExerciseNotes(nextNotes);
    setSelectedExerciseNoteIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    await handleSaveExerciseNotes(nextNotes);
  };

  const toggleExerciseNoteSelection = (id: string) => {
    setSelectedExerciseNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllExerciseNotes = () => {
    setSelectedExerciseNoteIds((prev) => {
      if (prev.size === exerciseNotes.length && exerciseNotes.length > 0) {
        return new Set();
      }
      return new Set(exerciseNotes.map((note) => note.id));
    });
  };

  const handlePrintSelectedExerciseNotes = () => {
    const selected = exerciseNotes.filter((note) => selectedExerciseNoteIds.has(note.id));
    if (selected.length === 0) {
      window.alert('Vui lòng tick chọn ít nhất một thẻ ghi chú để in.');
      return;
    }
    const gradeName = grades.find((grade) => grade.id === selectedGradeId)?.name;
    printExerciseNotes({
      exerciseTypeTitle: selectedExerciseType?.title || 'Dạng bài',
      gradeName,
      notes: selected,
    });
  };

  const submitExercise = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedGradeId || !exerciseForm.title.trim()) return;
    setSavingMaterial(true);
    setMaterialsError('');
    try {
      const input = {
        title: exerciseForm.title,
        subject: exerciseForm.subject,
        difficulty: exerciseForm.difficulty,
        exerciseCount: Number(exerciseForm.exerciseCount) || 0,
        description: exerciseForm.description,
      };
      const saved = editingExerciseTypeId
        ? await updateLearningExerciseType(editingExerciseTypeId, input)
        : await createLearningExerciseType({ gradeId: selectedGradeId, ...input });
      setFormMode(null);
      setEditingExerciseTypeId('');
      setExerciseForm({ title: '', subject: 'Toán', difficulty: 'Cơ bản', exerciseCount: '0', description: '' });
      await loadLearningData();
      setSelectedExerciseTypeId(saved.id);
    } catch (error) {
      setMaterialsError(dbErrorMessage(error));
    } finally {
      setSavingMaterial(false);
    }
  };

  const openExerciseForm = (exercise?: LearningExerciseType) => {
    setEditingExerciseTypeId(exercise?.id || '');
    setExerciseForm(
      exercise
        ? {
            title: exercise.title,
            subject: exercise.subject || 'Toán',
            difficulty: exercise.difficulty,
            exerciseCount: String(exercise.exerciseCount),
            description: exercise.description || '',
          }
        : { title: '', subject: 'Toán', difficulty: 'Cơ bản', exerciseCount: '0', description: '' }
    );
    setFormMode('exercise');
  };

  const handleDeleteExercise = async (exercise: LearningExerciseType) => {
    if (!window.confirm(`Xóa dạng bài "${exercise.title}"?`)) return;
    setSavingMaterial(true);
    setMaterialsError('');
    try {
      await deleteLearningExerciseType(exercise.id);
      if (selectedExerciseTypeId === exercise.id) setSelectedExerciseTypeId('');
      await loadLearningData();
    } catch (error) {
      setMaterialsError(dbErrorMessage(error));
    } finally {
      setSavingMaterial(false);
    }
  };

  const submitMaterial = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedExerciseTypeId || !materialForm.title.trim()) return;
    setSavingMaterial(true);
    setMaterialsError('');
    try {
      const created = await createLearningMaterial({
        exerciseTypeId: selectedExerciseTypeId,
        title: materialForm.title,
        contentType: materialForm.contentType,
        externalUrl: materialForm.externalUrl,
        fileUrl: materialForm.fileUrl,
        estimatedMinutes: Number(materialForm.estimatedMinutes) || undefined,
        questionCount: Number(materialForm.questionCount) || undefined,
      });
      setFormMode(null);
      setMaterialForm({
        title: '',
        contentType: 'worksheet',
        externalUrl: '',
        fileUrl: '',
        estimatedMinutes: '',
        questionCount: '',
      });
      await loadLearningData();
      setSelectedMaterialId(created.id);
    } catch (error) {
      setMaterialsError(dbErrorMessage(error));
    } finally {
      setSavingMaterial(false);
    }
  };

  const submitAssignment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedExerciseType || !selectedClassGroup) return;
    setSavingMaterial(true);
    setMaterialsError('');
    try {
      await createLearningAssignment({
        exerciseTypeId: selectedExerciseType.id,
        materialId: selectedMaterialId || undefined,
        classGroupId: selectedClassGroup.id,
        classId: selectedClassGroup.classId || undefined,
        className: selectedClassGroup.name,
        targetName: `${selectedClassGroup.name} - ${selectedExerciseType.title}`,
        assignedCount: Number(assignmentForm.assignedCount) || selectedClassGroup.studentCount,
        dueDate: assignmentForm.dueDate || undefined,
        assignedByName,
        note: assignmentForm.note,
      });
      setFormMode(null);
      setAssignmentForm({ dueDate: '', assignedCount: '', note: '' });
      await loadLearningData();
    } catch (error) {
      setMaterialsError(dbErrorMessage(error));
    } finally {
      setSavingMaterial(false);
    }
  };

  const openEditGradeBand = (band: LearningGradeBand) => {
    setEditingGradeBandId(band.id);
    setGradeBandForm({
      name: band.name,
      description: band.description || '',
      sortOrder: String(band.sortOrder || 0),
    });
    setFormMode('gradeBand');
  };

  const openEditGrade = (grade: LearningGrade) => {
    setEditingGradeId(grade.id);
    setGradeForm({
      name: grade.name,
      gradeNumber: String(grade.gradeNumber),
      sortOrder: String(grade.sortOrder || grade.gradeNumber),
    });
    setFormMode('grade');
  };

  const openEditClassGroup = (group: LearningClassGroup) => {
    setEditingClassGroupId(group.id);
    setClassGroupForm({
      code: group.code,
      name: group.name,
      teacherName: group.teacherName || '',
      studentCount: String(group.studentCount || 0),
      sortOrder: String(group.sortOrder || 0),
    });
    setFormMode('classGroup');
  };

  const submitGradeBandEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingGradeBandId || !gradeBandForm.name.trim()) return;
    setSavingMaterial(true);
    setMaterialsError('');
    try {
      await updateLearningGradeBand(editingGradeBandId, {
        name: gradeBandForm.name,
        description: gradeBandForm.description,
        sortOrder: Number(gradeBandForm.sortOrder) || 0,
      });
      setFormMode(null);
      await loadLearningData();
      setSelectedBandId(editingGradeBandId);
    } catch (error) {
      setMaterialsError(dbErrorMessage(error));
    } finally {
      setSavingMaterial(false);
    }
  };

  const submitGradeEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingGradeId || !gradeForm.name.trim() || !gradeForm.gradeNumber) return;
    setSavingMaterial(true);
    setMaterialsError('');
    try {
      await updateLearningGrade(editingGradeId, {
        name: gradeForm.name,
        gradeNumber: Number(gradeForm.gradeNumber),
        sortOrder: Number(gradeForm.sortOrder) || Number(gradeForm.gradeNumber),
      });
      setFormMode(null);
      await loadLearningData();
      setSelectedGradeId(editingGradeId);
    } catch (error) {
      setMaterialsError(dbErrorMessage(error));
    } finally {
      setSavingMaterial(false);
    }
  };

  const submitClassGroupEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingClassGroupId || !classGroupForm.code.trim() || !classGroupForm.name.trim()) return;
    setSavingMaterial(true);
    setMaterialsError('');
    try {
      await updateLearningClassGroup(editingClassGroupId, {
        code: classGroupForm.code,
        name: classGroupForm.name,
        teacherName: classGroupForm.teacherName,
        studentCount: Number(classGroupForm.studentCount) || 0,
        sortOrder: Number(classGroupForm.sortOrder) || 0,
      });
      setFormMode(null);
      await loadLearningData();
      setSelectedClassGroupId(editingClassGroupId);
    } catch (error) {
      setMaterialsError(dbErrorMessage(error));
    } finally {
      setSavingMaterial(false);
    }
  };

  const openMaterialModal = () => {
    if (!selectedExerciseTypeId) {
      setFormMode('exercise');
      return;
    }
    setFormMode('material');
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Học liệu</h3>
            <p className="text-sm text-gray-500">Dữ liệu lấy trực tiếp từ Supabase, không dùng mock prototype.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openExerciseForm()}
              disabled={!selectedGradeId}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={16} />
              Thêm dạng bài
            </button>
            <button
              type="button"
              onClick={openMaterialModal}
              disabled={!selectedGradeId}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={16} />
              Thêm học liệu
            </button>
          </div>
        </div>

        {materialsError && (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Không tải/lưu được học liệu</p>
              <p>{materialsError}</p>
              <p className="mt-1 text-red-600">Nếu báo thiếu bảng, hãy chạy file docs/supabase-homework-materials-migration.sql trong Supabase SQL Editor.</p>
            </div>
          </div>
        )}
      </div>

      {loadingMaterials ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center text-gray-500">
          Đang tải học liệu...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p className="mb-3 text-sm font-semibold text-gray-800">Khối</p>
              <div className="space-y-2">
                {gradeBands.map((band) => (
                  <div
                    key={band.id}
                    className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                      selectedBandId === band.id
                        ? 'border-purple-300 bg-purple-50 text-purple-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <button type="button" onClick={() => setSelectedBandId(band.id)} className="min-w-0 flex-1 text-left">
                      <span className="font-medium">{band.name}</span>
                      {band.description && <span className="block text-xs text-gray-500">{band.description}</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditGradeBand(band)}
                      title="Sửa khối"
                      className="mt-0.5 rounded-md p-1.5 text-gray-400 hover:bg-white hover:text-purple-700"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p className="mb-3 text-sm font-semibold text-gray-800">Lớp</p>
              <div className="grid grid-cols-3 gap-2">
                {visibleGrades.map((grade) => (
                  <div
                    key={grade.id}
                    className={`flex items-center justify-between rounded-lg border px-2 py-2 text-sm font-medium ${
                      selectedGradeId === grade.id
                        ? 'border-blue-300 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <button type="button" onClick={() => setSelectedGradeId(grade.id)} className="min-w-0 flex-1 px-1 text-center">
                      {grade.gradeNumber}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditGrade(grade)}
                      title="Sửa lớp"
                      className="rounded-md p-1 text-gray-400 hover:bg-white hover:text-blue-700"
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p className="mb-3 text-sm font-semibold text-gray-800">Lớp học</p>
              <div className="space-y-2">
                {visibleClassGroups.map((group) => (
                  <div
                    key={group.id}
                    className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                      selectedClassGroupId === group.id
                        ? 'border-green-300 bg-green-50 text-green-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <button type="button" onClick={() => setSelectedClassGroupId(group.id)} className="min-w-0 flex-1 text-left">
                      <span className="font-medium">{group.name}</span>
                      <span className="block text-xs text-gray-500">{group.teacherName || 'Chưa có giáo viên'} · {group.studentCount} học viên</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditClassGroup(group)}
                      title="Sửa lớp học"
                      className="mt-0.5 rounded-md p-1.5 text-gray-400 hover:bg-white hover:text-green-700"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatPill label="Dạng bài" value={visibleExerciseTypes.length} />
              <StatPill label="Học liệu" value={visibleMaterials.length} />
              <StatPill label="Lớp học" value={visibleClassGroups.length} />
              <StatPill label="Đã giao" value={visibleAssignments.length} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-800">Dạng bài</p>
                  <button
                    type="button"
                    onClick={() => openExerciseForm()}
                    disabled={!selectedGradeId}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Plus size={14} />
                    Thêm
                  </button>
                </div>
                <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                  {visibleExerciseTypes.length === 0 ? (
                    <EmptyPanel title="Chưa có dạng bài" description="Bấm Thêm để tạo dạng bài cho lớp đang chọn." />
                  ) : (
                    visibleExerciseTypes.map((exercise) => (
                      <div
                        key={exercise.id}
                        className={`flex w-full items-start gap-2 rounded-lg border p-3 ${
                          selectedExerciseTypeId === exercise.id
                            ? 'border-purple-300 bg-purple-50'
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <button type="button" onClick={() => setSelectedExerciseTypeId(exercise.id)} className="min-w-0 flex-1 text-left">
                          <p className="font-medium text-gray-900">{exercise.title}</p>
                          <p className="mt-1 text-xs text-gray-500">{exercise.subject || 'Chưa có môn'} · {exercise.difficulty} · {exercise.exerciseCount} bài</p>
                        </button>
                        <div className="flex shrink-0 gap-1">
                          <button type="button" onClick={() => openExerciseForm(exercise)} className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600" title="Sửa dạng bài">
                            <Pencil size={15} />
                          </button>
                          <button type="button" onClick={() => handleDeleteExercise(exercise)} disabled={savingMaterial} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50" title="Xóa dạng bài">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Chi tiết học liệu</p>
                    <h4 className="text-lg font-bold text-gray-900">{selectedExerciseType?.title || 'Chọn dạng bài'}</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setFormMode('material')}
                      disabled={!selectedExerciseTypeId}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus size={16} />
                      Thêm
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormMode('assignment')}
                      disabled={!selectedExerciseTypeId || !selectedClassGroupId}
                      className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Save size={16} />
                      Giao bài
                    </button>
                  </div>
                </div>

                {selectedExerciseType ? (
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full min-w-[680px] text-sm">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                          <tr>
                            <th className="w-12 px-3 py-3 text-center">Chọn</th>
                            <th className="px-3 py-3 text-left">Tên học liệu</th>
                            <th className="px-3 py-3 text-left">Loại</th>
                            <th className="px-3 py-3 text-right">Số câu</th>
                            <th className="px-3 py-3 text-right">Thời lượng</th>
                            <th className="px-3 py-3 text-left">Liên kết</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {visibleMaterials.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                Chưa có học liệu. Bấm Thêm để lưu file hoặc link học liệu cho dạng bài này.
                              </td>
                            </tr>
                          ) : visibleMaterials.map((material) => {
                            const materialUrl = material.externalUrl || material.fileUrl;
                            return (
                              <tr
                                key={material.id}
                                onClick={() => setSelectedMaterialId(material.id)}
                                className={`cursor-pointer ${
                                  selectedMaterialId === material.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                                }`}
                              >
                                <td className="px-3 py-3 text-center">
                                  <input
                                    type="radio"
                                    name="selectedMaterial"
                                    checked={selectedMaterialId === material.id}
                                    onChange={() => setSelectedMaterialId(material.id)}
                                    className="h-4 w-4 text-blue-600"
                                  />
                                </td>
                                <td className="px-3 py-3 font-medium text-gray-900">{material.title}</td>
                                <td className="px-3 py-3 text-gray-600">{material.contentType}</td>
                                <td className="px-3 py-3 text-right text-gray-600">{material.questionCount || '-'}</td>
                                <td className="px-3 py-3 text-right text-gray-600">
                                  {material.estimatedMinutes ? `${material.estimatedMinutes} phút` : '-'}
                                </td>
                                <td className="max-w-56 px-3 py-3">
                                  {materialUrl ? (
                                    <a
                                      href={materialUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(event) => event.stopPropagation()}
                                      className="block truncate font-medium text-blue-600 hover:underline"
                                    >
                                      Mở liên kết
                                    </a>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                        <p className="text-sm font-semibold text-gray-800">Ghi chú</p>
                        <div className="flex items-center gap-2">
                          {savingExerciseNote && (
                            <span className="text-xs text-indigo-600">Đang lưu...</span>
                          )}
                          <button
                            type="button"
                            onClick={handlePrintSelectedExerciseNotes}
                            disabled={selectedExerciseNoteIds.size === 0}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Printer size={14} />
                            In ({selectedExerciseNoteIds.size})
                          </button>
                          <button
                            type="button"
                            onClick={handleAddExerciseNote}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            <Plus size={14} />
                            Thêm
                          </button>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[560px] text-sm">
                          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                            <tr>
                              <th className="w-12 px-3 py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={
                                    exerciseNotes.length > 0 &&
                                    selectedExerciseNoteIds.size === exerciseNotes.length
                                  }
                                  onChange={toggleAllExerciseNotes}
                                  className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                  title="Chọn tất cả"
                                />
                              </th>
                              <th className="w-48 px-4 py-3 text-left">Tên</th>
                              <th className="px-4 py-3 text-left">Nội dung</th>
                              <th className="w-12 px-3 py-3 text-center"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {exerciseNotes.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                                  Chưa có ghi chú. Bấm Thêm để tạo dòng mới.
                                </td>
                              </tr>
                            ) : (
                              exerciseNotes.map((note) => (
                                <tr
                                  key={note.id}
                                  className={`align-top ${selectedExerciseNoteIds.has(note.id) ? 'bg-purple-50/50' : ''}`}
                                >
                                  <td className="px-3 py-3 text-center">
                                    <input
                                      type="checkbox"
                                      checked={selectedExerciseNoteIds.has(note.id)}
                                      onChange={() => toggleExerciseNoteSelection(note.id)}
                                      className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <input
                                      type="text"
                                      value={note.title}
                                      onChange={(event) =>
                                        handleUpdateExerciseNote(note.id, 'title', event.target.value)
                                      }
                                      onBlur={() => handleSaveExerciseNotes()}
                                      placeholder="Tên ghi chú..."
                                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <textarea
                                      value={note.content}
                                      onChange={(event) =>
                                        handleUpdateExerciseNote(note.id, 'content', event.target.value)
                                      }
                                      onBlur={() => handleSaveExerciseNotes()}
                                      placeholder="Nội dung... (Enter để xuống dòng)"
                                      rows={2}
                                      className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                                    />
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveExerciseNote(note.id)}
                                      className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                                      title="Xóa dòng"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyPanel title="Chọn hoặc thêm dạng bài" description="Dạng bài là nhóm học liệu có thể giao cho lớp." />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {formMode && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-200 p-4">
                <h3 className="text-lg font-bold text-gray-900">
                  {formMode === 'exercise'
                    ? editingExerciseTypeId ? 'Sửa dạng bài' : 'Thêm dạng bài'
                    : formMode === 'material'
                      ? 'Thêm học liệu'
                      : formMode === 'assignment'
                        ? 'Giao bài'
                        : formMode === 'gradeBand'
                          ? 'Sửa khối'
                          : formMode === 'grade'
                            ? 'Sửa lớp'
                            : 'Sửa lớp học'}
                </h3>
                <button type="button" onClick={() => setFormMode(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={22} />
                </button>
              </div>

              {formMode === 'gradeBand' && (
                <form onSubmit={submitGradeBandEdit} className="space-y-4 p-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Tên khối</label>
                    <input
                      value={gradeBandForm.name}
                      onChange={(event) => setGradeBandForm({ ...gradeBandForm, name: event.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Mô tả</label>
                    <input
                      value={gradeBandForm.description}
                      onChange={(event) => setGradeBandForm({ ...gradeBandForm, description: event.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                      placeholder="Ví dụ: Lớp 1 - 5"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Thứ tự</label>
                    <input
                      type="number"
                      value={gradeBandForm.sortOrder}
                      onChange={(event) => setGradeBandForm({ ...gradeBandForm, sortOrder: event.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setFormMode(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                      Hủy
                    </button>
                    <button type="submit" disabled={savingMaterial} className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50">
                      <Save size={16} />
                      Lưu
                    </button>
                  </div>
                </form>
              )}

              {formMode === 'grade' && (
                <form onSubmit={submitGradeEdit} className="space-y-4 p-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Tên lớp</label>
                      <input
                        value={gradeForm.name}
                        onChange={(event) => setGradeForm({ ...gradeForm, name: event.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Số lớp</label>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        value={gradeForm.gradeNumber}
                        onChange={(event) => setGradeForm({ ...gradeForm, gradeNumber: event.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Thứ tự</label>
                    <input
                      type="number"
                      value={gradeForm.sortOrder}
                      onChange={(event) => setGradeForm({ ...gradeForm, sortOrder: event.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setFormMode(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                      Hủy
                    </button>
                    <button type="submit" disabled={savingMaterial} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                      <Save size={16} />
                      Lưu
                    </button>
                  </div>
                </form>
              )}

              {formMode === 'classGroup' && (
                <form onSubmit={submitClassGroupEdit} className="space-y-4 p-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Mã lớp</label>
                      <input
                        value={classGroupForm.code}
                        onChange={(event) => setClassGroupForm({ ...classGroupForm, code: event.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-green-500 focus:ring-2 focus:ring-green-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Tên lớp học</label>
                      <input
                        value={classGroupForm.name}
                        onChange={(event) => setClassGroupForm({ ...classGroupForm, name: event.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-green-500 focus:ring-2 focus:ring-green-500"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Giáo viên</label>
                    <input
                      value={classGroupForm.teacherName}
                      onChange={(event) => setClassGroupForm({ ...classGroupForm, teacherName: event.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-green-500 focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Số học viên</label>
                      <input
                        type="number"
                        min="0"
                        value={classGroupForm.studentCount}
                        onChange={(event) => setClassGroupForm({ ...classGroupForm, studentCount: event.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-green-500 focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Thứ tự</label>
                      <input
                        type="number"
                        value={classGroupForm.sortOrder}
                        onChange={(event) => setClassGroupForm({ ...classGroupForm, sortOrder: event.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-green-500 focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setFormMode(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                      Hủy
                    </button>
                    <button type="submit" disabled={savingMaterial} className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                      <Save size={16} />
                      Lưu
                    </button>
                  </div>
                </form>
              )}

              {formMode === 'exercise' && (
                <form onSubmit={submitExercise} className="space-y-4 p-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Tên dạng bài</label>
                    <input
                      value={exerciseForm.title}
                      onChange={(event) => setExerciseForm({ ...exerciseForm, title: event.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                      placeholder="Ví dụ: Phép cộng trong phạm vi 10"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Môn</label>
                      <input
                        value={exerciseForm.subject}
                        onChange={(event) => setExerciseForm({ ...exerciseForm, subject: event.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Độ khó</label>
                      <select
                        value={exerciseForm.difficulty}
                        onChange={(event) => setExerciseForm({ ...exerciseForm, difficulty: event.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                      >
                        <option>Cơ bản</option>
                        <option>Vận dụng</option>
                        <option>Nâng cao</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Số bài</label>
                      <input
                        type="number"
                        min="0"
                        value={exerciseForm.exerciseCount}
                        onChange={(event) => setExerciseForm({ ...exerciseForm, exerciseCount: event.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Mô tả</label>
                    <textarea
                      value={exerciseForm.description}
                      onChange={(event) => setExerciseForm({ ...exerciseForm, description: event.target.value })}
                      className="min-h-24 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setFormMode(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                      Hủy
                    </button>
                    <button type="submit" disabled={savingMaterial} className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50">
                      <Save size={16} />
                      Lưu
                    </button>
                  </div>
                </form>
              )}

              {formMode === 'material' && (
                <form onSubmit={submitMaterial} className="space-y-4 p-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Tên học liệu</label>
                    <input
                      value={materialForm.title}
                      onChange={(event) => setMaterialForm({ ...materialForm, title: event.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      placeholder="Ví dụ: Phiếu bài tập số 1"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Loại</label>
                      <select
                        value={materialForm.contentType}
                        onChange={(event) => setMaterialForm({ ...materialForm, contentType: event.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="worksheet">Phiếu bài tập</option>
                        <option value="video">Video</option>
                        <option value="link">Link</option>
                        <option value="document">Tài liệu</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Số phút</label>
                      <input
                        type="number"
                        min="0"
                        value={materialForm.estimatedMinutes}
                        onChange={(event) => setMaterialForm({ ...materialForm, estimatedMinutes: event.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Số câu</label>
                      <input
                        type="number"
                        min="0"
                        value={materialForm.questionCount}
                        onChange={(event) => setMaterialForm({ ...materialForm, questionCount: event.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Link ngoài</label>
                    <input
                      value={materialForm.externalUrl}
                      onChange={(event) => setMaterialForm({ ...materialForm, externalUrl: event.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">File URL</label>
                    <input
                      value={materialForm.fileUrl}
                      onChange={(event) => setMaterialForm({ ...materialForm, fileUrl: event.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      placeholder="https://..."
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setFormMode(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                      Hủy
                    </button>
                    <button type="submit" disabled={savingMaterial || !selectedExerciseTypeId} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                      <Save size={16} />
                      Lưu
                    </button>
                  </div>
                </form>
              )}

              {formMode === 'assignment' && (
                <form onSubmit={submitAssignment} className="space-y-4 p-4">
                  <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                    <p><span className="font-medium">Dạng bài:</span> {selectedExerciseType?.title}</p>
                    <p><span className="font-medium">Lớp nhận:</span> {selectedClassGroup?.name}</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Hạn nộp</label>
                      <input
                        type="date"
                        value={assignmentForm.dueDate}
                        onChange={(event) => setAssignmentForm({ ...assignmentForm, dueDate: event.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-green-500 focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Số học viên</label>
                      <input
                        type="number"
                        min="0"
                        value={assignmentForm.assignedCount}
                        onChange={(event) => setAssignmentForm({ ...assignmentForm, assignedCount: event.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-green-500 focus:ring-2 focus:ring-green-500"
                        placeholder={String(selectedClassGroup?.studentCount || '')}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Ghi chú</label>
                    <textarea
                      value={assignmentForm.note}
                      onChange={(event) => setAssignmentForm({ ...assignmentForm, note: event.target.value })}
                      className="min-h-24 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-green-500 focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setFormMode(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                      Hủy
                    </button>
                    <button type="submit" disabled={savingMaterial || !selectedExerciseType || !selectedClassGroup} className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                      <Save size={16} />
                      Giao bài
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};


export const HomeworkManager: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { classes } = useClasses();
  const { students: allStudents } = useStudents({});
  const { user, staffData } = useAuth();
  const { shouldShowOnlyOwnClasses, staffId } = usePermissions();
  const { holidays } = useHolidays();

  const [activeTab, setActiveTab] = useState<'homework' | 'materials'>(() =>
    searchParams.get('tab') === 'materials' ? 'materials' : 'homework'
  );

  // State
  const [selectedClassId, setSelectedClassId] = useState<string>(() => searchParams.get('classId') || '');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [filterBranch, setFilterBranch] = useState<string>('');  // Branch filter
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  
  // Homework state
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [newHomeworkName, setNewHomeworkName] = useState('');
  const [studentRecords, setStudentRecords] = useState<StudentHomeworkRecord[]>([]);
  const [existingRecordId, setExistingRecordId] = useState<string | null>(null);
  
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Bulk homework state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedBulkClassIds, setSelectedBulkClassIds] = useState<string[]>([]);
  const [bulkHomeworks, setBulkHomeworks] = useState<string[]>(['']);
  const [bulkSaving, setBulkSaving] = useState(false);

  // Status config modal
  const [showStatusConfig, setShowStatusConfig] = useState(false);
  const [globalStatuses, setGlobalStatuses] = useState<HomeworkStatus[]>(DEFAULT_HOMEWORK_STATUSES);
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('bg-gray-500');

  useEffect(() => {
    setActiveTab(searchParams.get('tab') === 'materials' ? 'materials' : 'homework');
  }, [searchParams]);

  // Get unique branches from classes
  const branches = useMemo(() => {
    return [...new Set(classes.map(c => c.branch).filter(Boolean))].sort() as string[];
  }, [classes]);

  // Filter classes for teachers
  const filteredClasses = useMemo(() => {
    const onlyOwn = shouldShowOnlyOwnClasses('homework');
    const excludeStatuses = ['Đã kết thúc', 'Đã hủy', 'Kết thúc'];

    let result = classes.filter(c => !excludeStatuses.includes(c.status || ''));

    // Filter by branch
    if (filterBranch) {
      result = result.filter(c => c.branch === filterBranch);
    }

    // Filter by own classes for teachers
    if (onlyOwn && staffData) {
      const myName = staffData.name;
      result = result.filter(cls =>
        cls.teacher === myName || cls.assistant === myName || cls.foreignTeacher === myName
      );
    }

    return result;
  }, [classes, shouldShowOnlyOwnClasses, staffData, filterBranch]);

  // Get students in selected class - improved matching logic
  const studentsInClass = useMemo(() => {
    if (!selectedClassId) return [];
    const selectedClass = classes.find(c => c.id === selectedClassId);
    if (!selectedClass) return [];

    // More flexible matching - check all possible class references
    const matchedStudents = allStudents.filter(s => {
      // Match by classId (primary)
      if (s.classId === selectedClassId) return true;

      // Match by classIds array (multi-class support)
      if (s.classIds?.includes(selectedClassId)) return true;

      // Match by class name (legacy support)
      const className = selectedClass.name?.toLowerCase().trim();
      if (className) {
        if (s.class?.toLowerCase().trim() === className) return true;
        if ((s as any).className?.toLowerCase().trim() === className) return true;
        if ((s as any).currentClassName?.toLowerCase().trim() === className) return true;
      }

      // Match by currentClassId field (if exists)
      if ((s as any).currentClassId === selectedClassId) return true;

      return false;
    });

    // Filter by active status
    const activeStudents = matchedStudents.filter(s =>
      s.status === 'Đang học' || s.status === 'Học thử' || s.status === 'Nợ phí'
    );

    // Debug log when no students found
    if (activeStudents.length === 0 && matchedStudents.length > 0) {
      console.log('[HomeworkManager] Found', matchedStudents.length, 'students but none with active status');
    } else if (activeStudents.length === 0) {
      console.log('[HomeworkManager] No students matched for class:', selectedClass.name, selectedClassId);
    }

    return activeStudents;
  }, [selectedClassId, classes, allStudents]);

  // Check if date is a holiday
  const isHoliday = (dateStr: string): string | null => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    for (const h of holidays) {
      const start = new Date(h.startDate);
      const end = new Date(h.endDate || h.startDate);
      if (date >= start && date <= end) {
        return h.name || 'Lịch nghỉ chung';
      }
    }
    return null;
  };

  // Load global statuses from Firestore
  useEffect(() => {
    const loadStatuses = async () => {
      try {
        const statuses = await getHomeworkStatuses(DEFAULT_HOMEWORK_STATUSES);
        setGlobalStatuses(statuses);
      } catch (err) {
        console.error('Error loading statuses:', err);
      }
    };
    loadStatuses();
  }, []);

  // Load sessions when class is selected
  useEffect(() => {
    const loadSessions = async () => {
      if (!selectedClassId) {
        setSessions([]);
        return;
      }
      
      setLoadingSessions(true);
      try {
        const selectedClass = classes.find(c => c.id === selectedClassId);
        const data = await getClassSessionsWithScheduleFallback(selectedClass);
        setSessions(data);
      } catch (err) {
        console.error('Error loading sessions:', err);
      } finally {
        setLoadingSessions(false);
      }
    };
    
    loadSessions();
  }, [selectedClassId, classes]);

  // Load existing homework record when session is selected
  useEffect(() => {
    const loadExistingRecord = async () => {
      if (!selectedClassId || !selectedSessionId) {
        setHomeworks([]);
        setStudentRecords([]);
        setExistingRecordId(null);
        return;
      }
      
      setLoading(true);
      try {
        const data = await getHomeworkRecord(selectedClassId, selectedSessionId);

        if (data) {
          setExistingRecordId(data.id || null);
          setHomeworks(data.homeworks || []);

          // Smart merge: if stored studentRecords is empty but we have students,
          // regenerate from current students list to fix data created before students were assigned
          const storedRecords = data.studentRecords || [];
          if (storedRecords.length === 0 && studentsInClass.length > 0) {
            // No stored records, regenerate from current students
            setStudentRecords(
              studentsInClass.map(s => ({
                studentId: s.id,
                studentName: s.fullName || s.name || '',
                homeworks: {},
                note: ''
              }))
            );
          } else if (storedRecords.length > 0) {
            // Has stored records - use them but also add any new students not in the list
            const existingStudentIds = new Set(storedRecords.map(r => r.studentId));
            const newStudents = studentsInClass
              .filter(s => !existingStudentIds.has(s.id))
              .map(s => ({
                studentId: s.id,
                studentName: s.fullName || s.name || '',
                homeworks: {},
                note: ''
              }));
            setStudentRecords([...storedRecords, ...newStudents]);
          } else {
            // Both empty
            setStudentRecords([]);
          }
        } else {
          setExistingRecordId(null);
          setHomeworks([]);
          setStudentRecords(
            studentsInClass.map(s => ({
              studentId: s.id,
              studentName: s.fullName || s.name || '',
              homeworks: {},
              note: ''
            }))
          );
        }
      } catch (err) {
        console.error('Error loading homework record:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadExistingRecord();
  }, [selectedClassId, selectedSessionId, studentsInClass]);


  // Add new homework
  const handleAddHomework = () => {
    if (!newHomeworkName.trim()) return;
    
    const newHomework: Homework = {
      id: `hw_${Date.now()}`,
      name: newHomeworkName.trim(),
      statuses: globalStatuses
    };
    
    setHomeworks([...homeworks, newHomework]);
    
    setStudentRecords(prev => prev.map(record => ({
      ...record,
      homeworks: {
        ...record.homeworks,
        [newHomework.id]: { status: 'not_completed', score: null }
      }
    })));
    
    setNewHomeworkName('');
  };

  // Remove homework
  const handleRemoveHomework = (homeworkId: string) => {
    setHomeworks(prev => prev.filter(h => h.id !== homeworkId));
    setStudentRecords(prev => prev.map(record => {
      const { [homeworkId]: removed, ...rest } = record.homeworks;
      return { ...record, homeworks: rest };
    }));
  };

  // Update homework status
  const handleStatusChange = (studentId: string, homeworkId: string, status: string) => {
    setStudentRecords(prev => prev.map(record => {
      if (record.studentId !== studentId) return record;
      return {
        ...record,
        homeworks: {
          ...record.homeworks,
          [homeworkId]: {
            ...record.homeworks[homeworkId],
            status
          }
        }
      };
    }));
  };

  // Update score
  const handleScoreChange = (studentId: string, homeworkId: string, score: string) => {
    const scoreNum = score === '' ? null : parseFloat(score);
    setStudentRecords(prev => prev.map(record => {
      if (record.studentId !== studentId) return record;
      return {
        ...record,
        homeworks: {
          ...record.homeworks,
          [homeworkId]: {
            ...record.homeworks[homeworkId],
            score: scoreNum
          }
        }
      };
    }));
  };

  // Update note
  const handleNoteChange = (studentId: string, note: string) => {
    setStudentRecords(prev => prev.map(record => {
      if (record.studentId !== studentId) return record;
      return { ...record, note };
    }));
  };

  // Save homework records
  const handleSave = async () => {
    if (!selectedClassId || !selectedSessionId) {
      alert('Vui lòng chọn lớp và buổi học!');
      return;
    }
    
    if (homeworks.length === 0) {
      alert('Vui lòng thêm ít nhất 1 bài tập!');
      return;
    }
    
    setSaving(true);
    try {
      const selectedClass = classes.find(c => c.id === selectedClassId);
      const selectedSession = sessions.find(s => s.id === selectedSessionId);
      
      const recordData: any = {
        classId: selectedClassId,
        className: selectedClass?.name || '',
        sessionId: selectedSessionId,
        sessionNumber: selectedSession?.sessionNumber || 0,
        sessionDate: selectedSession?.date || '',
        homeworks,
        studentRecords: studentRecords || [],
        updatedAt: new Date().toISOString(),
        createdBy: staffData?.name || user?.displayName || 'Unknown'
      };
      
      if (existingRecordId) {
        await saveHomeworkRecord(recordData, existingRecordId);
      } else {
        recordData.createdAt = new Date().toISOString();
        const id = await saveHomeworkRecord(recordData);
        setExistingRecordId(id);
      }
      
      alert('Đã lưu thành công!');
    } catch (err: any) {
      console.error('Error saving homework:', err);
      alert('Có lỗi xảy ra khi lưu: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  // Save global statuses
  const handleSaveStatuses = async () => {
    try {
      await saveHomeworkStatuses(globalStatuses);
      alert('Đã lưu cấu hình trạng thái!');
      setShowStatusConfig(false);
    } catch (err) {
      console.error('Error saving statuses:', err);
      alert('Có lỗi xảy ra!');
    }
  };

  // Add new status
  const handleAddStatus = () => {
    if (!newStatusLabel.trim()) return;
    const newStatus: HomeworkStatus = {
      value: newStatusLabel.toLowerCase().replace(/\s+/g, '_'),
      label: newStatusLabel,
      color: newStatusColor,
      textColor: newStatusColor.includes('yellow') || newStatusColor.includes('gray-2') ? 'text-gray-800' : 'text-white'
    };
    setGlobalStatuses([...globalStatuses, newStatus]);
    setNewStatusLabel('');
    setNewStatusColor('bg-gray-500');
  };

  // Remove status
  const handleRemoveStatus = (value: string) => {
    setGlobalStatuses(prev => prev.filter(s => s.value !== value));
  };

  // Toggle bulk class selection
  const toggleBulkClass = (classId: string) => {
    setSelectedBulkClassIds(prev => 
      prev.includes(classId) 
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    );
  };

  // Save bulk homework for multiple classes
  const handleSaveBulkHomework = async () => {
    const validHomeworks = bulkHomeworks.filter(h => h.trim());
    if (selectedBulkClassIds.length === 0 || validHomeworks.length === 0) {
      alert('Vui lòng chọn ít nhất 1 lớp và nhập ít nhất 1 bài tập!');
      return;
    }

    setBulkSaving(true);
    try {
      let totalCreated = 0;
      let totalUpdated = 0;

      for (const classId of selectedBulkClassIds) {
        const selectedClass = classes.find(c => c.id === classId);
        
        // Get all sessions for this class, falling back to the configured class schedule.
        const classSessions = await getClassSessionsWithScheduleFallback(selectedClass);

        const homeworkList = validHomeworks.map(name => ({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          name,
          statuses: globalStatuses
        }));

        for (const session of classSessions) {
          if (!session.id) continue;
          const existingData = await getHomeworkRecord(classId, session.id);

          if (existingData) {
            const existingHomeworks = existingData.homeworks || [];
            
            const newHomeworks = homeworkList.filter(
              h => !existingHomeworks.some((eh: any) => eh.name === h.name)
            );
            
            if (newHomeworks.length > 0) {
              await saveHomeworkRecord({
                ...existingData,
                homeworks: [...existingHomeworks, ...newHomeworks],
                updatedAt: new Date().toISOString()
              }, existingData.id);
              totalUpdated++;
            }
          } else {
            await saveHomeworkRecord({
              classId,
              className: selectedClass?.name || '',
              sessionId: session.id,
              sessionNumber: (session as any).sessionNumber || 0,
              sessionDate: (session as any).date || '',
              homeworks: homeworkList,
              studentRecords: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              createdBy: staffData?.name || user?.displayName || 'Unknown'
            });
            totalCreated++;
          }
        }
      }

      alert(`Đã thêm bài tập vào ${totalCreated} buổi mới và cập nhật ${totalUpdated} buổi có sẵn!`);
      setShowBulkModal(false);
      setBulkHomeworks(['']);
      setSelectedBulkClassIds([]);
    } catch (err: any) {
      console.error('Error saving bulk homework:', err);
      alert('Có lỗi xảy ra: ' + (err.message || err));
    } finally {
      setBulkSaving(false);
    }
  };


  // Get status style
  const getStatusStyle = (status: string): { color: string; textColor: string; label: string } => {
    const found = globalStatuses.find(s => s.value === status);
    return found || { color: 'bg-gray-300', textColor: 'text-gray-700', label: status };
  };

  // Color options for status
  const colorOptions = [
    { value: 'bg-green-500', label: 'Xanh lá' },
    { value: 'bg-red-500', label: 'Đỏ' },
    { value: 'bg-yellow-400', label: 'Vàng' },
    { value: 'bg-blue-400', label: 'Xanh dương' },
    { value: 'bg-purple-500', label: 'Tím' },
    { value: 'bg-orange-500', label: 'Cam' },
    { value: 'bg-pink-500', label: 'Hồng' },
    { value: 'bg-gray-500', label: 'Xám' },
  ];

  return (
    <div className="space-y-6">
      {/* Homework controls */}
      {activeTab === 'homework' && (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <BookOpen className="text-blue-600" />
            Quản lý Bài tập về nhà
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowStatusConfig(true)}
              className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm"
              title="Cấu hình trạng thái bài tập"
            >
              <Settings size={16} />
              Cấu hình
            </button>
            <button
              onClick={() => setShowBulkModal(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 text-sm font-medium"
            >
              <Plus size={18} />
              Thêm hàng loạt
            </button>
          </div>
        </div>
        
        {/* Class Selector */}
        <div className="mb-4 flex flex-wrap gap-4 items-end">
          {/* Branch Filter */}
          {branches.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cơ sở</label>
              <select
                value={filterBranch}
                onChange={(e) => {
                  setFilterBranch(e.target.value);
                  setSelectedClassId('');
                  setSelectedSessionId('');
                }}
                className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Tất cả cơ sở</option>
                {branches.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          )}

          {/* Class Selector */}
          <div className="flex-1 min-w-[300px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Chọn lớp học</label>
            <select
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setSelectedSessionId('');
              }}
              className="w-full md:w-96 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">-- Chọn lớp --</option>
              {filteredClasses.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>
        </div>

      </div>
      )}

      {/* TAB: Homework by Session */}
      {activeTab === 'homework' && selectedClassId && (
        <>
          {/* Session Selector */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Chọn buổi học</label>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              disabled={loadingSessions || sessions.length === 0}
              className="w-full md:w-96 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
            >
              <option value="">
                {loadingSessions
                  ? 'Đang tải...'
                  : sessions.length === 0
                  ? 'Không có buổi học'
                  : '-- Chọn buổi học --'}
              </option>
              {sessions.map(session => {
                const holidayName = isHoliday(session.date);
                return (
                  <option key={session.id} value={session.id}>
                    Buổi {session.sessionNumber} - {session.date} ({session.status})
                    {holidayName && ` (${holidayName})`}
                  </option>
                );
              })}
            </select>

            {/* No sessions warning */}
            {!loadingSessions && sessions.length === 0 && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2 text-yellow-800">
                  <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <strong>Lớp này chưa có buổi học nào.</strong>
                    <p className="mt-1 text-yellow-700">
                      Vui lòng vào <strong>Đào tạo → Quản lý lớp học → Chi tiết lớp</strong> để tạo lịch buổi học,
                      hoặc liên hệ quản lý để được hỗ trợ.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Holiday Warning */}
            {selectedSessionId && (() => {
              const session = sessions.find(s => s.id === selectedSessionId);
              const holidayName = session ? isHoliday(session.date) : null;
              if (holidayName) {
                return (
                  <div className="mt-2 flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-2 rounded-lg text-sm">
                    <AlertCircle size={16} />
                    <span>Buổi học này trùng với: <strong>{holidayName}</strong></span>
                  </div>
                );
              }
              return null;
            })()}
          </div>

          {/* Homework Management */}
          {selectedSessionId && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Khai báo Bài tập</h3>
              
              {/* Add Homework */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newHomeworkName}
                  onChange={(e) => setNewHomeworkName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddHomework()}
                  placeholder="Tên bài tập..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleAddHomework}
                  disabled={!newHomeworkName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Plus size={18} />
                  Thêm
                </button>
              </div>
              
              {/* Homework Tags */}
              {homeworks.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {homeworks.map(hw => (
                    <span 
                      key={hw.id}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                    >
                      {hw.name}
                      <button
                        onClick={() => handleRemoveHomework(hw.id)}
                        className="ml-1 text-blue-500 hover:text-red-500"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Student Records Table */}
          {selectedSessionId && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">STT</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">Tên Học sinh</th>
                          {homeworks.map(hw => (
                            <th key={hw.id} className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-b min-w-[160px]">
                              {hw.name}
                            </th>
                          ))}
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b min-w-[200px]">
                            Ghi chú
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {studentRecords.length > 0 ? (
                          studentRecords.map((record, idx) => (
                            <tr key={record.studentId} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-500">{idx + 1}</td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                {record.studentName}
                              </td>
                              {homeworks.map(hw => {
                                const hwRecord = record.homeworks[hw.id] || { status: 'not_completed', score: null };
                                const statusStyle = getStatusStyle(hwRecord.status);
                                return (
                                  <td key={hw.id} className="px-4 py-3 text-center">
                                    <select
                                      value={hwRecord.status}
                                      onChange={(e) => handleStatusChange(record.studentId, hw.id, e.target.value)}
                                      className={`w-full px-2 py-1.5 rounded-lg text-sm font-medium ${statusStyle.color} ${statusStyle.textColor} border-0 cursor-pointer appearance-none text-center`}
                                      style={{ WebkitAppearance: 'none' }}
                                    >
                                      {globalStatuses.map(s => (
                                        <option key={s.value} value={s.value}>{s.label}</option>
                                      ))}
                                    </select>
                                  </td>
                                );
                              })}
                              <td className="px-4 py-3">
                                <input
                                  type="text"
                                  value={record.note}
                                  onChange={(e) => handleNoteChange(record.studentId, e.target.value)}
                                  placeholder="Ghi chú..."
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={homeworks.length + 3} className="px-4 py-8 text-center text-gray-400">
                              {homeworks.length === 0 
                                ? 'Vui lòng thêm bài tập để bắt đầu'
                                : 'Không có học sinh trong lớp này'
                              }
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Save Button */}
                  <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-center">
                    <button
                      onClick={handleSave}
                      disabled={saving || homeworks.length === 0}
                      className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 font-medium"
                    >
                      {saving ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          Đang lưu...
                        </>
                      ) : (
                        <>
                          <Save size={18} />
                          Lưu Dữ liệu
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}


      {/* TAB: Learning Materials */}
      {activeTab === 'materials' && (
        <LearningMaterialsTab assignedByName={staffData?.name || user?.displayName || 'Unknown'} />
      )}

      {/* Empty State */}
      {activeTab === 'homework' && !selectedClassId && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">Chọn lớp học</h3>
          <p className="text-gray-400">Vui lòng chọn lớp học để quản lý bài tập về nhà</p>
        </div>
      )}

      {/* Bulk Homework Modal - Multi-select classes */}
      {showBulkModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">Thêm bài tập hàng loạt</h3>
              <button onClick={() => setShowBulkModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Multi-select Classes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chọn lớp học (có thể chọn nhiều)
                </label>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                  {filteredClasses.map(cls => (
                    <label 
                      key={cls.id} 
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedBulkClassIds.includes(cls.id)}
                        onChange={() => toggleBulkClass(cls.id)}
                        className="w-4 h-4 text-purple-600 rounded"
                      />
                      <span className="text-sm">{cls.name}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Đã chọn: {selectedBulkClassIds.length} lớp
                </p>
              </div>

              {/* Homework List */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Danh sách bài tập</label>
                <div className="space-y-2">
                  {bulkHomeworks.map((hw, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={hw}
                        onChange={(e) => {
                          const updated = [...bulkHomeworks];
                          updated[index] = e.target.value;
                          setBulkHomeworks(updated);
                        }}
                        placeholder={`Bài tập ${index + 1}...`}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      {bulkHomeworks.length > 1 && (
                        <button
                          onClick={() => setBulkHomeworks(prev => prev.filter((_, i) => i !== index))}
                          className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <X size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setBulkHomeworks([...bulkHomeworks, ''])}
                  className="mt-2 text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
                >
                  <Plus size={16} />
                  Thêm bài tập
                </button>
              </div>

              {/* Preview */}
              {selectedBulkClassIds.length > 0 && (
                <div className="bg-purple-50 p-3 rounded-lg text-sm">
                  <p className="text-purple-700">
                    <strong>Xem trước:</strong> Sẽ thêm {bulkHomeworks.filter(h => h.trim()).length} bài tập 
                    vào tất cả buổi học của {selectedBulkClassIds.length} lớp đã chọn
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveBulkHomework}
                disabled={bulkSaving || selectedBulkClassIds.length === 0 || bulkHomeworks.filter(h => h.trim()).length === 0}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {bulkSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Thêm hàng loạt
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Status Config Modal */}
      {showStatusConfig && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">Cấu hình trạng thái bài tập</h3>
              <button onClick={() => setShowStatusConfig(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Existing Statuses */}
              <div className="space-y-2">
                {globalStatuses.map(status => (
                  <div key={status.value} className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-lg text-sm font-medium ${status.color} ${status.textColor}`}>
                      {status.label}
                    </span>
                    <button
                      onClick={() => handleRemoveStatus(status.value)}
                      className="ml-auto text-red-500 hover:text-red-600"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add New Status */}
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Thêm trạng thái mới</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newStatusLabel}
                    onChange={(e) => setNewStatusLabel(e.target.value)}
                    placeholder="Tên trạng thái..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <select
                    value={newStatusColor}
                    onChange={(e) => setNewStatusColor(e.target.value)}
                    className={`px-3 py-2 rounded-lg text-sm ${newStatusColor} text-white`}
                  >
                    {colorOptions.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddStatus}
                    disabled={!newStatusLabel.trim()}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowStatusConfig(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveStatuses}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Save size={18} />
                Lưu cấu hình
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

    </div>
  );
};
