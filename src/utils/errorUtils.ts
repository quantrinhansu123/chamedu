/**
 * Error Utilities
 * Sanitize error messages for user display
 */

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  // Firebase Auth
  'auth/user-not-found': 'Email hoặc mật khẩu không chính xác',
  'auth/wrong-password': 'Email hoặc mật khẩu không chính xác',
  'auth/email-already-in-use': 'Email đã được sử dụng',
  'auth/weak-password': 'Mật khẩu phải có ít nhất 6 ký tự',
  'auth/invalid-email': 'Email không hợp lệ',
  'auth/too-many-requests': 'Quá nhiều yêu cầu. Vui lòng thử lại sau',
  'auth/invalid-credential': 'Email hoặc mật khẩu không chính xác',

  // Supabase Auth
  invalid_credentials: 'Email hoặc mật khẩu không chính xác',
  email_not_confirmed: 'Email chưa được xác nhận. Kiểm tra hộp thư hoặc tắt xác nhận email trong Supabase.',
  user_not_found: 'Email hoặc mật khẩu không chính xác',
  weak_password: 'Mật khẩu phải có ít nhất 6 ký tự',
  email_address_invalid: 'Email không hợp lệ',
  over_request_rate_limit: 'Quá nhiều yêu cầu. Vui lòng thử lại sau',
  signup_disabled: 'Đăng ký tài khoản mới đang tắt',

  // Firestore / PostgREST
  'permission-denied': 'Bạn không có quyền thực hiện thao tác này',
  'not-found': 'Dữ liệu không tồn tại',
  'already-exists': 'Dữ liệu đã tồn tại',
  'resource-exhausted': 'Hệ thống quá tải. Vui lòng thử lại sau',
  'unavailable': 'Dịch vụ tạm thời không khả dụng',
  PGRST301: 'Bạn không có quyền truy cập dữ liệu',

  'network-error': 'Lỗi kết nối mạng',
  timeout: 'Yêu cầu hết thời gian chờ',
};

const MESSAGE_PATTERNS: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'Email hoặc mật khẩu không chính xác'],
  [/email hoặc mật khẩu không chính xác/i, 'Email hoặc mật khẩu không chính xác'],
  [/email not confirmed/i, 'Email chưa được xác nhận'],
  [/invalid api key/i, 'Cấu hình Supabase không hợp lệ (API key)'],
  [/failed to fetch|network/i, 'Lỗi kết nối mạng. Kiểm tra internet hoặc URL Supabase.'],
  [/missing.*supabase/i, 'Chưa cấu hình Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)'],
  [/authenticate_user/i, 'Chưa cấu hình đăng nhập. Chạy docs/supabase-users-auth-migration.sql trong Supabase SQL Editor.'],
];

const DEFAULT_ERROR = 'Đã xảy ra lỗi. Vui lòng thử lại';

const matchMessagePattern = (text: string): string | null => {
  for (const [pattern, message] of MESSAGE_PATTERNS) {
    if (pattern.test(text)) return message;
  }
  return null;
};

/**
 * Convert Firebase / Supabase / service errors to user-friendly message
 */
export const sanitizeFirebaseError = (error: unknown): string => {
  if (!error) return DEFAULT_ERROR;

  if (typeof error === 'string') {
    return matchMessagePattern(error) || error || DEFAULT_ERROR;
  }

  if (typeof error === 'object') {
    const err = error as { code?: string; message?: string; status?: number };

    if (err.message) {
      const byPattern = matchMessagePattern(err.message);
      if (byPattern) return byPattern;
      // Giữ nguyên thông báo tiếng Việt đã viết sẵn trong service
      if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(err.message)) {
        return err.message;
      }
    }

    if (err.code && AUTH_ERROR_MESSAGES[err.code]) {
      return AUTH_ERROR_MESSAGES[err.code];
    }
    if (err.message) {
      for (const [code, message] of Object.entries(AUTH_ERROR_MESSAGES)) {
        if (err.message.includes(code)) return message;
      }
    }
  }

  return DEFAULT_ERROR;
};

/**
 * Log error for debugging, return sanitized message for user
 */
export const handleServiceError = (error: unknown, context: string): never => {
  console.error(`[${context}]`, error);
  throw new Error(sanitizeFirebaseError(error));
};
