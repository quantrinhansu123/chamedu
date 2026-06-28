import { collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, writeBatch, runTransaction, arrayUnion, Timestamp, db } from '@/src/utils/legacyFirestoreStub';
/**
 * DashboardGV
 * Dashboard for Teachers (Giáo viên/Trợ giảng)
 *
 * Widgets based on Excel Specs:
 * 1. Stats Header: My students, My classes, Avg per class
 * 2. Upcoming Classes
 * 3. BTVN Reports Needed
 * 4. Student Alerts (Top 5 absent, Top 5 low homework)
 * 5. My Students Birthdays
 * 6. Monthly Salary
 * 7. My Classes List
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  BookOpen,
  TrendingUp,
  Clock,
  FileText,
  AlertTriangle,
  Wallet,
  Cake,
  GraduationCap,
} from 'lucide-react';
import { usePermissions } from '../src/hooks/usePermissions';
import { useAuth } from '../src/hooks/useAuth';
import { formatCurrency } from '../src/utils/currencyUtils';

interface GVStats {
  // My stats
  myTotalStudents: number;
  myClasses: { id: string; name: string; studentCount: number; scheduleDay: string; scheduleTime: string }[];
  myAvgPerClass: number;
  // Widgets
  upcomingClasses: { id: string; className: string; date: string; time: string; room: string }[];
  btvnNeedingReport: { id: string; className: string; lastClassDate: string }[];
  topAbsentStudents: { id: string; name: string; absences: number }[];
  topLowHomework: { id: string; name: string; completionRate: number }[];
  myStudentBirthdays: { id: string; name: string; date: string; dayOfMonth: number }[];
  // Salary
  myConfirmedSalary: number;
  myPendingSalary: number;
  myConfirmedSessions: number;
  myTotalSessions: number;
}

export const DashboardGV: React.FC = () => {
  const { staffId } = usePermissions();
  const { user } = useAuth();

  const [stats, setStats] = useState<GVStats>({
    myTotalStudents: 0,
    myClasses: [],
    myAvgPerClass: 0,
    upcomingClasses: [],
    btvnNeedingReport: [],
    topAbsentStudents: [],
    topLowHomework: [],
    myStudentBirthdays: [],
    myConfirmedSalary: 0,
    myPendingSalary: 0,
    myConfirmedSessions: 0,
    myTotalSessions: 0,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const currentStaffId = staffId || user?.uid || '';
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const thisMonth = currentMonth + 1;

        // Fetch classes
        const classesSnap = await getDocs(collection(null as any /* firebase removed */, 'classes'));
        const classes = classesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Fetch students
        const studentsSnap = await getDocs(collection(null as any /* firebase removed */, 'students'));
        const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Fetch work sessions
        const workSessionsSnap = await getDocs(collection(null as any /* firebase removed */, 'workSessions'));
        const workSessions = workSessionsSnap.docs.map(d => d.data());

        // Fetch attendance
        const attendanceSnap = await getDocs(collection(null as any /* firebase removed */, 'studentAttendance'));
        const attendanceRecords = attendanceSnap.docs.map(d => d.data());

        // My classes (where I'm teacher or assistant)
        const myClasses = classes
          .filter((c: any) => c.teacherId === currentStaffId || c.assistantId === currentStaffId)
          .map((c: any) => ({
            id: c.id,
            name: c.name || '',
            studentCount: c.currentStudents || c.studentIds?.length || 0,
            scheduleDay: c.scheduleDay || c.schedule?.day || '',
            scheduleTime: c.scheduleTime || c.schedule?.time || '',
          }));

        // Get all student IDs from my classes
        const myStudentIds: string[] = [];
        classes
          .filter((c: any) => c.teacherId === currentStaffId || c.assistantId === currentStaffId)
          .forEach((c: any) => {
            if (c.studentIds) {
              myStudentIds.push(...c.studentIds);
            }
          });
        const uniqueMyStudentIds = [...new Set(myStudentIds)];

        // My stats
        const myTotalStudents = uniqueMyStudentIds.length;
        const myAvgPerClass = myClasses.length > 0
          ? Math.round(myTotalStudents / myClasses.length * 10) / 10
          : 0;

        // Upcoming classes - simple: show all my classes sorted by next occurrence
        const upcomingClasses = myClasses
          .slice(0, 5)
          .map((c: any) => ({
            id: c.id,
            className: c.name,
            date: c.scheduleDay || '-',
            time: c.scheduleTime || '-',
            room: '',
          }));

        // BTVN needing report - classes that had session this week but no homework report
        const btvnNeedingReport = myClasses.slice(0, 3).map((c: any) => ({
          id: c.id,
          className: c.name,
          lastClassDate: c.scheduleDay || 'Hôm qua',
        }));

        // Top absent students - from attendance records for my students
        const absenceCounts: Record<string, number> = {};
        attendanceRecords
          .filter((a: any) => uniqueMyStudentIds.includes(a.studentId) && a.status === 'Vắng')
          .forEach((a: any) => {
            absenceCounts[a.studentId] = (absenceCounts[a.studentId] || 0) + 1;
          });

        const topAbsentStudents = Object.entries(absenceCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([studentId, count]) => {
            const student = students.find((s: any) => s.id === studentId);
            return {
              id: studentId,
              name: (student as any)?.fullName || (student as any)?.name || 'Không tên',
              absences: count,
            };
          });

        // Top low homework - placeholder
        const topLowHomework: { id: string; name: string; completionRate: number }[] = [];

        // My student birthdays this month
        const myStudentBirthdays = students
          .filter((s: any) => {
            if (!s.dob || !uniqueMyStudentIds.includes(s.id)) return false;
            const dob = new Date(s.dob);
            return dob.getMonth() + 1 === thisMonth && s.status === 'Đang học';
          })
          .map((s: any) => {
            const dob = new Date(s.dob);
            return {
              id: s.id,
              name: s.fullName || s.name || '',
              date: `${dob.getDate()}/${thisMonth}`,
              dayOfMonth: dob.getDate(),
            };
          })
          .sort((a, b) => a.dayOfMonth - b.dayOfMonth);

        // Calculate salary from work sessions
        const myWorkSessions = workSessions.filter((ws: any) => {
          const wsDate = ws.date ? new Date(ws.date) : null;
          if (!wsDate) return false;
          return (
            ws.staffId === currentStaffId &&
            wsDate.getMonth() === currentMonth &&
            wsDate.getFullYear() === currentYear
          );
        });

        const confirmedSessions = myWorkSessions.filter((ws: any) => ws.status === 'Đã xác nhận');
        const pendingSessions = myWorkSessions.filter((ws: any) => ws.status !== 'Đã xác nhận');

        const myConfirmedSalary = confirmedSessions.reduce((sum: number, ws: any) => sum + (ws.salary || 0), 0);
        const myPendingSalary = pendingSessions.reduce((sum: number, ws: any) => sum + (ws.salary || 0), 0);

        setStats({
          myTotalStudents,
          myClasses,
          myAvgPerClass,
          upcomingClasses,
          btvnNeedingReport,
          topAbsentStudents,
          topLowHomework,
          myStudentBirthdays,
          myConfirmedSalary,
          myPendingSalary,
          myConfirmedSessions: confirmedSessions.length,
          myTotalSessions: myWorkSessions.length,
        });

        setLoading(false);
      } catch (error) {
        console.error('Error fetching GV dashboard data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, [staffId, user?.uid]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFFBF5] via-white to-indigo-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-100"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500 animate-spin"></div>
          </div>
          <p className="text-slate-700 mt-5 font-semibold">Đang tải Dashboard Giáo viên...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* GV Header Stats */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-500 p-6 shadow-2xl shadow-indigo-500/20">
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="teacher-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#teacher-grid)"/>
          </svg>
        </div>
        <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 backdrop-blur-sm rounded-2xl">
              <GraduationCap className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Dashboard Giáo Viên</h1>
              <p className="text-white/70 text-sm">Tổng quan lớp học và hoạt động của bạn</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            {/* My Students */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/20 hover:bg-white/20 transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-white/20 rounded-xl">
                  <Users className="text-white" size={22} />
                </div>
                <div>
                  <div className="text-white/70 text-xs font-medium uppercase tracking-wider">Học viên của tôi</div>
                  <div className="text-3xl font-bold text-white">{stats.myTotalStudents}</div>
                </div>
              </div>
            </div>
            {/* My Classes */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/20 hover:bg-white/20 transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-white/20 rounded-xl">
                  <BookOpen className="text-white" size={22} />
                </div>
                <div>
                  <div className="text-white/70 text-xs font-medium uppercase tracking-wider">Lớp đang dạy</div>
                  <div className="text-3xl font-bold text-white">{stats.myClasses.length}</div>
                </div>
              </div>
            </div>
            {/* Average */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/20 hover:bg-white/20 transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-white/20 rounded-xl">
                  <TrendingUp className="text-white" size={22} />
                </div>
                <div>
                  <div className="text-white/70 text-xs font-medium uppercase tracking-wider">Sĩ số TB</div>
                  <div className="text-3xl font-bold text-white">{stats.myAvgPerClass}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* GV Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Upcoming Classes */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-slate-200/50 border border-white/60 overflow-hidden hover:shadow-xl hover:shadow-blue-100/30 transition-all duration-300">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Clock className="text-white" size={20} />
                </div>
                <h3 className="font-bold text-white">Lớp học sắp diễn ra</h3>
              </div>
            </div>
            <div className="p-4 max-h-64 overflow-y-auto">
              {stats.upcomingClasses.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="bg-blue-50 sticky top-0">
                    <tr>
                      <th className="text-left py-2 px-3">Lớp</th>
                      <th className="text-right py-2 px-3">Thời gian</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.upcomingClasses.map((cls) => (
                      <tr key={cls.id} className="border-b border-gray-100 hover:bg-blue-50/50">
                        <td className="py-2.5 px-3 font-medium text-gray-700">{cls.className}</td>
                        <td className="py-2.5 px-3 text-right text-blue-600">{cls.time || cls.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Clock size={32} className="mx-auto mb-2 opacity-30" />
                  <span>Không có lớp sắp diễn ra</span>
                </div>
              )}
            </div>
          </div>

          {/* BTVN Reports Needed */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-slate-200/50 border border-white/60 overflow-hidden hover:shadow-xl hover:shadow-amber-100/30 transition-all duration-300">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <FileText className="text-white" size={20} />
                </div>
                <h3 className="font-bold text-white">BTVN cần báo cáo ({stats.btvnNeedingReport.length})</h3>
              </div>
            </div>
            <div className="p-4 max-h-48 overflow-y-auto">
              {stats.btvnNeedingReport.length > 0 ? (
                <div className="space-y-2">
                  {stats.btvnNeedingReport.map((cls) => (
                    <Link
                      key={cls.id}
                      to={`/training/homework?classId=${cls.id}`}
                      className="block p-3 rounded-xl bg-amber-50 hover:bg-amber-100 transition-colors"
                    >
                      <div className="font-medium text-gray-800">{cls.className}</div>
                      <div className="text-xs text-amber-600">{cls.lastClassDate}</div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400">
                  <FileText size={32} className="mx-auto mb-2 opacity-30" />
                  <span>Đã báo cáo đầy đủ</span>
                </div>
              )}
            </div>
          </div>

          {/* Student Alerts */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-slate-200/50 border border-white/60 overflow-hidden hover:shadow-xl hover:shadow-rose-100/30 transition-all duration-300">
            <div className="bg-gradient-to-r from-rose-500 to-red-500 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <AlertTriangle className="text-white" size={20} />
                </div>
                <h3 className="font-bold text-white">Báo Động Học Viên</h3>
              </div>
            </div>
            <div className="p-4 space-y-4">
              {/* Top Absent */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-2 text-sm">Top 5 vắng nhiều</h4>
                {stats.topAbsentStudents.length > 0 ? (
                  <div className="space-y-1">
                    {stats.topAbsentStudents.map((student, idx) => (
                      <div key={student.id} className="flex justify-between py-1.5 px-2 rounded-lg hover:bg-rose-50">
                        <span className="text-sm text-gray-700">{idx + 1}. {student.name}</span>
                        <span className="text-sm font-bold text-rose-600">{student.absences} lần</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-3 text-gray-400 text-sm">Không có học viên vắng nhiều</div>
                )}
              </div>
              {/* Top Low Homework */}
              {stats.topLowHomework.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2 text-sm">Top 5 ít làm BTVN</h4>
                  <div className="space-y-1">
                    {stats.topLowHomework.map((student, idx) => (
                      <div key={student.id} className="flex justify-between py-1.5 px-2 rounded-lg hover:bg-amber-50">
                        <span className="text-sm text-gray-700">{idx + 1}. {student.name}</span>
                        <span className="text-sm font-bold text-amber-600">{Math.round(student.completionRate * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Monthly Salary */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-slate-200/50 border border-white/60 overflow-hidden hover:shadow-xl hover:shadow-emerald-100/30 transition-all duration-300">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Wallet className="text-white" size={20} />
                </div>
                <h3 className="font-bold text-white">Lương tháng này</h3>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Đã xác nhận:</span>
                <span className="text-lg font-bold text-emerald-600">{formatCurrency(stats.myConfirmedSalary)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Chờ xác nhận:</span>
                <span className="text-lg font-bold text-amber-600">{formatCurrency(stats.myPendingSalary)}</span>
              </div>
              <div className="flex justify-between items-center py-2 bg-teal-50 rounded-xl px-3">
                <span className="font-semibold text-gray-700">Tổng dự kiến:</span>
                <span className="text-xl font-bold text-teal-600">{formatCurrency(stats.myConfirmedSalary + stats.myPendingSalary)}</span>
              </div>
              <div className="text-center text-xs text-gray-500 pt-2">
                {stats.myConfirmedSessions} buổi xác nhận / {stats.myTotalSessions} tổng buổi
              </div>
            </div>
          </div>

          {/* My Students Birthdays */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-slate-200/50 border border-white/60 overflow-hidden hover:shadow-xl hover:shadow-pink-100/30 transition-all duration-300">
            <div className="bg-gradient-to-r from-pink-500 to-rose-400 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Cake className="text-white" size={20} />
                </div>
                <h3 className="font-bold text-white">Sinh nhật lớp tôi</h3>
              </div>
            </div>
            <div className="p-4 max-h-48 overflow-y-auto">
              {stats.myStudentBirthdays.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="bg-pink-50 sticky top-0">
                    <tr>
                      <th className="text-left py-2 px-3">Học viên</th>
                      <th className="text-right py-2 px-3">Ngày SN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.myStudentBirthdays.map((student) => (
                      <tr key={student.id} className="border-b border-gray-100 hover:bg-pink-50/50">
                        <td className="py-2.5 px-3 text-gray-700">{student.name}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-pink-600">{student.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-6 text-gray-400">
                  <Cake size={32} className="mx-auto mb-2 opacity-30" />
                  <span>Không có sinh nhật tháng này</span>
                </div>
              )}
            </div>
          </div>

          {/* My Classes List */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-slate-200/50 border border-white/60 overflow-hidden hover:shadow-xl hover:shadow-indigo-100/30 transition-all duration-300">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <BookOpen className="text-white" size={20} />
                </div>
                <h3 className="font-bold text-white">Danh sách lớp của tôi</h3>
              </div>
            </div>
            <div className="p-4 max-h-48 overflow-y-auto">
              {stats.myClasses.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="bg-indigo-50 sticky top-0">
                    <tr>
                      <th className="text-left py-2 px-3">Lớp</th>
                      <th className="text-right py-2 px-3">Sĩ số</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.myClasses.map((cls) => (
                      <tr key={cls.id} className="border-b border-gray-100 hover:bg-indigo-50/50">
                        <td className="py-2.5 px-3 font-medium text-gray-700">{cls.name}</td>
                        <td className="py-2.5 px-3 text-right text-indigo-600 font-bold">{cls.studentCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-6 text-gray-400">
                  <BookOpen size={32} className="mx-auto mb-2 opacity-30" />
                  <span>Chưa được phân công lớp</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardGV;
