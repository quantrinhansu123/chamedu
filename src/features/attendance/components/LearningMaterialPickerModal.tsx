import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { ModalPortal } from '@/components/modal-portal';
import type { LearningMaterialsData } from '../../../services/learningMaterialService';
import {
  AttentionCardData,
  CheckExerciseTagsData,
  LearningNoteItem,
  LessonExerciseTagsData,
  parseExerciseNotes,
} from '../../../utils/learningMaterialNotes';
import { MultiSelectCheckboxDropdown } from './MultiSelectCheckboxDropdown';

type PickerMode = 'attention' | 'lessonTypes' | 'checkTags';

interface LearningMaterialPickerModalProps {
  open: boolean;
  mode: PickerMode;
  studentName: string;
  learningData: LearningMaterialsData | null;
  initialAttention?: AttentionCardData | null;
  initialLessonTypes?: LessonExerciseTagsData | null;
  initialCheckTags?: CheckExerciseTagsData | null;
  onClose: () => void;
  onSaveAttention: (data: AttentionCardData) => void;
  onSaveLessonTypes: (data: LessonExerciseTagsData) => void;
  onSaveCheckTags: (data: CheckExerciseTagsData) => void;
}

const initialExerciseTypeIds = (
  singleId?: string,
  list?: Array<{ id: string }>
): Set<string> => {
  if (list?.length) return new Set(list.map((item) => item.id));
  if (singleId) return new Set([singleId]);
  return new Set();
};

export const LearningMaterialPickerModal: React.FC<LearningMaterialPickerModalProps> = ({
  open,
  mode,
  studentName,
  learningData,
  initialAttention,
  initialLessonTypes,
  initialCheckTags,
  onClose,
  onSaveAttention,
  onSaveLessonTypes,
  onSaveCheckTags,
}) => {
  const [gradeBandId, setGradeBandId] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [selectedExerciseTypeIds, setSelectedExerciseTypeIds] = useState<Set<string>>(new Set());
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    if (mode === 'attention') {
      setGradeBandId(initialAttention?.gradeBandId || learningData?.gradeBands[0]?.id || '');
      setGradeId(initialAttention?.gradeId || '');
      setSelectedExerciseTypeIds(
        initialExerciseTypeIds(initialAttention?.exerciseTypeId, initialAttention?.exerciseTypes)
      );
      setSelectedMaterialIds(
        initialAttention?.materials?.length
          ? new Set(initialAttention.materials.map((item) => item.id))
          : initialAttention?.materialId
            ? new Set([initialAttention.materialId])
            : new Set()
      );
      setSelectedNoteIds(new Set(initialAttention?.selectedNotes.map((note) => note.id) || []));
    } else if (mode === 'lessonTypes') {
      setGradeBandId(initialLessonTypes?.gradeBandId || learningData?.gradeBands[0]?.id || '');
      setGradeId(initialLessonTypes?.gradeId || '');
      setSelectedExerciseTypeIds(
        new Set(initialLessonTypes?.exerciseTypes.map((item) => item.id) || [])
      );
      setSelectedMaterialIds(new Set());
      setSelectedNoteIds(new Set());
    } else {
      setGradeBandId(initialCheckTags?.gradeBandId || learningData?.gradeBands[0]?.id || '');
      setGradeId(initialCheckTags?.gradeId || '');
      setSelectedExerciseTypeIds(
        initialExerciseTypeIds(
          initialCheckTags?.exerciseTypeId,
          initialCheckTags?.exerciseTypes
        )
      );
      setSelectedMaterialIds(
        new Set(initialCheckTags?.materials?.map((item) => item.id) || [])
      );
      setSelectedNoteIds(new Set());
    }
  }, [open, mode, initialAttention, initialLessonTypes, initialCheckTags, learningData]);

  const grades = useMemo(
    () => (learningData?.grades || []).filter((grade) => grade.gradeBandId === gradeBandId),
    [learningData, gradeBandId]
  );

  const exerciseTypes = useMemo(
    () => (learningData?.exerciseTypes || []).filter((exercise) => exercise.gradeId === gradeId),
    [learningData, gradeId]
  );

  const materials = useMemo(() => {
    if (!learningData || selectedExerciseTypeIds.size === 0) return [];
    return learningData.materials.filter((material) =>
      selectedExerciseTypeIds.has(material.exerciseTypeId)
    );
  }, [learningData, selectedExerciseTypeIds]);

  const availableNotes = useMemo(() => {
    return exerciseTypes
      .filter((exercise) => selectedExerciseTypeIds.has(exercise.id))
      .flatMap((exercise) =>
        parseExerciseNotes(exercise.description).map((note) => ({
          ...note,
          id: `${exercise.id}:${note.id}`,
          title: note.title || exercise.title,
        }))
      );
  }, [exerciseTypes, selectedExerciseTypeIds]);

  useEffect(() => {
    if (!gradeId && grades[0]) setGradeId(grades[0].id);
    if (gradeId && !grades.some((grade) => grade.id === gradeId)) {
      setGradeId(grades[0]?.id || '');
    }
  }, [gradeId, grades]);

  useEffect(() => {
    const validMaterialIds = new Set(materials.map((material) => material.id));
    setSelectedMaterialIds((prev) => {
      const next = new Set([...prev].filter((id) => validMaterialIds.has(id)));
      if (next.size === prev.size && [...next].every((id) => prev.has(id))) return prev;
      return next;
    });
  }, [materials]);

  const resetBelowGrade = () => {
    setSelectedExerciseTypeIds(new Set());
    setSelectedMaterialIds(new Set());
    setSelectedNoteIds(new Set());
  };

  const toggleNote = (id: string) => {
    setSelectedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExerciseType = (id: string) => {
    setSelectedExerciseTypeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    if (!learningData) return;
    const gradeBand = learningData.gradeBands.find((band) => band.id === gradeBandId);
    const grade = learningData.grades.find((item) => item.id === gradeId);
    if (!gradeBand || !grade) return;

    const selectedExercises = exerciseTypes
      .filter((exercise) => selectedExerciseTypeIds.has(exercise.id))
      .map((exercise) => ({ id: exercise.id, title: exercise.title }));

    if (mode === 'lessonTypes') {
      onSaveLessonTypes({
        gradeBandId: gradeBand.id,
        gradeBandName: gradeBand.name,
        gradeId: grade.id,
        gradeName: grade.name,
        exerciseTypes: selectedExercises,
      });
      onClose();
      return;
    }

    if (selectedExercises.length === 0) return;

    const selectedMaterials = materials
      .filter((material) => selectedMaterialIds.has(material.id))
      .map((material) => ({ id: material.id, title: material.title }));

    if (mode === 'attention') {
      const selectedNotes: LearningNoteItem[] = availableNotes.filter((note) =>
        selectedNoteIds.has(note.id)
      );
      const firstExercise = selectedExercises[0];
      onSaveAttention({
        gradeBandId: gradeBand.id,
        gradeBandName: gradeBand.name,
        gradeId: grade.id,
        gradeName: grade.name,
        exerciseTypeId: firstExercise.id,
        exerciseTypeTitle: selectedExercises.map((item) => item.title).join(', '),
        exerciseTypes: selectedExercises,
        materialId: selectedMaterials[0]?.id,
        materialTitle: selectedMaterials.map((item) => item.title).join(', '),
        materials: selectedMaterials,
        selectedNotes,
      });
    } else {
      const firstExercise = selectedExercises[0];
      onSaveCheckTags({
        gradeBandId: gradeBand.id,
        gradeBandName: gradeBand.name,
        gradeId: grade.id,
        gradeName: grade.name,
        exerciseTypeId: firstExercise.id,
        exerciseTypeTitle: selectedExercises.map((item) => item.title).join(', '),
        exerciseTypes: selectedExercises,
        materials: selectedMaterials,
      });
    }
    onClose();
  };

  const exerciseTypeOptions = exerciseTypes.map((exercise) => ({
    id: exercise.id,
    label: exercise.title,
  }));

  const materialOptions = materials.map((material) => ({
    id: material.id,
    label: material.title,
    sublabel: [
      material.contentType,
      material.questionCount ? `${material.questionCount} câu` : '',
      material.estimatedMinutes ? `${material.estimatedMinutes} phút` : '',
    ]
      .filter(Boolean)
      .join(' · '),
  }));

  const canSave =
    !!learningData &&
    (mode === 'lessonTypes'
      ? selectedExerciseTypeIds.size > 0
      : selectedExerciseTypeIds.size > 0);

  if (!open) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {mode === 'attention'
                  ? 'Chọn thẻ chú ý'
                  : mode === 'lessonTypes'
                    ? 'Chọn dạng bài học'
                    : 'Gắn dạng bài kiểm tra'}
              </h3>
              <p className="text-sm text-gray-500">{studentName}</p>
            </div>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={22} />
            </button>
          </div>

          {!learningData ? (
            <p className="px-5 py-8 text-sm text-gray-500">Đang tải học liệu...</p>
          ) : (
            <div className="space-y-4 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase text-gray-500">Khối</label>
                  <select
                    value={gradeBandId}
                    onChange={(event) => {
                      setGradeBandId(event.target.value);
                      setGradeId('');
                      resetBelowGrade();
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    {learningData.gradeBands.map((band) => (
                      <option key={band.id} value={band.id}>
                        {band.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase text-gray-500">Lớp</label>
                  <select
                    value={gradeId}
                    onChange={(event) => {
                      setGradeId(event.target.value);
                      resetBelowGrade();
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    {grades.length === 0 ? (
                      <option value="">Chưa có lớp</option>
                    ) : (
                      grades.map((grade) => (
                        <option key={grade.id} value={grade.id}>
                          {grade.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {mode !== 'lessonTypes' && (
                  <MultiSelectCheckboxDropdown
                    label="Dạng bài"
                    options={exerciseTypeOptions}
                    selectedIds={selectedExerciseTypeIds}
                    onChange={setSelectedExerciseTypeIds}
                    placeholder="Chọn dạng bài..."
                    emptyText="Chưa có dạng bài"
                    disabled={exerciseTypes.length === 0}
                  />
                )}

                {(mode === 'attention' || mode === 'checkTags') && (
                  <MultiSelectCheckboxDropdown
                    label="Chi tiết học liệu"
                    options={materialOptions}
                    selectedIds={selectedMaterialIds}
                    onChange={setSelectedMaterialIds}
                    placeholder="Chọn chi tiết học liệu..."
                    emptyText={
                      selectedExerciseTypeIds.size === 0
                        ? 'Chọn dạng bài trước'
                        : 'Chưa có học liệu'
                    }
                    disabled={selectedExerciseTypeIds.size === 0 || materials.length === 0}
                  />
                )}
              </div>

              {mode === 'attention' ? (
                <div className="rounded-lg border border-gray-200">
                  <div className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800">
                    Chọn thẻ ghi chú từ học liệu
                  </div>
                  <div className="divide-y divide-gray-100">
                    {selectedExerciseTypeIds.size === 0 ? (
                      <p className="px-4 py-6 text-sm text-gray-500">Chọn ít nhất một dạng bài.</p>
                    ) : availableNotes.length === 0 ? (
                      <p className="px-4 py-6 text-sm text-gray-500">
                        Dạng bài đã chọn chưa có thẻ ghi chú trong mục Học liệu.
                      </p>
                    ) : (
                      availableNotes.map((note) => (
                        <label
                          key={note.id}
                          className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedNoteIds.has(note.id)}
                            onChange={() => toggleNote(note.id)}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-gray-900">{note.title || 'Ghi chú'}</p>
                            <p className="whitespace-pre-wrap text-sm text-gray-600">{note.content}</p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              ) : mode === 'lessonTypes' ? (
                <div className="rounded-lg border border-gray-200">
                  <div className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800">
                    Chọn dạng bài học trong buổi
                  </div>
                  <div className="divide-y divide-gray-100">
                    {exerciseTypes.length === 0 ? (
                      <p className="px-4 py-6 text-sm text-gray-500">
                        Lớp này chưa có dạng bài trong mục Học liệu.
                      </p>
                    ) : (
                      exerciseTypes.map((exercise) => (
                        <label
                          key={exercise.id}
                          className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedExerciseTypeIds.has(exercise.id)}
                            onChange={() => toggleExerciseType(exercise.id)}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                          />
                          <p className="font-medium text-gray-900">{exercise.title}</p>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Lưu lựa chọn
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
