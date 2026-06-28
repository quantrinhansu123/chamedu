import { collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, writeBatch, runTransaction, arrayUnion, Timestamp, db } from '@/src/utils/legacyFirestoreStub';
/**
 * Training Report Page
 * Báo cáo đào tạo - thống kê từ attendance, tutoring, classes
 */

import React, { useState, useEffect } from 'react';
import { BarChart3, Users, BookOpen, Calendar, TrendingUp, Clock, Award } from 'lucide-react';
import { formatCurrency } from '../src/utils/currencyUtils';
import { getStudentSessionData } from '../src/utils/student-session-utils';

interface TrainingSummary {
  totalClasses: number;
  activeClasses: number;
  totalStudents: number;
  activeStudents: number;
  totalSessions: number;
  attendanceRate: number;
  tutoringCount: number;
  completedTutoring: number;
  // Renewal stats
  expiredStudents: number;    // HS đã hết phí
  renewedStudents: number;    // HS đã gia hạn
  renewalRate: number;        // Tỉ lệ tái tục
}

interface ClassSummary {
  id: string;
  name: string;
  studentCount: number;
  sessionCount: number;
  attendanceRate: number;
  status: string;
  // New fields for active rate
  regularStudents: number; // HS đi học đều (>=80%)
  tutoredStudents: number; // HS được bồi đủ
  activeStudents: number;  // Tổng HS active
  activeRate: number;      // Tỉ lệ HS active
}

export const TrainingReport: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<TrainingSummary>({
    totalClasses: 0,
    activeClasses: 0,
    totalStudents: 0,
    activeStudents: 0,
    totalSessions: 0,
    attendanceRate: 0,
    tutoringCount: 0,
    completedTutoring: 0,
    expiredStudents: 0,
    renewedStudents: 0,
    renewalRate: 0,
  });
  const [classSummaries, setClassSummaries] = useState<ClassSummary[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all collections
      const [classesSnap, studentsSnap, attendanceSnap, tutoringSnap, contractsSnap] = await Promise.all([
        getDocs(collection(null as any /* firebase removed */, 'classes')),
        getDocs(collection(null as any /* firebase removed */, 'students')),
        getDocs(collection(null as any /* firebase removed */, 'attendance')),
        getDocs(collection(null as any /* firebase removed */, 'tutoring')),
        getDocs(collection(null as any /* firebase removed */, 'contracts')),
      ]);

      const classes = classesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const attendance = attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const tutoring = tutoringSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const contracts = contractsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Calculate summary - Normalize status (Vietnamese)
      const normalizeClassStatus = (status: string) => {
        if (!status) return '';
        const lower = status.toLowerCase();
        if (lower === 'active' || lower === 'studying' || lower.includes('đang học')) return 'Đang học';
        if (lower === 'finished' || lower === 'completed' || lower.includes('kết thúc')) return 'Kết thúc';
        if (lower === 'paused' || lower.includes('tạm dừng')) return 'Tạm dừng';
        if (lower === 'pending' || lower.includes('chờ mở')) return 'Chờ mở';
        return status;
      };

      const normalizeStudentStatus = (status: string) => {
        if (!status) return '';
        const lower = status.toLowerCase();
        if (lower === 'active' || lower.includes('đang học')) return 'Đang học';
        if (lower === 'debt' || lower.includes('nợ')) return 'Nợ phí';
        if (lower === 'reserved' || lower.includes('bảo lưu')) return 'Bảo lưu';
        if (lower === 'dropped' || lower === 'inactive' || lower.includes('nghỉ')) return 'Nghỉ học';
        if (lower === 'trial' || lower.includes('học thử')) return 'Học thử';
        return status;
      };

      const activeClasses = classes.filter((c: any) => normalizeClassStatus(c.status) === 'Đang học').length;
      const activeStudents = students.filter((s: any) => normalizeStudentStatus(s.status) === 'Đang học').length;
      
      // Filter out holiday records (status = "LỊCH NGHỈ CHUNG") - these should not be counted as actual attendance sessions
      const actualAttendance = attendance.filter((a: any) => a.status !== 'LỊCH NGHỈ CHUNG');

      // Attendance rate calculation
      let totalPresent = 0;
      let totalRecords = 0;
      actualAttendance.forEach((a: any) => {
        if (a.records) {
          const records = Array.isArray(a.records) ? a.records : Object.values(a.records);
          records.forEach((r: any) => {
            totalRecords++;
            if (r.status === 'Present' || r.status === 'Có mặt') {
              totalPresent++;
            }
          });
        }
      });
      const attendanceRate = totalRecords > 0 ? (totalPresent / totalRecords) * 100 : 0;

      // Tutoring stats
      const completedTutoring = tutoring.filter((t: any) => t.status === 'Đã bồi' || t.status === 'Completed').length;

      // Renewal rate calculation
      // HS hết phí = remaining <= 0 (đã học hết buổi đăng ký)
      const expiredStudents = students.filter((s: any) => {
        const { registered, remaining } = getStudentSessionData(s);
        return registered > 0 && remaining <= 0;
      });
      
      // HS đã gia hạn = có hợp đồng tái phí (category = 'Hợp đồng tái phí') và đã thanh toán
      const renewalContracts = contracts.filter((c: any) => 
        (c.category === 'Hợp đồng tái phí' || c.category === 'Hợp đồng liên kết') &&
        c.status === 'Đã thanh toán'
      );
      
      // Unique students who renewed
      const renewedStudentIds = new Set(renewalContracts.map((c: any) => c.studentId).filter(Boolean));
      const renewedStudents = renewedStudentIds.size;
      
      // Renewal rate = students who renewed / students who expired
      const expiredCount = expiredStudents.length;
      const renewalRate = expiredCount > 0 ? (renewedStudents / expiredCount) * 100 : 0;

      setSummary({
        totalClasses: classes.length,
        activeClasses,
        totalStudents: students.length,
        activeStudents,
        totalSessions: actualAttendance.length, // Exclude holiday records
        attendanceRate,
        tutoringCount: tutoring.length,
        completedTutoring,
        expiredStudents: expiredCount,
        renewedStudents,
        renewalRate,
      });

      // Class summaries with active rate calculation
      const classData: ClassSummary[] = classes.map((c: any) => {
        // Exclude holiday records from class attendance count
        const classAttendance = actualAttendance.filter((a: any) => a.classId === c.id);
        const classTutoring = tutoring.filter((t: any) => t.classId === c.id);
        const classStudents = students.filter((s: any) => s.classId === c.id);
        
        // Track attendance by student
        const studentAttendance: Record<string, { present: number; absent: number; total: number }> = {};
        const studentTutored: Record<string, number> = {}; // count of tutoring sessions
        
        classAttendance.forEach((a: any) => {
          if (a.records) {
            const records = Array.isArray(a.records) ? a.records : Object.values(a.records);
            records.forEach((r: any) => {
              const studentId = r.studentId || r.id;
              if (!studentId) return;
              
              if (!studentAttendance[studentId]) {
                studentAttendance[studentId] = { present: 0, absent: 0, total: 0 };
              }
              studentAttendance[studentId].total++;
              if (r.status === 'Present' || r.status === 'Có mặt') {
                studentAttendance[studentId].present++;
              } else {
                studentAttendance[studentId].absent++;
              }
            });
          }
        });
        
        // Count tutoring per student
        classTutoring.forEach((t: any) => {
          if (t.studentId && (t.status === 'Đã bồi' || t.status === 'Completed')) {
            studentTutored[t.studentId] = (studentTutored[t.studentId] || 0) + 1;
          }
        });
        
        // Calculate active students
        let regularStudents = 0; // HS đi học đều (>=80%)
        let tutoredStudents = 0; // HS vắng nhiều nhưng được bồi đủ
        
        Object.entries(studentAttendance).forEach(([studentId, data]) => {
          if (data.total === 0) return;
          
          const attendanceRate = (data.present / data.total) * 100;
          const absentCount = data.absent;
          const tutoredCount = studentTutored[studentId] || 0;
          
          if (attendanceRate >= 80) {
            // Đi học đều (>=80%)
            regularStudents++;
          } else if (absentCount > 0 && tutoredCount >= absentCount) {
            // Vắng nhưng được bồi đủ
            tutoredStudents++;
          }
        });
        
        const totalStudentCount = c.currentStudents || c.studentsCount || classStudents.length || 0;
        const activeStudents = regularStudents + tutoredStudents;
        const activeRate = totalStudentCount > 0 ? (activeStudents / totalStudentCount) * 100 : 0;
        
        // Overall attendance rate
        let totalPresent = 0;
        let totalRecords = 0;
        Object.values(studentAttendance).forEach(data => {
          totalPresent += data.present;
          totalRecords += data.total;
        });
        
        return {
          id: c.id,
          name: c.name || 'N/A',
          studentCount: totalStudentCount,
          sessionCount: classAttendance.length,
          attendanceRate: totalRecords > 0 ? (totalPresent / totalRecords) * 100 : 0,
          status: normalizeClassStatus(c.status) || 'N/A',
          regularStudents,
          tutoredStudents,
          activeStudents,
          activeRate,
        };
      });

      // Sort by active rate descending, then filter top 10 for display
      classData.sort((a, b) => b.activeRate - a.activeRate);
      setClassSummaries(classData.slice(0, 15));
    } catch (err) {
      console.error('Error fetching training data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Đang tải báo cáo...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-600">Lỗi: {error}</p>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
        <div className="bg-indigo-100 p-2 rounded-lg">
          <BarChart3 className="text-indigo-600" size={24} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-800">Báo cáo đào tạo</h2>
          <p className="text-sm text-gray-500">Tổng hợp số liệu từ lớp học, điểm danh, bồi bài</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          icon={<BookOpen size={20} />}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          label="Lớp học"
          value={`${summary.activeClasses}/${summary.totalClasses}`}
          subtext="Đang hoạt động"
        />
        <SummaryCard
          icon={<Users size={20} />}
          iconBg="bg-green-100"
          iconColor="text-green-600"
          label="Học viên"
          value={`${summary.activeStudents}/${summary.totalStudents}`}
          subtext="Đang học"
        />
        <SummaryCard
          icon={<Calendar size={20} />}
          iconBg="bg-purple-100"
          iconColor="text-purple-600"
          label="Buổi học"
          value={summary.totalSessions.toString()}
          subtext="Đã điểm danh"
        />
        <SummaryCard
          icon={<TrendingUp size={20} />}
          iconBg="bg-orange-100"
          iconColor="text-orange-600"
          label="Tỷ lệ đi học"
          value={`${summary.attendanceRate.toFixed(1)}%`}
          subtext="Trung bình"
        />
      </div>

      {/* Tutoring Stats */}
      <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-6 rounded-xl text-white">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Clock size={20} />
          Thống kê bồi bài
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-3xl font-bold">{summary.tutoringCount}</div>
            <div className="text-cyan-100 text-sm">Tổng yêu cầu bồi</div>
          </div>
          <div>
            <div className="text-3xl font-bold">{summary.completedTutoring}</div>
            <div className="text-cyan-100 text-sm">Đã hoàn thành</div>
          </div>
          <div>
            <div className="text-3xl font-bold">
              {summary.tutoringCount > 0 
                ? `${((summary.completedTutoring / summary.tutoringCount) * 100).toFixed(0)}%`
                : '0%'}
            </div>
            <div className="text-cyan-100 text-sm">Tỷ lệ hoàn thành</div>
          </div>
        </div>
      </div>

      {/* Renewal Rate Stats */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-600 p-6 rounded-xl text-white">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <TrendingUp size={20} />
          Tỉ lệ tái tục
        </h3>
        <p className="text-purple-100 text-xs mb-4">
          HS hết phí mà đăng ký tiếp (không tính đang nợ phí)
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-3xl font-bold">{summary.expiredStudents}</div>
            <div className="text-purple-100 text-sm">HS đã hết phí</div>
          </div>
          <div>
            <div className="text-3xl font-bold">{summary.renewedStudents}</div>
            <div className="text-purple-100 text-sm">HS đã gia hạn</div>
          </div>
          <div>
            <div className={`text-3xl font-bold ${summary.renewalRate >= 70 ? '' : summary.renewalRate >= 50 ? 'text-yellow-200' : 'text-red-200'}`}>
              {summary.renewalRate.toFixed(0)}%
            </div>
            <div className="text-purple-100 text-sm">Tỉ lệ tái tục</div>
          </div>
        </div>
        {summary.expiredStudents > 0 && (
          <div className="mt-4 bg-white/10 rounded-lg p-3">
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${summary.renewalRate >= 70 ? 'bg-green-400' : summary.renewalRate >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                style={{ width: `${Math.min(100, summary.renewalRate)}%` }}
              />
            </div>
            <p className="text-xs text-purple-100 mt-2 text-center">
              {summary.renewedStudents}/{summary.expiredStudents} học viên gia hạn
            </p>
          </div>
        )}
      </div>

      {/* Class Table - Báo cáo chuyên cần */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Award size={18} />
            Báo cáo chuyên cần theo lớp
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Tỉ lệ HS active = (HS đi học đều ≥80% + HS được bồi đủ) / Sĩ số lớp
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-3 text-left">Lớp</th>
                <th className="px-3 py-3 text-center">Sĩ số</th>
                <th className="px-3 py-3 text-center">Đi đều</th>
                <th className="px-3 py-3 text-center">Được bồi</th>
                <th className="px-3 py-3 text-center">HS Active</th>
                <th className="px-3 py-3 text-center">Tỉ lệ Active</th>
                <th className="px-3 py-3 text-center">TT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {classSummaries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400">
                    Chưa có dữ liệu lớp học
                  </td>
                </tr>
              ) : classSummaries.map((cls) => (
                <tr key={cls.id} className="hover:bg-gray-50">
                  <td className="px-3 py-3 font-medium text-gray-900">{cls.name}</td>
                  <td className="px-3 py-3 text-center font-bold">{cls.studentCount}</td>
                  <td className="px-3 py-3 text-center">
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">
                      {cls.regularStudents}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold">
                      {cls.tutoredStudents}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-bold">
                      {cls.activeStudents}/{cls.studentCount}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            cls.activeRate >= 80 ? 'bg-green-500' :
                            cls.activeRate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(100, cls.activeRate)}%` }}
                        />
                      </div>
                      <span className={`text-xs font-bold ${
                        cls.activeRate >= 80 ? 'text-green-600' :
                        cls.activeRate >= 60 ? 'text-yellow-600' : 'text-red-600'
                      }`}>{cls.activeRate.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      cls.status === 'Đang học' ? 'bg-green-100 text-green-700' :
                      cls.status === 'Kết thúc' ? 'bg-gray-100 text-gray-600' :
                      cls.status === 'Tạm dừng' ? 'bg-yellow-100 text-yellow-700' :
                      cls.status === 'Chờ mở' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {cls.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Summary Card
interface SummaryCardProps {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  subtext: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ icon, iconBg, iconColor, label, value, subtext }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
    <div className="flex items-center gap-3">
      <div className={`${iconBg} p-2 rounded-lg ${iconColor}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-400">{subtext}</p>
      </div>
    </div>
  </div>
);
