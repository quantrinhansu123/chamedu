/**
 * useStudents Hook — Supabase polling
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Student, StudentStatus } from '../../types';
import { StudentService } from '../services/studentService';

export const useStudents = (filters?: {
  status?: StudentStatus;
  classId?: string;
  searchTerm?: string;
}) => {
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    try {
      setError(null);
      const data = await StudentService.getStudents({
        status: filters?.status,
        classId: filters?.classId,
        searchTerm: filters?.searchTerm,
      });
      setAllStudents(data);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải danh sách học viên');
    } finally {
      setLoading(false);
    }
  }, [filters?.status, filters?.classId, filters?.searchTerm]);

  useEffect(() => {
    setLoading(true);
    fetchStudents();
    const timer = setInterval(fetchStudents, 15000);
    return () => clearInterval(timer);
  }, [fetchStudents]);

  const students = useMemo(() => allStudents, [allStudents]);

  const createStudent = async (data: Omit<Student, 'id'>) => {
    const id = await StudentService.createStudent(data);
    await fetchStudents();
    return id;
  };

  const updateStudent = async (id: string, data: Partial<Student>) => {
    await StudentService.updateStudent(id, data);
    await fetchStudents();
  };

  const deleteStudent = async (id: string) => {
    await StudentService.deleteStudent(id);
    await fetchStudents();
  };

  return {
    students,
    loading,
    error,
    createStudent,
    updateStudent,
    deleteStudent,
    refresh: fetchStudents,
  };
};
