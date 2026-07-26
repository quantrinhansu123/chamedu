
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Briefcase,
  UserCog,
  DollarSign,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Menu,
  X,
  User,
  Key,
  LogOut,
  Clock,
  Wifi
} from 'lucide-react';
import { MenuItem } from '../types';
import { usePermissions } from '../src/hooks/usePermissions';
import { useAuth } from '../src/hooks/useAuth';
import { ModuleKey } from '../src/services/permissionService';
import brandLogo from '@/pages/Logo tách nền.png';

// Map subItem id to ModuleKey for permission checking
const subItemToModule: Record<string, ModuleKey> = {
  'classes': 'classes',
  'schedule': 'schedule',
  'holidays': 'holidays',
  'attendance': 'attendance',
  'tutoring': 'tutoring',
  'tuition-export': 'invoices',
  'homework': 'homework',
  'materials': 'homework',
  'attendance-history': 'attendance_history',
  'enrollment-history': 'enrollment_history',
  'students': 'students',
  'parents': 'parents',
  'dropped': 'students_dropped',
  'reserved': 'students_reserved',
  'feedback': 'feedback',
  'trial': 'students_trial',
  'leads': 'leads',
  'campaigns': 'campaigns',
  'staff': 'staff',
  'salary': 'salary_config',
  'work-confirm': 'work_confirmation',
  'report-teacher': 'salary_teacher',
  'report-staff': 'salary_staff',
  'contracts': 'contracts',
  'contracts-create': 'contracts',
  'invoices': 'invoices',
  'debt': 'debt',
  'revenue': 'revenue',
  'report-training': 'reports_training',
  'report-finance': 'reports_finance',
  'report-monthly': 'reports_learning',  // Báo cáo Học Tập uses separate module
  'settings-center': 'settings',
  'settings-staff': 'settings',
  'settings-products': 'settings',
  'settings-rooms': 'settings',
  'settings-wifi': 'wifi_management',     // WiFi management (admin only)
  'rewards': 'reward_penalty',          // Gap #6: Thưởng/Phạt
  'leave-requests': 'leave_request',    // Nghỉ phép
  'checkin': 'checkin',                 // Staff check-in
};

// Map parent menu to required modules (at least one must be visible)
const parentMenuModules: Record<string, ModuleKey[]> = {
  'training': ['classes', 'schedule', 'attendance', 'tutoring', 'homework', 'attendance_history', 'enrollment_history', 'invoices'],
  'customers': ['students', 'parents', 'students_dropped', 'students_reserved', 'feedback', 'students_trial'],
  'business': ['leads', 'campaigns'],
  'hr': ['staff', 'salary_config', 'work_confirmation', 'leave_request', 'salary_teacher', 'salary_staff', 'reward_penalty'],
  'finance': ['contracts', 'invoices', 'debt', 'revenue'],
  'reports': ['reports_training', 'reports_finance', 'reports_learning'],
  'settings': ['settings'],
};

const menuItems: MenuItem[] = [
  {
    id: 'dashboard',
    label: 'Trang chủ',
    icon: LayoutDashboard,
    path: '/'
  },
  {
    id: 'checkin',
    label: 'Chấm công',
    icon: Clock,
    path: '/checkin'
  },
  {
    id: 'training',
    label: 'Đào Tạo',
    icon: BookOpen,
    subItems: [
      { id: 'classes', label: 'Lớp học', path: '/training/classes', icon: ChevronRight },
      { id: 'schedule', label: 'Thời khóa biểu', path: '/training/schedule', icon: ChevronRight },
      { id: 'attendance', label: 'Điểm danh', path: '/training/attendance', icon: ChevronRight },
      { id: 'tutoring', label: 'Lịch bồi', path: '/training/tutoring', icon: ChevronRight },
      { id: 'tuition-export', label: 'Xuất học phí', path: '/training/tuition-export', icon: ChevronRight },
      { id: 'homework', label: 'Bài tập về nhà', path: '/training/homework', icon: ChevronRight },
      { id: 'materials', label: 'Học liệu', path: '/training/homework?tab=materials', icon: ChevronRight },
      { id: 'attendance-history', label: 'Lịch sử điểm danh', path: '/training/attendance-history', icon: ChevronRight },
    ]
  },
  {
    id: 'customers',
    label: 'Khách Hàng',
    icon: Users,
    subItems: [
      { id: 'students', label: 'Danh sách học viên', path: '/customers/students', icon: ChevronRight },
      { id: 'parents', label: 'Danh sách phụ huynh', path: '/customers/parents', icon: ChevronRight },
      { id: 'dropped', label: 'DS Học viên đã nghỉ', path: '/customers/dropped', icon: ChevronRight },

      { id: 'feedback', label: 'Phản hồi khách hàng', path: '/customers/feedback', icon: ChevronRight },
      { id: 'trial', label: 'DS Học viên học thử', path: '/customers/trial', icon: ChevronRight },
    ]
  },
  {
    id: 'business',
    label: 'Kinh Doanh',
    icon: Briefcase,
    subItems: [
      { id: 'leads', label: 'Kho dữ liệu KH', path: '/business/leads', icon: ChevronRight },
      { id: 'campaigns', label: 'Chiến dịch', path: '/business/campaigns', icon: ChevronRight },
    ]
  },
  {
    id: 'hr',
    label: 'Nhân sự',
    icon: UserCog,
    subItems: [
      { id: 'staff', label: 'DS Nhân viên', path: '/hr/staff', icon: ChevronRight },
      { id: 'salary', label: 'Cấu hình lương', path: '/hr/salary', icon: ChevronRight },
      { id: 'rewards', label: 'Thưởng / Phạt', path: '/hr/rewards', icon: ChevronRight },
      { id: 'work-confirm', label: 'Xác nhận công', path: '/hr/work-confirmation', icon: ChevronRight },
      { id: 'leave-requests', label: 'Xin nghỉ phép', path: '/hr/leave-requests', icon: ChevronRight },
      { id: 'report-teacher', label: 'Báo cáo lương GV/TG', path: '/hr/salary-teacher', icon: ChevronRight },
      { id: 'report-staff', label: 'Báo cáo lương NV', path: '/hr/salary-staff', icon: ChevronRight },
    ]
  },
  {
    id: 'finance',
    label: 'Tài chính',
    icon: DollarSign,
    subItems: [


      { id: 'invoices', label: 'Hóa đơn học phí', path: '/finance/invoices', icon: ChevronRight },
      { id: 'debt', label: 'Quản lý công nợ', path: '/finance/debt', icon: ChevronRight },
      { id: 'revenue', label: 'Báo cáo doanh thu', path: '/finance/revenue', icon: ChevronRight },
    ]
  },
  {
    id: 'reports',
    label: 'Báo Cáo',
    icon: BarChart3,
    subItems: [
      { id: 'report-training', label: 'Báo cáo đào tạo', path: '/reports/training', icon: ChevronRight },
      { id: 'report-finance', label: 'Báo cáo tài chính', path: '/reports/finance', icon: ChevronRight },
      { id: 'report-monthly', label: 'Báo cáo học tập', path: '/reports/monthly', icon: ChevronRight },
    ]
  },
  {
    id: 'settings',
    label: 'Cấu hình',
    icon: Settings,
    subItems: [
      { id: 'settings-center', label: 'Quản lý cơ sở', path: '/settings/center', icon: ChevronRight },
      { id: 'settings-staff', label: 'Quản lý nhân viên', path: '/settings/staff', icon: ChevronRight },
      { id: 'settings-products', label: 'Quản lý Sản phẩm', path: '/settings/products', icon: ChevronRight },
      { id: 'settings-rooms', label: 'Quản lý phòng học', path: '/settings/rooms', icon: ChevronRight },
      { id: 'settings-wifi', label: 'Quản lý WiFi', path: '/settings/wifi', icon: Wifi },
    ]
  }
];

export const Sidebar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['training', 'customers', 'settings']);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { canView, role, isAdmin } = usePermissions();
  const { user, staffData, signOut } = useAuth();

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter menu items based on permissions
  const filteredMenuItems = useMemo(() => {
    return menuItems.map(item => {
      // Dashboard always visible
      if (item.id === 'dashboard') return item;

      // For parent menus with subItems
      if (item.subItems) {
        const modules = parentMenuModules[item.id];
        // Check if at least one module is visible
        const hasVisibleModule = modules?.some(m => canView(m));
        if (!hasVisibleModule) return null;

        // Filter subItems
        const visibleSubItems = item.subItems.filter(sub => {
          const moduleKey = subItemToModule[sub.id];
          return moduleKey ? canView(moduleKey) : true;
        });

        if (visibleSubItems.length === 0) return null;
        return { ...item, subItems: visibleSubItems };
      }

      return item;
    }).filter(Boolean) as MenuItem[];
  }, [canView, role]);

  const toggleMenu = (id: string) => {
    setExpandedMenus(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleMobileSidebar = () => setIsOpen(!isOpen);

  // Profile menu handlers
  const handleChangePassword = () => {
    setShowProfileMenu(false);
    navigate('/settings/change-password');
  };

  const handleLogout = async () => {
    setShowProfileMenu(false);
    await signOut();
    navigate('/login');
  };

  // Get user display info
  const userName = staffData?.name || user?.displayName || 'User';
  const userPosition = staffData?.position || 'Nhân viên';
  const userInitials = userName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <>
      {/* Mobile Toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-[#5A3416] text-white rounded-md shadow-lg print:hidden"
        onClick={toggleMobileSidebar}
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar Container */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-[#FFFEF7] border-r border-[#F2E6CC] transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:block print:hidden
      `}>
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="h-24 flex items-center justify-center border-b border-[#F2E6CC] px-2 bg-white">
            <img
              src={brandLogo}
              alt="Logo"
              className="h-full w-full object-contain"
            />
          </div>

          {/* Menu Items */}
          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-hide">
            {filteredMenuItems.map((item) => (
              <div key={item.id}>
                {item.subItems ? (
                  // Parent Menu Item
                  <div>
                    <button
                      onClick={() => toggleMenu(item.id)}
                      className={`
                        w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                        ${expandedMenus.includes(item.id)
                          ? 'bg-[#FFF6D9] text-[#5A3416]'
                          : 'text-gray-700 hover:bg-gray-100'}
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon size={20} />
                        <span>{item.label}</span>
                      </div>
                      {expandedMenus.includes(item.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>

                    {/* Sub Menu */}
                    {expandedMenus.includes(item.id) && (
                      <div className="mt-1 ml-4 pl-3 border-l-2 border-[#F7D06A] space-y-1">
                        {item.subItems.map((sub) => (
                          <NavLink
                            key={sub.id}
                            to={sub.path || '#'}
                            className={({ isActive }) => `
                              flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors
                              ${isActive
                                ? 'text-[#A95A00] font-semibold bg-white shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}
                            `}
                          >
                            <span>{sub.label}</span>
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  // Single Menu Item
                  <NavLink
                    to={item.path || '#'}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-1
                      ${isActive
                        ? 'bg-[#5A3416] text-[#FFF7D6] shadow-md'
                        : 'text-gray-700 hover:bg-gray-100'}
                    `}
                  >
                    <item.icon size={20} />
                    <span>{item.label}</span>
                  </NavLink>
                )}
              </div>
            ))}
          </nav>

          {/* User Profile Snippet with Dropdown - Gap #7 */}
          <div className="p-4 border-t border-[#F2E6CC] relative" ref={profileMenuRef}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-3 w-full hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-[#FFF6D9] flex items-center justify-center text-[#5A3416] font-bold">
                {userInitials}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
                <p className="text-xs text-gray-500 truncate">{userPosition}</p>
              </div>
              <ChevronUp className={`w-4 h-4 text-gray-400 transition-transform ${showProfileMenu ? '' : 'rotate-180'}`} />
            </button>

            {/* Dropdown Menu */}
            {showProfileMenu && (
              <div className="absolute bottom-full left-4 right-4 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                <Link
                  to="/settings/profile"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setShowProfileMenu(false)}
                >
                  <User className="w-4 h-4" />
                  Thông tin cá nhân
                </Link>
                <button
                  onClick={handleChangePassword}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left"
                >
                  <Key className="w-4 h-4" />
                  Đổi mật khẩu
                </button>
                <hr className="my-1" />
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                >
                  <LogOut className="w-4 h-4" />
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
