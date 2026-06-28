import { collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, writeBatch, runTransaction, arrayUnion, Timestamp, db } from '@/src/utils/legacyFirestoreStub';
/**
 * MonthlyCommentTab Component
 *
 * Displays a list of students with textarea for monthly comments.
 * Features:
 * - Auto-save on blur (per student)
 * - Real-time listener for comments
 * - "Lưu tất cả" batch save button
 */

import React, { useState, useEffect } from 'react';
import { User, Save, MessageSquare, Printer } from 'lucide-react';
import { Student, MonthlyComment } from '../../../../types';
import { printMonthlyCommentSlip } from '../../../utils/commentSlipPrint';

export interface MonthlyCommentTabProps {
  students: Student[];
  classId: string;
  className: string;
  month: number;
  year: number;
}

export const MonthlyCommentTab: React.FC<MonthlyCommentTabProps> = ({
  students,
  classId,
  className,
  month,
  year
}) => {
  const [comments, setComments] = useState<Record<string, string>>({});
  const [existingComments, setExistingComments] = useState<MonthlyComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load existing comments with real-time listener
  useEffect(() => {
    if (!classId) {
      setExistingComments([]);
      setComments({});
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(null as any /* firebase removed */, 'monthlyComments'),
      where('classId', '==', classId),
      where('month', '==', month),
      where('year', '==', year)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as MonthlyComment[];

      setExistingComments(data);

      // Initialize comments state from existing data
      const initial: Record<string, string> = {};
      data.forEach(c => {
        initial[c.studentId] = c.teacherComment || '';
      });
      setComments(initial);
      setLoading(false);
      setHasChanges(false);
    });

    return () => unsubscribe();
  }, [classId, month, year]);

  // Handle comment change
  const handleCommentChange = (studentId: string, value: string) => {
    setComments(prev => ({
      ...prev,
      [studentId]: value
    }));
    setHasChanges(true);
  };

  // Save single comment on blur
  const handleSaveComment = async (studentId: string) => {
    const comment = comments[studentId];
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    setSaving(studentId);
    try {
      const existing = existingComments.find(c => c.studentId === studentId);
      if (existing) {
        await updateDoc(doc(null as any /* firebase removed */, 'monthlyComments', existing.id), {
          teacherComment: comment,
          updatedAt: new Date().toISOString()
        });
      } else if (comment.trim()) {
        await addDoc(collection(null as any /* firebase removed */, 'monthlyComments'), {
          studentId,
          studentName: student.fullName,
          classId,
          className,
          month,
          year,
          teacherComment: comment,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error saving comment:', error);
    } finally {
      setSaving(null);
    }
  };

  // Save all comments
  const handleSaveAll = async () => {
    setSavingAll(true);
    try {
      for (const student of students) {
        const comment = comments[student.id] || '';
        const existing = existingComments.find(c => c.studentId === student.id);

        if (existing) {
          await updateDoc(doc(null as any /* firebase removed */, 'monthlyComments', existing.id), {
            teacherComment: comment,
            updatedAt: new Date().toISOString()
          });
        } else if (comment.trim()) {
          await addDoc(collection(null as any /* firebase removed */, 'monthlyComments'), {
            studentId: student.id,
            studentName: student.fullName,
            classId,
            className,
            month,
            year,
            teacherComment: comment,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving all comments:', error);
    } finally {
      setSavingAll(false);
    }
  };

  const printCommentSlip = (student: Student, comment: string) => {
    printMonthlyCommentSlip({
      studentName: student.fullName || '',
      studentCode: student.code || '',
      className,
      month,
      year,
      comment,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
        <span className="ml-3 text-gray-500">Đang tải nhận xét...</span>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg">
        <MessageSquare className="mx-auto mb-2 text-gray-300" size={48} />
        <p>Không có học sinh trong lớp này</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Save All button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Nhận xét tháng {month}/{year} • {students.length} học sinh
        </p>
        <button
          onClick={handleSaveAll}
          disabled={savingAll || !hasChanges}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 text-sm"
        >
          {savingAll ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              Đang lưu...
            </>
          ) : (
            <>
              <Save size={16} />
              Lưu tất cả
            </>
          )}
        </button>
      </div>

      {/* Student list with comment textareas */}
      <div className="space-y-3">
        {students.map((student, index) => {
          const existing = existingComments.find(c => c.studentId === student.id);
          const isSaving = saving === student.id;

          return (
            <div key={student.id} className="border border-gray-200 rounded-lg p-4 bg-white">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-medium">
                  {index + 1}
                </span>
                <User size={16} className="text-gray-400" />
                <span className="font-medium text-gray-800">{student.fullName}</span>
                <span className="text-sm text-gray-500">({student.code})</span>
                <button
                  type="button"
                  onClick={() => printCommentSlip(student, comments[student.id] || '')}
                  className="ml-auto px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-xs font-medium flex items-center gap-1"
                  title="In phiếu nhận xét"
                >
                  <Printer size={14} />
                  In phiếu
                </button>
                {existing && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    Đã lưu
                  </span>
                )}
                {isSaving && (
                  <span className="text-xs text-indigo-600 flex items-center gap-1">
                    <div className="animate-spin rounded-full h-3 w-3 border border-indigo-600 border-t-transparent"></div>
                    Đang lưu...
                  </span>
                )}
              </div>
              <textarea
                value={comments[student.id] || ''}
                onChange={(e) => handleCommentChange(student.id, e.target.value)}
                onBlur={() => handleSaveComment(student.id)}
                placeholder="Nhập nhận xét cho học sinh..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MonthlyCommentTab;
