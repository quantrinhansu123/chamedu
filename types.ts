
export enum ClassStatus {
  STUDYING = 'Đang học',
  FINISHED = 'Kết thúc',
  PAUSED = 'Tạm dừng',
  PENDING = 'Chờ mở'
}

export enum StudentStatus {
  ACTIVE = 'Đang học',
  DEBT = 'Nợ phí',
  CONTRACT_DEBT = 'Nợ hợp đồng',
  RESERVED = 'Bảo lưu',
  DROPPED = 'Nghỉ học',
  TRIAL = 'Học thử',
  EXPIRED_FEE = 'Đã học hết phí'
}

export enum AttendanceStatus {
  PENDING = '',
  ON_TIME = 'Đúng giờ',
  LATE = 'Trễ giờ',
  ABSENT = 'Vắng',
  RESERVED = 'Bảo lưu',
  TUTORED = 'Đã bồi'
}

export interface ClassSession {
  id: string;
  className: string;
  room: string;
  teacher: string;
  time: string;
  dayOfWeek: string;
}

/**
 * ClassProgress: Track student progress per class
 * Used for student-level session counting
 */
export interface ClassProgress {
  registeredSessions: number;   // = class.totalSessions hoặc contract.sessions
  attendedSessions: number;     // present + late
  absentSessions: number;       // vắng
  makeupOwed: number;           // = absent - makeupDone
  makeupDone: number;           // buổi đã bù
  reservedSessions: number;     // bảo lưu
}

export interface Student {
  id: string;
  code: string;
  fullName: string;
  dob: string; // ISO date
  gender: 'Nam' | 'Nữ';
  phone: string;
  parentId?: string; // Reference to parents collection
  parentName?: string; // Denormalized for display (auto-synced)
  parentPhone?: string; // Denormalized for display (auto-synced)
  status: StudentStatus;
  careHistory: CareLog[];
  branch?: string; // Cơ sở học
  class?: string; // Current class name (legacy)
  classId?: string; // Primary class ID
  classIds?: string[]; // All enrolled class IDs (for multi-class support)
  registeredSessions?: number; // Số buổi đã đăng ký/đóng tiền
  attendedSessions?: number; // Số buổi đã học (tự động tính từ điểm danh)
  remainingSessions?: number; // Số buổi còn lại (âm = nợ phí, auto set status)
  /** Số buổi đã học ở hệ thống cũ (nhập thủ công, dùng để tính remaining chính xác) */
  legacyAttendedSessions?: number;
  /** Số buổi học bù/thêm đã tham gia (không tính vào nợ phí) */
  makeupSessionsAttended?: number;
  startSessionNumber?: number; // Buổi học bắt đầu (khi đăng ký giữa khoá)
  enrollmentDate?: string; // Ngày đăng ký
  startDate?: string; // Ngày bắt đầu học
  expectedEndDate?: string; // Ngày kết thúc dự kiến (tự động tính)
  reserveDate?: string; // Ngày bảo lưu
  reserveNote?: string; // Ghi chú bảo lưu
  reserveSessions?: number; // Số buổi bảo lưu

  // Nghỉ học
  dropoutReason?: string; // Lý do nghỉ học (free-text)
  dropoutDate?: string; // Ngày nghỉ học

  // Nợ xấu
  badDebt?: boolean; // Tick nợ xấu (học sinh nghỉ học nhưng còn nợ)
  badDebtSessions?: number; // Số buổi nợ
  badDebtAmount?: number; // Số tiền nợ xấu (sessions x 150k)
  badDebtDate?: string; // Ngày ghi nhận nợ xấu
  badDebtNote?: string; // Ghi chú nợ xấu

  // Nợ hợp đồng (trả góp)
  contractDebt?: number; // Số tiền còn nợ hợp đồng
  nextPaymentDate?: string; // Ngày hẹn thanh toán tiếp theo

  // Student progress per class (Phase 3.1)
  classProgress?: Record<string, ClassProgress>; // { [classId]: ClassProgress }
}

export interface CareLog {
  id: string;
  date: string;
  type: 'Bồi bài' | 'Phản hồi' | 'Tư vấn';
  content: string;
  staff: string;
}

// Cấu hình lịch học chi tiết cho từng ngày trong tuần
export interface DayScheduleConfig {
  dayOfWeek: string; // '2', '3', '4', '5', '6', '7', 'CN'
  dayLabel: string; // 'Thứ 2', 'Thứ 3'...
  startTime: string; // '18:00'
  endTime: string; // '19:30'
  room?: string; // Phòng học (có thể khác mỗi ngày)
  // Giáo viên Việt Nam
  teacherId?: string;
  teacher?: string;
  teacherDuration?: number; // phút (auto-calculated từ time range)
  teacherStartTime?: string; // '18:00' - giờ bắt đầu dạy
  teacherEndTime?: string;   // '19:30' - giờ kết thúc dạy
  // Trợ giảng
  assistantId?: string;
  assistant?: string;
  assistantDuration?: number; // phút
  assistantStartTime?: string;
  assistantEndTime?: string;
  // Giáo viên nước ngoài
  foreignTeacherId?: string;
  foreignTeacher?: string;
  foreignTeacherDuration?: number; // phút
  foreignTeacherStartTime?: string;
  foreignTeacherEndTime?: string;
}

// Lịch sử thay đổi lớp học (giáo viên, lịch học, phòng học...)
export interface TrainingHistoryEntry {
  id: string;
  date: string; // ISO date khi thay đổi
  type: 'schedule_change' | 'teacher_change' | 'room_change' | 'status_change' | 'other';
  description: string; // Mô tả chi tiết
  oldValue?: string; // Giá trị cũ
  newValue?: string; // Giá trị mới
  changedBy?: string; // Người thay đổi
  note?: string; // Ghi chú thêm
  effectiveDate?: string; // Ngày hiệu lực (YYYY-MM-DD), khác date (ngày thao tác)
}

// Payload tạm khi đổi GV - client lưu lên class doc, CF đọc rồi xoá
export interface TeacherChangePayload {
  teacherChangeEffectiveDate?: string;       // YYYY-MM-DD
  teacherChangeOldTeacher?: string;          // Tên GV cũ
  teacherChangeOldTeacherId?: string;        // ID GV cũ
  assistantChangeEffectiveDate?: string;
  assistantChangeOldAssistant?: string;
  assistantChangeOldAssistantId?: string;
  foreignTeacherChangeEffectiveDate?: string;
  foreignTeacherChangeOldTeacher?: string;
  foreignTeacherChangeOldTeacherId?: string;
}

export interface ClassModel {
  id: string;
  name: string;
  status: ClassStatus;
  curriculum: string;
  ageGroup: string;
  progress: string; // e.g., "12/24 Buổi"
  totalSessions?: number; // Tổng số buổi học của lớp
  tuitionFee?: number; // Học phí của lớp
  teacher: string;
  teacherId?: string;
  teacherDuration?: number; // Thời lượng dạy của GV VN (phút)
  teacherStartTime?: string; // Giờ bắt đầu dạy GV VN
  teacherEndTime?: string;   // Giờ kết thúc dạy GV VN
  assistant: string;
  assistantDuration?: number; // Thời lượng dạy của trợ giảng (phút)
  assistantStartTime?: string;
  assistantEndTime?: string;
  foreignTeacher?: string;
  foreignTeacherDuration?: number; // Thời lượng dạy của GVNN (phút)
  foreignTeacherStartTime?: string;
  foreignTeacherEndTime?: string;
  studentsCount: number;
  trialStudents?: number;
  activeStudents?: number;
  debtStudents?: number;
  reservedStudents?: number;
  schedule?: string; // Lịch học tổng quát, e.g., "Thứ 2, 4 (18h-19h30)"
  scheduleDetails?: DayScheduleConfig[]; // Chi tiết lịch học theo từng ngày (NEW)
  room?: string; // Phòng mặc định (legacy)
  branch?: string; // Cơ sở
  color?: number; // Index màu trong palette (0-15), undefined = auto từ tên lớp
  createdDate?: string; // Ngay tao lop de theo doi hoc phi theo ngay/thang
  startDate: string;
  endDate: string;
  createdAt?: string;
  updatedAt?: string;
  trainingHistory?: TrainingHistoryEntry[]; // Lịch sử đào tạo
}

export type StaffRole =
  // Điều Hành
  | 'Quản lý'
  | 'Quản trị viên'
  | 'Quản lý (Admin)'
  // Đào Tạo - Giáo viên
  | 'Giáo viên'
  | 'Giáo Viên Việt'
  | 'Giáo viên Việt'
  | 'GV Việt'
  | 'Giáo Viên Nước Ngoài'
  | 'Giáo viên nước ngoài'
  | 'GV NN'
  // Đào Tạo - Trợ giảng
  | 'Trợ giảng'
  | 'Trợ Giảng'
  // Văn Phòng - CSKH
  | 'Trưởng Nhóm CSKH'
  | 'NV CSKH'
  | 'Tư vấn viên'
  | 'Lễ tân'
  | 'CSKH'
  | 'Nhân viên'
  // Văn Phòng - CM (Chuyên Môn)
  | 'Trưởng Nhóm CM'
  | 'Trưởng Nhóm Học Thuật'
  | 'Trưởng Nhóm Chuyên Môn'
  | 'NV CM'
  | 'NV Chuyên Môn'
  | 'Chuyên môn'
  // Văn Phòng - Sale
  | 'Trưởng Nhóm Sale'
  | 'NV Sale'
  | 'Sale'
  // Văn Phòng - Kế Toán
  | 'Kế toán'
  | 'Kế Toán'
  // Legacy
  | 'Văn phòng';

// Position-based Salary Configuration
export interface PositionSalaryConfig {
  position: string;
  baseMultiplier: number;    // 1.0 = standard, 1.3 = lead, 1.5 = management
  hasKpiBonus: boolean;
  hasCommission: boolean;
  defaultBaseSalary?: number;
}

export interface SalaryCalculationResult {
  baseSalary: number;
  positionBonus: number;
  kpiBonus: number;
  commission: number;
  rewards: number;
  penalties: number;
  totalGross: number;
  deductions: number;
  totalNet: number;
}

// Monthly Salary Summary - unified collection for salary calculations
export type SalarySummaryStatus = 'draft' | 'calculated' | 'approved' | 'paid';

export interface MonthlySalarySummary {
  id?: string;
  staffId: string;
  staffName: string;
  position: string;
  department: string;
  month: number;
  year: number;

  // Base salary
  baseSalary: number;
  positionBonus: number;

  // Work-based calculations
  workDays: number;           // For office staff
  workSessions: number;       // For teachers
  sessionRate: number;        // Rate per session

  // Bonuses
  kpiBonus: number;
  commission: number;
  rewards: number;            // Sum from rewardPenalties

  // Deductions
  penalties: number;          // Sum from rewardPenalties
  latePenalty: number;        // From attendance
  otherDeductions: number;

  // Totals
  totalGross: number;
  totalDeductions: number;
  totalNet: number;

  // Metadata
  status: SalarySummaryStatus;
  calculatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface Staff {
  id: string;
  name: string;
  code: string;
  // Support multiple roles
  roles?: StaffRole[];
  // Legacy single role (for backward compatibility)
  role: StaffRole;
  department: string;
  position: string;
  phone: string;
  email?: string;
  status: 'Active' | 'Inactive' | 'Đang làm việc' | 'Nghỉ việc';
  dob?: string;
  startDate?: string;
  branch?: string; // Cơ sở làm việc
  leaveQuota?: number; // Override global default leave quota
}

export type HolidayApplyType = 'all_classes' | 'specific_classes' | 'specific_branch' | 'all_branches';

export interface Holiday {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'Đã áp dụng' | 'Chưa áp dụng';
  applyType: HolidayApplyType;
  classIds?: string[]; // Khi applyType = 'specific_classes'
  classNames?: string[]; // Tên lớp để hiển thị
  branch?: string; // Khi applyType = 'specific_branch'
  affectedSessionIds?: string[]; // Các session đã bị ảnh hưởng (để revert)
  date?: string; // Legacy field for ordering
  createdAt?: string;
}

export interface TutoringSession {
  id: string;
  studentName: string;
  className: string;
  date: string;
  time: string;
  teacher: string;
  content: string;
  status: 'Đã hẹn' | 'Hoàn thành' | 'Hủy';
}

// Leave Request Types
export type LeaveRequestStatus = 'Chờ phê duyệt' | 'Đã phê duyệt' | 'Từ chối';
export type LeaveType = 'Nghỉ phép' | 'Nghỉ ốm' | 'Nghỉ việc riêng' | 'Nghỉ không lương';

export interface LeaveRequest {
  id: string;
  // Staff info
  staffId: string;
  staffName: string;
  staffCode?: string;
  position?: string;
  branch?: string;
  // Leave details
  startDate: string;         // YYYY-MM-DD
  endDate: string;           // YYYY-MM-DD
  leaveType: LeaveType;
  reason: string;            // Lý do xin nghỉ
  // Status tracking
  status: LeaveRequestStatus;
  approvedBy?: string;       // Admin/Manager ID
  approvedByName?: string;
  approvalDate?: string;
  rejectionReason?: string;  // Lý do từ chối
  // Metadata
  createdAt: string;
  updatedAt?: string;
}

// Leave Balance tracking per staff per year
export interface LeaveBalance {
  id: string;
  staffId: string;
  staffName: string;
  year: number;              // e.g., 2025
  quota: number;             // Total quota for the year
  used: number;              // Approved leaves used
  pending: number;           // Pending approval
  remaining: number;         // = quota - used - pending
  lastUpdated: string;
}

export interface AttendanceRecord {
  id: string;
  classId: string;
  className: string;
  date: string;
  sessionNumber?: number | null;
  sessionId?: string | null;
  totalStudents: number;
  present: number;
  absent: number;
  reserved: number;
  tutored: number;
  status: 'Đã điểm danh' | 'Chưa điểm danh' | 'LỊCH NGHỈ CHUNG';
  holidayId?: string;  // Reference to holiday that created this record
  holidayName?: string; // Holiday name for display
  /**
   * Loại điểm danh:
   * - 'session': Điểm danh theo buổi học (mặc định khi có sessionId)
   * - 'makeup': Học bù (không trừ remainingSessions)
   * - 'manual': Admin override hoặc lớp chưa có schedule
   */
  attendanceType?: 'session' | 'makeup' | 'manual';
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface StudentAttendance {
  id?: string;
  attendanceId: string;
  sessionId?: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  classId?: string;
  className?: string;
  date?: string;
  sessionNumber?: number;
  status: AttendanceStatus;
  note?: string;
  /** Nhận xét ý thức học tập trong buổi */
  attitudeComment?: string;
  /** Thẻ chú ý gửi phụ huynh (JSON AttentionCardData) */
  attentionCard?: string;
  /** Dạng bài học trong buổi (JSON LessonExerciseTagsData) */
  lessonExerciseTags?: string;
  /** Dạng bài kiểm tra ngày sau (JSON CheckExerciseTagsData) */
  checkExerciseTags?: string;

  // Thông tin điểm số buổi học
  homeworkCompletion?: number;  // % BTVN (0-100)
  testName?: string;            // Tên bài KT (nếu có)
  score?: number;               // Điểm (0-10)
  bonusPoints?: number;         // Điểm thưởng

  // Thông tin đúng giờ / trễ giờ
  punctuality?: 'onTime' | 'late' | '';  // Đúng giờ / Trễ giờ
  isLate?: boolean;             // Đi trễ (legacy)

  /** Loại điểm danh - kế thừa từ parent attendance record */
  attendanceType?: 'session' | 'makeup' | 'manual';

  createdAt?: string;
  updatedAt?: string;
}

// Nhận xét cuối tháng của giáo viên
export interface MonthlyComment {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  month: number;              // 1-12
  year: number;               // 2025

  // Nhận xét từ giáo viên
  teacherComment?: string;
  teacherId?: string;
  teacherName?: string;

  // Nhận xét AI (có thể generate)
  aiComment?: string;

  // Metadata
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
}

// Thống kê báo cáo tháng
export interface MonthlyReportStats {
  totalSessions: number;        // Tổng số buổi
  attendedSessions: number;     // Số buổi có mặt
  absentSessions: number;       // Số buổi vắng
  attendanceRate: number;       // Tỉ lệ tham gia (%)
  averageScore: number | null;  // Điểm trung bình
  totalBonusPoints: number;     // Tổng điểm thưởng
}

// Nhận xét bài test (Brisky PDF format)
export interface SkillScore {
  score: number;
  maxScore: number;
}

export interface SkillContent {
  listening?: string;           // Nội dung phần Nghe
  readingWriting?: string;      // Nội dung phần Đọc và Viết
  speaking?: string;            // Nội dung phần Nói
}

export interface TestComment {
  id?: string;
  classId: string;
  studentId: string;
  studentName: string;

  // Test info
  testName: string;             // e.g., "PROGRESS TEST"
  testDate: string;
  unit?: string;                // e.g., "UNIT 1,2,3"
  book?: string;                // e.g., "Academy stars 1"
  videoLink?: string;           // YouTube link

  // Scores by skill (điểm theo kỹ năng)
  listeningScore?: SkillScore;  // e.g., { score: 12, maxScore: 13 }
  readingWritingScore?: SkillScore; // e.g., { score: 28, maxScore: 35 }
  speakingScore?: SkillScore;   // e.g., { score: 8.5, maxScore: 10 }

  // Content descriptions (Nội dung)
  content?: SkillContent;

  // Strengths (Nội dung con làm tốt)
  strengths?: SkillContent;

  // Improvements needed (Nội dung con cần cải thiện)
  improvements?: SkillContent;

  // Learning attitude (Thái độ học tập)
  learningAttitude?: string;

  // Parent message (Lời nhắn nhủ phụ huynh)
  parentMessage?: string;

  // Teacher info
  teacherId?: string;
  teacherName?: string;

  // Legacy fields (backward compatible)
  comment?: string;             // Simple comment (legacy)
  score?: number | null;        // Single score (legacy)

  // Metadata
  createdAt: string;
  updatedAt: string;
}

/**
 * Template for class-level test comments
 * Used to pre-fill common content for all students in a class
 */
export interface TestTemplate {
  id?: string;
  testName: string;              // Links to TestComment.testName
  classId: string;               // Links to TestComment.classId

  // Content templates (same structure as TestComment)
  content?: SkillContent;        // Nội dung
  strengths?: SkillContent;      // Làm tốt
  improvements?: SkillContent;   // Cần cải thiện
  learningAttitude?: string;     // Thái độ học tập
  parentMessage?: string;        // Lời nhắn phụ huynh

  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category: 'Sách' | 'Đồng phục' | 'Học liệu' | 'Khác';
  stock: number; // Tổng tồn kho (deprecated - dùng branchStock)
  branchStock?: Record<string, number>; // Tồn kho theo cơ sở { branchId: quantity }
  status: 'Kích hoạt' | 'Tạm khoá';
}

export interface InventoryTransfer {
  id: string;
  productId: string;
  productName: string;
  fromBranch: string;
  toBranch: string;
  quantity: number;
  transferDate: string;
  note?: string;
  createdBy: string;
  createdAt: string;
}

export interface Discount {
  id?: string;
  name: string;
  type: 'percent' | 'fixed';
  value: number;
  status: 'Kích hoạt' | 'Tạm dừng';
  createdAt?: string;
}

// Applied discount on contract item (supports multiple discounts)
export interface AppliedDiscount {
  discountId: string;    // Reference to Discount.id or 'custom' for manual
  name: string;          // Discount name for display
  type: 'percent' | 'fixed';
  value: number;         // % value (12) or fixed amount (50000)
  amount: number;        // Calculated discount amount in VND
}

export interface Room {
  id: string;
  name: string;
  type: 'Văn phòng' | 'Phòng học' | 'Phòng chức năng';
  capacity?: number;
  status: 'Hoạt động' | 'Bảo trì';
  branch?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EnrollmentRecord {
  id: string;
  studentName: string;
  studentId?: string;
  classId?: string;
  className?: string;
  sessions: number;
  type: 'Hợp đồng mới' | 'Hợp đồng tái phí' | 'Hợp đồng liên kết' | 'Thanh toán thêm' | 'Ghi danh thủ công' | 'Tặng buổi' | 'Nhận tặng buổi' | 'Chuyển lớp' | 'Xóa khỏi lớp';
  contractCode?: string;
  contractId?: string;
  originalAmount?: number;
  finalAmount?: number;
  createdDate?: string;
  createdAt?: string;
  createdBy: string;
  staff?: string; // Alias for createdBy for display
  note?: string;
  notes?: string; // Alias
  reason?: string; // Lý do thay đổi
}

export interface Parent {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  relationship?: 'Bố' | 'Mẹ' | 'Ông/Bà' | 'Khác';
  createdAt?: string;
  updatedAt?: string;
  // children will be queried from students collection by parentId
}

export interface FeedbackRecord {
  id: string;
  date: string;
  type: 'Call' | 'Form';
  studentId?: string;
  studentName: string;
  classId?: string;
  className: string;
  teacher?: string;
  teacherScore?: number;
  curriculumScore?: number;
  careScore?: number;
  facilitiesScore?: number;
  averageScore?: number;
  caller?: string; // For Call type
  content?: string; // For Call type
  status: 'Cần gọi' | 'Đã gọi' | 'Hoàn thành';
  parentId?: string;
  parentName?: string;
  parentPhone?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SalaryRule {
  id: string;
  staffName: string;
  dob: string;
  position: 'Giáo Viên Việt' | 'Giáo Viên Nước Ngoài' | 'Trợ Giảng';
  class: string;
  salaryMethod: 'Theo ca' | 'Theo giờ' | 'Nhận xét' | 'Dạy chính';
  baseRate: number;
  workMethod: 'Cố định' | 'Theo sĩ số';
  avgStudents: number;
  ratePerSession: number;
  effectiveDate: string;
}

export interface SalaryRangeConfig {
  id: string;
  type: 'Teaching' | 'AssistantFeedback';
  rangeLabel: string;
  method?: string;
  amount: number;
}

export interface WorkSession {
  id: string;
  staffName: string;
  position: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  className: string;
  type: 'Dạy chính' | 'Nhận xét' | 'Trợ giảng';
  status: 'Đã xác nhận' | 'Chờ xác nhận';
}

export interface SalarySummary {
  id: string;
  staffName: string;
  dob: string;
  position: 'Giáo Viên Việt' | 'Giáo Viên Nước Ngoài' | 'Trợ Giảng';
  estimatedSalary: number;
  expectedSalary: number;
  kpiBonus?: number;
}

export interface SalaryDetailItem {
  id: string;
  date: string;
  time: string;
  className: string;
  studentCount?: number;
  salary: number;
  mainSalary?: number; // For Assistant
  feedbackSalary?: number; // For Assistant
  type?: string; // e.g., 'Bồi bài', 'Dạy chính'
}

export interface StaffSalaryRecord {
  id: string;
  staffName: string;
  position: string;
  baseSalary: number;
  workDays: number;
  commission: number;
  allowance: number;
  deduction: number;
  totalSalary: number;
}

export interface StaffAttendanceLog {
  id: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: 'Đúng giờ' | 'Đi muộn' | 'Về sớm' | 'Nghỉ phép';
  note?: string;
}

export type MenuItem = {
  id: string;
  label: string;
  icon: any;
  path?: string;
  subItems?: MenuItem[];
};

// ==========================================
// CONTRACT TYPES
// ==========================================

export enum ContractType {
  STUDENT = 'Học viên',
  PRODUCT = 'Học liệu'
}

export enum ContractCategory {
  NEW = 'Hợp đồng mới',
  RENEWAL = 'Hợp đồng tái phí',
  MIGRATION = 'Hợp đồng liên kết'
}

export enum ContractStatus {
  DRAFT = 'Lưu nháp',
  PENDING = 'Chờ thanh toán',
  PAID = 'Đã thanh toán',
  PARTIAL = 'Nợ hợp đồng',
  CANCELLED = 'Đã hủy'
}

export enum PaymentMethod {
  FULL = 'Toàn bộ',
  INSTALLMENT = 'Trả góp',
  TRANSFER = 'Chuyển khoản',
  CASH = 'Tiền mặt'
}

export interface Course {
  id: string;
  code: string;
  name: string;
  totalSessions: number;
  pricePerSession: number;
  totalPrice: number;
  curriculum?: string;
  level?: string;
  ageGroup?: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
  updatedAt: string;
}

export interface ContractItem {
  type: 'course' | 'product';
  id: string;
  name: string;
  classId?: string;
  className?: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  discount: number; // 0-1 (0.2 = 20%) - legacy, calculated from appliedDiscounts
  appliedDiscounts?: AppliedDiscount[]; // Multiple discounts with details
  finalPrice: number;
  debtSessions?: number;
  startDate?: string;
  endDate?: string;
}

export interface Contract {
  id: string;
  code: string;
  type: ContractType;
  category?: ContractCategory; // Loại hợp đồng: mới, tái phí, liên kết

  // Student Info
  studentId?: string;
  studentName?: string;
  studentDOB?: string;
  parentName?: string;
  parentPhone?: string;

  // Items
  items: ContractItem[];

  // Financial
  subtotal: number;
  totalDiscount: number;
  totalAmount: number;
  totalAmountInWords: string;

  // Payment
  paymentMethod: PaymentMethod;
  paidAmount: number;
  remainingAmount: number;

  // Dates
  contractDate: string;
  startDate?: string; // Ngày bắt đầu hợp đồng
  endDate?: string; // Ngày kết thúc dự kiến (tự động tính từ số buổi + lịch học)
  paymentDate?: string;
  nextPaymentDate?: string; // Ngày hẹn thanh toán tiếp theo (cho nợ hợp đồng)

  // Class Info
  classId?: string;
  className?: string;
  branch?: string; // Cơ sở (lưu từ học viên hoặc lớp)

  // Session Info (for financial reports)
  totalSessions?: number;
  pricePerSession?: number;

  // Status
  status: ContractStatus;

  // Notes
  notes?: string;

  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface ContractPayment {
  id: string;
  contractId: string;
  contractCode: string;
  amount: number;
  paymentMethod: 'Tiền mặt' | 'Chuyển khoản' | 'Thẻ';
  paymentDate: string;
  receiptNumber?: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

export interface BirthdayGift {
  id: string;
  studentId: string;
  studentName: string;
  year: number;
  month: number;
  giftPrepared: boolean;
  giftGiven: boolean;
  preparedAt?: string;
  givenAt?: string;
  preparedBy?: string;
  givenBy?: string;
  note?: string;
}

// Settlement Invoice Types
export type SettlementStatus = 'Đã thanh toán' | 'Nợ xấu';

export interface SettlementInvoice {
  id?: string;
  invoiceCode: string;      // STL-YYYYMMDD-XXX
  invoiceDate: string;

  // Student Info
  studentId: string;
  studentCode: string;
  studentName: string;
  studentPhone?: string;
  studentDob?: string;
  parentName: string;

  // Course Details
  courseName: string;       // Curriculum/product name
  className: string;
  totalSessions: number;    // registeredSessions
  attendedSessions: number;
  debtSessions: number;     // attended - registered
  startDate?: string;
  endDate?: string;

  // Financials
  pricePerSession: number;  // 150,000 VND
  totalAmount: number;      // debtSessions × 150,000
  discount?: number;
  paidAmount: number;
  remainingAmount: number;

  // Status & Payment
  status: SettlementStatus;
  paymentMethod?: 'Tiền mặt' | 'Chuyển khoản';

  // Staff
  collectedBy?: string;     // Staff ID who collected
  collectedByName?: string; // Staff name (denormalized)

  // Meta
  createdAt: string;
  updatedAt?: string;
  note?: string;
}

// ==========================================
// WIFI & CHECKIN TYPES
// ==========================================

/**
 * WiFi configuration for IP verification
 * Admin configures allowed WiFi networks with their public IPs
 */
export interface AllowedWifi {
  id: string;
  name: string;           // WiFi name (SSID)
  publicIp: string;       // Public IP of the WiFi network
  branch?: string;        // Branch/center this WiFi belongs to
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Staff CheckIn record
 * Records daily check-in/check-out with IP verification
 */
export type CheckInVerificationMethod = 'ip' | 'wifi_name' | 'manual';
export type CheckInStatus = 'checked_in' | 'checked_out' | 'invalid';

export interface StaffCheckIn {
  id: string;
  staffId: string;
  staffName: string;
  date: string;           // YYYY-MM-DD
  checkInTime?: string;   // HH:mm
  checkOutTime?: string;  // HH:mm

  // Verification data
  detectedIp: string;
  detectedWifiName?: string;  // From user input when IP doesn't match
  matchedWifiId?: string;     // ID of matched AllowedWifi
  verificationMethod: CheckInVerificationMethod;

  // Photo capture
  checkInPhotoUrl?: string;   // Photo taken at check-in
  checkOutPhotoUrl?: string;  // Photo taken at check-out

  // Status
  status: CheckInStatus;
  note?: string;

  createdAt: string;
  updatedAt?: string;
}

// Center / Branch info
export interface Center {
  id: string;
  name: string;
  isMain?: boolean;
  address?: string;
  phone?: string;
  email?: string;
  manager?: string;
  signatureUrl?: string;
  status?: string;
}

