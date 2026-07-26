import { collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, writeBatch, runTransaction, arrayUnion, Timestamp, db } from '@/src/utils/legacyFirestoreStub';
/**
 * Today's Attendance View
 * Hiển thị dữ liệu điểm danh của ngày hôm nay
 */

import React, { useState, useEffect } from 'react';
import { AttendanceRecord, StudentAttendance } from '../types';
import { Calendar, Users, CheckCircle2, XCircle, Clock, BookOpen } from 'lucide-react';

export const TodayAttendance: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [studentAttendanceRecords, setStudentAttendanceRecords] = useState<StudentAttendance[]>([]);
  const [selectedAttendanceId, setSelectedAttendanceId] = useState<string | null>(null);
  const [today, setToday] = useState('');

  useEffect(() => {
    // Lấy ngày hôm nay (local timezone, không phải UTC)
    const todayDate = new Date();
    const year = todayDate.getFullYear();
    const month = String(todayDate.getMonth() + 1).padStart(2, '0');
    const day = String(todayDate.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    setToday(todayStr);

    console.log('[TodayAttendance] Loading attendance for date:', todayStr);
    loadTodayAttendance(todayStr);
  }, []);

  const loadTodayAttendance = async (date: string) => {
    try {
      setLoading(true);

      // Load attendance records
      // Note: Firestore query is case-sensitive and exact match
      console.log('[TodayAttendance] Querying attendance for date:', date);
      const attendanceQuery = query(
        collection(null as any /* firebase removed */, 'attendance'),
        where('date', '==', date)
      );
      const attendanceSnap = await getDocs(attendanceQuery);
      const records = attendanceSnap.docs.map(doc => {
        const data = doc.data();
        console.log('[TodayAttendance] Found attendance record:', {
          id: doc.id,
          date: data.date,
          className: data.className,
          classId: data.classId
        });
        return {
          id: doc.id,
          ...data
        } as AttendanceRecord;
      });
      console.log('[TodayAttendance] Total attendance records found:', records.length);
      setAttendanceRecords(records);

      // Load student attendance records
      const studentAttendanceQuery = query(
        collection(null as any /* firebase removed */, 'studentAttendance'),
        where('date', '==', date)
      );
      const studentAttendanceSnap = await getDocs(studentAttendanceQuery);
      const studentRecords = studentAttendanceSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as StudentAttendance));
      setStudentAttendanceRecords(studentRecords);

    } catch (error) {
      console.error('Error loading today attendance:', error);
      alert('Không thể tải dữ liệu điểm danh');
    } finally {
      setLoading(false);
    }
  };

  const getStudentsByAttendanceId = (attendanceId: string) => {
    return studentAttendanceRecords.filter(s => s.attendanceId === attendanceId);
  };

  const getStatusCount = (students: StudentAttendance[]) => {
    const counts = {
      onTime: 0,
      late: 0,
      absent: 0,
      reserved: 0,
      tutored: 0,
    };
    students.forEach(s => {
      if (s.status === 'Đúng giờ') counts.onTime++;
      else if (s.status === 'Trễ giờ') counts.late++;
      else if (s.status === 'Vắng') counts.absent++;
      else if (s.status === 'Nghỉ có phép' || s.status === 'Bảo lưu') counts.reserved++;
      else if (s.status === 'Đã bồi') counts.tutored++;
    });
    return counts;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3"></div>
          <p className="text-gray-500">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Calendar className="w-6 h-6" />
          Dữ liệu điểm danh hôm nay
        </h1>
        <p className="text-gray-600 mt-1">Ngày: {today}</p>
      </div>

      {attendanceRecords.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800">⚠️ Không có điểm danh nào được ghi nhận hôm nay!</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <BookOpen size={18} />
                <span className="text-sm font-medium">Tổng số lớp</span>
              </div>
              <p className="text-2xl font-bold text-gray-800">{attendanceRecords.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <Users size={18} />
                <span className="text-sm font-medium">Tổng học sinh</span>
              </div>
              <p className="text-2xl font-bold text-gray-800">
                {studentAttendanceRecords.length}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border border-green-200">
              <div className="flex items-center gap-2 text-green-600 mb-2">
                <CheckCircle2 size={18} />
                <span className="text-sm font-medium">Có mặt</span>
              </div>
              <p className="text-2xl font-bold text-green-700">
                {studentAttendanceRecords.filter(s => s.status === 'Đúng giờ' || s.status === 'Trễ giờ' || s.status === 'Đã bồi').length}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border border-red-200">
              <div className="flex items-center gap-2 text-red-600 mb-2">
                <XCircle size={18} />
                <span className="text-sm font-medium">Vắng</span>
              </div>
              <p className="text-2xl font-bold text-red-700">
                {studentAttendanceRecords.filter(s => s.status === 'Vắng').length}
              </p>
            </div>
          </div>

          {/* Attendance Records */}
          <div className="space-y-4">
            {attendanceRecords.map((record) => {
              const students = getStudentsByAttendanceId(record.id);
              const statusCount = getStatusCount(students);
              const isExpanded = selectedAttendanceId === record.id;

              return (
                <div key={record.id} className="bg-white rounded-lg shadow border border-gray-200">
                  {/* Header */}
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setSelectedAttendanceId(isExpanded ? null : record.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-gray-800">{record.className || 'N/A'}</h3>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                          <span>📅 {record.date}</span>
                          {record.sessionNumber && <span>📚 Buổi #{record.sessionNumber}</span>}
                          {record.sessionId && (
                            <span className="flex items-center gap-1">
                              ✅ Buổi chính thức
                            </span>
                          )}
                          {record.attendanceType === 'makeup' && (
                            <span className="flex items-center gap-1 text-orange-600">
                              ⚠️ Học bù
                            </span>
                          )}
                          {record.attendanceType === 'manual' && (
                            <span className="flex items-center gap-1 text-blue-600">
                              📝 Điểm danh thủ công
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-600">Tổng: {record.totalStudents || 0}</div>
                        <div className="flex items-center gap-4 mt-1 text-xs">
                          <span className="text-green-600">Có mặt: {record.present || 0}</span>
                          <span className="text-red-600">Vắng: {record.absent || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      <div className="mb-4">
                        <h4 className="font-semibold text-gray-700 mb-2">Chi tiết điểm danh:</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                          <div className="bg-green-50 p-2 rounded">
                            <div className="text-green-700 font-medium">Đúng giờ</div>
                            <div className="text-lg font-bold text-green-800">{statusCount.onTime}</div>
                          </div>
                          <div className="bg-yellow-50 p-2 rounded">
                            <div className="text-yellow-700 font-medium">Trễ giờ</div>
                            <div className="text-lg font-bold text-yellow-800">{statusCount.late}</div>
                          </div>
                          <div className="bg-red-50 p-2 rounded">
                            <div className="text-red-700 font-medium">Vắng</div>
                            <div className="text-lg font-bold text-red-800">{statusCount.absent}</div>
                          </div>
                          <div className="bg-orange-50 p-2 rounded">
                            <div className="text-orange-700 font-medium">Nghỉ có phép</div>
                            <div className="text-lg font-bold text-orange-800">{statusCount.reserved}</div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-semibold text-gray-700 mb-2">Danh sách học sinh:</h4>
                        {students.map((student) => (
                          <div
                            key={student.id}
                            className="bg-white p-3 rounded border border-gray-200 flex items-center justify-between"
                          >
                            <div className="flex-1">
                              <div className="font-medium text-gray-800">
                                {student.studentName} ({student.studentCode})
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                Status: <span className="font-medium">{student.status || 'N/A'}</span>
                                {student.attendanceType === 'makeup' ? (
                                  <span className="ml-2 text-orange-600">⚠️ Học bù</span>
                                ) : student.attendanceType === 'session' || student.sessionId ? (
                                  <span className="ml-2 text-green-600">✅ Buổi chính thức</span>
                                ) : student.attendanceType === 'manual' ? (
                                  <span className="ml-2 text-blue-600">📝 Điểm danh thủ công</span>
                                ) : null}
                              </div>
                              {(student.homeworkCompletion !== undefined || student.score !== undefined || student.testName) && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {student.homeworkCompletion !== undefined && `BTVN: ${student.homeworkCompletion}%`}
                                  {student.testName && ` | Bài KT: ${student.testName}`}
                                  {student.score !== undefined && ` | Điểm: ${student.score}`}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              {student.status === 'Đúng giờ' && (
                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                                  Đúng giờ
                                </span>
                              )}
                              {student.status === 'Trễ giờ' && (
                                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                                  Trễ giờ
                                </span>
                              )}
                              {student.status === 'Vắng' && (
                                <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                                  Vắng
                                </span>
                              )}
                              {(student.status === 'Nghỉ có phép' || student.status === 'Bảo lưu') && (
                                <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                                  Nghỉ có phép
                                </span>
                              )}
                              {student.status === 'Đã bồi' && (
                                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                                  Đã bồi
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
