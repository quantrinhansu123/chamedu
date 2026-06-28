/**
 * Parent Service - Supabase compatibility layer.
 *
 * There is no public.parents table yet, so persisted students remain the
 * source of truth for parents with children. Standalone parents are stored
 * locally and merged by phone number until the database gets a parents table.
 */

import { Parent, Student } from '../../types';
import { StudentService } from './studentService';

const LOCAL_PARENTS_KEY = 'edumanagerpro_local_parents';

export interface ParentWithChildren extends Parent {
  children: Student[];
  childrenIds: string[];
}

const normalizePhone = (phone?: string) => (phone || '').trim();

const toParentWithChildren = (parent: Parent): ParentWithChildren => ({
  ...parent,
  id: normalizePhone(parent.phone) || parent.id,
  phone: normalizePhone(parent.phone),
  children: [],
  childrenIds: [],
});

const canUseLocalStorage = () => typeof localStorage !== 'undefined';

const readLocalParents = (): ParentWithChildren[] => {
  if (!canUseLocalStorage()) return [];
  try {
    const raw = localStorage.getItem(LOCAL_PARENTS_KEY);
    const parents = raw ? (JSON.parse(raw) as Parent[]) : [];
    return parents.map(toParentWithChildren).filter((parent) => parent.phone);
  } catch {
    return [];
  }
};

const writeLocalParents = (parents: ParentWithChildren[]) => {
  if (!canUseLocalStorage()) return;
  localStorage.setItem(
    LOCAL_PARENTS_KEY,
    JSON.stringify(
      parents.map(({ children: _children, childrenIds: _childrenIds, ...parent }) => parent)
    )
  );
};

const upsertLocalParent = (parent: Parent) => {
  const normalized = toParentWithChildren(parent);
  const parents = readLocalParents().filter((item) => item.phone !== normalized.phone);
  parents.push({
    ...normalized,
    createdAt: normalized.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  writeLocalParents(parents);
};

export const createParent = async (data: Omit<Parent, 'id'>): Promise<string> => {
  const phone = normalizePhone(data.phone);
  if (!data.name?.trim() || !phone) {
    throw new Error('Vui lòng nhập tên và số điện thoại phụ huynh');
  }

  const existing = await findParentByPhone(phone);
  if (existing) return existing.id;

  upsertLocalParent({
    ...data,
    id: phone,
    phone,
    name: data.name.trim(),
  });
  return phone;
};

export const getParent = async (id: string): Promise<Parent | null> => {
  const parents = await getParents();
  return parents.find((parent) => parent.id === id || parent.phone === id) || null;
};

export const getParents = async (searchTerm?: string): Promise<ParentWithChildren[]> => {
  const students = await StudentService.getStudents();
  const map = new Map<string, ParentWithChildren>();

  for (const student of students) {
    const phone = normalizePhone(student.parentPhone);
    if (!phone) continue;

    if (!map.has(phone)) {
      map.set(phone, {
        id: phone,
        name: student.parentName || '',
        phone,
        email: '',
        address: '',
        childrenIds: [],
        children: [],
      });
    }

    const parent = map.get(phone)!;
    parent.childrenIds.push(student.id);
    parent.children.push(student);
    if (!parent.name && student.parentName) parent.name = student.parentName;
  }

  for (const localParent of readLocalParents()) {
    const existing = map.get(localParent.phone);
    if (existing) {
      map.set(localParent.phone, {
        ...existing,
        ...localParent,
        id: existing.id,
        phone: existing.phone,
        children: existing.children,
        childrenIds: existing.childrenIds,
      });
    } else {
      map.set(localParent.phone, localParent);
    }
  }

  let parents = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  if (searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    parents = parents.filter(
      (parent) =>
        parent.name.toLowerCase().includes(term) ||
        parent.phone.includes(term) ||
        parent.children.some((child) => child.fullName.toLowerCase().includes(term))
    );
  }
  return parents;
};

export const getChildrenByParentId = async (parentId: string): Promise<Student[]> => {
  const students = await StudentService.getStudents();
  return students.filter((student) => {
    const parentPhone = normalizePhone(student.parentPhone);
    return parentPhone === parentId || student.parentId === parentId;
  });
};

export const getParentsWithChildren = async (searchTerm?: string): Promise<ParentWithChildren[]> => {
  return getParents(searchTerm);
};

export const findParentByPhone = async (phone: string): Promise<Parent | null> => {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  const parents = await getParents();
  return parents.find((parent) => parent.phone === normalized) || null;
};

export const updateParent = async (id: string, data: Partial<Parent>): Promise<void> => {
  const current = await getParent(id);
  if (!current) throw new Error('Không tìm thấy phụ huynh');

  const nextPhone = normalizePhone(data.phone ?? current.phone);
  const nextParent: Parent = {
    ...current,
    ...data,
    id: nextPhone,
    phone: nextPhone,
    name: (data.name ?? current.name).trim(),
    updatedAt: new Date().toISOString(),
  };

  if (!nextParent.name || !nextPhone) {
    throw new Error('Vui lòng nhập tên và số điện thoại phụ huynh');
  }

  const children = await getChildrenByParentId(current.id);
  for (const child of children) {
    await StudentService.updateStudent(child.id, {
      parentId: nextPhone,
      parentName: nextParent.name,
      parentPhone: nextPhone,
    });
  }

  const localParents = readLocalParents().filter(
    (parent) => parent.id !== current.id && parent.phone !== current.phone && parent.phone !== nextPhone
  );
  writeLocalParents(localParents);
  upsertLocalParent(nextParent);
};

export const deleteParent = async (id: string): Promise<void> => {
  const parent = await getParent(id);
  if (!parent) return;

  const children = await getChildrenByParentId(parent.id);
  if (children.length > 0) {
    throw new Error('Không thể xóa phụ huynh đang có học sinh');
  }

  writeLocalParents(
    readLocalParents().filter((item) => item.id !== parent.id && item.phone !== parent.phone)
  );
};
