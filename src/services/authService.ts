import { supabase } from '../config/supabase';
import { Staff } from '../../types';
import { sanitizeFirebaseError } from '../utils/errorUtils';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName?: string | null;
  role?: string;
  staffData?: Staff;
}

const SESSION_KEY = 'chamedu_auth_session';

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  status: string;
  branch: string | null;
};

const createLocalId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export class AuthService {
  private static saveSession(user: AuthUser): void {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }

  static loadSession(): AuthUser | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }

  private static clearSession(): void {
    localStorage.removeItem(SESSION_KEY);
  }

  private static mapStaffRow(data: Record<string, unknown>): Staff {
    return {
      id: data.id as string,
      name: (data.name as string) || '',
      code: (data.code as string) || '',
      role: (data.role as string) || '',
      roles: (data.roles as string[]) || [],
      position: (data.position as string) || '',
      department: (data.department as string) || '',
      phone: (data.phone as string) || '',
      branch: (data.branch as string) || '',
      status: (data.status as string) || 'Active',
      dob: (data.dob as string) || '',
      startDate: (data.start_date as string) || '',
      email: (data.email as string) || '',
      uid: (data.uid as string) || '',
    } as Staff;
  }

  private static async getStaffByEmail(email: string): Promise<Staff | null> {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('email', email)
      .maybeSingle();
    if (error || !data) return null;
    return this.mapStaffRow(data as Record<string, unknown>);
  }

  private static async getStaffByUid(uid: string): Promise<Staff | null> {
    const { data, error } = await supabase.from('staff').select('*').eq('uid', uid).maybeSingle();
    if (error || !data) return null;
    return this.mapStaffRow(data as Record<string, unknown>);
  }

  private static mapUserRow(row: UserRow, staffData?: Staff | null): AuthUser {
    return {
      uid: row.id,
      email: row.email,
      displayName: row.full_name || staffData?.name || null,
      role: staffData?.role || row.role,
      staffData: staffData || undefined,
    };
  }

  private static assertSupabaseConfigured(): void {
    const url = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      import.meta.env.VITE_SUPABASE_ANON_KEY ||
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error('Missing Supabase env: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
    }
  }

  static async signIn(email: string, password: string): Promise<AuthUser> {
    try {
      this.assertSupabaseConfigured();

      const normalizedEmail = email.trim().toLowerCase();

      const { data, error } = await supabase.rpc('authenticate_user', {
        p_email: normalizedEmail,
        p_password: password,
      });

      if (error) {
        console.error('Sign in RPC error:', error);
        if (
          error.message?.includes('authenticate_user') &&
          /could not find|does not exist|schema cache/i.test(error.message)
        ) {
          throw new Error(
            'Chưa cấu hình đăng nhập trên Supabase. Chạy docs/supabase-users-auth-migration.sql rồi npm run setup:admin'
          );
        }
        throw error;
      }

      const rows = (data || []) as UserRow[];
      if (!rows.length) {
        throw new Error('Email hoặc mật khẩu không chính xác');
      }

      const row = rows[0];
      const staffData =
        (await this.getStaffByUid(row.id)) || (await this.getStaffByEmail(row.email));
      const authUser = this.mapUserRow(row, staffData);
      this.saveSession(authUser);
      return authUser;
    } catch (error) {
      console.error('Sign in error:', error);
      throw new Error(sanitizeFirebaseError(error));
    }
  }

  static async signOut(): Promise<void> {
    this.clearSession();
    await supabase.auth.signOut().catch(() => undefined);
  }

  static async registerStaff(
    email: string,
    password: string,
    staffData: {
      name: string;
      code: string;
      role: string;
      department: string;
      position: string;
      phone: string;
      dob?: string;
      startDate?: string;
      branch?: string;
      roles?: string[];
    }
  ): Promise<string> {
    this.assertSupabaseConfigured();

    const uid = createLocalId();
    const normalizedEmail = email.trim().toLowerCase();
    const { data: existingUser, error: findUserError } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();
    if (findUserError) {
      console.warn('Could not check existing user before staff registration:', findUserError);
    }
    if (existingUser) {
      throw new Error('Email đăng nhập đã tồn tại.');
    }

    const { data: staffRow, error: staffError } = await supabase.from('staff').insert({
      code: staffData.code || null,
      name: staffData.name,
      email: normalizedEmail,
      phone: staffData.phone || null,
      department: staffData.department || null,
      position: staffData.position || null,
      role: staffData.role || null,
      roles: staffData.roles || [staffData.role].filter(Boolean),
      branch: staffData.branch || null,
      status: 'Active',
    }).select('id').single();
    if (staffError) throw staffError;

    const { error: userError } = await supabase.from('users').insert({
      id: uid,
      email: normalizedEmail,
      password,
      full_name: staffData.name,
      role: staffData.role,
      status: 'active',
      branch: staffData.branch || null,
    });

    if (!userError) {
      await supabase.from('staff').update({ uid }).eq('id', staffRow.id);
    } else {
      console.warn('Staff was created but account creation was skipped/blocked:', userError);
    }

    return staffRow.id;
  }

  static getCurrentUser(): AuthUser | null {
    return this.loadSession();
  }

  static onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
    callback(this.loadSession());

    const onStorage = (e: StorageEvent) => {
      if (e.key === SESSION_KEY) {
        callback(this.loadSession());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }

  static async updateStaffPassword(
    staffId: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    this.assertSupabaseConfigured();

    const { data: staffRow, error: staffError } = await supabase
      .from('staff')
      .select('uid')
      .eq('id', staffId)
      .maybeSingle();
    if (staffError) throw staffError;

    const uid = (staffRow as { uid?: string | null } | null)?.uid;
    if (!uid) {
      return { success: false, message: 'Nhân sự chưa có tài khoản đăng nhập.' };
    }

    const { error } = await supabase.from('users').update({ password: newPassword }).eq('id', uid);
    if (error) throw error;
    return { success: true, message: 'Đã đổi mật khẩu nhân sự.' };
  }

  static async createStaffAccount(
    staffId: string,
    email: string,
    password: string
  ): Promise<{ success: boolean; message: string; uid?: string }> {
    this.assertSupabaseConfigured();

    const normalizedEmail = email.trim().toLowerCase();
    const { data: staffRow, error: staffError } = await supabase
      .from('staff')
      .select('*')
      .eq('id', staffId)
      .maybeSingle();
    if (staffError) throw staffError;
    if (!staffRow) {
      throw new Error('Không tìm thấy nhân sự để tạo tài khoản.');
    }

    const staffData = this.mapStaffRow(staffRow as Record<string, unknown>);
    const { data: existingEmailUser, error: findUserError } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();
    if (findUserError) {
      console.warn('Could not check existing user before account creation:', findUserError);
    }
    if (existingEmailUser && existingEmailUser.id !== staffData.uid) {
      throw new Error('Email đăng nhập đã tồn tại.');
    }

    const uid = staffData.uid || existingEmailUser?.id || createLocalId();
    const { error: userError } = await supabase.from('users').upsert(
      {
        id: uid,
        email: normalizedEmail,
        password,
        full_name: staffData.name,
        role: staffData.role || staffData.position || 'Nhân viên',
        status: staffData.status === 'Inactive' ? 'inactive' : 'active',
        branch: staffData.branch || null,
      },
      { onConflict: 'id' }
    );
    if (userError) {
      console.warn('Staff account creation was skipped/blocked:', userError);
      await supabase.from('staff').update({ email: normalizedEmail }).eq('id', staffId);
      return {
        success: false,
        message: 'Đã lưu email cho nhân sự. Chưa tạo được tài khoản đăng nhập do quyền Supabase.',
      };
    }

    const { error: updateStaffError } = await supabase
      .from('staff')
      .update({ uid, email: normalizedEmail })
      .eq('id', staffId);
    if (updateStaffError) throw updateStaffError;

    return { success: true, message: 'Đã tạo tài khoản đăng nhập cho nhân sự.', uid };
  }

  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc('change_user_password', {
      p_user_id: userId,
      p_current_password: currentPassword,
      p_new_password: newPassword,
    });
    if (error) throw error;
    return !!data;
  }
}
