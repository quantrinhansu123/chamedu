/**
 * Feedback Manager Page
 * Quản lý phản hồi phụ huynh (Gọi điện + Form khảo sát)
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Phone, FileText, Plus, Search, X, Star, Trash2, CheckCircle } from 'lucide-react';
import { ModalPortal } from '@/components/modal-portal';
import { useFeedback } from '../src/hooks/useFeedback';
import { useStudents } from '../src/hooks/useStudents';
import { useClasses } from '../src/hooks/useClasses';
import { useAuth } from '../src/hooks/useAuth';
import {
  FeedbackRecord,
  FeedbackType,
  FeedbackStatus,
  DEFAULT_CALL_STATUSES,
} from '../src/services/feedbackService';
import { Student } from '../types';

const StatusCombobox: React.FC<{
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
}> = ({ value, options, onChange, placeholder }) => {
  const [open, setOpen] = useState(false);
  const suggestions = useMemo(() => {
    const term = value.trim().toLowerCase();
    const matched = options.filter((o) => !term || o.toLowerCase().includes(term));
    if (value.trim() && !options.some((o) => o.toLowerCase() === value.trim().toLowerCase())) {
      return [value.trim(), ...matched];
    }
    return matched;
  }, [value, options]);

  return (
    <div className="relative">
      <input
        type="text"
        list="feedback-status-options"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
        autoComplete="off"
      />
      <datalist id="feedback-status-options">
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-indigo-50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(s);
                  setOpen(false);
                }}
              >
                {s}
                {!options.includes(s) && (
                  <span className="ml-2 text-xs text-indigo-500">(mới)</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const FeedbackManager: React.FC = () => {
  const { feedbacks, callFeedbacks, formFeedbacks, loading, error, createFeedback, updateStatus, deleteFeedback } = useFeedback();
  
  const [activeTab, setActiveTab] = useState<'call' | 'form'>('call');
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa phản hồi này?')) return;
    try {
      await deleteFeedback(id);
    } catch (err) {
      alert('Không thể xóa');
    }
  };

  const handleStatusChange = async (id: string, status: FeedbackStatus) => {
    try {
      await updateStatus(id, status);
    } catch (err) {
      alert('Không thể cập nhật trạng thái');
    }
  };

  // Filter by search
  const filteredCalls = callFeedbacks.filter(f => 
    f.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.className.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const filteredForms = formFeedbacks.filter(f => 
    f.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.className.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusOptions = useMemo(() => {
    const fromData = callFeedbacks.map((f) => f.status).filter(Boolean);
    return [...new Set([...DEFAULT_CALL_STATUSES, ...fromData])];
  }, [callFeedbacks]);

  const satisfiedCount = callFeedbacks.filter((f) => f.status === 'Hài lòng').length;
  const unsatisfiedCount = callFeedbacks.filter((f) => f.status === 'Không hài lòng').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-gray-800">Quản lý phản hồi phụ huynh</h2>
            <div className="flex gap-2">
              <span className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
                Hài lòng: {satisfiedCount}
              </span>
              <span className="text-sm bg-red-100 text-red-700 px-3 py-1 rounded-full font-medium">
                Không hài lòng: {unsatisfiedCount}
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Tìm kiếm..."
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium"
            >
              <Plus size={16} /> Thêm mới
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mt-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('call')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'call'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Phone size={16} />
            Gọi điện ({callFeedbacks.length})
          </button>
          <button
            onClick={() => setActiveTab('form')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'form'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText size={16} />
            Form khảo sát ({formFeedbacks.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
              Đang tải...
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500">Lỗi: {error}</div>
        ) : activeTab === 'call' ? (
          /* Call Feedbacks Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-600">
                <tr>
                  <th className="px-4 py-3">Ngày</th>
                  <th className="px-4 py-3">Học sinh</th>
                  <th className="px-4 py-3">Lớp</th>
                  <th className="px-4 py-3">Người gọi</th>
                  <th className="px-4 py-3">Nội dung</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                  <th className="px-4 py-3 text-center w-20">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCalls.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400">
                      <Phone size={48} className="mx-auto mb-2 opacity-20" />
                      Chưa có lịch gọi điện nào
                    </td>
                  </tr>
                ) : filteredCalls.map((fb) => (
                  <tr key={fb.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{fb.date}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{fb.studentName}</td>
                    <td className="px-4 py-3">{fb.className}</td>
                    <td className="px-4 py-3">{fb.caller || '-'}</td>
                    <td className="px-4 py-3 max-w-xs truncate">{fb.content || '-'}</td>
                    <td className="px-4 py-3 text-center min-w-[140px]">
                      <select
                        value={fb.status}
                        onChange={(e) => fb.id && handleStatusChange(fb.id, e.target.value)}
                        className={`px-2 py-1 rounded text-xs font-medium border-0 cursor-pointer max-w-[160px] ${
                          fb.status === 'Hài lòng' ? 'bg-green-100 text-green-700' :
                          fb.status === 'Không hài lòng' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {statusOptions.includes(fb.status) ? null : (
                          <option value={fb.status}>{fb.status}</option>
                        )}
                        {statusOptions.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => fb.id && handleDelete(fb.id)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Form Feedbacks Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-600">
                <tr>
                  <th className="px-4 py-3">Ngày</th>
                  <th className="px-4 py-3">Học sinh</th>
                  <th className="px-4 py-3">Lớp</th>
                  <th className="px-4 py-3 text-center">Giáo viên</th>
                  <th className="px-4 py-3 text-center">Chương trình</th>
                  <th className="px-4 py-3 text-center">Chăm sóc</th>
                  <th className="px-4 py-3 text-center">Cơ sở VC</th>
                  <th className="px-4 py-3 text-center">TB</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                  <th className="px-4 py-3 text-center w-20">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredForms.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-gray-400">
                      <FileText size={48} className="mx-auto mb-2 opacity-20" />
                      Chưa có form khảo sát nào
                    </td>
                  </tr>
                ) : filteredForms.map((fb) => (
                  <tr key={fb.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{fb.date}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{fb.studentName}</td>
                    <td className="px-4 py-3">{fb.className}</td>
                    <td className="px-4 py-3 text-center">
                      <ScoreBadge score={fb.teacherScore} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ScoreBadge score={fb.curriculumScore} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ScoreBadge score={fb.careScore} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ScoreBadge score={fb.facilitiesScore} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded font-bold text-sm ${
                        (fb.averageScore || 0) >= 8 ? 'bg-green-100 text-green-700' :
                        (fb.averageScore || 0) >= 6 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {fb.averageScore?.toFixed(1) || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        fb.status === 'Hoàn thành' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {fb.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => fb.id && handleDelete(fb.id)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showModal && (
        <FeedbackModal
          statusOptions={statusOptions}
          onClose={() => setShowModal(false)}
          onSubmit={async (data) => {
            await createFeedback(data);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
};

// Score Badge Component
const ScoreBadge: React.FC<{ score?: number }> = ({ score }) => {
  if (!score) return <span className="text-gray-400">-</span>;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
      score >= 8 ? 'bg-green-100 text-green-700' :
      score >= 6 ? 'bg-yellow-100 text-yellow-700' :
      'bg-red-100 text-red-700'
    }`}>
      <Star size={12} fill="currentColor" />
      {score}
    </span>
  );
};

// Feedback Modal
interface FeedbackModalProps {
  statusOptions: string[];
  onClose: () => void;
  onSubmit: (data: Omit<FeedbackRecord, 'id'>) => Promise<void>;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ statusOptions, onClose, onSubmit }) => {
  const { students } = useStudents();
  const { classes } = useClasses();
  const { staffData, user } = useAuth();

  const [formData, setFormData] = useState({
    type: 'Call' as FeedbackType,
    date: new Date().toISOString().split('T')[0],
    studentId: '',
    studentName: '',
    classId: '',
    className: '',
    caller: '',
    content: '',
    teacherScore: 8,
    curriculumScore: 8,
    careScore: 8,
    facilitiesScore: 8,
    status: DEFAULT_CALL_STATUSES[0] as FeedbackStatus,
  });
  const [loading, setLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [showStudentSuggestions, setShowStudentSuggestions] = useState(false);
  const studentSearchRef = useRef<HTMLDivElement>(null);

  const activeClasses = useMemo(
    () => [...classes].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [classes]
  );

  const studentsInClass = useMemo(() => {
    if (!formData.classId && !formData.className) return [];
    const cls = classes.find(
      (c) => c.id === formData.classId || c.name === formData.className
    );
    if (!cls) return [];

    return students.filter((s) => {
      if (s.classId === cls.id) return true;
      if (s.classIds?.includes(cls.id)) return true;
      if (s.class === cls.name) return true;
      return false;
    });
  }, [students, classes, formData.classId, formData.className]);

  const filteredStudents = useMemo(() => {
    if (!formData.classId) return [];
    const searchLower = studentSearch.trim().toLowerCase();
    const pool = searchLower
      ? studentsInClass.filter(
          (s) =>
            s.fullName?.toLowerCase().includes(searchLower) ||
            (s as any).name?.toLowerCase().includes(searchLower) ||
            s.code?.toLowerCase().includes(searchLower)
        )
      : studentsInClass;
    return pool.slice(0, 15);
  }, [studentsInClass, studentSearch, formData.classId]);

  useEffect(() => {
    const callerName = staffData?.name || user?.displayName || '';
    if (callerName) {
      setFormData((prev) => (prev.caller ? prev : { ...prev, caller: callerName }));
    }
  }, [staffData, user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (studentSearchRef.current && !studentSearchRef.current.contains(event.target as Node)) {
        setShowStudentSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClassChange = (classId: string) => {
    const cls = classes.find((c) => c.id === classId);
    setFormData((prev) => ({
      ...prev,
      classId: cls?.id || '',
      className: cls?.name || '',
      studentId: '',
      studentName: '',
    }));
    setStudentSearch('');
    setShowStudentSuggestions(false);
  };

  const handleSelectStudent = (student: Student) => {
    const name = student.fullName || (student as any).name || '';
    setStudentSearch(name);
    setFormData((prev) => ({
      ...prev,
      studentId: student.id,
      studentName: name,
    }));
    setShowStudentSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.className) {
      alert('Vui lòng chọn lớp');
      return;
    }
    if (!formData.studentName) {
      alert('Vui lòng chọn học sinh');
      return;
    }
    if (formData.type === 'Call' && !formData.status.trim()) {
      alert('Vui lòng nhập trạng thái');
      return;
    }
    setLoading(true);
    try {
      await onSubmit({
        ...formData,
        status: formData.type === 'Form' ? 'Hoàn thành' : formData.status.trim(),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h3 className="text-xl font-bold text-gray-800">Thêm phản hồi</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loại</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as FeedbackType })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Call">Gọi điện</option>
              <option value="Form">Form khảo sát</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ngày</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lớp *</label>
            <select
              required
              value={formData.classId}
              onChange={(e) => handleClassChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-- Chọn lớp --</option>
              {activeClasses.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>

          <div ref={studentSearchRef} className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên học sinh *</label>
            {!formData.classId ? (
              <input
                type="text"
                disabled
                placeholder="Vui lòng chọn lớp trước"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-400"
              />
            ) : (
              <>
                <input
                  type="text"
                  required
                  value={studentSearch}
                  onChange={(e) => {
                    setStudentSearch(e.target.value);
                    setShowStudentSuggestions(true);
                    if (!e.target.value) {
                      setFormData((prev) => ({ ...prev, studentId: '', studentName: '' }));
                    }
                  }}
                  onFocus={() => setShowStudentSuggestions(true)}
                  onBlur={() => {
                    setTimeout(() => {
                      setShowStudentSuggestions(false);
                      if (!formData.studentId && studentSearch.trim()) {
                        const match = studentsInClass.find(
                          (s) =>
                            (s.fullName || (s as any).name)?.toLowerCase() ===
                            studentSearch.trim().toLowerCase()
                        );
                        if (match) handleSelectStudent(match);
                      }
                    }, 150);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Chọn hoặc gõ tên học sinh..."
                  autoComplete="off"
                />
                {showStudentSuggestions && filteredStudents.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredStudents.map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => handleSelectStudent(student)}
                        className="w-full px-4 py-2 text-left hover:bg-indigo-50 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {student.fullName || (student as any).name}
                          </p>
                          <p className="text-xs text-gray-500">{student.code}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          student.status === 'Đang học' ? 'bg-green-100 text-green-700' :
                          student.status === 'Bảo lưu' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {student.status}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {showStudentSuggestions && formData.classId && filteredStudents.length === 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500 text-sm">
                    {studentSearch.trim() ? 'Không tìm thấy học sinh trong lớp này' : 'Lớp chưa có học sinh'}
                  </div>
                )}
              </>
            )}
          </div>

          {formData.type === 'Call' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Người gọi</label>
                <input
                  type="text"
                  value={formData.caller}
                  onChange={(e) => setFormData({ ...formData, caller: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                  placeholder="Tự điền người đang nhập"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
                <StatusCombobox
                  value={formData.status}
                  options={statusOptions}
                  onChange={(status) => setFormData({ ...formData, status })}
                  placeholder="Hài lòng / Không hài lòng..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Giáo viên</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={formData.teacherScore}
                  onChange={(e) => setFormData({ ...formData, teacherScore: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chương trình</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={formData.curriculumScore}
                  onChange={(e) => setFormData({ ...formData, curriculumScore: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chăm sóc KH</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={formData.careScore}
                  onChange={(e) => setFormData({ ...formData, careScore: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cơ sở vật chất</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={formData.facilitiesScore}
                  onChange={(e) => setFormData({ ...formData, facilitiesScore: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Đang lưu...' : 'Thêm'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
};
