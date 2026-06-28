
import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StudentStatus } from './types';
import { useAuth } from './src/hooks/useAuth';

// Lazy load page components for code splitting
const DashboardRouter = lazy(() => import('./pages/DashboardRouter').then(m => ({ default: m.DashboardRouter })));
const ClassManager = lazy(() => import('./pages/ClassManager').then(m => ({ default: m.ClassManager })));
const StudentManager = lazy(() => import('./pages/StudentManager').then(m => ({ default: m.StudentManager })));
const TrialStudents = lazy(() => import('./pages/TrialStudents').then(m => ({ default: m.TrialStudents })));
const Schedule = lazy(() => import('./pages/Schedule').then(m => ({ default: m.Schedule })));
const TutoringManager = lazy(() => import('./pages/TutoringManager').then(m => ({ default: m.TutoringManager })));
const AttendanceHistory = lazy(() => import('./pages/AttendanceHistory').then(m => ({ default: m.AttendanceHistory })));
const Attendance = lazy(() => import('./pages/Attendance').then(m => ({ default: m.Attendance })));
const TodayAttendance = lazy(() => import('./pages/TodayAttendance').then(m => ({ default: m.TodayAttendance })));
const StudentDetail = lazy(() => import('./pages/StudentDetail').then(m => ({ default: m.StudentDetail })));
const StaffManager = lazy(() => import('./pages/StaffManager').then(m => ({ default: m.StaffManager })));
const ProductManager = lazy(() => import('./pages/ProductManager').then(m => ({ default: m.ProductManager })));
const RoomManager = lazy(() => import('./pages/RoomManager').then(m => ({ default: m.RoomManager })));
const EnrollmentHistory = lazy(() => import('./pages/EnrollmentHistory').then(m => ({ default: m.EnrollmentHistory })));
const ParentManager = lazy(() => import('./pages/ParentManager').then(m => ({ default: m.ParentManager })));
const SalaryConfig = lazy(() => import('./pages/SalaryConfig').then(m => ({ default: m.SalaryConfig })));
const StaffRewardPenalty = lazy(() => import('./pages/StaffRewardPenalty').then(m => ({ default: m.StaffRewardPenalty })));
const WorkConfirmation = lazy(() => import('./pages/WorkConfirmation').then(m => ({ default: m.WorkConfirmation })));
const LeaveRequestManager = lazy(() => import('./pages/LeaveRequestManager').then(m => ({ default: m.LeaveRequestManager })));
const SalaryReportTeacher = lazy(() => import('./pages/SalaryReportTeacher').then(m => ({ default: m.SalaryReportTeacher })));
const SalaryReportStaff = lazy(() => import('./pages/SalaryReportStaff').then(m => ({ default: m.SalaryReportStaff })));
const ContractCreation = lazy(() => import('./pages/ContractCreation').then(m => ({ default: m.ContractCreation })));
const ContractList = lazy(() => import('./pages/ContractList').then(m => ({ default: m.ContractList })));
const FeedbackManager = lazy(() => import('./pages/FeedbackManager').then(m => ({ default: m.FeedbackManager })));
const RevenueReport = lazy(() => import('./pages/RevenueReport').then(m => ({ default: m.RevenueReport })));
const DebtManagement = lazy(() => import('./pages/DebtManagement').then(m => ({ default: m.DebtManagement })));
const CustomerDatabase = lazy(() => import('./pages/CustomerDatabase').then(m => ({ default: m.CustomerDatabase })));
const CampaignManager = lazy(() => import('./pages/CampaignManager').then(m => ({ default: m.CampaignManager })));
const TrainingReport = lazy(() => import('./pages/TrainingReport').then(m => ({ default: m.TrainingReport })));
const InvoiceManager = lazy(() => import('./pages/InvoiceManager').then(m => ({ default: m.InvoiceManager })));
const CenterSettings = lazy(() => import('./pages/CenterSettings').then(m => ({ default: m.CenterSettings })));

const HomeworkManager = lazy(() => import('./pages/HomeworkManager').then(m => ({ default: m.HomeworkManager })));
const MonthlyReport = lazy(() => import('./pages/MonthlyReport').then(m => ({ default: m.MonthlyReport })));
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const CheckInPage = lazy(() => import('./pages/CheckInPage').then(m => ({ default: m.CheckInPage })));
const WifiManager = lazy(() => import('./pages/WifiManager').then(m => ({ default: m.WifiManager })));
const ProfileSettings = lazy(() => import('./pages/ProfileSettings').then(m => ({ default: m.ProfileSettings })));
const ChangePassword = lazy(() => import('./pages/ChangePassword').then(m => ({ default: m.ChangePassword })));

// Page loading spinner component
const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center h-64">
    <div className="flex flex-col items-center gap-3">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      <span className="text-gray-500 text-sm">Đang tải...</span>
    </div>
  </div>
);

// Placeholder components for routes not fully implemented
const Placeholder: React.FC<{ title: string }> = ({ title }) => (
  <div className="flex flex-col items-center justify-center h-96 text-gray-400">
    <div className="text-6xl mb-4">🚧</div>
    <h3 className="text-xl font-medium text-gray-600">Trang đang phát triển</h3>
    <p className="mt-2">{title}</p>
  </div>
);

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex h-screen bg-white overflow-hidden print:block print:h-auto print:overflow-visible">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden print:block print:overflow-visible">
        <Header title="Hệ thống quản lý trung tâm" />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-white p-6 print:p-0 print:overflow-visible">
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              {children}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        {/* Public Route */}
        <Route path="/login" element={<Suspense fallback={<PageLoader />}><Login /></Suspense>} />

        {/* Protected Routes */}
        <Route path="/*" element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<DashboardRouter />} />

                {/* Training Routes */}
                <Route path="/training/classes" element={<ClassManager />} />
                <Route path="/training/schedule" element={<Schedule />} />
                <Route path="/training/attendance" element={<Attendance />} />
                <Route path="/training/attendance-today" element={<TodayAttendance />} />
                <Route path="/training/tutoring" element={<TutoringManager />} />
                <Route path="/training/homework" element={<HomeworkManager />} />
                <Route path="/training/attendance-history" element={<AttendanceHistory />} />

                {/* Customer Routes */}
                <Route path="/customers/students" element={<StudentManager key="all-students" title="Danh sách học viên" />} />
                <Route path="/customers/student-detail/:id" element={<StudentDetail />} />
                <Route path="/customers/parents" element={<ParentManager />} />
                <Route path="/customers/dropped" element={<StudentManager key="dropped-students" initialStatusFilter={StudentStatus.DROPPED} title="Danh sách học viên đã nghỉ" />} />

                <Route path="/customers/trial" element={<TrialStudents />} />
                <Route path="/customers/feedback" element={<FeedbackManager />} />

                {/* Business Routes */}
                <Route path="/business/leads" element={<CustomerDatabase />} />
                <Route path="/business/campaigns" element={<CampaignManager />} />

                {/* HR Routes */}
                <Route path="/hr/staff" element={<StaffManager />} />
                <Route path="/hr/salary" element={<SalaryConfig />} />
                <Route path="/hr/rewards" element={<StaffRewardPenalty />} />
                <Route path="/hr/work-confirmation" element={<WorkConfirmation />} />
                <Route path="/hr/leave-requests" element={<LeaveRequestManager />} />
                <Route path="/hr/salary-teacher" element={<SalaryReportTeacher />} />
                <Route path="/hr/salary-staff" element={<SalaryReportStaff />} />

                {/* Finance Routes */}


                <Route path="/finance/invoices" element={<InvoiceManager />} />
                <Route path="/finance/revenue" element={<RevenueReport />} />
                <Route path="/finance/debt" element={<DebtManagement />} />

                {/* Report Routes */}
                <Route path="/reports/training" element={<TrainingReport />} />
                <Route path="/reports/finance" element={<RevenueReport />} />
                <Route path="/reports/monthly" element={<MonthlyReport />} />

                {/* Settings Routes */}
                <Route path="/settings/staff" element={<StaffManager />} />
                <Route path="/settings/products" element={<ProductManager />} />
                <Route path="/settings/rooms" element={<RoomManager />} />
                <Route path="/settings/center" element={<CenterSettings />} />
                <Route path="/settings/wifi" element={<WifiManager />} />
                <Route path="/settings/profile" element={<ProfileSettings />} />
                <Route path="/settings/change-password" element={<ChangePassword />} />

                {/* CheckIn Route */}
                <Route path="/checkin" element={<CheckInPage />} />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        } />
      </Routes>
    </HashRouter>
  );
};

export default App;
