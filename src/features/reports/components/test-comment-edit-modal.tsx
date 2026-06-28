/**
 * Test Comment Edit Modal
 *
 * Modal for editing detailed test comments per student.
 * Includes scores, content descriptions, strengths, improvements, and attitude.
 */

import { doc, updateDoc } from '@/src/utils/legacyFirestoreStub';
import React, { useState, useEffect } from 'react';
import { X, Save, Download, Award, FileText, Printer } from 'lucide-react';
import { TestComment, SkillScore, SkillContent } from '../../../../types';
import { generateTestCommentPDF, downloadBlob } from '../../../services/testCommentPdfService';
import { TestCommentPrintPreview } from './test-comment-print-preview';
import { ModalPortal } from '@/components/modal-portal';

type DetailTab = 'scores' | 'content' | 'strengths' | 'improvements' | 'attitude';

export interface TestCommentEditModalProps {
  comment: TestComment;
  onClose: () => void;
  onSaved: () => void;
}

export const TestCommentEditModal: React.FC<TestCommentEditModalProps> = ({
  comment,
  onClose,
  onSaved
}) => {
  const [editTab, setEditTab] = useState<DetailTab>('scores');
  const [editFormData, setEditFormData] = useState<Partial<TestComment>>({});
  const [saving, setSaving] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // Initialize form data when comment changes
  useEffect(() => {
    setEditFormData({
      ...comment,
      listeningScore: comment.listeningScore || { score: 0, maxScore: 13 },
      readingWritingScore: comment.readingWritingScore || { score: 0, maxScore: 35 },
      speakingScore: comment.speakingScore || { score: 0, maxScore: 10 },
      videoLink: comment.videoLink || '',
      teacherName: comment.teacherName || ''
    });
    setEditTab('scores');
  }, [comment]);

  // Helper to update skill scores
  const updateSkillScore = (
    field: 'listeningScore' | 'readingWritingScore' | 'speakingScore',
    key: 'score' | 'maxScore',
    value: number
  ) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: {
        ...((prev[field] as SkillScore) || {}),
        [key]: value
      }
    }));
  };

  // Helper to update skill content
  const updateSkillContent = (
    field: 'content' | 'strengths' | 'improvements',
    key: 'listening' | 'readingWriting' | 'speaking',
    value: string
  ) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: {
        ...((prev[field] as SkillContent) || {}),
        [key]: value
      }
    }));
  };

  // Save detailed edit
  const handleSaveDetailedEdit = async () => {
    if (!comment.id) return;

    setSaving(true);
    try {
      await updateDoc(doc(null as any /* firebase removed */, 'testComments', comment.id), {
        ...editFormData,
        updatedAt: new Date().toISOString()
      });
      onSaved();
      onClose();
    } catch (error) {
      console.error('Error saving detailed edit:', error);
      alert('Có lỗi xảy ra khi lưu!');
    } finally {
      setSaving(false);
    }
  };

  // Export PDF
  const handleExportPDF = async () => {
    setExportingPdf(true);
    try {
      const dataToExport: TestComment = {
        ...comment,
        ...editFormData
      } as TestComment;

      const blob = await generateTestCommentPDF(dataToExport);
      const filename = `${comment.studentName}_${comment.testName}_${comment.testDate || new Date().toISOString().split('T')[0]}.pdf`;
      downloadBlob(blob, filename);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Có lỗi xảy ra khi xuất PDF!');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl my-8">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Nhận xét chi tiết bài Test</h3>
            <p className="text-sm text-gray-500">{comment.studentName} - {comment.testName}</p>
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
              { id: 'scores', label: 'Điểm số', icon: Award },
              { id: 'content', label: 'Nội dung', icon: FileText },
              { id: 'strengths', label: 'Làm tốt', icon: FileText },
              { id: 'improvements', label: 'Cần cải thiện', icon: FileText },
              { id: 'attitude', label: 'Thái độ & Nhắn nhủ', icon: FileText }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setEditTab(tab.id as DetailTab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  editTab === tab.id
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
          {/* Scores Tab */}
          {editTab === 'scores' && (
            <div className="space-y-6">
              {/* Test info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Link video bài test</label>
                  <input
                    type="url"
                    value={editFormData.videoLink || ''}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, videoLink: e.target.value }))}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Giáo viên</label>
                  <input
                    type="text"
                    value={editFormData.teacherName || ''}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, teacherName: e.target.value }))}
                    placeholder="VD: Ms. Tiên"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Skill scores */}
              <div>
                <h4 className="font-semibold text-gray-800 mb-3">Điểm theo kỹ năng</h4>
                <div className="grid grid-cols-3 gap-4">
                  {/* Listening */}
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h5 className="font-medium text-blue-800 mb-2">Listening (Nghe)</h5>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={(editFormData.listeningScore as SkillScore)?.score || 0}
                        onChange={(e) => updateSkillScore('listeningScore', 'score', parseFloat(e.target.value) || 0)}
                        step={0.5}
                        min={0}
                        className="w-20 px-2 py-2 border border-gray-300 rounded text-center"
                      />
                      <span className="text-gray-500">/</span>
                      <input
                        type="number"
                        value={(editFormData.listeningScore as SkillScore)?.maxScore || 13}
                        onChange={(e) => updateSkillScore('listeningScore', 'maxScore', parseFloat(e.target.value) || 13)}
                        min={1}
                        className="w-20 px-2 py-2 border border-gray-300 rounded text-center"
                      />
                    </div>
                  </div>

                  {/* Reading & Writing */}
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h5 className="font-medium text-green-800 mb-2">Reading & Writing (Đọc và Viết)</h5>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={(editFormData.readingWritingScore as SkillScore)?.score || 0}
                        onChange={(e) => updateSkillScore('readingWritingScore', 'score', parseFloat(e.target.value) || 0)}
                        step={0.5}
                        min={0}
                        className="w-20 px-2 py-2 border border-gray-300 rounded text-center"
                      />
                      <span className="text-gray-500">/</span>
                      <input
                        type="number"
                        value={(editFormData.readingWritingScore as SkillScore)?.maxScore || 35}
                        onChange={(e) => updateSkillScore('readingWritingScore', 'maxScore', parseFloat(e.target.value) || 35)}
                        min={1}
                        className="w-20 px-2 py-2 border border-gray-300 rounded text-center"
                      />
                    </div>
                  </div>

                  {/* Speaking */}
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <h5 className="font-medium text-purple-800 mb-2">Speaking (Nói)</h5>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={(editFormData.speakingScore as SkillScore)?.score || 0}
                        onChange={(e) => updateSkillScore('speakingScore', 'score', parseFloat(e.target.value) || 0)}
                        step={0.5}
                        min={0}
                        className="w-20 px-2 py-2 border border-gray-300 rounded text-center"
                      />
                      <span className="text-gray-500">/</span>
                      <input
                        type="number"
                        value={(editFormData.speakingScore as SkillScore)?.maxScore || 10}
                        onChange={(e) => updateSkillScore('speakingScore', 'maxScore', parseFloat(e.target.value) || 10)}
                        min={1}
                        className="w-20 px-2 py-2 border border-gray-300 rounded text-center"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Content Tab */}
          {editTab === 'content' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 mb-4">Mô tả nội dung bài test theo từng kỹ năng:</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Listening (Nghe)</label>
                <textarea
                  value={(editFormData.content as SkillContent)?.listening || ''}
                  onChange={(e) => updateSkillContent('content', 'listening', e.target.value)}
                  rows={4}
                  placeholder="Bao gồm 4 phần dựa theo cấu trúc bài thi Starters:&#10;- Phần 1: Nghe và điền số thứ tự..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reading and Writing (Đọc và Viết)</label>
                <textarea
                  value={(editFormData.content as SkillContent)?.readingWriting || ''}
                  onChange={(e) => updateSkillContent('content', 'readingWriting', e.target.value)}
                  rows={4}
                  placeholder="- Ngữ pháp: Động từ to be: am/is/are...&#10;- Đọc hiểu: đọc hiểu cấp độ Starters..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Speaking (Nói)</label>
                <textarea
                  value={(editFormData.content as SkillContent)?.speaking || ''}
                  onChange={(e) => updateSkillContent('content', 'speaking', e.target.value)}
                  rows={4}
                  placeholder="Bao gồm 3 phần:&#10;- Phần 1: Trả lời các câu hỏi cá nhân..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Strengths Tab */}
          {editTab === 'strengths' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 mb-4">Nội dung con làm tốt theo từng kỹ năng:</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Listening (Nghe)</label>
                <textarea
                  value={(editFormData.strengths as SkillContent)?.listening || ''}
                  onChange={(e) => updateSkillContent('strengths', 'listening', e.target.value)}
                  rows={4}
                  placeholder="- Con làm tốt nội dung phần nghe..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reading and Writing (Đọc và Viết)</label>
                <textarea
                  value={(editFormData.strengths as SkillContent)?.readingWriting || ''}
                  onChange={(e) => updateSkillContent('strengths', 'readingWriting', e.target.value)}
                  rows={4}
                  placeholder="- Con làm đúng phần chọn từ khác biệt...&#10;- Phần sắp xếp câu (5/5) đều chính xác..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Speaking (Nói)</label>
                <textarea
                  value={(editFormData.strengths as SkillContent)?.speaking || ''}
                  onChange={(e) => updateSkillContent('strengths', 'speaking', e.target.value)}
                  rows={4}
                  placeholder="- Pronunciation (Phát âm): Con phát âm khá tốt...&#10;- Reflexes (Phản xạ): Con có phản xạ nhanh nhạy..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Improvements Tab */}
          {editTab === 'improvements' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 mb-4">Nội dung con cần cải thiện theo từng kỹ năng:</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Listening (Nghe)</label>
                <textarea
                  value={(editFormData.improvements as SkillContent)?.listening || ''}
                  onChange={(e) => updateSkillContent('improvements', 'listening', e.target.value)}
                  rows={4}
                  placeholder="- Phần nghe và điền từ, có hai câu con điền sai do chưa nghe được từ cần điền..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reading and Writing (Đọc và Viết)</label>
                <textarea
                  value={(editFormData.improvements as SkillContent)?.readingWriting || ''}
                  onChange={(e) => updateSkillContent('improvements', 'readingWriting', e.target.value)}
                  rows={4}
                  placeholder="- Task 2, từ 'pencil case', 'picture' con viết sai chính tả..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Speaking (Nói)</label>
                <textarea
                  value={(editFormData.improvements as SkillContent)?.speaking || ''}
                  onChange={(e) => updateSkillContent('improvements', 'speaking', e.target.value)}
                  rows={4}
                  placeholder="- Con hiểu câu hỏi nhưng đôi lúc trả lời hơi chậm...&#10;- Con cần chú ý phát âm các cụm từ 'He's', 'She's'..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Attitude Tab */}
          {editTab === 'attitude' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thái độ học tập của con trong quá trình học vừa rồi</label>
                <textarea
                  value={editFormData.learningAttitude || ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, learningAttitude: e.target.value }))}
                  rows={6}
                  placeholder="Anna là học sinh có ý thức chuyên cần tốt, con luôn tham gia đầy đủ các buổi học và đến lớp đúng giờ..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lời nhắn nhủ phụ huynh</label>
                <textarea
                  value={editFormData.parentMessage || ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, parentMessage: e.target.value }))}
                  rows={4}
                  placeholder="Trong thời gian tới, các con sẽ học đến các phần từ vựng và ngữ pháp khó hơn, cô mong rằng bố mẹ có thể đồng hành và sát cánh cùng con..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div className="p-4 border-t border-gray-200 flex justify-between items-center">
          <div className="flex gap-2">
            <button
              onClick={() => setShowPrintPreview(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
            >
              <Printer size={18} />
              Xem trước & In
            </button>
            <button
              onClick={handleExportPDF}
              disabled={exportingPdf}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {exportingPdf ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Đang xuất...
                </>
              ) : (
                <>
                  <Download size={18} />
                  Xuất PDF
                </>
              )}
            </button>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Hủy
            </button>
            <button
              onClick={handleSaveDetailedEdit}
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Đang lưu...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Lưu nhận xét
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Print Preview Modal */}
      {showPrintPreview && (
        <TestCommentPrintPreview
          comment={{ ...comment, ...editFormData } as TestComment}
          onClose={() => setShowPrintPreview(false)}
          onExportPDF={handleExportPDF}
        />
      )}
    </div>
    </ModalPortal>
  );
};

export default TestCommentEditModal;
