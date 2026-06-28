import { collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, writeBatch, runTransaction, arrayUnion, Timestamp, db } from '@/src/utils/legacyFirestoreStub';
/**
 * TestCommentTab Component
 *
 * Displays test results with scores and comments for each student.
 * Supports Brisky PDF format with multi-skill scores and detailed comments.
 *
 * Features:
 * - Add new test with book/unit info
 * - Edit detailed test comment per student (scores, content, strengths, improvements, attitude)
 * - Export PDF report in Brisky format
 * - Delete test (with confirmation)
 * - Auto-save on blur
 */

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, X, AlertTriangle, Edit2, Settings, Award } from 'lucide-react';
import { Student, TestComment, TestTemplate } from '../../../../types';
import { TestCommentTemplateModal } from './test-comment-template-modal';
import { TestCommentEditModal } from './test-comment-edit-modal';
import { ModalPortal } from '@/components/modal-portal';

export interface TestCommentTabProps {
  students: Student[];
  classId: string;
  className: string;
  month: number;
  year: number;
}

export const TestCommentTab: React.FC<TestCommentTabProps> = ({
  students,
  classId,
  className,
  month,
  year
}) => {
  const [testComments, setTestComments] = useState<TestComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Add Test Modal
  const [showAddTestModal, setShowAddTestModal] = useState(false);
  const [newTestName, setNewTestName] = useState('');
  const [newTestDate, setNewTestDate] = useState('');
  const [newTestUnit, setNewTestUnit] = useState('');
  const [newTestBook, setNewTestBook] = useState('');
  const [addingTest, setAddingTest] = useState(false);

  // Delete Confirmation Modal
  const [testToDelete, setTestToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Detailed Edit Modal - comment being edited
  const [editingComment, setEditingComment] = useState<TestComment | null>(null);

  // Template management
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [currentTestForTemplate, setCurrentTestForTemplate] = useState<string>('');
  const [testTemplates, setTestTemplates] = useState<Record<string, TestTemplate>>({});

  // Load existing test comments with real-time listener
  useEffect(() => {
    if (!classId) {
      setTestComments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(null as any /* firebase removed */, 'testComments'),
      where('classId', '==', classId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as TestComment[];
      setTestComments(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [classId]);

  // Load templates for all tests in this class
  useEffect(() => {
    if (!classId) {
      setTestTemplates({});
      return;
    }

    const q = query(
      collection(null as any /* firebase removed */, 'testTemplates'),
      where('classId', '==', classId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const templates: Record<string, TestTemplate> = {};
      snapshot.docs.forEach(d => {
        const data = d.data() as TestTemplate;
        templates[data.testName] = { ...data, id: d.id };
      });
      setTestTemplates(templates);
    });

    return () => unsubscribe();
  }, [classId]);

  // Get unique test names
  const testNames: string[] = Array.from(new Set(testComments.map(t => t.testName)));

  // Save quick comment/score (legacy support)
  const handleSaveQuickComment = async (
    testName: string,
    studentId: string,
    studentName: string,
    comment: string,
    score: number | null
  ) => {
    setSaving(`${testName}-${studentId}`);
    try {
      const existing = testComments.find(
        t => t.testName === testName && t.studentId === studentId
      );

      if (existing) {
        await updateDoc(doc(null as any /* firebase removed */, 'testComments', existing.id!), {
          comment,
          score,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(null as any /* firebase removed */, 'testComments'), {
          classId,
          studentId,
          studentName,
          testName,
          testDate: '',
          comment,
          score,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error saving test comment:', error);
    } finally {
      setSaving(null);
    }
  };

  // Add new test
  const handleAddTest = async () => {
    if (!newTestName.trim()) {
      alert('Vui lòng nhập tên bài test!');
      return;
    }

    setAddingTest(true);
    try {
      // Create test records for all students
      for (const student of students) {
        await addDoc(collection(null as any /* firebase removed */, 'testComments'), {
          classId,
          studentId: student.id,
          studentName: student.fullName,
          testName: newTestName,
          testDate: newTestDate,
          unit: newTestUnit,
          book: newTestBook,
          comment: '',
          score: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      setShowAddTestModal(false);
      setNewTestName('');
      setNewTestDate('');
      setNewTestUnit('');
      setNewTestBook('');
    } catch (error) {
      console.error('Error adding test:', error);
      alert('Có lỗi xảy ra khi thêm bài test!');
    } finally {
      setAddingTest(false);
    }
  };

  // Delete test
  const handleDeleteTest = async (testName: string) => {
    setDeleting(true);
    try {
      // Get all records for this test
      const q = query(
        collection(null as any /* firebase removed */, 'testComments'),
        where('classId', '==', classId),
        where('testName', '==', testName)
      );
      const snapshot = await getDocs(q);

      // Delete all records
      for (const docSnap of snapshot.docs) {
        await deleteDoc(doc(null as any /* firebase removed */, 'testComments', docSnap.id));
      }

      setTestToDelete(null);
    } catch (error) {
      console.error('Error deleting test:', error);
      alert('Có lỗi xảy ra khi xóa bài test!');
    } finally {
      setDeleting(false);
    }
  };

  // Open template modal
  const handleOpenTemplateModal = (testName: string) => {
    setCurrentTestForTemplate(testName);
    setShowTemplateModal(true);
  };

  // Open detailed edit modal with auto-fill from template
  const openDetailedEdit = (testComment: TestComment) => {
    const template = testTemplates[testComment.testName];

    // Create pre-filled comment with template data for empty fields
    const prefilledComment: TestComment = {
      ...testComment,
      listeningScore: testComment.listeningScore || { score: 0, maxScore: 13 },
      readingWritingScore: testComment.readingWritingScore || { score: 0, maxScore: 35 },
      speakingScore: testComment.speakingScore || { score: 0, maxScore: 10 },
      videoLink: testComment.videoLink || '',
      teacherName: testComment.teacherName || ''
    };

    // Auto-fill from template if student fields are empty
    if (template) {
      if (!testComment.content?.listening && !testComment.content?.readingWriting && !testComment.content?.speaking) {
        prefilledComment.content = template.content;
      }
      if (!testComment.strengths?.listening && !testComment.strengths?.readingWriting && !testComment.strengths?.speaking) {
        prefilledComment.strengths = template.strengths;
      }
      if (!testComment.improvements?.listening && !testComment.improvements?.readingWriting && !testComment.improvements?.speaking) {
        prefilledComment.improvements = template.improvements;
      }
      if (!testComment.learningAttitude && template.learningAttitude) {
        prefilledComment.learningAttitude = template.learningAttitude;
      }
      if (!testComment.parentMessage && template.parentMessage) {
        prefilledComment.parentMessage = template.parentMessage;
      }
    }

    setEditingComment(prefilledComment);
  };

  // Check if a test comment has detailed data (for showing PDF button)
  const hasDetailedData = (tc: TestComment): boolean => {
    return !!(tc.listeningScore || tc.readingWritingScore || tc.speakingScore ||
              tc.content?.listening || tc.strengths?.listening || tc.improvements?.listening ||
              tc.learningAttitude || tc.parentMessage);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
        <span className="ml-3 text-gray-500">Đang tải bài test...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Add Test button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {testNames.length} bài test • {students.length} học sinh
        </p>
        <button
          onClick={() => setShowAddTestModal(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 text-sm"
        >
          <Plus size={16} />
          Thêm bài Test
        </button>
      </div>

      {/* Test list */}
      {testNames.length === 0 ? (
        <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg">
          <Award className="mx-auto mb-2 text-gray-300" size={48} />
          <p>Chưa có bài test nào</p>
          <p className="text-sm mt-1">Bấm "Thêm bài Test" để tạo mới</p>
        </div>
      ) : (
        <div className="space-y-4">
          {testNames.map(testName => {
            const testItems = testComments.filter(t => t.testName === testName);
            const testDate = testItems[0]?.testDate;
            const testUnit = testItems[0]?.unit;
            const testBook = testItems[0]?.book;

            return (
              <div key={testName} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                {/* Test header */}
                <div className="bg-purple-50 px-4 py-3 flex items-center justify-between border-b border-purple-100">
                  <div>
                    <h4 className="font-semibold text-purple-800">{testName}</h4>
                    <div className="flex gap-3 text-xs text-purple-600">
                      {testDate && <span>Ngày: {testDate}</span>}
                      {testUnit && <span>Unit: {testUnit}</span>}
                      {testBook && <span>Book: {testBook}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Template button */}
                    <button
                      onClick={() => handleOpenTemplateModal(testName)}
                      className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5 transition-colors ${
                        testTemplates[testName]
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      title={testTemplates[testName] ? 'Sửa template' : 'Tạo template'}
                    >
                      <Settings size={14} />
                      {testTemplates[testName] ? 'Template ✓' : 'Tạo Template'}
                    </button>
                    {/* Delete button */}
                    <button
                      onClick={() => setTestToDelete(testName)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Xóa bài test"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* Student scores/comments */}
                <div className="divide-y divide-gray-100">
                  {students.map((student, index) => {
                    const existing = testItems.find(t => t.studentId === student.id);
                    const isSaving = saving === `${testName}-${student.id}` || saving === existing?.id;
                    const hasDetail = existing ? hasDetailedData(existing) : false;

                    return (
                      <div key={student.id} className="p-4 flex items-start gap-4">
                        <div className="w-36 flex-shrink-0">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-xs">
                              {index + 1}
                            </span>
                            <span className="font-medium text-gray-800 truncate">
                              {student.fullName}
                            </span>
                          </div>
                        </div>

                        {/* Quick score input */}
                        <div className="w-16 flex-shrink-0">
                          <input
                            type="number"
                            defaultValue={existing?.score ?? ''}
                            placeholder="Điểm"
                            min={0}
                            max={10}
                            step={0.5}
                            onBlur={(e) => handleSaveQuickComment(
                              testName,
                              student.id,
                              student.fullName,
                              existing?.comment || '',
                              e.target.value ? parseFloat(e.target.value) : null
                            )}
                            className="w-full px-2 py-2 border border-gray-300 rounded text-sm text-center focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          />
                        </div>

                        {/* Quick comment input */}
                        <div className="flex-1">
                          <textarea
                            defaultValue={existing?.comment || ''}
                            placeholder="Nhận xét nhanh..."
                            rows={2}
                            onBlur={(e) => handleSaveQuickComment(
                              testName,
                              student.id,
                              student.fullName,
                              e.target.value,
                              existing?.score ?? null
                            )}
                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          />
                        </div>

                        {/* Action buttons */}
                        <div className="flex-shrink-0 flex items-center gap-2">
                          {/* Edit detail button */}
                          {existing && (
                            <button
                              onClick={() => openDetailedEdit(existing)}
                              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Nhận xét chi tiết"
                            >
                              <Edit2 size={18} />
                            </button>
                          )}

                          {/* Detail indicator - PDF export is in edit modal */}
                          {existing && hasDetail && (
                            <span className="text-xs text-green-600 px-2 py-1 bg-green-50 rounded" title="Có dữ liệu chi tiết">
                              Chi tiết ✓
                            </span>
                          )}

                          {/* Saving indicator */}
                          {isSaving && (
                            <div className="animate-spin rounded-full h-4 w-4 border border-purple-600 border-t-transparent"></div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Test Modal */}
      {showAddTestModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">Thêm bài Test mới</h3>
              <button
                onClick={() => setShowAddTestModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tên bài Test *
                </label>
                <input
                  type="text"
                  value={newTestName}
                  onChange={(e) => setNewTestName(e.target.value)}
                  placeholder="VD: PROGRESS TEST"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={newTestUnit}
                    onChange={(e) => setNewTestUnit(e.target.value)}
                    placeholder="VD: UNIT 1,2,3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Book
                  </label>
                  <input
                    type="text"
                    value={newTestBook}
                    onChange={(e) => setNewTestBook(e.target.value)}
                    placeholder="VD: Academy stars 1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ngày Test
                </label>
                <input
                  type="date"
                  value={newTestDate}
                  onChange={(e) => setNewTestDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="p-3 bg-blue-50 text-blue-700 text-sm rounded-lg">
                Sẽ tạo bản ghi cho {students.length} học sinh trong lớp {className}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowAddTestModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Hủy
              </button>
              <button
                onClick={handleAddTest}
                disabled={addingTest || !newTestName.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {addingTest ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Đang tạo...
                  </>
                ) : (
                  <>
                    <Plus size={18} />
                    Thêm bài Test
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Delete Confirmation Modal */}
      {testToDelete && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <AlertTriangle className="text-red-500" size={24} />
                Xác nhận xóa
              </h3>
            </div>

            <div className="p-4">
              <p className="text-gray-600">
                Bạn có chắc chắn muốn xóa bài test <strong>"{testToDelete}"</strong>?
              </p>
              <p className="text-sm text-red-500 mt-2">
                Hành động này sẽ xóa tất cả điểm và nhận xét của {students.length} học sinh và không thể hoàn tác.
              </p>
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setTestToDelete(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Hủy
              </button>
              <button
                onClick={() => handleDeleteTest(testToDelete)}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Đang xóa...
                  </>
                ) : (
                  <>
                    <Trash2 size={18} />
                    Xóa bài Test
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Detailed Edit Modal */}
      {editingComment && (
        <TestCommentEditModal
          comment={editingComment}
          onClose={() => setEditingComment(null)}
          onSaved={() => setEditingComment(null)}
        />
      )}

      {/* Template Modal */}
      <TestCommentTemplateModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        testName={currentTestForTemplate}
        className={className}
        classId={classId}
        existingTemplate={testTemplates[currentTestForTemplate]}
        onSaved={() => {}}
      />
    </div>
  );
};

export default TestCommentTab;
