/**
 * StudentsInClassModal Component
 * Modal for managing students enrolled in a class
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Users, Search, UserPlus, UserMinus, ArrowRightLeft } from 'lucide-react';
import { ModalPortal } from '@/components/modal-portal';
import { ClassModel, Student, StudentStatus } from '@/types';
import { StudentService } from '@/src/services/studentService';
import { createEnrollment } from '@/src/services/enrollmentService';
import { TransferClassModal } from '@/src/features/students/components/TransferClassModal';
import { useClasses } from '@/src/hooks/useClasses';
import { useAuth } from '@/src/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { getStudentSessionData } from '@/src/utils/student-session-utils';
import { sanitizeFirebaseError } from '@/src/utils/errorUtils';
import { isSupabaseConfigured } from '@/src/config/supabase';

const isStudentInClass = (student: Student, classData: ClassModel): boolean =>
  student.classId === classData.id ||
  (student.classIds || []).includes(classData.id) ||
  student.class === classData.name;

export interface StudentsInClassModalProps {
  classData: ClassModel;
  onClose: () => void;
  onUpdate: () => void;
}

export const StudentsInClassModal: React.FC<StudentsInClassModalProps> = ({ classData, onClose, onUpdate }) => {
  const navigate = useNavigate();
  const [studentsInClass, setStudentsInClass] = useState<Student[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Transfer class modal state
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedStudentToTransfer, setSelectedStudentToTransfer] = useState<any>(null);
  const { classes: allClasses } = useClasses({});
  const { staffData } = useAuth();

  // Normalize student status
  const normalizeStatus = (status: string): string => {
    const map: { [key: string]: string } = {
      'Active': 'Đang học', 'active': 'Đang học',
      'Trial': 'Học thử', 'trial': 'Học thử',
      'Reserved': 'Bảo lưu', 'reserved': 'Bảo lưu',
      'Debt': 'Nợ phí', 'debt': 'Nợ phí',
      'Dropped': 'Nghỉ học', 'dropped': 'Nghỉ học',
    };
    return map[status] || status;
  };

  const getStatusColor = (status: string) => {
    const normalized = normalizeStatus(status);
    switch (normalized) {
      case 'Đang học': return 'bg-green-100 text-green-700';
      case 'Học thử': return 'bg-purple-100 text-purple-700';
      case 'Nợ phí': return 'bg-red-100 text-red-700';
      case 'Bảo lưu': return 'bg-orange-100 text-orange-700';
      case 'Nghỉ học': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const fetchStudents = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const students = await StudentService.getStudents();
      const inClass = students.filter((s) => isStudentInClass(s, classData));
      const notInClass = students.filter((s) => !isStudentInClass(s, classData));
      setStudentsInClass(inClass);
      setAllStudents(notInClass);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  }, [classData]);

  useEffect(() => {
    fetchStudents();
    const timer = setInterval(fetchStudents, 15000);
    return () => clearInterval(timer);
  }, [fetchStudents]);

  // Add student directly without prompting for session count.
  const addStudentToClass = async (student: Student) => {
    if (adding) return;
    setAdding(true);
    try {
      const classIds = student.classIds || [];
      const newClassIds = classIds.includes(classData.id) ? classIds : [...classIds, classData.id];

      await StudentService.updateStudent(student.id, {
        classId: classData.id,
        class: classData.name,
        classIds: newClassIds,
        status: StudentStatus.ACTIVE,
      });

      await createEnrollment({
        studentId: student.id,
        studentName: student.fullName,
        classId: classData.id,
        className: classData.name,
        sessions: 0,
        type: 'Ghi danh thủ công',
        createdBy: staffData?.name || 'Hệ thống',
        staff: staffData?.name,
        createdDate: new Date().toLocaleDateString('vi-VN'),
        note: `Thêm vào lớp ${classData.name} từ Quản lý học viên - không tính số buổi`,
      });

      await fetchStudents();
      onUpdate();
      alert('Đã thêm học viên vào lớp thành công!');
    } catch (err) {
      console.error('Error adding student to class:', err);
      alert(sanitizeFirebaseError(err));
    } finally {
      setAdding(false);
    }
  };


  // Remove student from class (clear classId / class name / classIds)
  const removeStudentFromClass = async (student: Student) => {
    if (removingId) return;
    if (!confirm(`Bạn có chắc muốn xóa ${student.fullName} khỏi lớp ${classData.name}?`)) return;

    setRemovingId(student.id);
    try {
      // Gộp classId hiện tại vào danh sách rồi loại bỏ lớp này
      const linkedIds = Array.from(
        new Set([...(student.classIds || []), ...(student.classId ? [student.classId] : [])])
      );
      const classIds = linkedIds.filter((id) => id !== classData.id);

      const matchedById = student.classId === classData.id || linkedIds.includes(classData.id);
      const matchedByName = Boolean(student.class && student.class === classData.name);
      const isPrimaryOfThisClass = student.classId === classData.id || matchedByName;

      const updates: Partial<Student> = { classIds };

      if (isPrimaryOfThisClass) {
        if (classIds.length > 0) {
          const otherClass = allClasses.find((c) => c.id === classIds[0]);
          updates.classId = classIds[0];
          updates.class = otherClass?.name || '';
        } else {
          updates.classId = '';
          updates.class = '';
        }
      } else if (matchedByName) {
        updates.class = '';
      }

      // Đảm bảo không còn khớp theo tên/id lớp sau khi xóa
      if (matchedByName && updates.class === undefined) {
        updates.class = '';
      }
      if (matchedById && student.classId === classData.id && updates.classId === undefined) {
        updates.classId = '';
      }

      await StudentService.updateStudent(student.id, updates);

      try {
        await createEnrollment({
          studentId: student.id,
          studentName: student.fullName,
          classId: '',
          className: '',
          sessions: 0,
          type: 'Xóa khỏi lớp',
          createdBy: staffData?.name || 'Hệ thống',
          staff: staffData?.name,
          createdDate: new Date().toLocaleDateString('vi-VN'),
          note: `Xóa khỏi lớp ${classData.name} từ Quản lý học viên trong lớp`,
        });
      } catch (enrollErr) {
        console.warn('Enrollment log failed (student still removed):', enrollErr);
      }

      await fetchStudents();
      onUpdate();
      alert(`Đã xóa ${student.fullName} khỏi lớp ${classData.name}`);
    } catch (err) {
      console.error('Error removing student from class:', err);
      alert(sanitizeFirebaseError(err));
    } finally {
      setRemovingId(null);
    }
  };

  // Open transfer class modal - Bug 5 fix
  const openTransferModal = (student: any) => {
    setSelectedStudentToTransfer(student);
    setShowTransferModal(true);
  };

  // Handle transfer class submission
  const handleTransferSubmit = async (data: {
    newClassId: string;
    newClassName: string;
    sessions: number;
    note: string;
  }) => {
    if (!selectedStudentToTransfer) return;

    try {
      const student = selectedStudentToTransfer as Student;
      const classIds = (student.classIds || []).filter((id) => id !== classData.id);
      if (!classIds.includes(data.newClassId)) {
        classIds.push(data.newClassId);
      }

      await StudentService.updateStudent(student.id, {
        classId: data.newClassId,
        class: data.newClassName,
        classIds,
        registeredSessions: data.sessions,
        remainingSessions: data.sessions,
        status: StudentStatus.ACTIVE,
      });

      await createEnrollment({
        studentId: student.id,
        studentName: student.fullName,
        classId: data.newClassId,
        className: data.newClassName,
        sessions: data.sessions,
        type: 'Chuyển lớp',
        createdBy: staffData?.name || 'Hệ thống',
        staff: staffData?.name,
        note: data.note || `Chuyển từ lớp ${classData.name}`,
      });

      setShowTransferModal(false);
      setSelectedStudentToTransfer(null);
      await fetchStudents();
      onUpdate();
      alert(`Đã chuyển ${student.fullName} sang lớp ${data.newClassName}`);
    } catch (err) {
      console.error('Error transferring student:', err);
      alert('Không thể chuyển lớp cho học viên');
    }
  };

  // Filter students in class by status
  const filteredStudentsInClass = useMemo(() => {
    if (statusFilter === 'ALL') return studentsInClass;
    return studentsInClass.filter(s => normalizeStatus(s.status) === statusFilter);
  }, [studentsInClass, statusFilter]);

  // Filter available students by search
  const filteredAvailableStudents = useMemo(() => {
    if (!searchTerm) return allStudents.slice(0, 10); // Show first 10 by default
    const term = searchTerm.toLowerCase();
    return allStudents.filter(s =>
      s.fullName.toLowerCase().includes(term) ||
      (s.code || '').toLowerCase().includes(term) ||
      (s.phone || '').includes(term)
    ).slice(0, 20);
  }, [allStudents, searchTerm]);

  return (
    <ModalPortal>
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-200">
              <Users className="text-white" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Quản lý học viên trong lớp</h3>
              <p className="text-sm text-gray-500">{classData.name} - {studentsInClass.length} học viên</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          {/* Current Students List */}
          <div className="flex-1 p-4 border-r border-gray-200 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Học viên trong lớp ({filteredStudentsInClass.length}/{studentsInClass.length})
              </h4>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="Đang học">Đang học</option>
                <option value="Học thử">Học thử</option>
                <option value="Nợ phí">Nợ phí</option>
                <option value="Bảo lưu">Bảo lưu</option>
                <option value="Nghỉ học">Nghỉ học</option>
              </select>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
              </div>
            ) : filteredStudentsInClass.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Users size={32} className="mx-auto mb-2 opacity-30" />
                <p>{statusFilter === 'ALL' ? 'Chưa có học viên nào trong lớp' : `Không có học viên "${statusFilter}"`}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredStudentsInClass.map((student) => {
                  const { registered, totalAttended, remaining } = getStudentSessionData(student as Student);
                  return (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-green-300 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { onClose(); navigate(`/customers/student-detail/${student.id}`); }}
                          className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline text-left"
                          title="Xem chi tiết học viên"
                        >
                          {student.fullName}
                        </button>
                        <span className="text-xs text-gray-500">({student.code})</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(student.status)}`}>
                          {normalizeStatus(student.status)}
                        </span>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-blue-600" title="Đăng ký">{registered} ĐK</span>
                          <span className="text-gray-400">/</span>
                          <span className="text-green-600" title="Đã học">{totalAttended} ĐH</span>
                          <span className="text-gray-400">/</span>
                          <span className={`font-medium ${remaining <= 3 ? 'text-red-600' : 'text-orange-600'}`} title="Còn lại">
                            {remaining} CL
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openTransferModal(student)}
                        className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Chuyển lớp"
                      >
                        <ArrowRightLeft size={18} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeStudentFromClass(student);
                        }}
                        disabled={removingId === student.id}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Xóa khỏi lớp"
                      >
                        <UserMinus size={18} />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add Students Section */}
          <div className="w-full lg:w-80 p-4 bg-gray-50 overflow-y-auto">
            <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              Thêm học viên
            </h4>

            {/* Search */}
            <div className="relative mb-3">
              <input
                type="text"
                placeholder="Tìm theo tên, mã, SĐT..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>

            {/* Available Students */}
            <div className="space-y-2">
              {filteredAvailableStudents.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  {searchTerm ? 'Không tìm thấy học viên' : 'Không có học viên khả dụng'}
                </p>
              ) : (
                filteredAvailableStudents.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">{student.fullName}</p>
                      <p className="text-xs text-gray-500">{student.code}</p>
                    </div>
                    <button
                      onClick={() => addStudentToClass(student)}
                      disabled={adding}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Thêm vào lớp"
                    >
                      <UserPlus size={18} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {allStudents.length > 10 && !searchTerm && (
              <p className="text-xs text-gray-500 text-center mt-3">
                Hiển thị 10/{allStudents.length} học viên. Tìm kiếm để xem thêm.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>


      {/* Transfer Class Modal - Bug 5 fix */}
      {showTransferModal && selectedStudentToTransfer && (
        <TransferClassModal
          student={selectedStudentToTransfer as Student}
          classes={allClasses}
          staffData={staffData}
          onClose={() => { setShowTransferModal(false); setSelectedStudentToTransfer(null); }}
          onSubmit={handleTransferSubmit}
        />
      )}
    </div>
    </ModalPortal>
  );
};

export default StudentsInClassModal;
