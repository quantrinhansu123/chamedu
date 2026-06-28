import { collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, writeBatch, runTransaction, arrayUnion, Timestamp, db } from '@/src/utils/legacyFirestoreStub';
/**
 * Test Comment Template Modal
 *
 * Modal for creating/editing class-level templates for test comments.
 * Templates auto-fill when editing individual student comments.
 */

import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { TestTemplate, SkillContent } from '../../../../types';
import { ModalPortal } from '@/components/modal-portal';

type TemplateTab = 'content' | 'strengths' | 'improvements' | 'attitude';

export interface TestCommentTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  testName: string;
  className: string;
  classId: string;
  existingTemplate?: TestTemplate;
  onSaved: () => void;
}

export const TestCommentTemplateModal: React.FC<TestCommentTemplateModalProps> = ({
  isOpen,
  onClose,
  testName,
  className,
  classId,
  existingTemplate,
  onSaved
}) => {
  const [templateTab, setTemplateTab] = useState<TemplateTab>('content');
  const [templateFormData, setTemplateFormData] = useState<Partial<TestTemplate>>(existingTemplate || {});
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Reset form when modal opens with new template
  React.useEffect(() => {
    setTemplateFormData(existingTemplate || {});
    setTemplateTab('content');
  }, [existingTemplate, isOpen]);

  // Save template to Firestore
  const handleSaveTemplate = async () => {
    if (!testName || !classId) return;

    setSavingTemplate(true);
    try {
      const templateData = {
        ...templateFormData,
        testName,
        classId,
        updatedAt: new Date().toISOString(),
      };

      if (existingTemplate?.id) {
        // Update existing
        await updateDoc(doc(null as any /* firebase removed */, 'testTemplates', existingTemplate.id), templateData);
      } else {
        // Create new
        await addDoc(collection(null as any /* firebase removed */, 'testTemplates'), {
          ...templateData,
          createdAt: new Date().toISOString(),
        });
      }

      onSaved();
      onClose();
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Có lỗi xảy ra khi lưu template!');
    } finally {
      setSavingTemplate(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl my-8">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-800">
              Template cho bài Test
            </h3>
            <p className="text-sm text-gray-500">
              {testName} - {className}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-4">
          <div className="flex gap-1 overflow-x-auto">
            {[
              { id: 'content', label: 'Nội dung' },
              { id: 'strengths', label: 'Làm tốt' },
              { id: 'improvements', label: 'Cần cải thiện' },
              { id: 'attitude', label: 'Thái độ & Nhắn nhủ' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setTemplateTab(tab.id as TemplateTab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  templateTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {/* Info Banner */}
          <div className="p-3 bg-blue-50 text-blue-700 text-sm rounded-lg mb-4">
            Nội dung này sẽ tự động điền cho tất cả học sinh khi mở form chi tiết (chỉ điền vào các trường trống)
          </div>

          {/* Content Tab */}
          {templateTab === 'content' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Listening (Nghe)</label>
                <textarea
                  value={(templateFormData.content as SkillContent)?.listening || ''}
                  onChange={(e) => setTemplateFormData(prev => ({
                    ...prev,
                    content: { ...(prev.content as SkillContent || {}), listening: e.target.value }
                  }))}
                  rows={4}
                  placeholder="Bao gồm 4 phần dựa theo cấu trúc bài thi Starters:&#10;- Phần 1: Nghe và điền số thứ tự..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reading and Writing (Đọc và Viết)</label>
                <textarea
                  value={(templateFormData.content as SkillContent)?.readingWriting || ''}
                  onChange={(e) => setTemplateFormData(prev => ({
                    ...prev,
                    content: { ...(prev.content as SkillContent || {}), readingWriting: e.target.value }
                  }))}
                  rows={4}
                  placeholder="- Ngữ pháp: Động từ to be: am/is/are...&#10;- Đọc hiểu: đọc hiểu cấp độ Starters..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Speaking (Nói)</label>
                <textarea
                  value={(templateFormData.content as SkillContent)?.speaking || ''}
                  onChange={(e) => setTemplateFormData(prev => ({
                    ...prev,
                    content: { ...(prev.content as SkillContent || {}), speaking: e.target.value }
                  }))}
                  rows={4}
                  placeholder="Bao gồm 3 phần:&#10;- Phần 1: Trả lời các câu hỏi cá nhân..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Strengths Tab */}
          {templateTab === 'strengths' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Listening (Nghe)</label>
                <textarea
                  value={(templateFormData.strengths as SkillContent)?.listening || ''}
                  onChange={(e) => setTemplateFormData(prev => ({
                    ...prev,
                    strengths: { ...(prev.strengths as SkillContent || {}), listening: e.target.value }
                  }))}
                  rows={4}
                  placeholder="- Con làm tốt nội dung phần nghe..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reading and Writing (Đọc và Viết)</label>
                <textarea
                  value={(templateFormData.strengths as SkillContent)?.readingWriting || ''}
                  onChange={(e) => setTemplateFormData(prev => ({
                    ...prev,
                    strengths: { ...(prev.strengths as SkillContent || {}), readingWriting: e.target.value }
                  }))}
                  rows={4}
                  placeholder="- Con làm đúng phần chọn từ khác biệt...&#10;- Phần sắp xếp câu (5/5) đều chính xác..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Speaking (Nói)</label>
                <textarea
                  value={(templateFormData.strengths as SkillContent)?.speaking || ''}
                  onChange={(e) => setTemplateFormData(prev => ({
                    ...prev,
                    strengths: { ...(prev.strengths as SkillContent || {}), speaking: e.target.value }
                  }))}
                  rows={4}
                  placeholder="- Pronunciation (Phát âm): Con phát âm khá tốt...&#10;- Reflexes (Phản xạ): Con có phản xạ nhanh nhạy..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Improvements Tab */}
          {templateTab === 'improvements' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Listening (Nghe)</label>
                <textarea
                  value={(templateFormData.improvements as SkillContent)?.listening || ''}
                  onChange={(e) => setTemplateFormData(prev => ({
                    ...prev,
                    improvements: { ...(prev.improvements as SkillContent || {}), listening: e.target.value }
                  }))}
                  rows={4}
                  placeholder="- Phần nghe và điền từ, có hai câu con điền sai do chưa nghe được từ cần điền..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reading and Writing (Đọc và Viết)</label>
                <textarea
                  value={(templateFormData.improvements as SkillContent)?.readingWriting || ''}
                  onChange={(e) => setTemplateFormData(prev => ({
                    ...prev,
                    improvements: { ...(prev.improvements as SkillContent || {}), readingWriting: e.target.value }
                  }))}
                  rows={4}
                  placeholder="- Con cần chú ý sử dụng dấu chấm (.) và viết hoa chữ cái đầu câu..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Speaking (Nói)</label>
                <textarea
                  value={(templateFormData.improvements as SkillContent)?.speaking || ''}
                  onChange={(e) => setTemplateFormData(prev => ({
                    ...prev,
                    improvements: { ...(prev.improvements as SkillContent || {}), speaking: e.target.value }
                  }))}
                  rows={4}
                  placeholder="- Con cần chú ý phát âm thêm một số từ..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Attitude Tab */}
          {templateTab === 'attitude' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thái độ học tập của con trong quá trình học vừa rồi</label>
                <textarea
                  value={templateFormData.learningAttitude || ''}
                  onChange={(e) => setTemplateFormData(prev => ({ ...prev, learningAttitude: e.target.value }))}
                  rows={6}
                  placeholder="Anna là học sinh có ý thức chuyên cần tốt, con luôn tham gia đầy đủ các buổi học và đến lớp đúng giờ..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lời nhắn nhủ phụ huynh</label>
                <textarea
                  value={templateFormData.parentMessage || ''}
                  onChange={(e) => setTemplateFormData(prev => ({ ...prev, parentMessage: e.target.value }))}
                  rows={4}
                  placeholder="Trong thời gian tới, các con sẽ học đến các phần từ vựng và ngữ pháp khó hơn, cô mong rằng bố mẹ có thể đồng hành và sát cánh cùng con..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Hủy
          </button>
          <button
            onClick={handleSaveTemplate}
            disabled={savingTemplate}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            {savingTemplate ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Đang lưu...
              </>
            ) : (
              <>
                <Save size={18} />
                Lưu Template
              </>
            )}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

export default TestCommentTemplateModal;
