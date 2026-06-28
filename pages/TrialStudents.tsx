import { doc, updateDoc, arrayUnion } from '@/src/utils/legacyFirestoreStub';
import React, { useState, useMemo, useEffect } from 'react';
import { Search, Plus, Phone, FileText, X, Calendar, User, Clock, PhoneCall } from 'lucide-react';
import { Student, StudentStatus } from '../types';
import { useStudents } from '../src/hooks/useStudents';
import { useClasses } from '../src/hooks/useClasses';
import { useStaff } from '../src/hooks/useStaff';
import { useNavigate, useLocation } from 'react-router-dom';
import { formatSchedule } from '../src/utils/scheduleUtils';
import { ModalPortal } from '@/components/modal-portal';

// Extended student type for trial students
interface TrialStudent extends Student {
  trialStatus?: 'Chờ Test' | 'Đang học thử' | 'Đã đăng ký' | 'Không đăng ký';
  trialClassId?: string;
  trialClassName?: string;
  trialHistory?: { session: number; date: string }[];
  debtSessions?: number;
  consultant?: string;
  callHistory?: { date: string; content: string; result: string }[];
  source?: string;
}

export const TrialStudents: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterConsultant, setFilterConsultant] = useState('ALL');
  const [filterSource, setFilterSource] = useState('ALL');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [showCallHistoryModal, setShowCallHistoryModal] = useState(false);
  const [showAddCallModal, setShowAddCallModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<TrialStudent | null>(null);

  // Form states
  const [newStudentForm, setNewStudentForm] = useState({
    fullName: '',
    dob: '',
    parentName: '',
    phone: '',
    consultant: '',
    source: '',
    note: ''
  });

  const [addClassForm, setAddClassForm] = useState({
    classId: '',
    startDate: new Date().toISOString().split('T')[0]
  });

  const [newCallForm, setNewCallForm] = useState({
    date: new Date().toISOString().split('T')[0],
    content: '',
    result: 'Đã liên hệ'
  });

  const [editForm, setEditForm] = useState({
    trialStatus: 'Chờ Test' as 'Chờ Test' | 'Đang học thử' | 'Đã đăng ký' | 'Không đăng ký',
    consultant: '',
    source: '',
    note: '',
    trialHistory: [] as { session: number; date: string }[]
  });

  const { students, loading, createStudent, updateStudent } = useStudents({ status: StudentStatus.TRIAL });
  const { classes } = useClasses({});
  const { staff } = useStaff();

  // Handle prefill data from CustomerDatabase (Kho dữ liệu KH)
  useEffect(() => {
    const state = location.state as { prefillData?: { fullName?: string; parentName?: string; phone?: string; source?: string; note?: string } } | null;
    if (state?.prefillData) {
      setNewStudentForm(prev => ({
        ...prev,
        fullName: state.prefillData?.fullName || '',
        parentName: state.prefillData?.parentName || '',
        phone: state.prefillData?.phone || '',
        source: state.prefillData?.source || '',
        note: state.prefillData?.note || ''
      }));
      setShowAddModal(true);
      // Clear location state to prevent re-triggering
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Get consultants from staff (all staff can be consultants)
  const consultants = useMemo(() => staff.map(s => s.name).filter(Boolean), [staff]);
  const sources = ['Facebook', 'Zalo', 'Giới thiệu', 'Website', 'Khác'];

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchesSearch = s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           s.phone?.includes(searchTerm) ||
                           s.parentName?.toLowerCase().includes(searchTerm.toLowerCase());
      const student = s as TrialStudent;
      // Treat undefined trialStatus as 'Chờ Test' (default for new trial students)
      const studentTrialStatus = student.trialStatus || 'Chờ Test';
      const matchesStatus = filterStatus === 'ALL' || studentTrialStatus === filterStatus;
      const matchesConsultant = filterConsultant === 'ALL' || student.consultant === filterConsultant;
      const matchesSource = filterSource === 'ALL' || student.source === filterSource;
      return matchesSearch && matchesStatus && matchesConsultant && matchesSource;
    });
  }, [students, searchTerm, filterStatus, filterConsultant, filterSource]);

  // Format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  };

  // Get status badge
  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'Chờ Test':
        return { color: 'bg-yellow-100 text-yellow-700', text: 'Chờ Test' };
      case 'Đang học thử':
        return { color: 'bg-blue-100 text-blue-700', text: 'Đang học thử' };
      case 'Đã đăng ký':
        return { color: 'bg-green-100 text-green-700', text: 'Đã đăng ký' };
      case 'Không đăng ký':
        return { color: 'bg-gray-100 text-gray-600', text: 'Không đăng ký' };
      default:
        return { color: 'bg-yellow-100 text-yellow-700', text: 'Chờ Test' };
    }
  };

  // Add new potential student
  const handleAddStudent = async () => {
    if (!newStudentForm.fullName || !newStudentForm.phone) {
      alert('Vui lòng nhập họ tên và số điện thoại!');
      return;
    }

    try {
      await createStudent({
        fullName: newStudentForm.fullName,
        dob: newStudentForm.dob,
        parentName: newStudentForm.parentName,
        phone: newStudentForm.phone,
        status: StudentStatus.TRIAL,
        gender: 'Nam',
        code: `HT${Date.now().toString().slice(-6)}`,
        careHistory: [],
        // Extended fields stored in a way Firebase accepts
      } as any);
      
      setShowAddModal(false);
      setNewStudentForm({ fullName: '', dob: '', parentName: '', phone: '', consultant: '', source: '', note: '' });
      alert('Đã thêm học viên tiềm năng!');
    } catch (err) {
      console.error('Error adding student:', err);
      alert('Có lỗi xảy ra. Vui lòng thử lại.');
    }
  };

  // Add trial class
  const handleAddTrialClass = async () => {
    if (!selectedStudent || !addClassForm.classId) {
      alert('Vui lòng chọn lớp học thử!');
      return;
    }

    const selectedClass = classes.find(c => c.id === addClassForm.classId);
    
    try {
      await updateStudent(selectedStudent.id, {
        class: selectedClass?.name || '',
        // Update trial status and history
      } as any);
      
      setShowAddClassModal(false);
      setSelectedStudent(null);
      alert('Đã thêm lớp học thử! Học viên được ghi danh 2 buổi học thử.');
    } catch (err) {
      console.error('Error adding trial class:', err);
      alert('Có lỗi xảy ra. Vui lòng thử lại.');
    }
  };

  // Add call history
  const handleAddCall = async () => {
    if (!selectedStudent || !newCallForm.content) {
      alert('Vui lòng nhập nội dung cuộc gọi!');
      return;
    }

    try {
      const studentRef = doc(null as any /* firebase removed */, 'students', selectedStudent.id);
      const newCall = {
        date: newCallForm.date,
        content: newCallForm.content,
        result: newCallForm.result,
        createdAt: new Date().toISOString(),
      };
      
      await updateDoc(studentRef, {
        callHistory: arrayUnion(newCall),
      });
      
      // Update local state
      setSelectedStudent(prev => prev ? {
        ...prev,
        callHistory: [...(prev.callHistory || []), newCall]
      } : null);
      
      alert('Đã lưu lịch sử cuộc gọi!');
      setShowAddCallModal(false);
      setNewCallForm({ date: new Date().toISOString().split('T')[0], content: '', result: 'Đã liên hệ' });
    } catch (error) {
      console.error('Error adding call:', error);
      alert('Lỗi khi lưu cuộc gọi. Vui lòng thử lại.');
    }
  };

  // Open edit modal
  const openEditModal = (student: TrialStudent) => {
    setSelectedStudent(student);
    setEditForm({
      trialStatus: student.trialStatus || 'Chờ Test',
      consultant: student.consultant || '',
      source: student.source || '',
      note: (student as any).note || '',
      trialHistory: student.trialHistory || []
    });
    setShowEditModal(true);
  };

  // Add trial session
  const addTrialSession = () => {
    const nextSession = editForm.trialHistory.length + 1;
    setEditForm({
      ...editForm,
      trialHistory: [...editForm.trialHistory, { session: nextSession, date: new Date().toISOString().split('T')[0] }]
    });
  };

  // Update trial session date
  const updateTrialSessionDate = (index: number, date: string) => {
    const updated = [...editForm.trialHistory];
    updated[index] = { ...updated[index], date };
    setEditForm({ ...editForm, trialHistory: updated });
  };

  // Remove trial session
  const removeTrialSession = (index: number) => {
    const updated = editForm.trialHistory.filter((_, i) => i !== index);
    // Re-number sessions
    const renumbered = updated.map((h, i) => ({ ...h, session: i + 1 }));
    setEditForm({ ...editForm, trialHistory: renumbered });
  };

  // Update student
  const handleUpdateStudent = async () => {
    if (!selectedStudent) return;

    try {
      await updateStudent(selectedStudent.id, {
        trialStatus: editForm.trialStatus,
        consultant: editForm.consultant,
        source: editForm.source,
        note: editForm.note,
        trialHistory: editForm.trialHistory,
        // If status changes to "Đã đăng ký", update main status
        ...(editForm.trialStatus === 'Đã đăng ký' && { status: StudentStatus.ACTIVE }),
        ...(editForm.trialStatus === 'Không đăng ký' && { status: StudentStatus.DROPPED })
      } as any);
      
      setShowEditModal(false);
      setSelectedStudent(null);
      alert('Đã cập nhật thông tin học viên!');
    } catch (err) {
      console.error('Error updating student:', err);
      alert('Có lỗi xảy ra. Vui lòng thử lại.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-3 text-gray-600">Đang tải...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Quản lý DS Học viên tiềm năng</h2>
          <p className="text-sm text-gray-500 mt-1">Chờ Test → Học thử B1/B2 → Đăng ký / Không đăng ký</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          <Plus size={18} />
          Thêm HV Tiềm năng
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Tìm kiếm học viên..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
        >
          <option value="ALL">Lọc trạng thái</option>
          <option value="Chờ Test">Chờ Test</option>
          <option value="Đang học thử">Đang học thử</option>
          <option value="Đã đăng ký">Đã đăng ký</option>
          <option value="Không đăng ký">Không đăng ký</option>
        </select>
        <select
          value={filterConsultant}
          onChange={(e) => setFilterConsultant(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
        >
          <option value="ALL">Tư vấn viên</option>
          {consultants.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
        >
          <option value="ALL">Nguồn</option>
          {sources.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-500">
              <tr>
                <th className="px-4 py-4 w-12">STT</th>
                <th className="px-4 py-4">Họ và Tên</th>
                <th className="px-4 py-4">Phụ Huynh</th>
                <th className="px-4 py-4 text-center">Trạng thái</th>
                <th className="px-4 py-4">Lớp học thử</th>
                <th className="px-4 py-4">Lịch sử học thử</th>
                <th className="px-4 py-4 text-center">Nợ phí</th>
                <th className="px-4 py-4">Tư vấn viên</th>
                <th className="px-4 py-4 text-center">LS Gọi điện</th>
                <th className="px-4 py-4 text-center">Hợp đồng</th>
                <th className="px-4 py-4 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStudents.length > 0 ? filteredStudents.map((s, index) => {
                const student = s as TrialStudent;
                const statusBadge = getStatusBadge(student.trialStatus);
                
                return (
                  <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4 text-gray-400">{index + 1}</td>
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-bold text-gray-900">{student.fullName}</p>
                        <p className="text-xs text-gray-500">{formatDate(student.dob)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div>
                        <p className="text-gray-700">{student.parentName || '--'}</p>
                        <p className="text-xs text-blue-600">{student.phone}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${statusBadge.color}`}>
                        {statusBadge.text}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {student.class ? (
                        <span className="text-indigo-600 font-medium">{student.class}</span>
                      ) : (
                        <button
                          onClick={() => { setSelectedStudent(student); setShowAddClassModal(true); }}
                          className="text-indigo-600 hover:text-indigo-700 text-xs font-medium flex items-center gap-1"
                        >
                          <Plus size={14} /> Thêm lớp học thử
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {student.trialHistory && student.trialHistory.length > 0 ? (
                        <div className="text-xs text-gray-600">
                          {student.trialHistory.map((h, i) => (
                            <p key={i}>Buổi {h.session}: {formatDate(h.date)}</p>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">--</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {student.debtSessions && student.debtSessions > 0 ? (
                        <span className="text-red-600 font-bold">{student.debtSessions}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-gray-700">{student.consultant || '--'}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => { setSelectedStudent(student); setShowCallHistoryModal(true); }}
                        className="text-blue-600 hover:text-blue-700"
                        title="Xem lịch sử gọi điện"
                      >
                        <PhoneCall size={18} />
                      </button>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {student.trialStatus === 'Đã đăng ký' ? (
                        <span className="text-green-600 text-xs font-medium">Đã ký HĐ</span>
                      ) : (
                        <span className="text-gray-400 text-xs">--</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(student)}
                          className="px-2 py-1 text-indigo-600 hover:bg-indigo-50 rounded text-xs font-medium transition-colors"
                          title="Cập nhật thông tin"
                        >
                          Cập nhật
                        </button>

                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-gray-400">
                    Không có học viên tiềm năng nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
          <span className="text-xs text-gray-500">
            Hiển thị {filteredStudents.length} học viên
          </span>
        </div>
      </div>

      {/* Add Student Modal */}
      {showAddModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-purple-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Thêm học viên tiềm năng</h3>
                <p className="text-sm text-indigo-600">Trạng thái mặc định: Chờ Test</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={22} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên học viên *</label>
                  <input
                    type="text"
                    value={newStudentForm.fullName}
                    onChange={(e) => setNewStudentForm({ ...newStudentForm, fullName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Nhập họ tên"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày sinh</label>
                  <input
                    type="date"
                    value={newStudentForm.dob}
                    onChange={(e) => setNewStudentForm({ ...newStudentForm, dob: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại PH *</label>
                  <input
                    type="tel"
                    value={newStudentForm.phone}
                    onChange={(e) => setNewStudentForm({ ...newStudentForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="0901234567"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên phụ huynh</label>
                  <input
                    type="text"
                    value={newStudentForm.parentName}
                    onChange={(e) => setNewStudentForm({ ...newStudentForm, parentName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Nhập tên phụ huynh"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tư vấn viên</label>
                  <select
                    value={newStudentForm.consultant}
                    onChange={(e) => setNewStudentForm({ ...newStudentForm, consultant: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Chọn --</option>
                    {consultants.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nguồn</label>
                  <select
                    value={newStudentForm.source}
                    onChange={(e) => setNewStudentForm({ ...newStudentForm, source: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Chọn --</option>
                    {sources.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                  <textarea
                    value={newStudentForm.note}
                    onChange={(e) => setNewStudentForm({ ...newStudentForm, note: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ghi chú thêm..."
                  />
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                Hủy
              </button>
              <button
                onClick={handleAddStudent}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Thêm học viên
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Add Trial Class Modal */}
      {showAddClassModal && selectedStudent && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-blue-50 to-cyan-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Thêm lớp học thử</h3>
                <p className="text-sm text-blue-600">{selectedStudent.fullName}</p>
              </div>
              <button onClick={() => { setShowAddClassModal(false); setSelectedStudent(null); }} className="text-gray-400 hover:text-gray-600">
                <X size={22} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Lưu ý:</strong> Khi thêm lớp học thử, học viên sẽ được tự động ghi danh 2 buổi học thử vào lớp được chọn.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chọn lớp học thử *</label>
                <select
                  value={addClassForm.classId}
                  onChange={(e) => setAddClassForm({ ...addClassForm, classId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Chọn lớp --</option>
                  {classes.filter(c => c.status === 'Đang học' || c.status === 'Active').map(cls => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} - {cls.teacher} ({formatSchedule(cls.schedule)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bắt đầu</label>
                <input
                  type="date"
                  value={addClassForm.startDate}
                  onChange={(e) => setAddClassForm({ ...addClassForm, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="p-5 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
              <button
                onClick={() => { setShowAddClassModal(false); setSelectedStudent(null); }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                Hủy
              </button>
              <button
                onClick={handleAddTrialClass}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Thêm lớp học thử
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Call History Modal */}
      {showCallHistoryModal && selectedStudent && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-green-50 to-teal-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Lịch sử gọi điện chăm sóc</h3>
                <p className="text-sm text-teal-600">{selectedStudent.fullName} - {selectedStudent.phone}</p>
              </div>
              <button onClick={() => { setShowCallHistoryModal(false); setSelectedStudent(null); }} className="text-gray-400 hover:text-gray-600">
                <X size={22} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[50vh]">
              {selectedStudent.callHistory && selectedStudent.callHistory.length > 0 ? (
                <div className="space-y-3">
                  {selectedStudent.callHistory.map((call, idx) => (
                    <div key={idx} className="bg-gray-50 p-3 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-medium text-gray-900">{formatDate(call.date)}</span>
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">{call.result}</span>
                      </div>
                      <p className="text-sm text-gray-600">{call.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <PhoneCall size={32} className="mx-auto mb-2 opacity-50" />
                  <p>Chưa có lịch sử gọi điện</p>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-gray-200 flex justify-between bg-gray-50">
              <button
                onClick={() => { setShowCallHistoryModal(false); setShowAddCallModal(true); }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Plus size={18} /> Thêm cuộc gọi
              </button>
              <button
                onClick={() => { setShowCallHistoryModal(false); setSelectedStudent(null); }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Add Call Modal */}
      {showAddCallModal && selectedStudent && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Thêm cuộc gọi chăm sóc</h3>
              <button onClick={() => { setShowAddCallModal(false); setSelectedStudent(null); }} className="text-gray-400 hover:text-gray-600">
                <X size={22} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ngày gọi</label>
                <input
                  type="date"
                  value={newCallForm.date}
                  onChange={(e) => setNewCallForm({ ...newCallForm, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung *</label>
                <textarea
                  value={newCallForm.content}
                  onChange={(e) => setNewCallForm({ ...newCallForm, content: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Nội dung cuộc gọi..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kết quả</label>
                <select
                  value={newCallForm.result}
                  onChange={(e) => setNewCallForm({ ...newCallForm, result: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Đã liên hệ">Đã liên hệ</option>
                  <option value="Không nghe máy">Không nghe máy</option>
                  <option value="Hẹn gọi lại">Hẹn gọi lại</option>
                  <option value="Đã hẹn học thử">Đã hẹn học thử</option>
                  <option value="Không quan tâm">Không quan tâm</option>
                </select>
              </div>
            </div>

            <div className="p-5 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
              <button
                onClick={() => { setShowAddCallModal(false); setSelectedStudent(null); }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                Hủy
              </button>
              <button
                onClick={handleAddCall}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Lưu cuộc gọi
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Edit Student Modal */}
      {showEditModal && selectedStudent && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-purple-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Cập nhật thông tin</h3>
                <p className="text-sm text-gray-500">{selectedStudent.fullName}</p>
              </div>
              <button onClick={() => { setShowEditModal(false); setSelectedStudent(null); }} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Trial Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Trạng thái <span className="text-red-500">*</span>
                </label>
                <select
                  value={editForm.trialStatus}
                  onChange={(e) => setEditForm({ ...editForm, trialStatus: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Chờ Test">Chờ Test</option>
                  <option value="Đang học thử">Đang học thử</option>
                  <option value="Đã đăng ký">Đã đăng ký</option>
                  <option value="Không đăng ký">Không đăng ký</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {editForm.trialStatus === 'Đã đăng ký' && '→ Học viên sẽ chuyển sang trạng thái "Đang học"'}
                  {editForm.trialStatus === 'Không đăng ký' && '→ Học viên sẽ chuyển sang trạng thái "Nghỉ học"'}
                </p>
              </div>

              {/* Consultant */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Người tư vấn</label>
                <select
                  value={editForm.consultant}
                  onChange={(e) => setEditForm({ ...editForm, consultant: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Chọn người tư vấn --</option>
                  {consultants.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Source */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nguồn</label>
                <select
                  value={editForm.source}
                  onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Chọn nguồn --</option>
                  {sources.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Trial History */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Lịch sử học thử</label>
                  <button
                    type="button"
                    onClick={addTrialSession}
                    className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 flex items-center gap-1"
                  >
                    <Plus size={12} /> Thêm buổi
                  </button>
                </div>
                {editForm.trialHistory.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">Chưa có lịch sử học thử</p>
                ) : (
                  <div className="space-y-2">
                    {editForm.trialHistory.map((h, i) => (
                      <div key={i} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                        <span className="text-sm font-medium text-gray-600 w-16">Buổi {h.session}</span>
                        <input
                          type="date"
                          value={h.date}
                          onChange={(e) => updateTrialSessionDate(i, e.target.value)}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => removeTrialSession(i)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                          title="Xóa buổi này"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                <textarea
                  value={editForm.note}
                  onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ghi chú về học viên..."
                />
              </div>
            </div>

            <div className="p-5 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
              <button
                onClick={() => { setShowEditModal(false); setSelectedStudent(null); }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                Hủy
              </button>
              <button
                onClick={handleUpdateStudent}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};
