/**
 * Excel Import/Export Utilities
 * Sử dụng thư viện xlsx để xử lý file Excel
 */

import * as XLSX from 'xlsx';

// ============ EXPORT FUNCTIONS ============

/**
 * Export data to Excel file
 */
export const exportToExcel = (
  data: Record<string, any>[],
  fileName: string,
  sheetName: string = 'Data'
) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  // Auto-width columns
  const maxWidth = 50;
  const colWidths = Object.keys(data[0] || {}).map(key => ({
    wch: Math.min(maxWidth, Math.max(key.length, ...data.map(row => String(row[key] || '').length)))
  }));
  worksheet['!cols'] = colWidths;
  
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

/**
 * Export template Excel (empty with headers)
 */
export const exportTemplate = (
  headers: { key: string; label: string; example?: string }[],
  fileName: string,
  sheetName: string = 'Template'
) => {
  // Create header row
  const headerRow: Record<string, string> = {};
  headers.forEach(h => {
    headerRow[h.label] = h.example || '';
  });
  
  const worksheet = XLSX.utils.json_to_sheet([headerRow]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  // Set column widths
  worksheet['!cols'] = headers.map(h => ({ wch: Math.max(h.label.length, 20) }));
  
  XLSX.writeFile(workbook, `${fileName}_template.xlsx`);
};

// ============ IMPORT FUNCTIONS ============

/**
 * Read Excel file and return JSON data
 */
export const readExcelFile = (file: File): Promise<Record<string, any>[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        resolve(jsonData as Record<string, any>[]);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
};

/**
 * Map Excel columns to database fields
 * Hỗ trợ aliases - tự động tìm cột phù hợp nếu tên cột khác nhau
 */
export const mapExcelToFields = (
  excelData: Record<string, any>[],
  mapping: { excelColumn: string; dbField: string; transform?: (val: any) => any; aliases?: string[] }[]
): Record<string, any>[] => {
  // Lấy danh sách tên cột từ dữ liệu Excel
  const excelColumns = excelData.length > 0 ? Object.keys(excelData[0]) : [];
  
  // Normalize string để so sánh: lowercase, bỏ dấu, bỏ khoảng trắng thừa
  const normalize = (s: string) => s
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // bỏ dấu tiếng Việt
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/\s+/g, ' ')
    .trim();
  
  return excelData.map(row => {
    const mapped: Record<string, any> = {};
    mapping.forEach(({ excelColumn, dbField, transform, aliases }) => {
      // Tìm cột phù hợp: thử tên chính trước, sau đó thử aliases
      let actualColumn = excelColumn;
      if (row[excelColumn] === undefined && aliases) {
        // Tìm trong aliases - exact match trước
        for (const alias of aliases) {
          if (row[alias] !== undefined) {
            actualColumn = alias;
            break;
          }
        }
        
        // Nếu chưa tìm được, thử partial match với normalize
        if (row[actualColumn] === undefined) {
          for (const alias of aliases) {
            const normalizedAlias = normalize(alias);
            const matchedCol = excelColumns.find(col => {
              const normalizedCol = normalize(col);
              return normalizedCol.includes(normalizedAlias) || 
                     normalizedAlias.includes(normalizedCol);
            });
            if (matchedCol && row[matchedCol] !== undefined) {
              actualColumn = matchedCol;
              break;
            }
          }
        }
      }
      
      let value = row[actualColumn];
      if (transform && value !== undefined) {
        value = transform(value);
      }
      if (value !== undefined && value !== '') {
        mapped[dbField] = value;
      }
    });
    return mapped;
  });
};

// ============ FIELD MAPPINGS FOR EACH MODULE ============

// Student fields - Template mới phù hợp với file Excel thực tế
export const STUDENT_FIELDS = [
  { key: 'fullName', label: 'Họ Và Tên', example: 'Nguyễn Văn A', required: true },
  { key: 'code', label: 'Mã học viên', example: 'HV001' },
  { key: 'dob', label: 'Ngày sinh', example: '10/11/2018' },
  { key: 'gender', label: 'Giới tính', example: 'Nam' },
  { key: 'phone', label: 'SĐT Phụ huynh', example: '0901234567' },
  { key: 'email', label: 'Email', example: 'email@example.com' },
  { key: 'parentName', label: 'Phụ huynh', example: 'Nguyễn Văn B' },
  { key: 'branch', label: 'Cơ sở', example: 'Bình Minh' },
  { key: 'class', label: 'Lớp đang theo học', example: 'Starters 22' },
  { key: 'registeredSessions', label: 'Số buổi đăng ký (Gói học)', example: '48' },
  { key: 'legacyAttendedSessions', label: 'Đã học', example: '' },
  { key: 'status', label: 'Tình trạng', example: 'Đang học' },
  { key: 'note', label: 'Ghi chú', example: '' },
];

// Mapping linh hoạt - hỗ trợ nhiều tên cột khác nhau
export const STUDENT_MAPPING = [
  { excelColumn: 'Họ Và Tên', dbField: 'fullName', aliases: ['Họ và tên', 'Họ tên', 'Tên học viên', 'HỌ VÀ TÊN'] },
  { excelColumn: 'Mã học viên', dbField: 'code', aliases: ['Mã HV', 'MÃ HỌC VIÊN'] },
  { excelColumn: 'Ngày sinh', dbField: 'dob', transform: parseVNDate, aliases: ['Ngày sinh (dd/mm/yyyy)', 'NGÀY SINH'] },
  { excelColumn: 'Giới tính', dbField: 'gender', aliases: ['GIỚI TÍNH', 'GT'] },
  { excelColumn: 'SĐT Phụ huynh', dbField: 'phone', transform: String, aliases: ['SĐT PH', 'Điện thoại', 'SĐT'] },
  { excelColumn: 'Email', dbField: 'email', aliases: ['EMAIL', 'email'] },
  { excelColumn: 'Phụ huynh', dbField: 'parentName', aliases: ['Tên phụ huynh', 'PHỤ HUYNH', 'Tên PH'] },
  { excelColumn: 'Cơ sở', dbField: 'branch', aliases: ['CƠ SỞ', 'Chi nhánh', 'CHI NHÁNH', 'Branch', 'Center'] },
  { excelColumn: 'Lớp đang theo học', dbField: 'class', aliases: ['Lớp học', 'Lớp', 'LỚP ĐANG THEO HỌC'] },
  // 4 cột số buổi - map từ Excel thực tế
  { excelColumn: 'Số buổi đăng ký', dbField: 'registeredSessions', transform: parseSessionNumber, aliases: ['SỐ BUỔI ĐĂNG KÍ KHOÁ GẦN NHẤT', 'SỐ BUỔI ĐĂNG KÍ KHOÁ', 'ĐĂNG KÍ KHOÁ', 'SỐ BUỔI ĐĂNG KÍ', 'SỐ BUỔI ĐĂNG KÝ', 'Gói học'] },
  { excelColumn: 'Đã điểm danh', dbField: 'attendedSessions', transform: parseSessionNumber, aliases: ['ĐÃ ĐIỂM DANH', 'SỐ BUỔI ĐÃ ĐIỂM DANH', 'ĐIỂM DANH'] },
  { excelColumn: 'Số buổi còn lại', dbField: 'remainingSessions', transform: parseSessionNumber, aliases: ['SỐ BUỔI CÒN LẠI TÍNH ĐẾN', 'SỐ BUỔI CÒN LẠI', 'CÒN LẠI TÍNH ĐẾN', 'Còn lại', 'CÒN LẠI'] },
  { excelColumn: 'Đã học', dbField: 'legacyAttendedSessions', transform: parseSessionNumber, aliases: ['ĐÃ HỌC (CŨ)', 'Đã học cũ', 'SỐ BUỔI ĐÃ HỌC (CŨ)', 'Legacy Attended', 'ĐÃ HỌC CŨ'] },
  { excelColumn: 'Tình trạng', dbField: 'status', transform: parseStudentStatus, aliases: ['Trạng thái', 'TÌNH TRẠNG', 'Status'] },
  { excelColumn: 'Ghi chú', dbField: 'note', aliases: ['GHI CHÚ', 'Note'] },
];

// Parse số buổi - hỗ trợ số âm
function parseSessionNumber(val: any): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const num = parseInt(String(val).replace(/[^\d-]/g, ''));
  return isNaN(num) ? undefined : num;
}

// Parse trạng thái học viên - map từ nhiều format khác nhau
function parseStudentStatus(val: any): string {
  if (!val) return 'Đang học';
  const v = String(val).toLowerCase().trim();
  if (v.includes('hết phí') || v.includes('học hết')) return 'Đã học hết phí';
  if (v.includes('nợ')) return 'Nợ phí';
  if (v.includes('bảo lưu')) return 'Bảo lưu';
  if (v.includes('nghỉ')) return 'Nghỉ học';
  if (v.includes('đang học') || v.includes('active')) return 'Đang học';
  if (v.includes('học thử') || v.includes('trial')) return 'Học thử';
  return val; // Giữ nguyên nếu không match
}

// Staff fields
export const STAFF_FIELDS = [
  { key: 'name', label: 'Họ và tên', example: 'Trần Thị B', required: true },
  { key: 'code', label: 'Mã nhân viên', example: 'NV001' },
  { key: 'position', label: 'Vị trí', example: 'Giáo viên' },
  { key: 'department', label: 'Phòng ban', example: 'Giảng dạy' },
  { key: 'phone', label: 'Số điện thoại', example: '0901234567' },
  { key: 'email', label: 'Email', example: 'email@example.com' },
  { key: 'dob', label: 'Ngày sinh (dd/mm/yyyy)', example: '15/06/1990' },
  { key: 'address', label: 'Địa chỉ', example: '123 Đường ABC' },
  { key: 'startDate', label: 'Ngày vào làm (dd/mm/yyyy)', example: '01/01/2024' },
  { key: 'status', label: 'Trạng thái', example: 'Đang làm việc' },
];

export const STAFF_MAPPING = [
  { excelColumn: 'Họ và tên', dbField: 'name' },
  { excelColumn: 'Mã nhân viên', dbField: 'code' },
  { excelColumn: 'Vị trí', dbField: 'position' },
  { excelColumn: 'Phòng ban', dbField: 'department' },
  { excelColumn: 'Số điện thoại', dbField: 'phone', transform: String },
  { excelColumn: 'Email', dbField: 'email' },
  { excelColumn: 'Ngày sinh (dd/mm/yyyy)', dbField: 'dob', transform: parseVNDate },
  { excelColumn: 'Địa chỉ', dbField: 'address' },
  { excelColumn: 'Ngày vào làm (dd/mm/yyyy)', dbField: 'startDate', transform: parseVNDate },
  { excelColumn: 'Trạng thái', dbField: 'status' },
];

// Class fields
export const CLASS_FIELDS = [
  { key: 'name', label: 'Tên lớp', example: 'Beginner A', required: true },
  { key: 'code', label: 'Mã lớp', example: 'BEG-A' },
  { key: 'teacher', label: 'Giáo viên VN', example: 'Nguyễn Văn A' },
  { key: 'foreignTeacher', label: 'Giáo viên NN', example: 'John Smith' },
  { key: 'assistant', label: 'Trợ giảng', example: 'Trần Thị B' },
  { key: 'room', label: 'Phòng học', example: 'Phòng 101' },
  { key: 'schedule', label: 'Lịch học', example: 'T2-T4-T6 17:00' },
  { key: 'maxStudents', label: 'Sĩ số tối đa', example: '15' },
  { key: 'tuitionFee', label: 'Học phí', example: '3600000' },
  { key: 'status', label: 'Trạng thái', example: 'Đang hoạt động' },
];

export const CLASS_MAPPING = [
  { excelColumn: 'Tên lớp', dbField: 'name' },
  { excelColumn: 'Mã lớp', dbField: 'code' },
  { excelColumn: 'Giáo viên VN', dbField: 'teacher' },
  { excelColumn: 'Giáo viên NN', dbField: 'foreignTeacher' },
  { excelColumn: 'Trợ giảng', dbField: 'assistant' },
  { excelColumn: 'Phòng học', dbField: 'room' },
  { excelColumn: 'Lịch học', dbField: 'schedule' },
  { excelColumn: 'Sĩ số tối đa', dbField: 'maxStudents', transform: Number },
  { excelColumn: 'Học phí', dbField: 'tuitionFee', transform: parseNumber },
  { excelColumn: 'Trạng thái', dbField: 'status' },
];

// Curriculum/Course fields
export const CURRICULUM_FIELDS = [
  { key: 'name', label: 'Tên khóa học', example: 'Tiếng Anh Mầm Non', required: true },
  { key: 'level', label: 'Chương trình', example: 'Tiếng Anh Trẻ Em' },
  { key: 'ageRange', label: 'Độ tuổi', example: '4-6 tuổi' },
  { key: 'totalSessions', label: 'Tổng số buổi', example: '24' },
  { key: 'sessionDuration', label: 'Phút/buổi', example: '90' },
  { key: 'tuitionFee', label: 'Học phí', example: '3600000' },
  { key: 'status', label: 'Trạng thái', example: 'Active' },
];

export const CURRICULUM_MAPPING = [
  { excelColumn: 'Tên khóa học', dbField: 'name' },
  { excelColumn: 'Chương trình', dbField: 'level' },
  { excelColumn: 'Độ tuổi', dbField: 'ageRange' },
  { excelColumn: 'Tổng số buổi', dbField: 'totalSessions', transform: Number },
  { excelColumn: 'Phút/buổi', dbField: 'sessionDuration', transform: Number },
  { excelColumn: 'Học phí', dbField: 'tuitionFee', transform: parseNumber },
  { excelColumn: 'Trạng thái', dbField: 'status' },
];

// ============ HELPER FUNCTIONS ============

/**
 * Parse Vietnamese date format (dd/mm/yyyy) to ISO string
 */
function parseVNDate(value: any): string {
  if (!value) return '';
  const str = String(value);
  
  // Already ISO format
  if (str.includes('-') && str.length === 10) return str;
  
  // Excel serial date number
  if (typeof value === 'number') {
    const date = new Date((value - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  
  // dd/mm/yyyy format
  const parts = str.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  
  return str;
}

/**
 * Parse number from string (remove dots/commas)
 */
function parseNumber(value: any): number {
  if (typeof value === 'number') return value;
  const str = String(value).replace(/\./g, '').replace(/,/g, '');
  return parseInt(str) || 0;
}

/**
 * Format date to Vietnamese format for export
 */
export const formatDateVN = (isoDate: string): string => {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDate;
};

/**
 * Prepare student data for export
 */
export const prepareStudentExport = (students: any[]): Record<string, any>[] => {
  return students.map(s => ({
    'Họ và tên': s.fullName || '',
    'Mã học viên': s.code || '',
    'Ngày sinh (dd/mm/yyyy)': formatDateVN(s.dob),
    'Giới tính': s.gender || '',
    'SĐT Phụ huynh': s.phone || '',
    'Email': s.email || '',
    'Tên phụ huynh': s.parentName || '',
    'SĐT PH 2': s.parentPhone2 || '',
    'Địa chỉ': s.address || '',
    'Lớp học': s.class || '',
    'Số buổi đăng ký': s.registeredSessions || 0,
    'Đã học': s.legacyAttendedSessions || 0,
    'Trạng thái': s.status || '',
    'Ghi chú': s.note || '',
  }));
};

/**
 * Prepare staff data for export
 */
export const prepareStaffExport = (staffList: any[]): Record<string, any>[] => {
  return staffList.map(s => ({
    'Họ và tên': s.name || '',
    'Mã nhân viên': s.code || '',
    'Vị trí': s.position || '',
    'Phòng ban': s.department || '',
    'Số điện thoại': s.phone || '',
    'Email': s.email || '',
    'Ngày sinh (dd/mm/yyyy)': formatDateVN(s.dob),
    'Địa chỉ': s.address || '',
    'Ngày vào làm (dd/mm/yyyy)': formatDateVN(s.startDate),
    'Trạng thái': s.status || '',
  }));
};

/**
 * Prepare class data for export
 */
export const prepareClassExport = (classes: any[]): Record<string, any>[] => {
  return classes.map(c => ({
    'Tên lớp': c.name || '',
    'Mã lớp': c.code || '',
    'Giáo viên VN': c.teacher || '',
    'Giáo viên NN': c.foreignTeacher || '',
    'Trợ giảng': c.assistant || '',
    'Phòng học': c.room || '',
    'Lịch học': c.schedule || '',
    'Sĩ số tối đa': c.maxStudents || '',
    'Học phí': c.tuitionFee || '',
    'Trạng thái': c.status || '',
  }));
};

/**
 * Prepare curriculum data for export
 */
export const prepareCurriculumExport = (curriculums: any[]): Record<string, any>[] => {
  return curriculums.map(c => ({
    'Tên khóa học': c.name || '',
    'Chương trình': c.level || '',
    'Độ tuổi': c.ageRange || '',
    'Tổng số buổi': c.totalSessions || '',
    'Phút/buổi': c.sessionDuration || '',
    'Học phí': c.tuitionFee || '',
    'Trạng thái': c.status || '',
  }));
};

// Contract fields
export const CONTRACT_FIELDS = [
  { key: 'studentName', label: 'Học viên', example: 'Nguyễn Văn A', required: true },
  { key: 'studentCode', label: 'Mã học viên', example: 'HV001' },
  { key: 'parentName', label: 'Tên phụ huynh', example: 'Nguyễn Thị B' },
  { key: 'parentPhone', label: 'SĐT phụ huynh', example: '0901234567' },
  { key: 'contractDate', label: 'Ngày HĐ (dd/mm/yyyy)', example: '01/03/2026' },
  { key: 'className', label: 'Lớp học', example: 'Cam 4.2' },
  { key: 'branch', label: 'Cơ sở', example: 'Cơ sở 1' },
  { key: 'courseName', label: 'Tên gói/khóa', example: 'Gói 48 buổi' },
  { key: 'sessions', label: 'Số buổi', example: '48' },
  { key: 'unitPrice', label: 'Đơn giá/buổi', example: '150000' },
  { key: 'totalAmount', label: 'Tổng tiền', example: '7200000' },
  { key: 'paidAmount', label: 'Đã thanh toán', example: '7200000' },
  { key: 'remainingAmount', label: 'Còn nợ', example: '0' },
  { key: 'status', label: 'Trạng thái', example: 'Đã thanh toán' },
  { key: 'paymentMethod', label: 'Hình thức TT', example: 'Tiền mặt' },
  { key: 'notes', label: 'Ghi chú', example: '' },
];

export const CONTRACT_MAPPING = [
  { excelColumn: 'Học viên', dbField: 'studentName' },
  { excelColumn: 'Mã học viên', dbField: 'studentCode' },
  { excelColumn: 'Tên phụ huynh', dbField: 'parentName' },
  { excelColumn: 'SĐT phụ huynh', dbField: 'parentPhone', transform: String },
  { excelColumn: 'Ngày HĐ (dd/mm/yyyy)', dbField: 'contractDate', transform: parseVNDate },
  { excelColumn: 'Lớp học', dbField: 'className' },
  { excelColumn: 'Cơ sở', dbField: 'branch' },
  { excelColumn: 'Tên gói/khóa', dbField: 'courseName' },
  { excelColumn: 'Số buổi', dbField: 'sessions', transform: Number },
  { excelColumn: 'Đơn giá/buổi', dbField: 'unitPrice', transform: parseNumber },
  { excelColumn: 'Tổng tiền', dbField: 'totalAmount', transform: parseNumber },
  { excelColumn: 'Đã thanh toán', dbField: 'paidAmount', transform: parseNumber },
  { excelColumn: 'Còn nợ', dbField: 'remainingAmount', transform: parseNumber },
  { excelColumn: 'Trạng thái', dbField: 'status' },
  { excelColumn: 'Hình thức TT', dbField: 'paymentMethod' },
  { excelColumn: 'Ghi chú', dbField: 'notes' },
];

/**
 * Prepare contract data for export (flat row per contract)
 */
export const prepareContractExport = (contracts: any[]): Record<string, any>[] => {
  return contracts.map(c => {
    const firstItem = c.items?.[0];
    const sessions =
      c.totalSessions ||
      c.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) ||
      0;
    const contractDate = c.contractDate
      ? formatDateVN(String(c.contractDate).split('T')[0])
      : '';

    return {
      'Mã HĐ': c.code || '',
      'Học viên': c.studentName || '',
      'Tên phụ huynh': c.parentName || '',
      'SĐT phụ huynh': c.parentPhone || '',
      'Ngày HĐ (dd/mm/yyyy)': contractDate,
      'Lớp học': c.className || firstItem?.className || '',
      'Cơ sở': c.branch || '',
      'Tên gói/khóa': firstItem?.name || '',
      'Số buổi': sessions,
      'Đơn giá/buổi': firstItem?.unitPrice || c.pricePerSession || '',
      'Tổng tiền': c.totalAmount || 0,
      'Đã thanh toán': c.paidAmount || 0,
      'Còn nợ': c.remainingAmount || 0,
      'Trạng thái': c.status || '',
      'Hình thức TT': c.paymentMethod || '',
      'Ghi chú': c.notes || '',
      'Người tạo': c.createdBy || '',
    };
  });
};
