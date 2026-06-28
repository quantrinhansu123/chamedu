/**
 * Attendance Service
 * Handle attendance CRUD operations with Firestore
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  QueryConstraint,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { AttendanceRecord, StudentAttendance, AttendanceStatus, StudentStatus } from '../../types';

const ATTENDANCE_COLLECTION = 'attendance';
const STUDENT_ATTENDANCE_COLLECTION = 'studentAttendance';
const TUTORING_COLLECTION = 'tutoring';

/**
 * Create attendance record for a class session
 */
export const createAttendanceRecord = async (
  data: Omit<AttendanceRecord, 'id'>
): Promise<string> => {
  try {
    const recordData = {
      ...data,
      // Trim className to avoid trailing spaces
      className: data.className?.trim() || data.className,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, ATTENDANCE_COLLECTION), recordData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating attendance record:', error);
    throw new Error('Kh├┤ng thß╗â tß║ío bß║ún ghi ─æiß╗âm danh');
  }
};

/**
 * Get attendance record by ID
 */
export const getAttendanceRecord = async (id: string): Promise<AttendanceRecord | null> => {
  try {
    const docRef = doc(db, ATTENDANCE_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;

    return { id: docSnap.id, ...docSnap.data() } as AttendanceRecord;
  } catch (error) {
    console.error('Error getting attendance record:', error);
    throw new Error('Kh├┤ng thß╗â tß║úi bß║ún ghi ─æiß╗âm danh');
  }
};

/**
 * Get attendance records with optional filters
 */
export const getAttendanceRecords = async (filters?: {
  classId?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
}): Promise<AttendanceRecord[]> => {
  try {
    const constraints: QueryConstraint[] = [orderBy('date', 'desc')];

    if (filters?.classId) {
      constraints.unshift(where('classId', '==', filters.classId));
    }

    if (filters?.date) {
      constraints.unshift(where('date', '==', filters.date));
    }

    const q = query(collection(db, ATTENDANCE_COLLECTION), ...constraints);
    const snapshot = await getDocs(q);

    let records = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as AttendanceRecord));

    // Client-side date range filter
    if (filters?.startDate) {
      records = records.filter(r => r.date >= filters.startDate!);
    }
    if (filters?.endDate) {
      records = records.filter(r => r.date <= filters.endDate!);
    }

    return records;
  } catch (error) {
    console.error('Error getting attendance records:', error);
    throw new Error('Kh├┤ng thß╗â tß║úi danh s├ích ─æiß╗âm danh');
  }
};

/**
 * Check if attendance already exists for class + date
 */
export const checkExistingAttendance = async (
  classId: string,
  date: string
): Promise<AttendanceRecord | null> => {
  try {
    const q = query(
      collection(db, ATTENDANCE_COLLECTION),
      where('classId', '==', classId),
      where('date', '==', date)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as AttendanceRecord;
  } catch (error) {
    console.error('Error checking existing attendance:', error);
    throw new Error('Lß╗ùi kiß╗âm tra ─æiß╗âm danh');
  }
};

/**
 * Save student attendance details
 */
export const saveStudentAttendance = async (
  attendanceId: string,
  students: Omit<StudentAttendance, 'id' | 'attendanceId'>[],
  classId?: string,
  className?: string,
  date?: string,
  sessionNumber?: number,
  sessionId?: string,
  attendanceType?: 'session' | 'makeup' | 'manual'
): Promise<Map<string, string>> => {  // Return map of studentId -> studentAttendanceId
  try {
    console.log('[saveStudentAttendance] Starting...', { attendanceId, studentsCount: students.length });

    if (students.length === 0) {
      console.warn('[saveStudentAttendance] No students to save!');
      return new Map();
    }

    const batch = writeBatch(db);
    const studentAttendanceIdMap = new Map<string, string>(); // studentId -> studentAttendanceId

    // Delete existing records for this attendance
    const existingQuery = query(
      collection(db, STUDENT_ATTENDANCE_COLLECTION),
      where('attendanceId', '==', attendanceId)
    );
    const existingDocs = await getDocs(existingQuery);
    console.log('[saveStudentAttendance] Deleting existing:', existingDocs.size);
    existingDocs.docs.forEach(d => batch.delete(d.ref));

    // Add new records with extended fields
    console.log('[saveStudentAttendance] Adding', students.length, 'new records...');
    console.log('[saveStudentAttendance] sessionId:', sessionId, 'sessionNumber:', sessionNumber);
    students.forEach((student, i) => {
      const docRef = doc(collection(db, STUDENT_ATTENDANCE_COLLECTION));

      // Build record, excluding undefined values (Firestore doesn't accept undefined)
      const record: Record<string, unknown> = {
        studentId: student.studentId,
        studentName: student.studentName,
        studentCode: student.studentCode,
        status: student.status,
        attendanceId,
        classId: classId || null,
        className: className || null,
        date: date || null,
        sessionNumber: sessionNumber || null,
        sessionId: sessionId || null,
        createdAt: new Date().toISOString(),
      };
      
      // Copy attendanceType from parent attendance record
      if (attendanceType) {
        record.attendanceType = attendanceType;
      }
      
      console.log(`[saveStudentAttendance] Student ${student.studentName} (${student.studentId}): status=${student.status}, sessionId=${sessionId || 'null'}, sessionNumber=${sessionNumber || 'null'}`);

      // Add optional fields only if they have values
      if (student.note) record.note = student.note;
      if (student.homeworkCompletion !== undefined) record.homeworkCompletion = student.homeworkCompletion;
      if (student.testName) record.testName = student.testName;
      if (student.score !== undefined) record.score = student.score;
      if (student.bonusPoints !== undefined) record.bonusPoints = student.bonusPoints;
      if (student.punctuality) record.punctuality = student.punctuality;
      if (student.isLate !== undefined) record.isLate = student.isLate;

      batch.set(docRef, record);
      // Store the mapping: studentId -> studentAttendanceId (docRef.id)
      studentAttendanceIdMap.set(student.studentId, docRef.id);
    });

    console.log('[saveStudentAttendance] Committing batch...');
    try {
      await batch.commit();
      console.log('[saveStudentAttendance] Batch committed successfully!');
    } catch (commitError) {
      console.error('[saveStudentAttendance] Batch commit failed:', commitError);
      throw commitError;
    }
    console.log('[saveStudentAttendance] Saved', students.length, 'students');
    return studentAttendanceIdMap;
  } catch (error) {
    console.error('[saveStudentAttendance] Error:', error);
    throw new Error('Kh├┤ng thß╗â l╞░u ─æiß╗âm danh hß╗ìc sinh');
  }
};

/**
 * Get student attendance for a record
 */
export const getStudentAttendance = async (
  attendanceId: string
): Promise<StudentAttendance[]> => {
  try {
    const q = query(
      collection(db, STUDENT_ATTENDANCE_COLLECTION),
      where('attendanceId', '==', attendanceId)
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as StudentAttendance));
  } catch (error) {
    console.error('Error getting student attendance:', error);
    throw new Error('Kh├┤ng thß╗â tß║úi ─æiß╗âm danh chi tiß║┐t');
  }
};

/**
 * Update attendance record summary
 */
export const updateAttendanceRecord = async (
  id: string,
  data: Partial<AttendanceRecord>
): Promise<void> => {
  try {
    const docRef = doc(db, ATTENDANCE_COLLECTION, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error updating attendance record:', error);
    throw new Error('Kh├┤ng thß╗â cß║¡p nhß║¡t bß║ún ghi ─æiß╗âm danh');
  }
};

/**
 * Delete attendance record and related student records
 */
export const deleteAttendanceRecord = async (id: string): Promise<void> => {
  try {
    const batch = writeBatch(db);

    // Delete main record
    batch.delete(doc(db, ATTENDANCE_COLLECTION, id));

    // Delete related student attendance
    const studentQuery = query(
      collection(db, STUDENT_ATTENDANCE_COLLECTION),
      where('attendanceId', '==', id)
    );
    const studentDocs = await getDocs(studentQuery);
    studentDocs.docs.forEach(doc => batch.delete(doc.ref));

    await batch.commit();
  } catch (error) {
    console.error('Error deleting attendance record:', error);
    throw new Error('Kh├┤ng thß╗â x├│a bß║ún ghi ─æiß╗âm danh');
  }
};

/**
 * Find studentAttendance record by student, class, and date
 * Used to link tutoring records with original attendance
 */
export const findStudentAttendanceRecord = async (
  studentId: string,
  classId: string,
  date: string
): Promise<{ id: string; status: AttendanceStatus } | null> => {
  try {
    const q = query(
      collection(db, STUDENT_ATTENDANCE_COLLECTION),
      where('studentId', '==', studentId),
      where('classId', '==', classId),
      where('date', '==', date)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    const docData = snapshot.docs[0];
    return {
      id: docData.id,
      status: docData.data().status as AttendanceStatus
    };
  } catch (error) {
    console.error('Error finding student attendance:', error);
    return null;
  }
};

/**
 * Update a single studentAttendance record status
 */
export const updateStudentAttendanceStatus = async (
  id: string,
  status: AttendanceStatus
): Promise<void> => {
  try {
    const docRef = doc(db, STUDENT_ATTENDANCE_COLLECTION, id);
    await updateDoc(docRef, {
      status,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating student attendance status:', error);
    throw new Error('Kh├┤ng thß╗â cß║¡p nhß║¡t trß║íng th├íi ─æiß╗âm danh');
  }
};

/**
 * Create tutoring record for absent student (auto-create khi vß║»ng)
 * Now includes studentAttendanceId link and statusHistory for audit trail
 */
export const createTutoringFromAbsent = async (data: {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  absentDate: string;
  type: 'Nghß╗ë hß╗ìc' | 'Hß╗ìc yß║┐u';
  studentAttendanceId?: string;  // Optional: pass if already known
}): Promise<string> => {
  try {
    const now = new Date().toISOString();

    // Find the studentAttendance record to link (if not provided)
    let attendanceId = data.studentAttendanceId;
    if (!attendanceId) {
      const studentAttendance = await findStudentAttendanceRecord(
        data.studentId,
        data.classId,
        data.absentDate
      );
      attendanceId = studentAttendance?.id || undefined;
    }

    const tutoringData = {
      studentId: data.studentId,
      studentName: data.studentName,
      classId: data.classId,
      className: data.className,
      absentDate: data.absentDate,
      type: data.type,
      status: '─É├ú hß║╣n',
      scheduledDate: null,  // ─Éß╗â trß╗æng, sß║╜ ─æiß╗ün sau
      scheduledTime: null,  // ─Éß╗â trß╗æng, sß║╜ ─æiß╗ün sau
      tutor: null,
      studentAttendanceId: attendanceId || null,  // Link to studentAttendance
      deletedAt: null,
      statusHistory: [{  // Initial status for audit trail
        status: '─É├ú hß║╣n',
        changedAt: now,
        changedBy: 'system',
        reason: 'Auto-created from attendance'
      }],
      note: `Vß║»ng buß╗òi hß╗ìc ng├áy ${new Date(data.absentDate).toLocaleDateString('vi-VN')}`,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(collection(db, TUTORING_COLLECTION), tutoringData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating tutoring record:', error);
    throw new Error('Kh├┤ng thß╗â tß║ío lß╗ïch bß╗ôi b├ái');
  }
};

/**
 * Count student's attended sessions for a specific class
 */
export const countStudentAttendedSessions = async (
  studentId: string,
  classId: string
): Promise<number> => {
  try {
    const q = query(
      collection(db, STUDENT_ATTENDANCE_COLLECTION),
      where('studentId', '==', studentId),
      where('classId', '==', classId),
      where('status', 'in', [AttendanceStatus.ON_TIME, AttendanceStatus.LATE, 'C├│ mß║╖t', '─Éß║┐n trß╗à'])
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error('Error counting attended sessions:', error);
    return 0;
  }
};

/**
 * Check and update student debt status
 * If attendedSessions === registeredSessions => status = "─É├ú hß╗ìc hß║┐t ph├¡"
 * If attendedSessions > registeredSessions => status = "Nß╗ú ph├¡"
 *
 * IMPORTANT: This function now handles incremental attendance correctly.
 * When historical attendance wasn't tracked in studentAttendance collection,
 * we use the stored attendedSessions as baseline and add new attendance on top.
 */
export const checkAndUpdateStudentDebtStatus = async (
  studentId: string,
  classId: string,
  attendanceId?: string  // Optional: pass to track which attendance was processed
): Promise<void> => {
  try {
    // Get student data
    const studentRef = doc(db, 'students', studentId);
    const studentSnap = await getDoc(studentRef);

    if (!studentSnap.exists()) return;

    const studentData = studentSnap.data();
    const registeredSessions = studentData.registeredSessions || 0;
    const currentStatus = studentData.status;

    // Skip if student has already dropped, reserved, or is in trial
    const skipStatuses = [StudentStatus.DROPPED, StudentStatus.RESERVED, StudentStatus.TRIAL];
    if (skipStatuses.includes(currentStatus)) return;

    // Count attended sessions from attendance records
    const countedAttended = await countStudentAttendedSessions(studentId, classId);
    const currentAttended = studentData.attendedSessions || 0;

    // Track processed attendance IDs to avoid double-counting
    const processedAttendanceIds: string[] = studentData.processedAttendanceIds || [];

    let attendedSessions: number;

    // Case 1: Collection count >= stored count - use collection count (accurate data)
    if (countedAttended >= currentAttended) {
      attendedSessions = countedAttended;
    } else {
      // Case 2: Historical data exists outside collection (e.g., manual entry of 24 sessions)
      // We need to ADD new attendance on top of the historical baseline

      // Check if this attendance was already processed (to avoid double-incrementing on re-save)
      if (attendanceId && processedAttendanceIds.includes(attendanceId)) {
        // Already processed, don't increment again
        attendedSessions = currentAttended;
        console.log(`[checkDebtStatus] Attendance ${attendanceId} already processed for student ${studentId}, skipping increment`);
      } else {
        // New attendance! Increment by 1
        attendedSessions = currentAttended + 1;
        console.log(`[checkDebtStatus] New attendance for student ${studentId}: ${currentAttended} -> ${attendedSessions} (historical data mode)`);

        // Track this attendance as processed
        if (attendanceId) {
          processedAttendanceIds.push(attendanceId);
        }
      }
    }

    // Calculate remaining sessions (include legacy sessions from old system)
    const legacyAttended = studentData.legacyAttendedSessions || 0;
    const remainingSessions = registeredSessions - attendedSessions - legacyAttended;

    // Prepare update data
    const updateData: Record<string, unknown> = {
      attendedSessions,
      remainingSessions,
    };

    // Track processed attendance IDs (limit to last 100 to avoid growing too large)
    if (attendanceId && !processedAttendanceIds.includes(attendanceId)) {
      updateData.processedAttendanceIds = processedAttendanceIds.slice(-99).concat(attendanceId);
    }

    // Update attendedSessions and remainingSessions
    await updateDoc(studentRef, updateData);

    // Check status based on remaining sessions
    if (registeredSessions > 0) {
      if (remainingSessions < 0) {
        // Negative remaining = "Nß╗ú ph├¡" (debt)
        // Kh├┤ng override nß║┐u status hiß╗çn tß║íi l├á Nghß╗ë hß╗ìc
        if (currentStatus !== StudentStatus.DEBT && currentStatus !== StudentStatus.DROPPED) {
          await updateDoc(studentRef, {
            status: StudentStatus.DEBT,
            debtStartDate: new Date().toISOString(),
            debtSessions: Math.abs(remainingSessions)
          });
          console.log(`[checkDebtStatus] Student ${studentId} status changed to "Nß╗ú ph├¡" (attended: ${attendedSessions}, registered: ${registeredSessions}, remaining: ${remainingSessions})`);
        } else if (currentStatus === StudentStatus.DEBT) {
          // Already in debt, just update debtSessions
          await updateDoc(studentRef, {
            debtSessions: Math.abs(remainingSessions)
          });
        }
      } else if (remainingSessions === 0) {
        // Exactly 0 remaining = "─É├ú hß╗ìc hß║┐t ph├¡" (only if not already in debt)
        if (currentStatus === StudentStatus.ACTIVE) {
          await updateDoc(studentRef, {
            status: StudentStatus.EXPIRED_FEE
          });
          console.log(`[checkDebtStatus] Student ${studentId} status changed to "─É├ú hß╗ìc hß║┐t ph├¡" (attended: ${attendedSessions}, registered: ${registeredSessions})`);
        }
      } else if (remainingSessions > 0) {
        // Positive remaining = should be "─Éang hß╗ìc", restore if currently in debt
        if (currentStatus === StudentStatus.DEBT || currentStatus === StudentStatus.EXPIRED_FEE) {
          await updateDoc(studentRef, {
            status: StudentStatus.ACTIVE,
            debtStartDate: null,
            debtSessions: 0
          });
          console.log(`[checkDebtStatus] Student ${studentId} status restored to "─Éang hß╗ìc" (attended: ${attendedSessions}, registered: ${registeredSessions}, remaining: ${remainingSessions})`);
        }
      }
    }
  } catch (error) {
    console.error('Error checking student debt status:', error);
  }
};

/**
 * Full attendance save with auto tutoring creation
 */
export const saveFullAttendance = async (
  attendanceData: Omit<AttendanceRecord, 'id'> & { sessionId?: string },
  students: Array<{
    studentId: string;
    studentName: string;
    studentCode: string;
    status: AttendanceStatus;
    note?: string;
    homeworkCompletion?: number;
    testName?: string;
    score?: number;
    bonusPoints?: number;
    punctuality?: 'onTime' | 'late' | '';
    isLate?: boolean;
  }>
): Promise<string> => {
  try {
    console.log('[saveFullAttendance] Input students:', students.length);
    console.log('[saveFullAttendance] Student statuses:', students.map(s => ({ name: s.studentName, status: s.status })));

    // Filter out students with PENDING status (not yet marked)
    const markedStudents = students.filter(s => s.status && s.status !== ('' as AttendanceStatus));
    console.log('[saveFullAttendance] Marked students after filter:', markedStudents.length);
    
    // Validate: Must have at least one marked student
    if (markedStudents.length === 0) {
      console.error('[saveFullAttendance] No marked students to save!');
      throw new Error('Vui l├▓ng ─æ├ính dß║Ñu trß║íng th├íi cho ├¡t nhß║Ñt mß╗Öt hß╗ìc sinh tr╞░ß╗¢c khi l╞░u.');
    }

    // Calculate summary from marked students only (ON_TIME + LATE = present)
    const present = markedStudents.filter(s => s.status === AttendanceStatus.ON_TIME || s.status === AttendanceStatus.LATE).length;
    const absent = markedStudents.filter(s => s.status === AttendanceStatus.ABSENT).length;
    const reserved = markedStudents.filter(s => s.status === AttendanceStatus.RESERVED).length;
    const tutored = markedStudents.filter(s => s.status === AttendanceStatus.TUTORED).length;

    // Check existing
    const existing = await checkExistingAttendance(attendanceData.classId, attendanceData.date);

    let attendanceId: string;

    if (existing) {
      // Update existing
      await updateAttendanceRecord(existing.id, {
        ...attendanceData,
        present,
        absent,
        reserved,
        tutored,
        status: '─É├ú ─æiß╗âm danh',
      });
      attendanceId = existing.id;
    } else {
      // Create new
      attendanceId = await createAttendanceRecord({
        ...attendanceData,
        present,
        absent,
        reserved,
        tutored,
        status: '─É├ú ─æiß╗âm danh',
      });
    }

    // Save student attendance with extended fields for monthly report (only marked students)
    console.log('[saveFullAttendance] Saving student attendance...');
    const studentAttendanceIdMap = await saveStudentAttendance(
      attendanceId,
      markedStudents,
      attendanceData.classId,
      attendanceData.className,
      attendanceData.date,
      attendanceData.sessionNumber,
      attendanceData.sessionId,
      attendanceData.attendanceType // Pass attendanceType to studentAttendance records
    );
    console.log('[saveFullAttendance] Student attendance saved!');

    // Auto create tutoring for absent students with studentAttendanceId link
    const absentStudents = markedStudents.filter(s => s.status === AttendanceStatus.ABSENT);
    console.log('[saveFullAttendance] Creating tutoring for', absentStudents.length, 'absent students...');
    for (const student of absentStudents) {
      const studentAttendanceId = studentAttendanceIdMap.get(student.studentId);
      await createTutoringFromAbsent({
        studentId: student.studentId,
        studentName: student.studentName,
        classId: attendanceData.classId,
        className: attendanceData.className,
        absentDate: attendanceData.date,
        type: 'Nghß╗ë hß╗ìc',
        studentAttendanceId: studentAttendanceId, // Pass the linked studentAttendanceId
      });
    }
    console.log('[saveFullAttendance] Tutoring created!');

    // NOTE: Debt status and session counts are now handled EXCLUSIVELY by Cloud Functions
    // (onStudentAttendanceCreate/Update/Delete triggers in studentAttendanceTriggers.ts)
    // Previously, calling checkAndUpdateStudentDebtStatus here caused a RACE CONDITION
    // with the Cloud Function, resulting in double-counting of attendedSessions.
    // See: functions/src/triggers/studentAttendanceTriggers.ts

    console.log('[saveFullAttendance] All done! Returning attendanceId:', attendanceId);
    return attendanceId;
  } catch (error) {
    console.error('[saveFullAttendance] Error saving full attendance:', error);
    // Preserve original error message if it's already an Error with message
    if (error instanceof Error && error.message) {
      throw error;
    }
    // Otherwise, wrap in generic error
    throw new Error(error instanceof Error ? error.message : 'Kh├┤ng thß╗â l╞░u ─æiß╗âm danh. Vui l├▓ng thß╗¡ lß║íi.');
  }
};

/**
 * Manually recalculate student's attended sessions and update status.
 * Uses the studentAttendance collection as the SOLE source of truth.
 * 
 * If classId is provided, only recalculates for that class.
 * If classId is not provided, recalculates for ALL classes the student is enrolled in.
 * 
 * NOTE: The old "historical data mode" logic has been removed because it
 * was unreliable and caused data corruption. If there's a discrepancy between
 * stored attendedSessions and actual attendance records, we always trust
 * the actual records.
 */
export const recalculateStudentStatus = async (
  studentId: string,
  classId?: string
): Promise<{ attended: number; registered: number; remaining: number; newStatus: string }> => {
  try {
    // Get student data
    const studentRef = doc(db, 'students', studentId);
    const studentSnap = await getDoc(studentRef);

    if (!studentSnap.exists()) {
      throw new Error('Kh├┤ng t├¼m thß║Ñy hß╗ìc vi├¬n');
    }

    const studentData = studentSnap.data();
    const registeredSessions = studentData.registeredSessions || 0;
    const currentAttended = studentData.attendedSessions || 0;

    // Count attended sessions from studentAttendance collection (present statuses)
    // Include all present statuses: ON_TIME, LATE, TUTORED, and legacy values
    // If classId provided, filter by classId; otherwise count all classes
    const presentStatuses = [
      AttendanceStatus.ON_TIME, 
      AttendanceStatus.LATE, 
      AttendanceStatus.TUTORED, // '─É├ú bß╗ôi' should also count
      'C├│ mß║╖t', 
      '─Éß║┐n trß╗à',
      '─É├ú bß╗ôi' // Legacy value
    ];
    
    const presentQuery = classId
      ? query(
          collection(db, STUDENT_ATTENDANCE_COLLECTION),
          where('studentId', '==', studentId),
          where('classId', '==', classId),
          where('status', 'in', presentStatuses)
        )
      : query(
          collection(db, STUDENT_ATTENDANCE_COLLECTION),
          where('studentId', '==', studentId),
          where('status', 'in', presentStatuses)
        );
    
    const presentSnap = await getDocs(presentQuery);

    // Count only session attendance (has sessionId) vs makeup (no sessionId)
    // Group by classId to calculate per-class progress
    const classStats = new Map<string, { sessionAttended: number; makeupAttended: number; records: any[] }>();
    const debugRecords: any[] = [];
    
    presentSnap.docs.forEach(d => {
      const data = d.data();
      const recordClassId = data.classId || 'unknown';
      
      // If classId is specified, only count records for that class
      if (classId && recordClassId !== classId) {
        return;
      }
      
      // Debug: log all records
      debugRecords.push({
        id: d.id,
        status: data.status,
        sessionId: data.sessionId || 'null',
        classId: recordClassId,
        date: data.date || 'null'
      });
      
      // Initialize class stats if not exists
      if (!classStats.has(recordClassId)) {
        classStats.set(recordClassId, { sessionAttended: 0, makeupAttended: 0, records: [] });
      }
      
      const stats = classStats.get(recordClassId)!;
      stats.records.push({
        id: d.id,
        status: data.status,
        sessionId: data.sessionId || 'null',
        date: data.date || 'null'
      });
      
      // Cß║ó buß╗òi ch├¡nh thß╗⌐c V├Ç hß╗ìc b├╣ ─æß╗üu t├¡nh v├áo attendedSessions
      // V├¼ hß╗ìc b├╣ c┼⌐ng l├á buß╗òi hß╗ìc ─æ├ú tham gia
      if (data.sessionId) {
        stats.sessionAttended++;
      } else {
        // Hß╗ìc b├╣ c┼⌐ng t├¡nh v├áo sessionAttended (kh├┤ng phß║úi makeupAttended)
        stats.sessionAttended++;
        stats.makeupAttended++; // Track ri├¬ng ─æß╗â b├ío c├ío
      }
    });
    
    console.log(`[recalculateStudentStatus] Found ${presentSnap.docs.length} present records:`, debugRecords);

    // Calculate total attended sessions (sum across all classes if no classId specified)
    let totalSessionAttended = 0;
    let totalMakeupAttended = 0;
    classStats.forEach((stats) => {
      totalSessionAttended += stats.sessionAttended;
      totalMakeupAttended += stats.makeupAttended;
    });

    // Use session attendance count as the source of truth
    // Bao gß╗ôm cß║ú buß╗òi ch├¡nh thß╗⌐c (c├│ sessionId) v├á hß╗ìc b├╣ (kh├┤ng c├│ sessionId)
    const attendedSessions = classId ? classStats.get(classId)?.sessionAttended || 0 : totalSessionAttended;
    const makeupAttended = classId ? classStats.get(classId)?.makeupAttended || 0 : totalMakeupAttended;
    const legacyAttended = studentData.legacyAttendedSessions || 0;
    const remainingSessions = registeredSessions - attendedSessions - legacyAttended;

    console.log(`[recalculateStudentStatus] Student ${studentId}${classId ? ` (class ${classId})` : ' (all classes)'}:`);
    console.log(`  - Stored attendedSessions: ${currentAttended}`);
    console.log(`  - Counted from studentAttendance: ${attendedSessions} (with sessionId)`);
    console.log(`  - Makeup sessions: ${makeupAttended} (no sessionId)`);
    console.log(`  - Registered sessions: ${registeredSessions}`);
    console.log(`  - Legacy attended: ${legacyAttended}`);
    console.log(`  - Remaining sessions: ${remainingSessions}`);
    console.log(`  - Total present records found: ${presentSnap.docs.length}`);
    if (debugRecords.length > 0) {
      console.log(`  - Sample records:`, debugRecords.slice(0, 5));
    }
    console.log(`  - Class stats:`, Array.from(classStats.entries()).map(([cid, stats]) => ({
      classId: cid,
      sessionAttended: stats.sessionAttended,
      makeupAttended: stats.makeupAttended
    })));

    // Determine new status
    let newStatus = studentData.status;
    const updateData: Record<string, unknown> = {
      attendedSessions: classId ? attendedSessions : totalSessionAttended, // If no classId, use total
      remainingSessions,
      makeupSessionsAttended: makeupAttended,
    };

    // Update classProgress for each class
    const existingClassProgress = (studentData.classProgress as Record<string, any>) || {};
    const updatedClassProgress: Record<string, any> = { ...existingClassProgress };

    if (classId) {
      // Update single class progress
      const classRegistered = existingClassProgress[classId]?.registeredSessions || registeredSessions;
      updatedClassProgress[classId] = {
        ...existingClassProgress[classId],
        registeredSessions: classRegistered,
        attendedSessions: attendedSessions,
        makeupDone: existingClassProgress[classId]?.makeupDone || 0,
        makeupOwed: existingClassProgress[classId]?.makeupOwed || 0,
        absentSessions: existingClassProgress[classId]?.absentSessions || 0,
        reservedSessions: existingClassProgress[classId]?.reservedSessions || 0,
      };
      console.log(`[recalculateStudentStatus] Updated classProgress[${classId}]:`, updatedClassProgress[classId]);
    } else {
      // Update all classes that have attendance records
      classStats.forEach((stats, recordClassId) => {
        if (recordClassId !== 'unknown') {
          const classRegistered = existingClassProgress[recordClassId]?.registeredSessions || registeredSessions;
          updatedClassProgress[recordClassId] = {
            ...existingClassProgress[recordClassId],
            registeredSessions: classRegistered,
            attendedSessions: stats.sessionAttended,
            makeupDone: existingClassProgress[recordClassId]?.makeupDone || 0,
            makeupOwed: existingClassProgress[recordClassId]?.makeupOwed || 0,
            absentSessions: existingClassProgress[recordClassId]?.absentSessions || 0,
            reservedSessions: existingClassProgress[recordClassId]?.reservedSessions || 0,
          };
          console.log(`[recalculateStudentStatus] Updated classProgress[${recordClassId}]:`, updatedClassProgress[recordClassId]);
        }
      });
    }

    // Only update classProgress if we have data
    if (Object.keys(updatedClassProgress).length > 0) {
      updateData.classProgress = updatedClassProgress;
    }

    // Don't change status for dropped/reserved/trial students
    const skipStatuses = [StudentStatus.DROPPED, StudentStatus.RESERVED, StudentStatus.TRIAL];

    if (!skipStatuses.includes(studentData.status) && registeredSessions > 0) {
      if (remainingSessions < 0) {
        newStatus = StudentStatus.DEBT;
        updateData.status = StudentStatus.DEBT;
        updateData.debtSessions = Math.abs(remainingSessions);
        if (!studentData.debtStartDate) {
          updateData.debtStartDate = new Date().toISOString();
        }
      } else if (remainingSessions === 0) {
        newStatus = StudentStatus.EXPIRED_FEE;
        updateData.status = StudentStatus.EXPIRED_FEE;
        updateData.debtSessions = 0;
      } else {
        // Still has remaining sessions - status should be ACTIVE
        if (studentData.status === StudentStatus.EXPIRED_FEE || studentData.status === StudentStatus.DEBT) {
          newStatus = StudentStatus.ACTIVE;
          updateData.status = StudentStatus.ACTIVE;
          updateData.debtSessions = 0;
          updateData.debtStartDate = null;
        }
      }
    }

    // Update student
    await updateDoc(studentRef, updateData);

    return {
      attended: attendedSessions,
      registered: registeredSessions,
      remaining: remainingSessions,
      newStatus,
    };
  } catch (error) {
    console.error('Error recalculating student status:', error);
    throw error;
  }
};

