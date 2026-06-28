import { collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, writeBatch, runTransaction, arrayUnion, Timestamp, db } from '@/src/utils/legacyFirestoreStub';
/**
 * Class Manager Hook
 * State management for ClassManager page
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useClasses } from '../../../hooks/useClasses';
import { usePermissions } from '../../../hooks/usePermissions';
import { useAuth } from '../../../hooks/useAuth';
import { ClassModel } from '../../../../types';

export type ClassModalType = 'create' | 'edit' | 'detail' | 'students' | 'history' | 'test' | null;

export interface ClassStudentCounts {
  total: number;
  trial: number;
  active: number;
  debt: number;
  reserved: number;
  dropped: number;
  remainingSessions: number;
  remainingValue: number;
}

export interface ClassSessionStats {
  completed: number;
  total: number;
}

export function useClassManager(options?: { searchTerm?: string }) {
  // Permissions
  const { canCreate, canEdit, canDelete, shouldShowOnlyOwnClasses, staffId } = usePermissions();
  const { staffData } = useAuth();

  // Core data
  const { classes: allClasses, loading, createClass, updateClass, deleteClass } = useClasses({
    searchTerm: options?.searchTerm
  });

  // Filter classes based on permission
  const classes = useMemo(() => {
    const onlyOwnClasses = shouldShowOnlyOwnClasses('classes');
    if (!onlyOwnClasses || !staffData) return allClasses;

    const myName = staffData.name;
    const myId = staffData.id || staffId;
    return allClasses.filter(cls =>
      cls.teacher === myName ||
      cls.teacherId === myId ||
      cls.assistant === myName ||
      cls.assistantId === myId ||
      cls.foreignTeacher === myName ||
      cls.foreignTeacherId === myId
    );
  }, [allClasses, shouldShowOnlyOwnClasses, staffData, staffId]);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal state
  const [activeModal, setActiveModal] = useState<ClassModalType>(null);
  const [selectedClass, setSelectedClass] = useState<ClassModel | null>(null);

  // Student counts per class (real-time)
  const [classStudentCounts, setClassStudentCounts] = useState<Record<string, ClassStudentCounts>>({});

  // Session stats per class (real-time)
  const [classSessionStats, setClassSessionStats] = useState<Record<string, ClassSessionStats>>({});

  // Real-time student counts
  useEffect(() => {
    if (classes.length === 0) {
      setClassStudentCounts({});
      return;
    }

    const unsubscribe = onSnapshot(
      collection(null as any /* firebase removed */, 'students'),
      (snapshot) => {
        const students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const PRICE_PER_SESSION = 150000;
        const counts: Record<string, ClassStudentCounts> = {};

        classes.forEach(cls => {
          counts[cls.id] = {
            total: 0,
            trial: 0,
            active: 0,
            debt: 0,
            reserved: 0,
            dropped: 0,
            remainingSessions: 0,
            remainingValue: 0
          };
        });

        students.forEach((student: Record<string, unknown>) => {
          const classId = student.classId as string;
          const status = (student.status as string) || '';

          if (classId && counts[classId]) {
            counts[classId].total++;

            if (status.includes('Nợ') || student.hasDebt === true) {
              counts[classId].debt++;
            } else if (status.includes('thử')) {
              counts[classId].trial++;
            } else if (status.includes('Đang học')) {
              counts[classId].active++;
            } else if (status.includes('Bảo lưu')) {
              counts[classId].reserved++;
            } else if (status.includes('Nghỉ')) {
              counts[classId].dropped++;
            }

            if (!status.includes('Nghỉ') && !status.includes('Bảo lưu')) {
              const registered = (student.registeredSessions as number) || 0;
              const attended = (student.attendedSessions as number) || 0;
              const remaining = registered - attended;
              if (remaining > 0) {
                counts[classId].remainingSessions += remaining;
                counts[classId].remainingValue += remaining * PRICE_PER_SESSION;
              }
            }
          }
        });

        setClassStudentCounts(counts);
      }
    );

    return () => unsubscribe();
  }, [classes]);

  // Real-time session stats
  useEffect(() => {
    if (classes.length === 0) {
      setClassSessionStats({});
      return;
    }

    const unsubscribe = onSnapshot(
      collection(null as any /* firebase removed */, 'classSessions'),
      (snapshot) => {
        const stats: Record<string, ClassSessionStats> = {};

        classes.forEach(cls => {
          stats[cls.id] = { completed: 0, total: 0 };
        });

        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const classId = data.classId as string;
          if (classId && stats[classId]) {
            stats[classId].total++;
            if (data.status === 'Đã học') {
              stats[classId].completed++;
            }
          }
        });

        setClassSessionStats(stats);
      }
    );

    return () => unsubscribe();
  }, [classes]);

  // Filtered classes
  const filteredClasses = useMemo(() => {
    let result = classes;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c =>
        c.name?.toLowerCase().includes(term) ||
        c.teacher?.toLowerCase().includes(term)
      );
    }
    if (teacherFilter) {
      result = result.filter(c => c.teacher === teacherFilter);
    }
    if (branchFilter) {
      result = result.filter(c => c.branch === branchFilter);
    }
    if (statusFilter) {
      result = result.filter(c => c.status === statusFilter);
    }

    return result;
  }, [classes, searchTerm, teacherFilter, branchFilter, statusFilter]);

  // Unique values for filters
  const teachers = useMemo(() =>
    [...new Set(classes.map(c => c.teacher).filter(Boolean))].sort(),
    [classes]
  );

  const branches = useMemo(() =>
    [...new Set(classes.map(c => c.branch).filter(Boolean))].sort(),
    [classes]
  );

  // Modal handlers
  const openModal = useCallback((modal: ClassModalType, classData?: ClassModel) => {
    setSelectedClass(classData || null);
    setActiveModal(modal);
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
    setSelectedClass(null);
  }, []);

  // Get counts for specific class
  const getClassCounts = useCallback((classId: string): ClassStudentCounts => {
    return classStudentCounts[classId] || {
      total: 0,
      trial: 0,
      active: 0,
      debt: 0,
      reserved: 0,
      dropped: 0,
      remainingSessions: 0,
      remainingValue: 0
    };
  }, [classStudentCounts]);

  const getSessionStats = useCallback((classId: string): ClassSessionStats => {
    return classSessionStats[classId] || { completed: 0, total: 0 };
  }, [classSessionStats]);

  return {
    // Data
    classes: filteredClasses,
    allClasses: classes,
    loading,

    // CRUD
    createClass,
    updateClass,
    deleteClass,

    // Permissions
    canCreateClass: canCreate('classes'),
    canEditClass: canEdit('classes'),
    canDeleteClass: canDelete('classes'),

    // Filters
    searchTerm,
    setSearchTerm,
    teacherFilter,
    setTeacherFilter,
    branchFilter,
    setBranchFilter,
    statusFilter,
    setStatusFilter,
    teachers,
    branches,

    // Modal
    activeModal,
    selectedClass,
    openModal,
    closeModal,

    // Stats
    getClassCounts,
    getSessionStats,
    classStudentCounts,
    classSessionStats
  };
}
