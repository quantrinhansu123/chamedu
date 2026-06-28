/**
 * CreateStudentModal Component
 * Modal for creating a new student with parent selection
 * Extracted from pages/StudentManager.tsx for modularity
 */

import React, { useMemo, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Student, StudentStatus, Parent, ClassModel, Center } from '@/types';
import { ModalPortal } from '@/components/modal-portal';
import { SearchableSelect } from '@/components/SearchableSelect';

export interface CreateStudentModalProps {
  parents: Array<Parent & { children: Student[] }>;
  classes: ClassModel[];
  centers: Center[];
  onClose: () => void;
  onSubmit: (data: Partial<Student> & { newParentName?: string; newParentPhone?: string }) => void;
}

export const CreateStudentModal: React.FC<CreateStudentModalProps> = ({ parents, classes, centers, onClose, onSubmit }) => {
  const [parentMode, setParentMode] = useState<'select' | 'new'>('select');
  const [formData, setFormData] = useState({
    fullName: '',
    dob: '',
    gender: 'Nam' as 'Nam' | 'Nữ',
    phone: '',
    parentId: '',
    newParentName: '',
    newParentPhone: '',
    status: StudentStatus.ACTIVE,
    branch: '',
    class: '',
    registeredSessions: 0,
    remainingSessions: 0
  });

  const selectedParent = parents.find(p => p.id === formData.parentId);
  const parentOptions = useMemo(() => parents.map(parent => ({
    value: parent.id,
    label: `${parent.name} - ${parent.phone}`,
    sublabel: [
      parent.children.length > 0 ? `${parent.children.length} con` : 'Chưa có học sinh',
      parent.children.map(child => child.fullName).join(', '),
    ].filter(Boolean).join(' - '),
  })), [parents]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (parentMode === 'select' && !formData.parentId) {
      alert('Vui lòng chọn phụ huynh');
      return;
    }

    // If user explicitly chooses "Nghỉ học", keep it even when remainingSessions < 0.
    // Otherwise, auto-set status = 'Nợ phí' when remainingSessions < 0.
    const finalStatus =
      formData.status === StudentStatus.DROPPED
        ? StudentStatus.DROPPED
        : formData.remainingSessions < 0
          ? StudentStatus.DEBT
          : formData.status;

    const submitData: any = {
      fullName: formData.fullName,
      dob: formData.dob,
      gender: formData.gender,
      phone: formData.phone,
      status: finalStatus,
      branch: formData.branch,
      class: formData.class,
      registeredSessions: formData.registeredSessions || 0,
      remainingSessions: formData.remainingSessions || 0,
      attendedSessions: 0,
    };

    if (parentMode === 'select' && formData.parentId) {
      submitData.parentId = formData.parentId;
      submitData.parentName = selectedParent?.name;
      submitData.parentPhone = selectedParent?.phone;
    } else if (parentMode === 'new') {
      submitData.newParentName = formData.newParentName;
      submitData.newParentPhone = formData.newParentPhone;
    }

    onSubmit(submitData);
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-800">Tạo học viên mới</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Họ và tên <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Nguyễn Văn A"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ngày sinh <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.dob}
                onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Giới tính <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'Nam' | 'Nữ' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SĐT học viên
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="0123456789"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Trạng thái
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as StudentStatus })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                {Object.values(StudentStatus).map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            {/* Parent Selection Section */}
            <div className="col-span-2 border-t border-gray-200 pt-4 mt-2">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                  <UserPlus size={18} className="text-indigo-600" />
                  Thông tin phụ huynh
                </h4>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setParentMode('select')}
                    className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                      parentMode === 'select'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Chọn PH có sẵn
                  </button>
                  <button
                    type="button"
                    onClick={() => setParentMode('new')}
                    className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                      parentMode === 'new'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Tạo PH mới
                  </button>
                </div>
              </div>

              {parentMode === 'select' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Chọn phụ huynh <span className="text-red-500">*</span>
                  </label>
                  <SearchableSelect
                    options={parentOptions}
                    value={formData.parentId}
                    onChange={(parentId) => setFormData({ ...formData, parentId })}
                    placeholder="-- Chọn phụ huynh --"
                    emptyMessage="Không tìm thấy phụ huynh phù hợp"
                  />
                  {selectedParent && (
                    <div className="mt-2 p-3 bg-indigo-50 rounded-lg text-sm">
                      <p className="font-medium text-indigo-800">{selectedParent.name}</p>
                      <p className="text-indigo-600">SĐT: {selectedParent.phone}</p>
                      {selectedParent.children.length > 0 && (
                        <p className="text-indigo-500 text-xs mt-1">
                          Đã có: {selectedParent.children.map(c => c.fullName).join(', ')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tên phụ huynh <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.newParentName}
                      onChange={(e) => setFormData({ ...formData, newParentName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Nguyễn Văn B"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SĐT phụ huynh <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.newParentPhone}
                      onChange={(e) => setFormData({ ...formData, newParentPhone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="0987654321"
                    />
                  </div>
                  <div className="col-span-2 text-xs text-gray-500 bg-yellow-50 p-2 rounded">
                    Phụ huynh mới sẽ được tự động tạo khi lưu học viên
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cơ sở
              </label>
              <select
                value={formData.branch}
                onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">-- Chọn cơ sở --</option>
                {centers.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lớp học hiện tại
              </label>
              <select
                value={formData.class}
                onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">-- Chọn lớp --</option>
                {classes
                  .filter(c => c.status === 'Đang học' || c.status === 'Chờ mở' || c.status === 'Active' || c.status === 'Pending')
                  .map(cls => (
                    <option key={cls.id} value={cls.name}>
                      {cls.name} {cls.teacher ? `(${cls.teacher})` : ''}
                    </option>
                  ))
                }
              </select>
              {classes.length === 0 && (
                <p className="text-xs text-yellow-600 mt-1">Chưa có lớp học nào trong hệ thống</p>
              )}
            </div>

          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Tạo học viên
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
};

export default CreateStudentModal;
