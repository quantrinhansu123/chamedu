import { collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, writeBatch, runTransaction, arrayUnion, Timestamp, db } from '@/src/utils/legacyFirestoreStub';
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Eye, EyeOff, AlertTriangle, X, Phone, Building2, Key } from 'lucide-react';
import { Staff, StaffRole } from '../types';
import { useStaff } from '../src/hooks/useStaff';
import { usePermissions } from '../src/hooks/usePermissions';
import { ImportExportButtons } from '../components/ImportExportButtons';
import { STAFF_FIELDS, STAFF_MAPPING, prepareStaffExport } from '../src/utils/excelUtils';
import { AuthService } from '../src/services/authService';
import { ModalPortal } from '@/components/modal-portal';
import { getCenters } from '../src/services/centerService';

// Departments and positions based on Excel
const DEPARTMENTS = ['Điều hành', 'Đào Tạo', 'Văn phòng'];
const POSITIONS = {
  'Điều hành': ['Quản lý (Admin)'],
  'Đào Tạo': ['Giáo Viên Việt', 'Giáo Viên Nước Ngoài', 'Trợ Giảng'],
  'Văn phòng': [
    // CSKH Team
    'Trưởng Nhóm CSKH',
    'NV CSKH',
    'Lễ tân',
    // CM Team
    'Trưởng Nhóm CM',
    'NV CM',
    // Sale Team
    'Trưởng Nhóm Sale',
    'NV Sale',
    // Finance
    'Kế toán',
  ],
};

// Grouped positions for optgroup dropdown (Văn phòng only)
const POSITION_GROUPS = {
  'Văn phòng': [
    { label: 'CSKH', positions: ['Trưởng Nhóm CSKH', 'NV CSKH', 'Lễ tân'] },
    { label: 'Chuyên Môn', positions: ['Trưởng Nhóm CM', 'NV CM'] },
    { label: 'Sale', positions: ['Trưởng Nhóm Sale', 'NV Sale'] },
    { label: 'Kế toán', positions: ['Kế toán'] },
  ],
};

// Available roles for salary configuration (multi-select)
// Đào Tạo: tính theo giờ/ca | Văn phòng: lương cứng + KPI/commission | Quản lý: lương cứng + thưởng
const AVAILABLE_ROLES: StaffRole[] = [
  // Đào Tạo
  'Giáo viên',
  'Trợ giảng',
  // Văn phòng
  'CSKH',
  'Sale',
  'Chuyên môn',
  'Kế toán',
  // Điều hành
  'Quản lý',
];

export const StaffManager: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('ALL');
  const [filterBranch, setFilterBranch] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [centerList, setCenterList] = useState<{ id: string; name: string }[]>([]);

  // Account management state
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountStaff, setAccountStaff] = useState<Staff | null>(null);
  const [accountPassword, setAccountPassword] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const { canDelete } = usePermissions();
  const canDeleteStaff = canDelete('staff');

  const { staff, loading, createStaff, updateStaff, deleteStaff } = useStaff();

  useEffect(() => {
    const fetchCenters = async () => {
      try {
        const centers = await getCenters();
        setCenterList(
          centers
            .filter((c) => c.status === 'Active')
            .map((c) => ({ id: c.id!, name: c.name }))
        );
      } catch (err) {
        console.error('Error fetching centers:', err);
      }
    };
    fetchCenters();
  }, []);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    dob: '',
    phone: '',
    department: 'Đào Tạo',
    position: 'Giáo Viên Việt',
    roles: [] as StaffRole[],
    startDate: '',
    contractLink: '',
    username: '',
    password: '',
    status: 'Active' as 'Active' | 'Inactive',
    branch: '',
  });

  // Normalize position name (handle variations in database)
  const normalizePosition = (pos: string): string => {
    if (!pos) return '';
    const lower = pos.toLowerCase();

    // Admin
    if (lower.includes('quản lý') || lower.includes('admin')) return 'Quản lý (Admin)';

    // Teachers
    if (lower.includes('giáo viên việt') || lower === 'gv việt') return 'Giáo Viên Việt';
    if (lower.includes('nước ngoài') || lower.includes('gv ngoại') || lower.includes('foreign')) return 'Giáo Viên Nước Ngoài';
    if (lower.includes('trợ giảng')) return 'Trợ Giảng';

    // CSKH Team
    if (lower.includes('trưởng nhóm cskh') || lower === 'cskh lead') return 'Trưởng Nhóm CSKH';
    if (lower.includes('nv cskh') || lower === 'cskh staff') return 'NV CSKH';
    if (lower.includes('lễ tân')) return 'Lễ tân';

    // CM Team
    if (lower.includes('trưởng nhóm cm') || lower === 'cm lead') return 'Trưởng Nhóm CM';
    if (lower.includes('nv cm') || lower === 'cm staff') return 'NV CM';

    // Sale Team
    if (lower.includes('trưởng nhóm sale') || lower === 'sale lead') return 'Trưởng Nhóm Sale';
    if (lower.includes('nv sale') || lower === 'sale staff') return 'NV Sale';

    // Finance
    if (lower.includes('kế toán')) return 'Kế toán';

    // Legacy fallback - map old "Nhân viên" to NV CSKH for backward compatibility
    if (lower.includes('nhân viên')) return 'NV CSKH';

    return pos;
  };

  // Position order for sorting (by department hierarchy)
  const positionOrder: Record<string, number> = {
    // Admin
    'Quản lý (Admin)': 1,
    // Teachers
    'Giáo Viên Việt': 2,
    'Giáo Viên Nước Ngoài': 3,
    'Trợ Giảng': 4,
    // CSKH Team
    'Trưởng Nhóm CSKH': 5,
    'NV CSKH': 6,
    'Lễ tân': 7,
    // CM Team
    'Trưởng Nhóm CM': 8,
    'NV CM': 9,
    // Sale Team
    'Trưởng Nhóm Sale': 10,
    'NV Sale': 11,
    // Finance
    'Kế toán': 12,
  };

  // Filter and sort staff by position
  const filteredStaff = useMemo(() => {
    return staff
      .filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             s.phone?.includes(searchTerm) ||
                             s.code?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDept = filterDepartment === 'ALL' || s.department === filterDepartment;
        const matchesBranch = filterBranch === 'ALL' || s.branch === filterBranch;
        return matchesSearch && matchesDept && matchesBranch;
      })
      .sort((a, b) => {
        // Sort by position (normalized)
        const posA = positionOrder[normalizePosition(a.position || '')] || 99;
        const posB = positionOrder[normalizePosition(b.position || '')] || 99;
        if (posA !== posB) return posA - posB;
        
        // Then sort by name
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [staff, searchTerm, filterDepartment, filterBranch]);

  const allVisibleSelected =
    filteredStaff.length > 0 && selectedStaffIds.length === filteredStaff.length;

  // Open create modal
  const handleCreate = () => {
    setEditingStaff(null);
    setFormData({
      name: '',
      dob: '',
      phone: '',
      department: 'Đào Tạo',
      position: 'Giáo Viên Việt',
      roles: [],
      startDate: new Date().toISOString().split('T')[0],
      contractLink: '',
      username: '',
      password: '',
      status: 'Active',
      branch: centerList.length > 0 ? centerList[0].name : '',
    });
    setShowModal(true);
  };

  // Open edit modal
  const handleEdit = (staffMember: Staff) => {
    // Get email from various possible sources in Firestore
    const staffEmail = (staffMember as any).email ||
                       (staffMember as any).loginEmail ||
                       (staffMember as any).accountEmail ||
                       '';

    // Debug logging (can be removed in production)
    console.log('[StaffManager] Edit staff:', {
      id: staffMember.id,
      name: staffMember.name,
      hasUid: !!(staffMember as any).uid,
      email: staffEmail,
      rawEmail: (staffMember as any).email,
    });

    setEditingStaff(staffMember);
    setFormData({
      name: staffMember.name || '',
      dob: staffMember.dob || '',
      phone: staffMember.phone || '',
      department: staffMember.department || 'Đào Tạo',
      position: staffMember.position || 'Giáo Viên Việt',
      roles: staffMember.roles || (staffMember.role ? [staffMember.role] : []),
      startDate: staffMember.startDate || '',
      contractLink: '',
      // Populate email from existing account if available
      username: staffEmail,
      password: '',
      status: staffMember.status || 'Active',
      branch: staffMember.branch || '',
    });
    setShowModal(true);
  };

  // Handle form submit
  const handleSubmit = async () => {
    if (!formData.name || !formData.phone) {
      alert('Vui lòng nhập họ tên và số điện thoại!');
      return;
    }

    try {
      // Determine primary role from position or roles array
      const primaryRole = formData.roles.length > 0 ? formData.roles[0] :
              formData.position.includes('Giáo Viên') ? 'Giáo viên' :
              formData.position === 'Trợ Giảng' ? 'Trợ giảng' :
              formData.position === 'Quản lý (Admin)' ? 'Quản lý' : 'Nhân viên';

      const staffCode = editingStaff?.code || `NV${Date.now().toString().slice(-6)}`;

      if (editingStaff) {
        // Update existing staff
        const staffData = {
          name: formData.name,
          dob: formData.dob,
          phone: formData.phone,
          department: formData.department,
          position: formData.position,
          role: primaryRole,
          roles: formData.roles.length > 0 ? formData.roles : [primaryRole],
          startDate: formData.startDate,
          status: formData.status,
          branch: formData.branch,
        };
        await updateStaff(editingStaff.id, staffData);

        // Handle account creation/update
        const hasExistingAccount = !!(editingStaff as any).uid;

        if (hasExistingAccount && formData.password) {
          // Staff has account - update password if provided
          if (formData.password.length < 6) {
            alert('Đã cập nhật thông tin. Mật khẩu phải có ít nhất 6 ký tự nên chưa được đổi!');
          } else {
            try {
              await AuthService.updateStaffPassword(editingStaff.id, formData.password);
              alert('Đã cập nhật thông tin và mật khẩu mới!');
            } catch (pwErr: any) {
              alert('Đã cập nhật thông tin. Lỗi đổi mật khẩu: ' + pwErr.message);
            }
          }
        } else if (!hasExistingAccount && formData.username && formData.password) {
          // Staff doesn't have account - create one if credentials provided
          if (formData.password.length < 6) {
            alert('Đã cập nhật thông tin. Mật khẩu phải có ít nhất 6 ký tự nên chưa tạo tài khoản!');
          } else {
            try {
              const email = formData.username.includes('@')
                ? formData.username
                : `${formData.username}@edumanager.local`;
              await AuthService.createStaffAccount(editingStaff.id, email, formData.password);
              alert('Đã cập nhật thông tin và tạo tài khoản đăng nhập!');
            } catch (accErr: any) {
              alert('Đã cập nhật thông tin. Lỗi tạo tài khoản: ' + accErr.message);
            }
          }
        } else {
          alert('Đã cập nhật thông tin nhân viên!');
        }
      } else {
        // Create new staff
        if (formData.username && formData.password) {
          // Create with Firebase Auth account
          if (formData.password.length < 6) {
            alert('Mật khẩu phải có ít nhất 6 ký tự!');
            return;
          }

          // Convert username to email format if not already email
          const email = formData.username.includes('@')
            ? formData.username
            : `${formData.username}@edumanager.local`;

          await AuthService.registerStaff(email, formData.password, {
            name: formData.name,
            code: staffCode,
            role: primaryRole,
            department: formData.department,
            position: formData.position,
            phone: formData.phone,
          });
          alert('Đã tạo nhân viên với tài khoản đăng nhập!');
        } else {
          // Create without account (Firestore only)
          const staffData = {
            name: formData.name,
            code: staffCode,
            dob: formData.dob,
            phone: formData.phone,
            department: formData.department,
            position: formData.position,
            role: primaryRole,
            roles: formData.roles.length > 0 ? formData.roles : [primaryRole],
            startDate: formData.startDate,
            status: formData.status,
            branch: formData.branch,
          };
          await createStaff(staffData as Omit<Staff, 'id'>);
          alert('Đã thêm nhân viên mới (chưa có tài khoản đăng nhập)!');
        }
      }
      setShowModal(false);
    } catch (err: any) {
      console.error('Error saving staff:', err);

      // Better error messages for common Firebase errors
      let errorMessage = 'Có lỗi xảy ra: ';
      if (err.code === 'permission-denied') {
        errorMessage = 'Bạn không có quyền thực hiện thao tác này. Vui lòng đăng nhập lại hoặc liên hệ Admin.';
      } else if (err.code === 'failed-precondition') {
        errorMessage = 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại các trường bắt buộc.';
      } else if (err.code === 'unavailable') {
        errorMessage = 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.';
      } else {
        errorMessage += err.message || err.code || 'Vui lòng thử lại.';
      }

      alert(errorMessage);
    }
  };

  // Open account management modal
  const handleManageAccount = (staffMember: Staff) => {
    setAccountStaff(staffMember);
    setAccountPassword('');
    setAccountEmail((staffMember as any).email || '');
    setShowAccountModal(true);
  };

  // Handle account save (create or update password)
  const handleSaveAccount = async () => {
    if (!accountStaff) return;

    if (!accountPassword || accountPassword.length < 6) {
      alert('Mật khẩu phải có ít nhất 6 ký tự!');
      return;
    }

    setSavingAccount(true);
    try {
      const hasAccount = !!(accountStaff as any).uid;

      if (hasAccount) {
        // Update password via Cloud Function
        const result = await AuthService.updateStaffPassword(accountStaff.id, accountPassword);
        alert(result.message);
      } else {
        // Create new account via Cloud Function
        if (!accountEmail) {
          alert('Vui lòng nhập email đăng nhập!');
          setSavingAccount(false);
          return;
        }
        const email = accountEmail.includes('@') ? accountEmail : `${accountEmail}@edumanager.local`;
        const result = await AuthService.createStaffAccount(accountStaff.id, email, accountPassword);
        alert(result.message);
      }
      setShowAccountModal(false);
    } catch (err: any) {
      console.error('Error managing account:', err);
      alert('Có lỗi xảy ra: ' + (err.message || 'Vui lòng thử lại.'));
    } finally {
      setSavingAccount(false);
    }
  };

  // Handle delete
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa nhân viên "${name}"?`)) return;
    
    try {
      await deleteStaff(id);
      setSelectedStaffIds(prev => prev.filter(sid => sid !== id));
      alert('Đã xóa nhân viên!');
    } catch (err) {
      console.error('Error deleting staff:', err);
      alert('Có lỗi xảy ra. Vui lòng thử lại.');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedStaffIds.length === 0) {
      alert('Vui lòng chọn ít nhất 1 nhân viên để xóa.');
      return;
    }

    const selectedSet = new Set(selectedStaffIds);
    const staffToDelete = filteredStaff.filter(s => selectedSet.has(s.id));
    const namesPreview = staffToDelete
      .slice(0, 5)
      .map(s => s.name)
      .join(', ');
    const moreCount = staffToDelete.length > 5 ? ` và ${staffToDelete.length - 5} người khác` : '';
    const confirmMsg = `Bạn có chắc chắn muốn xóa ${staffToDelete.length} nhân viên đã chọn?\n\n${namesPreview}${moreCount}\n\nThao tác này KHÔNG THỂ hoàn tác!`;
    if (!confirm(confirmMsg)) return;

    setBulkDeleting(true);
    let deleted = 0;
    let failed = 0;

    for (const member of staffToDelete) {
      try {
        await deleteStaff(member.id);
        deleted++;
      } catch (err) {
        console.error('Error deleting staff:', member.name, err);
        failed++;
      }
    }

    setBulkDeleting(false);
    setSelectedStaffIds([]);
    alert(`Đã xóa ${deleted} nhân viên.${failed > 0 ? ` Lỗi: ${failed}` : ''}`);
  };

  // Import staff from Excel
  const handleImportStaff = async (data: Record<string, any>[]): Promise<{ success: number; errors: string[] }> => {
    const errors: string[] = [];
    let success = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        if (!row.name) {
          errors.push(`Dòng ${i + 1}: Thiếu họ tên`);
          continue;
        }
        await createStaff({
          name: row.name,
          code: row.code || `NV${Date.now()}${i}`,
          position: row.position || 'Nhân viên',
          department: row.department || 'Văn phòng',
          phone: row.phone || '',
          email: row.email || '',
          dob: row.dob || '',
          address: row.address || '',
          startDate: row.startDate || new Date().toISOString().split('T')[0],
          status: row.status || 'Active',
          roles: [],
        } as any);
        success++;
      } catch (err: any) {
        errors.push(`Dòng ${i + 1} (${row.name}): ${err.message || 'Lỗi'}`);
      }
    }
    return { success, errors };
  };

  // Format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  };

  // Get department badge color
  const getDeptBadge = (dept?: string) => {
    switch (dept) {
      case 'Điều hành': return 'bg-red-500';
      case 'Đào Tạo': return 'bg-teal-500';
      case 'Văn phòng': return 'bg-blue-500';
      default: return 'bg-gray-500';
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
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Danh sách nhân viên</h2>
          <p className="text-sm text-gray-500">Quản lý thông tin nhân viên, giáo viên, trợ giảng</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <ImportExportButtons
            data={staff}
            prepareExport={prepareStaffExport}
            exportFileName="DanhSachNhanVien"
            fields={STAFF_FIELDS}
            mapping={STAFF_MAPPING}
            onImport={handleImportStaff}
            templateFileName="MauNhapNhanVien"
            entityName="nhân viên"
          />
          {canDeleteStaff && (
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting || selectedStaffIds.length === 0}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <Trash2 size={16} />
              {bulkDeleting ? 'Đang xóa...' : `Xóa đã chọn (${selectedStaffIds.length})`}
            </button>
          )}
          <button 
            onClick={handleCreate}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
          >
            <Plus size={18} />
            Tạo mới
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Tìm kiếm nhân viên..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          />
        </div>
        <select
          value={filterDepartment}
          onChange={(e) => setFilterDepartment(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
        >
          <option value="ALL">Tất cả phòng ban</option>
          {DEPARTMENTS.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select
          value={filterBranch}
          onChange={(e) => setFilterBranch(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
        >
          <option value="ALL">Tất cả cơ sở</option>
          {centerList.map(c => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500">
            <tr>
              {canDeleteStaff && (
                <th className="px-4 py-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedStaffIds(filteredStaff.map(s => s.id));
                      } else {
                        setSelectedStaffIds([]);
                      }
                    }}
                    aria-label="Chọn tất cả nhân viên"
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
              )}
              <th className="px-6 py-4 w-16">STT</th>
              <th className="px-6 py-4">Họ tên</th>
              <th className="px-6 py-4">SĐT</th>
              <th className="px-6 py-4 text-center">Phòng ban</th>
              <th className="px-6 py-4">Vị trí</th>
              <th className="px-6 py-4">Cơ sở</th>
              <th className="px-6 py-4">Vai trò</th>
              <th className="px-6 py-4 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredStaff.length > 0 ? filteredStaff.map((s, index) => (
              <tr
                key={s.id}
                className={`hover:bg-gray-50 transition-colors ${selectedStaffIds.includes(s.id) ? 'bg-red-50/50' : ''}`}
              >
                {canDeleteStaff && (
                  <td className="px-4 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={selectedStaffIds.includes(s.id)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSelectedStaffIds(prev => {
                          if (checked) {
                            if (prev.includes(s.id)) return prev;
                            return [...prev, s.id];
                          }
                          return prev.filter(id => id !== s.id);
                        });
                      }}
                      aria-label={`Chọn nhân viên ${s.name}`}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                )}
                <td className="px-6 py-4 text-gray-400">{index + 1}</td>
                <td className="px-6 py-4">
                  <div>
                    <p className="font-bold text-gray-900">{s.name}</p>
                    <p className="text-xs text-gray-500">{formatDate(s.dob)}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <a href={`tel:${s.phone}`} className="text-blue-600 hover:underline flex items-center gap-1">
                    <Phone size={14} /> {s.phone}
                  </a>
                </td>
                <td className="px-6 py-4 text-center whitespace-nowrap">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold text-white whitespace-nowrap ${getDeptBadge(s.department)}`}>
                    {s.department}
                  </span>
                </td>
                <td className="px-6 py-4">{normalizePosition(s.position || '')}</td>
                <td className="px-6 py-4">
                  {s.branch ? (
                    <span className="inline-flex items-center gap-1 text-sm text-gray-700">
                      <Building2 size={14} className="text-gray-400" />
                      {s.branch}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">-</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {(s.roles?.length ? s.roles : [s.role]).map((role, i) => (
                      <span key={i} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">
                        {role}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleManageAccount(s)}
                      className={`p-2 transition-colors ${(s as any).uid ? 'text-green-500 hover:text-green-700' : 'text-gray-400 hover:text-amber-600'}`}
                      title={(s as any).uid ? 'Đổi mật khẩu' : 'Tạo tài khoản'}
                    >
                      <Key size={16} />
                    </button>
                    <button
                      onClick={() => handleEdit(s)}
                      className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                      title="Sửa"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(s.id, s.name)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      title="Xóa"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={canDeleteStaff ? 9 : 8} className="px-6 py-12 text-center text-gray-400">
                  Không có nhân viên nào
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
          <span className="text-xs text-gray-500">
            Hiển thị {filteredStaff.length} nhân viên
            {canDeleteStaff && selectedStaffIds.length > 0 && (
              <span className="ml-2 text-red-600 font-medium">
                · Đã chọn {selectedStaffIds.length}
              </span>
            )}
          </span>
          {canDeleteStaff && selectedStaffIds.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedStaffIds([])}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Bỏ chọn tất cả
            </button>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-green-50 to-teal-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {editingStaff ? 'Chỉnh sửa nhân viên' : 'Tạo mới nhân viên'}
                </h3>
                {editingStaff && <p className="text-sm text-teal-600">{editingStaff.name} - {editingStaff.code}</p>}
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={22} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto max-h-[60vh]">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Họ tên *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Nhập họ tên đầy đủ"
                />
              </div>

              {/* DOB & Phone */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sinh nhật</label>
                  <input
                    type="date"
                    value={formData.dob}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SĐT *</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="0901234567"
                  />
                </div>
              </div>

              {/* Department */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phòng ban</label>
                <div className="flex gap-4">
                  {DEPARTMENTS.map(dept => (
                    <label key={dept} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                      <input
                        type="radio"
                        name="department"
                        checked={formData.department === dept}
                        onChange={() => setFormData({ 
                          ...formData, 
                          department: dept,
                          position: POSITIONS[dept as keyof typeof POSITIONS]?.[0] || ''
                        })}
                        className="text-indigo-600"
                      />
                      {dept}
                    </label>
                  ))}
                </div>
              </div>

              {/* Position & Branch */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vị trí
                    <span className="text-xs text-gray-400 font-normal ml-1">- quyết định quyền truy cập</span>
                  </label>
                  <select
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    {formData.department === 'Văn phòng' ? (
                      // Grouped dropdown for Văn phòng
                      POSITION_GROUPS['Văn phòng'].map(group => (
                        <optgroup key={group.label} label={group.label}>
                          {group.positions.map(pos => (
                            <option key={pos} value={pos}>{pos}</option>
                          ))}
                        </optgroup>
                      ))
                    ) : (
                      // Simple dropdown for other departments
                      (POSITIONS[formData.department as keyof typeof POSITIONS] || []).map(pos => (
                        <option key={pos} value={pos}>{pos}</option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cơ sở làm việc</label>
                  <select
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Chọn cơ sở --</option>
                    {centerList.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Multiple Roles - for salary configuration only */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vai trò lương (có thể chọn nhiều)
                  <span className="text-xs text-gray-400 font-normal ml-1">- dùng cho cấu hình lương</span>
                </label>
                <div className="border border-gray-300 rounded-lg p-2 grid grid-cols-2 gap-2">
                  {AVAILABLE_ROLES.map(role => (
                    <label key={role} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={formData.roles.includes(role)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, roles: [...formData.roles, role] });
                          } else {
                            setFormData({ ...formData, roles: formData.roles.filter(r => r !== role) });
                          }
                        }}
                        className="rounded border-gray-300 text-indigo-600"
                      />
                      <span className="text-sm">{role}</span>
                    </label>
                  ))}
                </div>
                {formData.roles.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">Đã chọn: {formData.roles.join(', ')}</p>
                )}
              </div>

              {/* Start Date & Contract Link */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bắt đầu làm việc</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Link Hợp đồng</label>
                  <input
                    type="text"
                    value={formData.contractLink}
                    onChange={(e) => setFormData({ ...formData, contractLink: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="URL..."
                  />
                </div>
              </div>

              {/* Login Credentials */}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  Thông tin đăng nhập
                  {editingStaff && (editingStaff as any).uid && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                      <Key size={12} />
                      Đã có tài khoản
                    </span>
                  )}
                </h4>

                {/* Display current credentials for staff with account */}
                {editingStaff && (editingStaff as any).uid && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Email đăng nhập:</span>
                        <p className="font-medium text-gray-900">
                          {(editingStaff as any).email || formData.username || '(Chưa có email)'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Mật khẩu hiện tại:</span>
                        <p className="font-medium text-gray-900 font-mono">
                          {(editingStaff as any).plainPassword || '(Chưa lưu)'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {editingStaff && (editingStaff as any).uid ? 'Email (không thể đổi)' : 'Email đăng nhập'}
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                          editingStaff && (editingStaff as any).uid
                            ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed'
                            : 'border-gray-300'
                        }`}
                        placeholder={editingStaff && (editingStaff as any).uid ? '' : 'email@example.com'}
                        readOnly={!!(editingStaff && (editingStaff as any).uid)}
                      />
                      {editingStaff && (editingStaff as any).uid && (
                        <Key size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />
                      )}
                    </div>
                    {!(editingStaff && (editingStaff as any).uid) && (
                      <p className="text-xs text-gray-500 mt-1">Để trống nếu chưa cần tài khoản</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {editingStaff && (editingStaff as any).uid ? 'Đổi mật khẩu mới' : 'Mật khẩu'}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        placeholder={editingStaff && (editingStaff as any).uid ? 'Nhập mật khẩu mới...' : 'Nhập mật khẩu'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {editingStaff && (editingStaff as any).uid
                        ? 'Để trống nếu không muốn đổi mật khẩu'
                        : 'Tối thiểu 6 ký tự'}
                    </p>
                  </div>
                </div>

                {/* Warning for new accounts */}
                {!(editingStaff && (editingStaff as any).uid) && formData.username && (
                  <div className="mt-2 bg-yellow-50 text-yellow-800 text-xs p-2 rounded flex items-center gap-2">
                    <AlertTriangle size={14} />
                    Vui lòng chọn mật khẩu không liên quan đến thông tin cá nhân!
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                {editingStaff ? 'Cập nhật' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Account Management Modal */}
      {showAccountModal && accountStaff && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-amber-50 to-yellow-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {(accountStaff as any).uid ? 'Đổi mật khẩu' : 'Tạo tài khoản'}
                </h3>
                <p className="text-sm text-amber-600">{accountStaff.name}</p>
              </div>
              <button onClick={() => setShowAccountModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={22} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Email field - only show for new account */}
              {!(accountStaff as any).uid && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email đăng nhập *</label>
                  <input
                    type="text"
                    value={accountEmail}
                    onChange={(e) => setAccountEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    placeholder="email@example.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Nếu không có @, hệ thống sẽ thêm @edumanager.local
                  </p>
                </div>
              )}

              {/* Existing email display */}
              {(accountStaff as any).email && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email đăng nhập</label>
                  <p className="px-3 py-2 bg-gray-100 rounded-lg text-gray-700">
                    {(accountStaff as any).email}
                  </p>
                </div>
              )}

              {/* Password field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {(accountStaff as any).uid ? 'Mật khẩu mới *' : 'Mật khẩu *'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={accountPassword}
                    onChange={(e) => setAccountPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    placeholder="Nhập mật khẩu (ít nhất 6 ký tự)"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="bg-amber-50 text-amber-800 text-xs p-3 rounded-lg">
                <p className="font-medium mb-1">Lưu ý:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Mật khẩu phải có ít nhất 6 ký tự</li>
                  <li>Không nên dùng thông tin cá nhân làm mật khẩu</li>
                  {(accountStaff as any).uid ? (
                    <li>Nhân viên sẽ dùng mật khẩu mới để đăng nhập</li>
                  ) : (
                    <li>Sau khi tạo, nhân viên có thể đăng nhập vào hệ thống</li>
                  )}
                </ul>
              </div>
            </div>

            <div className="p-5 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
              <button
                onClick={() => setShowAccountModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
                disabled={savingAccount}
              >
                Hủy
              </button>
              <button
                onClick={handleSaveAccount}
                disabled={savingAccount || accountPassword.length < 6}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"
              >
                {savingAccount ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <Key size={16} />
                    {(accountStaff as any).uid ? 'Đổi mật khẩu' : 'Tạo tài khoản'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};
