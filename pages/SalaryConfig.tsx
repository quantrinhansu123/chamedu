import { collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, writeBatch, runTransaction, arrayUnion, Timestamp, db } from '@/src/utils/legacyFirestoreStub';
/**
 * Salary Config Page - Redesigned
 * Cấu hình lương GV theo ca/giờ, liên kết với lớp học
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, X, DollarSign, Calendar, User, Building, Clock, Save, ChevronDown, ChevronRight } from 'lucide-react';
import { useSalaryConfig } from '../src/hooks/useSalaryConfig';
import {
  SalaryRule,
  SalaryRangeConfig,
  RangeType
} from '../src/services/salaryConfigService';
import { formatCurrency } from '../src/utils/currencyUtils';
import { ModalPortal } from '@/components/modal-portal';

interface StaffOption {
  id: string;
  name: string;
  position: string;
  department?: string;
  roles?: string[]; // Support multiple roles
}

interface ClassOption {
  id: string;
  name: string;
  code: string;
  teacherId?: string;
  teacher?: string;
  assistant?: string;
  foreignTeacher?: string;
  sessionDuration?: number; // in minutes
}

interface TeacherClassConfig {
  id?: string;
  staffId: string;
  classId: string;
  className: string;
  classCode: string;
  ratePerUnit: number;
  unit: 'Giờ' | 'Ca'; // Giờ = 60 phút, Ca = 90 phút
}

interface TeacherSalaryConfig {
  staffId: string;
  staffName: string;
  department: string;
  salaryCycle: string; // "Tháng 12/2025"
  note: string;
  classConfigs: TeacherClassConfig[];
  fixedSalary: number;
  allowance: number;
  kpiBonus: number;
}

export const SalaryConfig: React.FC = () => {
  const { 
    salaryRules, 
    teachingRanges, 
    feedbackRanges, 
    loading: rulesLoading, 
    createRule,
    deleteRule,
    createRange,
    deleteRange,
  } = useSalaryConfig();

  // State
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<StaffOption | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>(''); // Selected role for multi-role staff
  const [staffClasses, setStaffClasses] = useState<ClassOption[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  
  // Form state
  const [salaryCycle, setSalaryCycle] = useState(() => {
    const now = new Date();
    return `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;
  });
  const [note, setNote] = useState('');
  const [classConfigs, setClassConfigs] = useState<TeacherClassConfig[]>([]);
  const [fixedSalary, setFixedSalary] = useState(0);
  const [allowance, setAllowance] = useState(0);
  const [kpiBonus, setKpiBonus] = useState(700);
  const [enableHourlyRate, setEnableHourlyRate] = useState(true);
  
  // Modal state
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Grouped view state for saved configs
  const [expandedStaff, setExpandedStaff] = useState<Set<string>>(new Set());

  // Normalize position for display and backward compatibility
  // Maps old roles to new salary role categories
  const normalizePosition = (pos: string): string => {
    const lower = pos?.toLowerCase() || '';

    // Điều hành
    if (lower.includes('quản lý') || lower.includes('quản trị') || lower === 'admin') return 'Quản lý';

    // Đào Tạo
    if (lower.includes('nước ngoài') || lower.includes('ngoại') || lower === 'foreign') return 'Giáo Viên Nước Ngoài';
    if (lower.includes('việt') || lower === 'gv việt') return 'Giáo Viên Việt';
    if (lower.includes('trợ') || lower === 'tg') return 'Trợ Giảng';

    // Văn phòng - New roles
    if (lower.includes('cskh') || lower.includes('lễ tân') || lower.includes('tư vấn')) return 'CSKH';
    if (lower.includes('chuyên môn') || lower.includes(' cm') || lower === 'cm') return 'Chuyên môn';
    if (lower.includes('kế toán')) return 'Kế toán';
    if (lower.includes('sale')) return 'Sale';

    // Backward compatibility: old roles → new roles
    if (lower.includes('nhân viên') || lower === 'nv') return 'CSKH';
    if (lower.includes('văn phòng') || lower === 'vp') return 'CSKH';

    return pos || 'CSKH';
  };

  // Fetch staff list - includes all positions (GV, TG, NV, VP, Sale...)
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const snapshot = await getDocs(collection(null as any /* firebase removed */, 'staff'));
        const staffData: StaffOption[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const normalizedPos = normalizePosition(data.position || '');
          // Get roles array or create from single position
          const roles = data.roles && Array.isArray(data.roles) && data.roles.length > 0
            ? data.roles
            : [normalizedPos || data.role || 'Nhân viên'];
          // Include all staff for salary configuration
          staffData.push({
            id: docSnap.id,
            name: data.name || '',
            position: normalizedPos,
            department: data.department || '',
            roles: roles,
          });
        });
        staffData.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
        setStaffList(staffData);
      } catch (err) {
        console.error('Error fetching staff:', err);
      } finally {
        setLoadingStaff(false);
      }
    };
    fetchStaff();
  }, []);

  // Normalize string for comparison (remove diacritics, lowercase, trim)
  const normalizeString = (s: string): string => {
    if (!s) return '';
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Check if two names match (exact or partial)
  const namesMatch = (name1: string, name2: string): boolean => {
    if (!name1 || !name2) return false;
    const n1 = normalizeString(name1);
    const n2 = normalizeString(name2);
    // Exact match or one contains the other
    return n1 === n2 || n1.includes(n2) || n2.includes(n1);
  };

  // Fetch classes for selected staff
  useEffect(() => {
    const fetchStaffClasses = async () => {
      if (!selectedStaff) {
        setStaffClasses([]);
        return;
      }
      
      setLoadingClasses(true);
      try {
        const snapshot = await getDocs(collection(null as any /* firebase removed */, 'classes'));
        const classData: ClassOption[] = [];
        const staffName = selectedStaff.name;
        const staffId = selectedStaff.id;
        
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          
          // Check multiple ways: ID match OR name match
          const isTeacher = data.teacherId === staffId || 
                           namesMatch(data.teacher, staffName);
          const isAssistant = data.assistantId === staffId || 
                             namesMatch(data.assistant, staffName);
          const isForeignTeacher = data.foreignTeacherId === staffId || 
                                   namesMatch(data.foreignTeacher, staffName);
          
          // Also check scheduleDetails for detailed assignment
          let isInScheduleDetails = false;
          if (data.scheduleDetails && Array.isArray(data.scheduleDetails)) {
            for (const detail of data.scheduleDetails) {
              if (namesMatch(detail.teacher, staffName) ||
                  namesMatch(detail.assistant, staffName) ||
                  namesMatch(detail.foreignTeacher, staffName)) {
                isInScheduleDetails = true;
                break;
              }
            }
          }
          
          if (isTeacher || isAssistant || isForeignTeacher || isInScheduleDetails) {
            classData.push({
              id: docSnap.id,
              name: data.name || '',
              code: data.code || data.id || '',
              teacherId: data.teacherId,
              teacher: data.teacher,
              assistant: data.assistant,
              foreignTeacher: data.foreignTeacher,
              sessionDuration: data.sessionDuration || 90,
            });
          }
        });
        
        classData.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
        setStaffClasses(classData);
        
        // Auto-add classes to config if no existing config
        if (classConfigs.length === 0) {
          const newConfigs: TeacherClassConfig[] = classData.map(cls => ({
            classId: cls.id,
            className: cls.name,
            classCode: cls.code,
            staffId: selectedStaff.id,
            ratePerUnit: 200000,
            unit: cls.sessionDuration === 60 ? 'Giờ' : 'Ca',
          }));
          setClassConfigs(newConfigs);
        }
      } catch (err) {
        console.error('Error fetching classes:', err);
      } finally {
        setLoadingClasses(false);
      }
    };
    
    fetchStaffClasses();
  }, [selectedStaff]);

  // Load existing config for selected staff
  useEffect(() => {
    const loadExistingConfig = async () => {
      if (!selectedStaff) return;
      
      // Find existing rules for this staff
      const existingRules = salaryRules.filter(r => r.staffId === selectedStaff.id);
      if (existingRules.length > 0) {
        // Load from existing rules
        const configs: TeacherClassConfig[] = existingRules.map(rule => ({
          id: rule.id,
          staffId: rule.staffId || '',
          classId: rule.classId || '',
          className: rule.className || '',
          classCode: rule.classCode || '',
          ratePerUnit: rule.ratePerSession || 200000,
          unit: rule.salaryMethod === 'Theo giờ' ? 'Giờ' : 'Ca',
        }));
        setClassConfigs(configs);
        
        // Load other settings from first rule
        const firstRule = existingRules[0];
        setFixedSalary(firstRule.baseRate || 0);
        setAllowance(firstRule.allowance || 0);
        setKpiBonus(firstRule.kpiBonus || 700);
        setNote(firstRule.note || '');
      }
    };
    
    loadExistingConfig();
  }, [selectedStaff, salaryRules]);

  // Calculate total estimate
  const totalEstimate = useMemo(() => {
    const classTotal = classConfigs.reduce((sum, cfg) => sum + cfg.ratePerUnit, 0);
    return fixedSalary + allowance + classTotal;
  }, [classConfigs, fixedSalary, allowance]);

  // Group salary rules by staffId for collapsed view
  const groupedSalaryRules = useMemo(() => {
    const groups: Record<string, {
      staffId: string;
      staffName: string;
      position: string;
      rules: typeof salaryRules;
      totalClasses: number;
    }> = {};

    salaryRules.forEach(rule => {
      const key = rule.staffId || rule.staffName; // Use staffId if available, else staffName
      if (!groups[key]) {
        groups[key] = {
          staffId: rule.staffId || '',
          staffName: rule.staffName || '',
          position: rule.position || '',
          rules: [],
          totalClasses: 0,
        };
      }
      groups[key].rules.push(rule);
      if (rule.className) {
        groups[key].totalClasses++;
      }
    });

    // Sort by staff name
    return Object.values(groups).sort((a, b) =>
      a.staffName.localeCompare(b.staffName, 'vi')
    );
  }, [salaryRules]);

  // Toggle expand/collapse for a staff group
  const toggleStaffExpand = (staffId: string) => {
    setExpandedStaff(prev => {
      const newSet = new Set(prev);
      if (newSet.has(staffId)) {
        newSet.delete(staffId);
      } else {
        newSet.add(staffId);
      }
      return newSet;
    });
  };

  // Handle staff select
  const handleStaffSelect = (staffId: string) => {
    const staff = staffList.find(s => s.id === staffId);
    setSelectedStaff(staff || null);
    // Auto-select first role if staff has roles
    if (staff?.roles && staff.roles.length > 0) {
      setSelectedRole(staff.roles[0]);
    } else {
      setSelectedRole(staff?.position || '');
    }
    // Reset form
    setClassConfigs([]);
    setNote('');
  };

  // Update class config
  const updateClassConfig = (index: number, field: keyof TeacherClassConfig, value: any) => {
    const newConfigs = [...classConfigs];
    newConfigs[index] = { ...newConfigs[index], [field]: value };
    setClassConfigs(newConfigs);
  };

  // Remove class config
  const removeClassConfig = (index: number) => {
    setClassConfigs(classConfigs.filter((_, i) => i !== index));
  };

  // Add new class config
  const addClassConfig = (cls: ClassOption) => {
    // Check if already added
    if (classConfigs.some(c => c.classId === cls.id)) {
      alert('Lớp này đã được thêm');
      return;
    }
    
    setClassConfigs([...classConfigs, {
      staffId: selectedStaff?.id || '',
      classId: cls.id,
      className: cls.name,
      classCode: cls.code,
      ratePerUnit: 200000,
      unit: cls.sessionDuration === 60 ? 'Giờ' : 'Ca',
    }]);
    setShowAddClassModal(false);
  };

  // Save configuration
  const handleSave = async () => {
    if (!selectedStaff) {
      alert('Vui lòng chọn nhân viên');
      return;
    }
    if (!selectedRole) {
      alert('Vui lòng chọn vai trò cấu hình');
      return;
    }

    setSaving(true);
    try {
      // Delete existing rules for this staff + role combination only
      const existingRules = salaryRules.filter(r =>
        r.staffId === selectedStaff.id && r.position === selectedRole
      );
      for (const rule of existingRules) {
        if (rule.id) {
          await deleteRule(rule.id);
        }
      }

      // Create new rules for each class (for teaching roles)
      // Or create a single rule for non-teaching roles (Nhân viên, Văn phòng)
      const isTeachingRole = ['Giáo viên', 'Giáo Viên Việt', 'Giáo Viên Nước Ngoài', 'Trợ Giảng', 'Trợ giảng'].includes(selectedRole);

      if (isTeachingRole && classConfigs.length > 0) {
        // Teaching role: create rules per class
        for (const config of classConfigs) {
          await createRule({
            staffId: selectedStaff.id,
            staffName: selectedStaff.name,
            position: selectedRole, // Use selected role
            classId: config.classId,
            className: config.className,
            classCode: config.classCode,
            salaryMethod: config.unit === 'Giờ' ? 'Theo giờ' : 'Theo ca',
            baseRate: fixedSalary,
            workMethod: 'Cố định',
            ratePerSession: config.ratePerUnit,
            allowance: allowance,
            kpiBonus: kpiBonus,
            note: note,
            effectiveDate: new Date().toISOString().split('T')[0],
            salaryCycle: salaryCycle,
          });
        }
      } else {
        // Non-teaching role (Nhân viên, Văn phòng, Sale): create single rule
        await createRule({
          staffId: selectedStaff.id,
          staffName: selectedStaff.name,
          position: selectedRole,
          classId: '',
          className: '',
          classCode: '',
          salaryMethod: 'Theo giờ',
          baseRate: fixedSalary,
          workMethod: 'Cố định',
          ratePerSession: 0,
          allowance: allowance,
          kpiBonus: kpiBonus,
          note: note,
          effectiveDate: new Date().toISOString().split('T')[0],
          salaryCycle: salaryCycle,
        });
      }

      alert(`Đã lưu cấu hình lương cho ${selectedStaff.name} - ${selectedRole}!`);
    } catch (err) {
      console.error('Error saving config:', err);
      alert('Không thể lưu cấu hình');
    } finally {
      setSaving(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setSelectedStaff(null);
    setSelectedRole('');
    setClassConfigs([]);
    setFixedSalary(0);
    setAllowance(0);
    setKpiBonus(700);
    setNote('');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-2xl shadow-lg">
        <h1 className="text-2xl font-bold text-center mb-2">CẤU HÌNH CƠ CẤU LƯƠNG NHÂN SỰ</h1>
        <p className="text-center text-blue-100">Cấu hình lương theo vai trò: GV theo ca/giờ dạy, NV theo giờ làm việc. Hỗ trợ đa vai trò.</p>
      </div>

      {/* Main Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        
        {/* Section 1: Chọn Giáo viên & Xác định Chu kỳ */}
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="bg-blue-100 text-blue-700 w-7 h-7 rounded-full flex items-center justify-center text-sm">1</span>
            Chọn Giáo Viên & Xác Định Chu Kỳ
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tên Nhân Viên</label>
              <div className="relative">
                <select
                  value={selectedStaff?.id || ''}
                  onChange={(e) => handleStaffSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none"
                  disabled={loadingStaff}
                >
                  <option value="">{loadingStaff ? 'Đang tải...' : '-- Chọn nhân viên --'}</option>
                  {staffList.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name} {staff.roles && staff.roles.length > 1 ? `(${staff.roles.length} vai trò)` : `(${staff.position})`}
                    </option>
                  ))}
                </select>
                <User className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vai trò cấu hình
                {selectedStaff?.roles && selectedStaff.roles.length > 1 && (
                  <span className="text-xs text-amber-600 ml-1">({selectedStaff.roles.length} vai trò)</span>
                )}
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={!selectedStaff}
              >
                <option value="">-- Chọn vai trò --</option>
                {selectedStaff?.roles?.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phòng Ban</label>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={selectedStaff?.department || ''}
                  placeholder="Khoa Tiếng Anh"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
                />
                <Building className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chu Kỳ Lương</label>
              <div className="relative">
                <input
                  type="text"
                  value={salaryCycle}
                  onChange={(e) => setSalaryCycle(e.target.value)}
                  placeholder="Tháng 12/2025"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú thêm</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Vd: nhân viên có 1 oral vend..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Section 2: Cấu hình Lương theo Giờ Dạy */}
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="bg-blue-100 text-blue-700 w-7 h-7 rounded-full flex items-center justify-center text-sm">2</span>
            Cấu Hình Lương Cơ Bản theo Giờ Dạy
          </h2>

          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => selectedStaff && setShowAddClassModal(true)}
              disabled={!selectedStaff}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              <Plus size={16} />
              Lương Theo Ca/Giờ Dạy
            </button>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <div className={`relative w-12 h-6 rounded-full transition-colors ${enableHourlyRate ? 'bg-blue-600' : 'bg-gray-300'}`}>
                <input
                  type="checkbox"
                  checked={enableHourlyRate}
                  onChange={(e) => setEnableHourlyRate(e.target.checked)}
                  className="sr-only"
                />
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${enableHourlyRate ? 'translate-x-7' : 'translate-x-1'}`} />
              </div>
            </label>
          </div>

          {/* Class Rate Table */}
          {classConfigs.length > 0 ? (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Tên Lớp Học</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Mã Lớp</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600">Mức Lương Giờ/Ca (VNĐ)</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600">Đơn Vị Tính</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {classConfigs.map((config, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{config.className}</td>
                      <td className="px-4 py-3 text-gray-600">{config.classCode}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-center gap-2">
                          {/* Quick rate buttons */}
                          <div className="flex gap-1 flex-wrap justify-center">
                            {[150000, 200000, 250000, 300000].map(rate => (
                              <button
                                key={rate}
                                type="button"
                                onClick={() => updateClassConfig(idx, 'ratePerUnit', rate)}
                                className={`px-2 py-1 text-xs rounded border ${
                                  config.ratePerUnit === rate
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                                }`}
                              >
                                {(rate / 1000)}k
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                const custom = prompt('Nhập mức lương tùy chỉnh (VNĐ):', String(config.ratePerUnit));
                                if (custom !== null) {
                                  const value = parseInt(custom) || 0;
                                  updateClassConfig(idx, 'ratePerUnit', value);
                                }
                              }}
                              className={`px-2 py-1 text-xs rounded border ${
                                ![150000, 200000, 250000, 300000].includes(config.ratePerUnit)
                                  ? 'bg-orange-500 text-white border-orange-500'
                                  : 'bg-white text-orange-600 border-orange-300 hover:border-orange-400'
                              }`}
                            >
                              Tuỳ chỉnh
                            </button>
                          </div>
                          {/* Show custom value input */}
                          <input
                            type="number"
                            value={config.ratePerUnit}
                            onChange={(e) => updateClassConfig(idx, 'ratePerUnit', parseInt(e.target.value) || 0)}
                            className="w-28 px-2 py-1 border border-gray-300 rounded text-center text-sm"
                            step={10000}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <select
                          value={config.unit}
                          onChange={(e) => updateClassConfig(idx, 'unit', e.target.value)}
                          className="px-3 py-1 border border-gray-300 rounded"
                        >
                          <option value="Giờ">Giờ</option>
                          <option value="Ca">Ca</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => removeClassConfig(idx)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center text-gray-400">
              <Clock size={48} className="mx-auto mb-2 opacity-50" />
              <p>{selectedStaff ? 'Chưa có lớp nào được cấu hình' : 'Vui lòng chọn giáo viên trước'}</p>
            </div>
          )}
        </div>

        {/* Section 3: Cấu hình Lương Cố Định & Phụ Cấp */}
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="bg-blue-100 text-blue-700 w-7 h-7 rounded-full flex items-center justify-center text-sm">3</span>
            Cấu Hình Lương Cố Định & Phụ Cấp
          </h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-700">Lương Cố Định Hàng Tháng</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">{fixedSalary > 0 ? formatCurrency(fixedSalary) : '0'}</span>
                <select
                  value={fixedSalary}
                  onChange={(e) => setFixedSalary(parseInt(e.target.value))}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                >
                  <option value={0}>0</option>
                  <option value={500000}>500,000</option>
                  <option value={1000000}>1,000,000</option>
                  <option value={2000000}>2,000,000</option>
                  <option value={3000000}>3,000,000</option>
                  <option value={5000000}>5,000,000</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-700">Phụ Cấp Trách Nhiệm</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">{allowance > 0 ? formatCurrency(allowance) : '0'}</span>
                <input
                  type="number"
                  value={allowance}
                  onChange={(e) => setAllowance(parseInt(e.target.value) || 0)}
                  className="w-32 px-3 py-1 border border-gray-300 rounded-lg text-sm text-right"
                  step={50000}
                  min={0}
                  placeholder="Nhập số tiền"
                />
              </div>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-700">Thưởng KPI/Đánh giá</span>
              <div className="flex items-center gap-2">
                <select
                  value={kpiBonus}
                  onChange={(e) => setKpiBonus(parseInt(e.target.value))}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                >
                  <option value={0}>0 VNĐ</option>
                  <option value={500}>500 VNĐ</option>
                  <option value={700}>700 VNĐ</option>
                  <option value={1000}>1,000 VNĐ</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Tóm Tắt & Hành động */}
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="bg-blue-100 text-blue-700 w-7 h-7 rounded-full flex items-center justify-center text-sm">4</span>
            Tóm Tắt & Hành động
          </h2>

          <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg mb-4">
            <span className="text-gray-700 font-medium">Tổng Ước Tính</span>
            <span className="text-2xl font-bold text-indigo-600">{formatCurrency(totalEstimate)}</span>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={handleSave}
              disabled={saving || !selectedStaff}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              <Save size={18} />
              {saving ? 'Đang lưu...' : 'Lưu Cấu Hình'}
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
            >
              Hủy Bỏ
            </button>
          </div>
        </div>
      </div>

      {/* Existing Configurations Table - Grouped by Staff */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-orange-100/50 px-4 py-3 font-bold text-gray-800 border-b border-gray-200 flex items-center justify-between">
          <span>Danh sách cấu hình lương đã lưu</span>
          <span className="text-sm font-normal text-gray-500">
            {groupedSalaryRules.length} nhân viên • {salaryRules.length} cấu hình
          </span>
        </div>
        <div className="divide-y divide-gray-100">
          {rulesLoading ? (
            <div className="text-center py-8 text-gray-500">
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                Đang tải...
              </div>
            </div>
          ) : groupedSalaryRules.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <DollarSign size={48} className="mx-auto mb-2 opacity-20" />
              Chưa có cấu hình lương nào
            </div>
          ) : (
            groupedSalaryRules.map((group, idx) => {
              const isExpanded = expandedStaff.has(group.staffId || group.staffName);
              const groupKey = group.staffId || group.staffName;

              return (
                <div key={groupKey}>
                  {/* Staff Header Row - Clickable to expand/collapse */}
                  <button
                    onClick={() => toggleStaffExpand(groupKey)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    {/* Expand/Collapse Icon */}
                    <span className="text-gray-400">
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </span>

                    {/* Number */}
                    <span className="text-gray-500 text-sm w-6">{idx + 1}</span>

                    {/* Staff Name */}
                    <span className="font-medium text-gray-900 min-w-[160px]">{group.staffName}</span>

                    {/* Role Badge */}
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      group.position === 'Giáo Viên Việt' ? 'bg-blue-100 text-blue-700' :
                      group.position === 'Giáo Viên Nước Ngoài' ? 'bg-purple-100 text-purple-700' :
                      group.position === 'Trợ Giảng' ? 'bg-green-100 text-green-700' :
                      group.position === 'Nhân viên' ? 'bg-amber-100 text-amber-700' :
                      group.position === 'Văn phòng' ? 'bg-slate-100 text-slate-700' :
                      group.position === 'Sale' ? 'bg-pink-100 text-pink-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {group.position}
                    </span>

                    {/* Classes Count */}
                    <span className="text-gray-500 text-sm ml-auto">
                      {group.totalClasses > 0 ? `${group.totalClasses} lớp` : 'Lương cố định'}
                    </span>
                  </button>

                  {/* Expanded Detail Table */}
                  {isExpanded && (
                    <div className="bg-gray-50 border-t border-gray-100">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100 text-xs uppercase font-semibold text-gray-500">
                          <tr>
                            <th className="px-4 py-2 pl-12 text-left">Lớp/Loại</th>
                            <th className="px-4 py-2 text-right">Mức Lương</th>
                            <th className="px-4 py-2 text-center">Đơn Vị</th>
                            <th className="px-4 py-2 text-left">Ngày Hiệu Lực</th>
                            <th className="px-4 py-2 text-center">Xóa</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {group.rules.map((rule) => (
                            <tr key={rule.id} className="hover:bg-white">
                              <td className="px-4 py-2 pl-12">
                                {rule.className || (
                                  <span className="text-gray-400 italic">Lương cố định</span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-right font-bold text-indigo-600">
                                {rule.ratePerSession > 0
                                  ? formatCurrency(rule.ratePerSession)
                                  : rule.baseRate > 0
                                    ? formatCurrency(rule.baseRate)
                                    : '-'
                                }
                              </td>
                              <td className="px-4 py-2 text-center">
                                {rule.className ? (rule.salaryMethod === 'Theo giờ' ? 'Giờ' : 'Ca') : 'Tháng'}
                              </td>
                              <td className="px-4 py-2">{rule.effectiveDate}</td>
                              <td className="px-4 py-2 text-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    rule.id && deleteRule(rule.id);
                                  }}
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
              );
            })
          )}
        </div>
      </div>

      {/* Add Class Modal */}
      {showAddClassModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">Thêm lớp dạy</h3>
              <button onClick={() => setShowAddClassModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
              {loadingClasses ? (
                <div className="text-center py-8 text-gray-500">Đang tải...</div>
              ) : staffClasses.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  Giáo viên này chưa được phân công lớp nào
                </div>
              ) : staffClasses.filter(cls => !classConfigs.some(c => c.classId === cls.id)).length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  Tất cả các lớp đã được thêm vào cấu hình
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {staffClasses.filter(cls => !classConfigs.some(c => c.classId === cls.id)).map((cls) => (
                    <button
                      key={cls.id}
                      onClick={() => addClassConfig(cls)}
                      className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    >
                      <div className="font-medium text-gray-900">{cls.name}</div>
                      <div className="text-sm text-gray-500">Mã lớp: {cls.code}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};
