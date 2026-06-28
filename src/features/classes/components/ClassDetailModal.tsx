import { collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, writeBatch, runTransaction, arrayUnion, Timestamp, db } from '@/src/utils/legacyFirestoreStub';
/**
 * ClassDetailModal Component
 * Modal for viewing class details, session progress, and student stats
 * Extracted from pages/ClassManager.tsx for modularity
 */

import React, { useState, useEffect } from 'react';
import { X, Users, Clock, Calendar, MapPin, User, GraduationCap, BookOpen, CheckCircle, Edit } from 'lucide-react';
import { ModalPortal } from '@/components/modal-portal';
import { ClassModel } from '@/types';
import { formatSchedule } from '@/src/utils/scheduleUtils';

// Type for ClassSession used in detail modal
interface ClassSession {
  id: string;
  classId: string;
  sessionNumber: number;
  date: string;
  dayOfWeek: string;
  time?: string | null;
  status: string;
}

// Helper to parse progress string like "0/18" to get total sessions
const parseTotalFromProgress = (progress: string | undefined): number => {
  if (!progress) return 0;
  const match = progress.match(/\/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
};

// Helper to safely format date
const formatDateSafe = (dateValue: unknown): string => {
  if (!dateValue) return '?';
  try {
    // Handle Firestore Timestamp
    if (typeof dateValue === 'object' && dateValue !== null && 'toDate' in dateValue) {
      return (dateValue as { toDate: () => Date }).toDate().toLocaleDateString('vi-VN');
    }
    const date = new Date(dateValue as string);
    if (isNaN(date.getTime())) return '?';
    return date.toLocaleDateString('vi-VN');
  } catch {
    return '?';
  }
};

export interface ClassDetailModalProps {
  classData: ClassModel;
  studentCounts: {
    total: number;
    trial: number;
    active: number;
    debt: number;
    reserved: number;
    dropped: number;
    remainingSessions: number;
    remainingValue: number;
  };
  onClose: () => void;
  onEdit: () => void;
  onManageStudents: () => void;
  canEdit: boolean;
}

export const ClassDetailModal: React.FC<ClassDetailModalProps> = ({
  classData,
  studentCounts,
  onClose,
  onEdit,
  onManageStudents,
  canEdit
}) => {
  const [studentsInClass, setStudentsInClass] = useState<any[]>([]);
  const [sessionStats, setSessionStats] = useState<{ completed: number; total: number; upcoming: ClassSession[] }>({ completed: 0, total: 0, upcoming: [] });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Fetch students in class and session stats
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch students
        const studentsSnap = await getDocs(collection(null as any /* firebase removed */, 'students'));
        const students = studentsSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((s: any) =>
            s.classId === classData.id ||
            s.currentClassId === classData.id ||
            s.class === classData.name ||
            s.className === classData.name ||
            (Array.isArray(s.classIds) && s.classIds.includes(classData.id))
          );
        setStudentsInClass(students);

        // Fetch sessions
        const sessionsSnap = await getDocs(
          query(
            collection(null as any /* firebase removed */, 'classSessions'),
            where('classId', '==', classData.id)
          )
        );
        const allSessions = sessionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ClassSession[];
        // Filter valid sessions (sessionNumber > 0) - consistent with sessionService.ts
        const sessions = allSessions.filter(s => s.sessionNumber > 0);
        const completed = sessions.filter(s => s.status === 'Đã học').length;
        const today = new Date().toISOString().split('T')[0];
        const upcoming = sessions
          .filter(s => s.status === 'Chưa học' && s.date >= today)
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(0, 3);

        setSessionStats({ completed, total: sessions.length, upcoming });
      } catch (err) {
        console.error('Error fetching class data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [classData.id, classData.name]);

  // Generate sessions for this class
  const handleGenerateSessions = async () => {
    // Get total from totalSessions or parse from progress string
    const effectiveTotal = classData.totalSessions || parseTotalFromProgress(classData.progress);

    if (!classData.schedule) {
      alert('Vui lòng cập nhật lịch học trước khi tạo buổi học');
      return;
    }

    if (!effectiveTotal) {
      alert('Vui lòng cập nhật tổng số buổi trước khi tạo buổi học');
      return;
    }

    if (!confirm(`Tạo ${effectiveTotal} buổi học cho lớp ${classData.name}?`)) return;

    setGenerating(true);
    try {
      // Parse schedule
      const DAY_MAP: Record<string, number> = {
        'chủ nhật': 0, 'cn': 0,
        'thứ 2': 1, 'thứ hai': 1, 't2': 1,
        'thứ 3': 2, 'thứ ba': 2, 't3': 2,
        'thứ 4': 3, 'thứ tư': 3, 't4': 3,
        'thứ 5': 4, 'thứ năm': 4, 't5': 4,
        'thứ 6': 5, 'thứ sáu': 5, 't6': 5,
        'thứ 7': 6, 'thứ bảy': 6, 't7': 6,
      };
      const DAY_NAMES = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

      const scheduleLower = classData.schedule.toLowerCase();
      const days: Set<number> = new Set();

      for (const [dayName, dayNum] of Object.entries(DAY_MAP)) {
        if (scheduleLower.includes(dayName)) days.add(dayNum);
      }
      const tMatches = classData.schedule.match(/T([2-7])/gi);
      if (tMatches) {
        tMatches.forEach(match => {
          const n = parseInt(match.substring(1));
          if (n >= 2 && n <= 7) days.add(n === 7 ? 6 : n - 1);
        });
      }

      const scheduleDays = Array.from(days).sort();
      if (scheduleDays.length === 0) {
        alert('Không thể phân tích lịch học. Vui lòng kiểm tra định dạng.');
        setGenerating(false);
        return;
      }

      // Parse time
      const timeMatch = classData.schedule.match(/(\d{1,2})[h:](\d{2})?\s*[-–]\s*(\d{1,2})[h:](\d{2})?/);
      const time = timeMatch
        ? `${timeMatch[1].padStart(2, '0')}:${(timeMatch[2] || '00').padStart(2, '0')}-${timeMatch[3].padStart(2, '0')}:${(timeMatch[4] || '00').padStart(2, '0')}`
        : null;

      // Generate sessions
      const sessions: any[] = [];
      let currentDate = classData.startDate ? new Date(classData.startDate) : new Date();
      let sessionNumber = 1;
      let daysChecked = 0;

      while (sessionNumber <= effectiveTotal && daysChecked < 365) {
        const dayOfWeek = currentDate.getDay();
        if (scheduleDays.includes(dayOfWeek)) {
          sessions.push({
            classId: classData.id,
            className: classData.name,
            sessionNumber,
            date: currentDate.toISOString().split('T')[0],
            dayOfWeek: DAY_NAMES[dayOfWeek],
            time,
            room: classData.room || null,
            teacherName: classData.teacher || null,
            status: 'Chưa học',
            createdAt: new Date().toISOString(),
          });
          sessionNumber++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
        daysChecked++;
      }

      // Save to Firestore
      for (const session of sessions) {
        await addDoc(collection(null as any /* firebase removed */, 'classSessions'), session);
      }

      alert(`Đã tạo ${sessions.length} buổi học!`);

      // Refresh session stats
      setSessionStats({ completed: 0, total: sessions.length, upcoming: sessions.slice(0, 3) as ClassSession[] });
    } catch (err) {
      console.error('Error generating sessions:', err);
      alert('Lỗi khi tạo buổi học');
    } finally {
      setGenerating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Đang hoạt động':
      case 'Active':
        return 'bg-green-100 text-green-700';
      case 'Kết thúc':
        return 'bg-gray-100 text-gray-700';
      case 'Tạm dừng':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-blue-100 text-blue-700';
    }
  };

  return (
    <ModalPortal>
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">{classData.name}</h2>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(classData.status)}`}>
                  {classData.status}
                </span>
                {classData.level && (
                  <span className="text-blue-200 text-sm">• {classData.level}</span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors">
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <User className="text-blue-600 mt-0.5" size={20} />
              <div>
                <p className="text-xs text-gray-500">Giáo viên VN</p>
                <p className="font-medium text-gray-800">{classData.teacher || 'Chưa phân công'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <GraduationCap className="text-purple-600 mt-0.5" size={20} />
              <div>
                <p className="text-xs text-gray-500">Giáo viên NN</p>
                <p className="font-medium text-gray-800">{classData.foreignTeacher || 'Không có'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Clock className="text-green-600 mt-0.5" size={20} />
              <div>
                <p className="text-xs text-gray-500">Lịch học</p>
                <p className="font-medium text-gray-800">{formatSchedule(classData.schedule) || 'Chưa có'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <MapPin className="text-red-600 mt-0.5" size={20} />
              <div>
                <p className="text-xs text-gray-500">Phòng học</p>
                <p className="font-medium text-gray-800">{classData.room || 'Chưa xếp'}</p>
              </div>
            </div>
            {classData.branch && (
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <MapPin className="text-purple-600 mt-0.5" size={20} />
                <div>
                  <p className="text-xs text-gray-500">Cơ sở</p>
                  <p className="font-medium text-gray-800">{classData.branch}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Calendar className="text-orange-600 mt-0.5" size={20} />
              <div>
                <p className="text-xs text-gray-500">Thời gian</p>
                <p className="font-medium text-gray-800">
                  {formatDateSafe(classData.startDate)} → {formatDateSafe(classData.endDate)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Calendar className="text-blue-600 mt-0.5" size={20} />
              <div>
                <p className="text-xs text-gray-500">Ngay tao lop</p>
                <p className="font-medium text-gray-800">{formatDateSafe(classData.createdDate || classData.createdAt)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <BookOpen className="text-indigo-600 mt-0.5" size={20} />
              <div>
                <p className="text-xs text-gray-500">Chương trình</p>
                <p className="font-medium text-gray-800">{classData.curriculum || 'Chưa có'}</p>
              </div>
            </div>
            {classData.tuitionFee !== undefined && classData.tuitionFee > 0 && (
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="text-emerald-600 mt-0.5 flex-shrink-0">
                  <span className="font-bold text-lg leading-none">₫</span>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Học phí</p>
                  <p className="font-medium text-gray-800">
                    {classData.tuitionFee ? classData.tuitionFee.toLocaleString('vi-VN') + 'đ' : 'Chưa cập nhật'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Session Progress */}
          <div className={`rounded-lg p-4 ${classData.status === 'Kết thúc' ? 'bg-gray-100' : 'bg-indigo-50'}`}>
            <h3 className={`font-semibold mb-3 flex items-center gap-2 ${classData.status === 'Kết thúc' ? 'text-gray-700' : 'text-indigo-900'}`}>
              <CheckCircle size={18} />
              Tiến độ buổi học
            </h3>
            {loading ? (
              <div className="text-center text-indigo-600">Đang tải...</div>
            ) : classData.status === 'Kết thúc' ? (
              /* Lớp đã kết thúc */
              <div className="text-gray-600 text-sm">
                {sessionStats.total > 0 ? (
                  <p>Lớp đã kết thúc - Hoàn thành {sessionStats.completed}/{sessionStats.total} buổi</p>
                ) : (
                  <p>Lớp đã kết thúc (không có dữ liệu buổi học)</p>
                )}
              </div>
            ) : sessionStats.total > 0 ? (
              <>
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex-1 bg-indigo-200 rounded-full h-3">
                    <div
                      className="bg-indigo-600 h-3 rounded-full transition-all"
                      style={{ width: `${(sessionStats.completed / sessionStats.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-indigo-900">
                    {sessionStats.completed}/{sessionStats.total} buổi
                  </span>
                </div>
                {sessionStats.upcoming.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-indigo-700 mb-2">Buổi học sắp tới:</p>
                    <div className="space-y-1">
                      {sessionStats.upcoming.map(s => (
                        <div key={s.id} className="text-sm text-indigo-800 flex items-center gap-2">
                          <span className="w-16">Buổi {s.sessionNumber}</span>
                          <span>{new Date(s.date).toLocaleDateString('vi-VN')}</span>
                          <span className="text-indigo-500">({s.dayOfWeek})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (() => {
              // No actual sessions - show button to create them
              // Get total from totalSessions field or parse from progress string
              const effectiveTotal = classData.totalSessions || parseTotalFromProgress(classData.progress);

              if (!effectiveTotal) {
                return (
                  <div>
                    <p className="text-indigo-600 text-sm mb-2">Chưa thiết lập số buổi học</p>
                    <p className="text-xs text-gray-500">Vui lòng chỉnh sửa lớp để thêm tổng số buổi và lịch học</p>
                  </div>
                );
              }

              return (
              /* Có tổng số buổi nhưng chưa tạo sessions */
              <div>
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex-1 bg-indigo-200 rounded-full h-3">
                    <div
                      className="bg-indigo-600 h-3 rounded-full transition-all"
                      style={{ width: '0%' }}
                    />
                  </div>
                  <span className="text-sm font-medium text-indigo-900">
                    0/{effectiveTotal} buổi
                  </span>
                </div>
                <button
                  onClick={handleGenerateSessions}
                  disabled={generating || !classData.schedule}
                  className="w-full mt-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
                >
                  {generating ? 'Đang tạo...' : `Tạo ${effectiveTotal} buổi học`}
                </button>
                {!classData.schedule && (
                  <p className="text-xs text-orange-600 mt-2">Vui lòng thiết lập lịch học trước khi tạo buổi</p>
                )}
              </div>
              );
            })()}
          </div>

          {/* Student Stats */}
          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
              <Users size={18} />
              Học viên ({studentCounts.total})
            </h3>
            <div className="grid grid-cols-5 gap-2 text-center">
              <div className="bg-white rounded-lg p-2">
                <p className="text-lg font-bold text-green-600">{studentCounts.active}</p>
                <p className="text-xs text-gray-500">Đang học</p>
              </div>
              <div className="bg-white rounded-lg p-2">
                <p className="text-lg font-bold text-purple-600">{studentCounts.trial}</p>
                <p className="text-xs text-gray-500">Học thử</p>
              </div>
              <div className="bg-white rounded-lg p-2">
                <p className="text-lg font-bold text-red-600">{studentCounts.debt}</p>
                <p className="text-xs text-gray-500">Nợ phí</p>
              </div>
              <div className="bg-white rounded-lg p-2">
                <p className="text-lg font-bold text-orange-600">{studentCounts.reserved}</p>
                <p className="text-xs text-gray-500">Bảo lưu</p>
              </div>
              <div className="bg-white rounded-lg p-2">
                <p className="text-lg font-bold text-gray-500">{studentCounts.dropped}</p>
                <p className="text-xs text-gray-500">Nghỉ học</p>
              </div>
            </div>

            {/* Student List Preview */}
            {studentsInClass.length > 0 && (
              <div className="mt-3 pt-3 border-t border-green-200">
                <p className="text-xs text-green-700 mb-2">Danh sách học viên:</p>
                <div className="flex flex-wrap gap-1">
                  {studentsInClass.slice(0, 8).map((s: any) => (
                    <span key={s.id} className="px-2 py-1 bg-white rounded text-xs text-gray-700">
                      {s.fullName || s.name}
                    </span>
                  ))}
                  {studentsInClass.length > 8 && (
                    <span className="px-2 py-1 bg-green-200 rounded text-xs text-green-700">
                      +{studentsInClass.length - 8} khác
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Công nợ buổi học còn lại */}
            {studentCounts.remainingSessions > 0 && (
              <div className="mt-3 pt-3 border-t border-green-200">
                <p className="text-xs text-green-700 mb-2">Buổi học còn lại (TT nợ HV):</p>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-bold">
                    {studentCounts.remainingSessions} buổi
                  </span>
                  <span className="text-sm text-gray-600">
                    ~{(studentCounts.remainingValue / 1000000).toFixed(1)} triệu đồng
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Training History - Always show */}
          <div className="bg-purple-50 rounded-lg p-4">
            <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
              <Clock size={18} />
              Lịch sử đào tạo ({(classData.trainingHistory?.length || 0) + (classData.teacher ? 1 : 0)})
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {/* Show training history if exists */}
              {classData.trainingHistory && classData.trainingHistory.length > 0 &&
                [...classData.trainingHistory]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((entry) => (
                    <div key={entry.id} className="bg-white rounded-lg p-3 border border-purple-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          entry.type === 'schedule_change' ? 'bg-blue-100 text-blue-700' :
                          entry.type === 'teacher_change' ? 'bg-green-100 text-green-700' :
                          entry.type === 'room_change' ? 'bg-orange-100 text-orange-700' :
                          entry.type === 'status_change' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {entry.type === 'schedule_change' ? 'Lịch học' :
                           entry.type === 'teacher_change' ? 'Giáo viên' :
                           entry.type === 'room_change' ? 'Phòng học' :
                           entry.type === 'status_change' ? 'Trạng thái' : 'Khác'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(entry.date).toLocaleDateString('vi-VN', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 font-medium">{entry.description}</p>
                      <div className="text-xs text-gray-600 mt-1">
                        <span className="line-through text-red-500">{entry.oldValue}</span>
                        <span className="mx-2">→</span>
                        <span className="text-green-600 font-medium">{entry.newValue}</span>
                      </div>
                      {entry.changedBy && (
                        <p className="text-xs text-gray-400 mt-1">Bởi: {entry.changedBy}</p>
                      )}
                    </div>
                  ))
              }

              {/* Always show current teacher as the initial/current state */}
              {classData.teacher && (
                <div className="bg-white rounded-lg p-3 border border-purple-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                      Giáo viên
                    </span>
                    <span className="text-xs text-gray-500">
                      {(() => {
                        if (!classData.createdAt) return 'Ban đầu';
                        // Handle Firestore Timestamp
                        const date = (classData.createdAt as any)?.toDate ? (classData.createdAt as any).toDate() : new Date(classData.createdAt as string);
                        if (isNaN(date.getTime())) return 'Ban đầu';
                        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
                      })()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 font-medium">Thay đổi giáo viên chính</p>
                  <div className="text-xs text-gray-600 mt-1">
                    <span className="text-gray-400">Bắt đầu</span>
                    <span className="mx-2">→</span>
                    <span className="text-green-600 font-medium">{classData.teacher}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Bởi: System</p>
                </div>
              )}

              {/* Show message if no teacher assigned */}
              {!classData.teacher && (!classData.trainingHistory || classData.trainingHistory.length === 0) && (
                <div className="text-center py-4 text-gray-500 text-sm">
                  Chưa có thông tin đào tạo
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {classData.notes && (
            <div className="bg-yellow-50 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-900 mb-2">Ghi chú</h3>
              <p className="text-sm text-yellow-800">{classData.notes}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between">
          <button
            onClick={onManageStudents}
            className="px-4 py-2 border border-green-500 text-green-600 rounded-lg hover:bg-green-50 flex items-center gap-2"
          >
            <Users size={18} /> Quản lý học viên
          </button>
          <div className="flex gap-2">
            {canEdit && (
              <button
                onClick={onEdit}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
              >
                <Edit size={18} /> Chỉnh sửa
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

export default ClassDetailModal;
