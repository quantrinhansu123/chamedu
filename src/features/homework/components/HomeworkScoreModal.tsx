import React, { useState } from 'react';
import { X, Save, Plus } from 'lucide-react';
import { ModalPortal } from '@/components/modal-portal';

export interface HomeworkScoreStatus {
  value: string;
  label: string;
  color: string;
  textColor: string;
}

export interface HomeworkScoreItem {
  id: string;
  name: string;
}

export interface HomeworkScoreStudentRecord {
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

interface HomeworkScoreModalProps {
  className: string;
  sessionLabel: string;
  homeworks: HomeworkScoreItem[];
  studentRecords: HomeworkScoreStudentRecord[];
  statuses: HomeworkScoreStatus[];
  saving?: boolean;
  allowAddHomework?: boolean;
  onAddHomework?: (name: string) => void;
  onStatusChange: (studentId: string, homeworkId: string, status: string) => void;
  onScoreChange: (studentId: string, homeworkId: string, score: string) => void;
  onNoteChange: (studentId: string, note: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export const HomeworkScoreModal: React.FC<HomeworkScoreModalProps> = ({
  className,
  sessionLabel,
  homeworks,
  studentRecords,
  statuses,
  saving = false,
  allowAddHomework = false,
  onAddHomework,
  onStatusChange,
  onScoreChange,
  onNoteChange,
  onSave,
  onClose,
}) => {
  const [newHomeworkName, setNewHomeworkName] = useState('');

  const getStatusStyle = (status: string) => {
    const found = statuses.find((s) => s.value === status);
    return found || { color: 'bg-gray-300', textColor: 'text-gray-700', label: status };
  };

  const handleAddHomework = () => {
    const name = newHomeworkName.trim();
    if (!name || !onAddHomework) return;
    onAddHomework(name);
    setNewHomeworkName('');
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-start justify-between gap-3 shrink-0">
            <div>
              <h3 className="text-lg font-bold text-gray-800">Nhập điểm BTVN</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {className}
                {sessionLabel ? ` · ${sessionLabel}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1"
              aria-label="Đóng"
            >
              <X size={22} />
            </button>
          </div>

          {allowAddHomework && (
            <div className="px-4 py-3 border-b border-gray-100 bg-slate-50 flex gap-2 shrink-0">
              <input
                type="text"
                value={newHomeworkName}
                onChange={(e) => setNewHomeworkName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddHomework()}
                placeholder="Thêm tên bài tập..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddHomework}
                disabled={!newHomeworkName.trim()}
                className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Plus size={16} />
                Thêm bài
              </button>
            </div>
          )}

          <div className="overflow-auto flex-1">
            {homeworks.length === 0 ? (
              <div className="p-10 text-center text-gray-400">
                {allowAddHomework
                  ? 'Thêm bài tập ở trên để bắt đầu nhập điểm.'
                  : 'Chưa có bài tập. Vui lòng thêm bài tập trước khi nhập điểm.'}
              </div>
            ) : studentRecords.length === 0 ? (
              <div className="p-10 text-center text-gray-400">Không có học sinh trong lớp này</div>
            ) : (
              <table className="w-full min-w-[720px]">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 border-b w-12">
                      STT
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 border-b min-w-[140px]">
                      Học sinh
                    </th>
                    {homeworks.map((hw) => (
                      <th
                        key={hw.id}
                        className="px-3 py-3 text-center text-xs font-semibold text-gray-600 border-b min-w-[180px]"
                      >
                        {hw.name}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 border-b min-w-[160px]">
                      Ghi chú
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {studentRecords.map((record, idx) => (
                    <tr key={record.studentId} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-sm text-gray-500">{idx + 1}</td>
                      <td className="px-3 py-2.5 text-sm font-medium text-gray-900">
                        {record.studentName}
                      </td>
                      {homeworks.map((hw) => {
                        const hwRecord = record.homeworks[hw.id] || {
                          status: 'not_completed',
                          score: null,
                        };
                        const statusStyle = getStatusStyle(hwRecord.status);
                        return (
                          <td key={hw.id} className="px-3 py-2.5">
                            <div className="flex flex-col gap-1.5">
                              <select
                                value={hwRecord.status}
                                onChange={(e) =>
                                  onStatusChange(record.studentId, hw.id, e.target.value)
                                }
                                className={`w-full px-2 py-1.5 rounded-lg text-xs font-medium ${statusStyle.color} ${statusStyle.textColor} border-0 cursor-pointer text-center`}
                              >
                                {statuses.map((s) => (
                                  <option key={s.value} value={s.value}>
                                    {s.label}
                                  </option>
                                ))}
                              </select>
                              <div className="flex items-center gap-1.5">
                                <label className="text-[10px] text-gray-400 shrink-0">Điểm</label>
                                <input
                                  type="number"
                                  min={0}
                                  max={10}
                                  step={0.5}
                                  value={hwRecord.score ?? ''}
                                  onChange={(e) =>
                                    onScoreChange(record.studentId, hw.id, e.target.value)
                                  }
                                  placeholder="—"
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                              </div>
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5">
                        <input
                          type="text"
                          value={record.note}
                          onChange={(e) => onNoteChange(record.studentId, e.target.value)}
                          placeholder="Ghi chú..."
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3 shrink-0">
            <p className="text-xs text-gray-500">Thang điểm 0–10. Để trống nếu chưa chấm.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white text-sm font-medium"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={saving || homeworks.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Lưu điểm
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
