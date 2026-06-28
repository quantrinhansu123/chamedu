/**
 * Curriculum Manager Page
 * Quản lý Gói học / Khóa học
 */

import React, { useState, useEffect, useMemo } from 'react';
import { BookOpen, Plus, Edit, Trash2, X, Clock, Users, DollarSign, Settings } from 'lucide-react';
import { ModalPortal } from '@/components/modal-portal';
import * as curriculumService from '../src/services/curriculumService';
import { Curriculum, CurriculumLevel, CurriculumStatus } from '../src/services/curriculumService';
import { formatCurrency } from '../src/utils/currencyUtils';
import { ImportExportButtons } from '../components/ImportExportButtons';
import { CURRICULUM_FIELDS, CURRICULUM_MAPPING, prepareCurriculumExport } from '../src/utils/excelUtils';

// Default programs
const DEFAULT_PROGRAMS = [
  'Tiếng Anh Trẻ Em',
  'Tiếng Anh Giao Tiếp', 
  'Tiếng Anh Học Thuật',
  'IELTS',
  'TOEIC',
  'Khác'
];

const LEVEL_COLORS: Record<CurriculumLevel, string> = {
  'Beginner': 'bg-green-100 text-green-700',
  'Elementary': 'bg-blue-100 text-blue-700',
  'Intermediate': 'bg-orange-100 text-orange-700',
  'Advanced': 'bg-purple-100 text-purple-700',
};

const STATUS_COLORS: Record<CurriculumStatus, string> = {
  'Active': 'bg-green-100 text-green-700',
  'Inactive': 'bg-gray-100 text-gray-600',
  'Draft': 'bg-yellow-100 text-yellow-700',
};

export const CurriculumManager: React.FC = () => {
  const [curriculums, setCurriculums] = useState<Curriculum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingCurriculum, setEditingCurriculum] = useState<Curriculum | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Program types config
  const [programTypes, setProgramTypes] = useState<string[]>(DEFAULT_PROGRAMS);
  const [showProgramConfig, setShowProgramConfig] = useState(false);
  const [newProgram, setNewProgram] = useState('');
  const [programConfigError, setProgramConfigError] = useState<string | null>(null);

  useEffect(() => {
    fetchCurriculums();
    fetchProgramTypes();
  }, []);

  // Fetch program types from Firestore
  const fetchProgramTypes = async () => {
    try {
      setProgramConfigError(null);
      const types = await curriculumService.getProgramTypes();
      if (types?.length) {
        setProgramTypes(types);
      }
    } catch (err: any) {
      console.error('Error fetching program types:', err);
      setProgramConfigError(err?.message || 'Khong the tai cau hinh chuong trinh');
    }
  };

  // Save program types to Firestore
  const saveProgramTypes = async (types: string[]) => {
    try {
      setProgramConfigError(null);
      await curriculumService.saveProgramTypes(types);
      setProgramTypes(types);
    } catch (err: any) {
      console.error('Error saving program types:', err);
      setProgramConfigError(err?.message || 'Khong the luu cau hinh chuong trinh');
    }
  };

  const addProgramType = () => {
    if (!newProgram.trim()) return;
    if (programTypes.includes(newProgram.trim())) {
      alert('Chương trình đã tồn tại');
      return;
    }
    saveProgramTypes([...programTypes, newProgram.trim()]);
    setNewProgram('');
  };

  const removeProgramType = (program: string) => {
    if (!confirm(`Xóa "${program}"?`)) return;
    saveProgramTypes(programTypes.filter(p => p !== program));
  };

  const fetchCurriculums = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await curriculumService.getCurriculums();
      setCurriculums(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Khong the tai danh sach goi hoc');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa khóa học này?')) return;
    try {
      await curriculumService.deleteCurriculum(id);
      await fetchCurriculums();
    } catch (err: any) {
      setError(err?.message || 'Khong the xoa goi hoc');
    }
  };

  // Import curriculums from Excel
  const handleImportCurriculum = async (data: Record<string, any>[]): Promise<{ success: number; errors: string[] }> => {
    const errors: string[] = [];
    let success = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        if (!row.name) {
          errors.push(`Dòng ${i + 1}: Thiếu tên khóa học`);
          continue;
        }
        const code = row.name.split(' ').map((w: string) => w[0]).join('').toUpperCase() + Date.now().toString().slice(-4);
        await curriculumService.createCurriculum({
          name: row.name,
          code: row.code || code,
          level: row.level || 'Beginner',
          totalSessions: parseInt(row.totalSessions) || 48,
          duration: 0,
          sessionDuration: 90,
          tuitionFee: parseInt(String(row.tuitionFee).replace(/\D/g, '')) || 0,
          description: row.description || '',
          status: row.status || 'Active',
        });
        success++;
      } catch (err: any) {
        errors.push(`Dòng ${i + 1} (${row.name}): ${err.message || 'Lỗi'}`);
      }
    }
    await fetchCurriculums();
    return { success, errors };
  };

  // Filter
  const filteredCurriculums = curriculums.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeCurriculums = curriculums.filter(c => c.status === 'Active');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-100 p-2 rounded-lg">
              <BookOpen className="text-indigo-600" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Quản lý Gói học</h2>
              <p className="text-sm text-gray-500">Thiết lập các khóa học</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-sm bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-medium">
              {activeCurriculums.length} đang hoạt động
            </span>
            <button
              onClick={() => setShowProgramConfig(true)}
              className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium"
              title="Cấu hình chương trình học"
            >
              <Settings size={16} /> Chương trình
            </button>
            <ImportExportButtons
              data={curriculums}
              prepareExport={prepareCurriculumExport}
              exportFileName="DanhSachGoiHoc"
              fields={CURRICULUM_FIELDS}
              mapping={CURRICULUM_MAPPING}
              onImport={handleImportCurriculum}
              templateFileName="MauNhapGoiHoc"
              entityName="gói học"
            />
            <button
              onClick={() => { setEditingCurriculum(null); setShowModal(true); }}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium"
            >
              <Plus size={16} /> Thêm khóa học
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4">
          <input
            type="text"
            placeholder="Tìm theo tên khóa học..."
            className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Curriculum Grid */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          Đang tải...
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-red-500">
          Lỗi: {error}
        </div>
      ) : filteredCurriculums.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
          <BookOpen size={48} className="mx-auto mb-2 opacity-20" />
          Chưa có giáo trình nào
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCurriculums.map((curriculum) => (
            <div
              key={curriculum.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900">{curriculum.name}</h3>
                    <span className="text-xs font-mono text-gray-500">{curriculum.code}</span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setEditingCurriculum(curriculum); setShowModal(true); }}
                      className="p-1 text-gray-400 hover:text-indigo-600"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => curriculum.id && handleDelete(curriculum.id)}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {curriculum.description && (
                  <p className="text-sm text-gray-500 mt-2 line-clamp-2">{curriculum.description}</p>
                )}

                <div className="flex flex-wrap gap-2 mt-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${LEVEL_COLORS[curriculum.level]}`}>
                    {curriculum.level}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[curriculum.status]}`}>
                    {curriculum.status === 'Active' ? 'Hoạt động' : curriculum.status === 'Inactive' ? 'Tạm dừng' : 'Nháp'}
                  </span>
                  {curriculum.ageRange && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                      <Users size={10} className="inline mr-1" />
                      {curriculum.ageRange}
                    </span>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-lg font-bold text-gray-900">{curriculum.duration}</div>
                    <div className="text-xs text-gray-500">tháng</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-gray-900">{curriculum.totalSessions}</div>
                    <div className="text-xs text-gray-500">buổi</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-gray-900">{curriculum.sessionDuration}</div>
                    <div className="text-xs text-gray-500">phút/buổi</div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-sm text-gray-500">Học phí:</span>
                  <span className="font-bold text-indigo-600">{formatCurrency(curriculum.tuitionFee)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <CurriculumModal
          curriculum={editingCurriculum}
          programTypes={programTypes}
          onClose={() => { setShowModal(false); setEditingCurriculum(null); }}
          onAddProgramType={async (type) => {
            if (!programTypes.includes(type)) {
              await saveProgramTypes([...programTypes, type]);
            }
          }}
          onSubmit={async (data) => {
            if (editingCurriculum?.id) {
              await curriculumService.updateCurriculum(editingCurriculum.id, data);
            } else {
              await curriculumService.createCurriculum(data as Omit<Curriculum, 'id'>);
            }
            await fetchCurriculums();
            setShowModal(false);
            setEditingCurriculum(null);
          }}
        />
      )}

      {/* Program Config Modal */}
      {showProgramConfig && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">Cấu hình Chương trình học</h3>
              <button onClick={() => setShowProgramConfig(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newProgram}
                  onChange={(e) => setNewProgram(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addProgramType()}
                  placeholder="Nhập tên chương trình mới..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={addProgramType}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {programTypes.map((program, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg">
                    <span className="text-sm text-gray-700">{program}</span>
                    <button
                      onClick={() => removeProgramType(program)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              {programConfigError && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {programConfigError}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-4">
                Danh sách này sẽ hiển thị trong dropdown "Chương trình" khi thêm/sửa khóa học.
              </p>
            </div>
            <div className="border-t border-gray-200 px-6 py-4 flex justify-end">
              <button
                onClick={() => setShowProgramConfig(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};

// Curriculum Modal
interface CurriculumModalProps {
  curriculum?: Curriculum | null;
  programTypes: string[];
  onClose: () => void;
  onAddProgramType?: (type: string) => Promise<void>;
  onSubmit: (data: Partial<Curriculum>) => Promise<void>;
}

const CurriculumModal: React.FC<CurriculumModalProps> = ({
  curriculum,
  programTypes,
  onClose,
  onAddProgramType,
  onSubmit,
}) => {
  const [formData, setFormData] = useState({
    name: curriculum?.name || '',
    code: curriculum?.code || '',
    description: curriculum?.description || '',
    level: curriculum?.level || '',
    ageRange: curriculum?.ageRange || '',
    duration: curriculum?.duration || 3,
    totalSessions: String(curriculum?.totalSessions ?? 24),
    sessionDuration: String(curriculum?.sessionDuration ?? 90),
    tuitionFee: curriculum?.tuitionFee || 0,
    status: curriculum?.status || 'Active' as CurriculumStatus,
  });
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showProgramSuggestions, setShowProgramSuggestions] = useState(false);

  const programSuggestions = useMemo(() => {
    const term = formData.level.trim().toLowerCase();
    const fromConfig = programTypes.filter((p) => !term || p.toLowerCase().includes(term));
    const typed = formData.level.trim();
    if (typed && !programTypes.some((p) => p.toLowerCase() === typed.toLowerCase())) {
      return [typed, ...fromConfig];
    }
    return fromConfig;
  }, [formData.level, programTypes]);

  const formatNumber = (num: number) => num.toLocaleString('vi-VN');
  const parseNumber = (str: string) => parseInt(str.replace(/\./g, '').replace(/,/g, ''), 10) || 0;

  const handleIntegerInput = (field: 'totalSessions' | 'sessionDuration', value: string) => {
    if (value === '' || /^\d+$/.test(value)) {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Vui lòng nhập tên khóa học');
      return;
    }
    const totalSessions = parseInt(formData.totalSessions, 10);
    const sessionDuration = parseInt(formData.sessionDuration, 10);
    if (!totalSessions || totalSessions < 1) {
      alert('Vui lòng nhập tổng số buổi hợp lệ');
      return;
    }
    if (!sessionDuration || sessionDuration < 1) {
      alert('Vui lòng nhập phút/buổi hợp lệ');
      return;
    }
    const level = formData.level.trim();
    if (!level) {
      alert('Vui lòng chọn hoặc nhập chương trình');
      return;
    }
    setLoading(true);
    setSubmitError(null);
    try {
      if (onAddProgramType && !programTypes.includes(level)) {
        await onAddProgramType(level);
      }
      const code = formData.code || formData.name.replace(/\s+/g, '_').toUpperCase().slice(0, 20);
      await onSubmit({
        ...formData,
        code,
        level: level as CurriculumLevel,
        totalSessions,
        sessionDuration,
      });
    } catch (err: any) {
      setSubmitError(err?.message || 'Không thể lưu khóa học');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="text-xl font-bold text-gray-800">
            {curriculum ? 'Sửa khóa học' : 'Thêm khóa học'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tên khóa học <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="VD: Tiếng Anh Mầm Non - Starter"
              />
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Chương trình</label>
              <input
                type="text"
                list="curriculum-program-types"
                value={formData.level}
                onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                onFocus={() => setShowProgramSuggestions(true)}
                onBlur={() => setTimeout(() => setShowProgramSuggestions(false), 150)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Chọn hoặc nhập chương trình..."
                autoComplete="off"
              />
              <datalist id="curriculum-program-types">
                {programTypes.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
              {showProgramSuggestions && programSuggestions.length > 0 && (
                <ul className="absolute z-20 mt-1 w-full max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {programSuggestions.map((p) => (
                    <li key={p}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-indigo-50"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setFormData({ ...formData, level: p });
                          setShowProgramSuggestions(false);
                        }}
                      >
                        {p}
                        {!programTypes.includes(p) && (
                          <span className="ml-2 text-xs text-indigo-500">(mới)</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Độ tuổi</label>
              <input
                type="text"
                value={formData.ageRange}
                onChange={(e) => setFormData({ ...formData, ageRange: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="VD: 4-6 tuổi"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as CurriculumStatus })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Active">Hoạt động</option>
                <option value="Inactive">Tạm dừng</option>
                <option value="Draft">Nháp</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tổng số buổi</label>
              <input
                type="text"
                inputMode="numeric"
                value={formData.totalSessions}
                onChange={(e) => handleIntegerInput('totalSessions', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="VD: 24"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phút/buổi</label>
              <input
                type="text"
                inputMode="numeric"
                value={formData.sessionDuration}
                onChange={(e) => handleIntegerInput('sessionDuration', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="VD: 90"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Học phí (VND)</label>
              <input
                type="text"
                value={formatNumber(formData.tuitionFee)}
                onChange={(e) => setFormData({ ...formData, tuitionFee: parseNumber(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="VD: 3.600.000"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            {submitError && (
              <div className="mr-auto rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {submitError}
              </div>
            )}
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
              {loading ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
};
