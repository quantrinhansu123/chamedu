# Logic Import Excel - Trang Quản Lý Học Viên

## Tổng Quan

Khi upload file Excel, hệ thống sẽ xử lý theo các bước sau:

## Quy Trình Import

### 1. Đọc File Excel
```
File Excel (.xlsx, .xls) 
  → readExcelFile() 
  → JSON Array [{column1: value1, column2: value2, ...}]
```

### 2. Map Cột Excel → Database Fields
```
Excel Data 
  → mapExcelToFields(excelData, STUDENT_MAPPING)
  → Mapped Data {fullName, code, registeredSessions, ...}
```

**Logic Mapping:**
- Tìm cột theo tên chính xác trước
- Nếu không tìm thấy, tìm trong aliases (exact match)
- Nếu vẫn không tìm thấy, dùng partial match (bỏ dấu, lowercase, normalize)

### 3. Xử Lý Từng Dòng

#### 3.1. Validation
- **Bắt buộc**: `fullName` (Họ và tên) - nếu thiếu → bỏ qua dòng, ghi lỗi
- **Tùy chọn**: Các trường khác có thể để trống

#### 3.2. Parse Dữ Liệu

**a) Số Buổi:**
```javascript
registeredSessions = parseInt(row.registeredSessions) || 0
attendedSessions = parseInt(row.attendedSessions) || 0
legacyAttendedSessions = parseInt(row.legacyAttendedSessions) || 0
remainingSessions = parseInt(row.remainingSessions) || 0
```

**b) Trạng Thái:**
```javascript
// Nếu có "Số buổi còn lại" < 0 → tự động set status = "Nợ phí"
if (remainingSessions < 0) {
  status = "Nợ phí"
} else {
  status = parseStudentStatus(row.status) || "Đang học"
}
```

**c) Lớp Học:**
```javascript
// Tự động match tên lớp từ Excel với database
// VD: "Prestarters 26" → match với "Pre Starters 26"
normalizeClassName = (s) => s.toLowerCase().replace(/\s+/g, '').trim()

// Exact match trước
matchedClass = classes.find(c => normalizeClassName(c.name) === normalizeClassName(row.class))

// Nếu không match, thử partial match
if (!matchedClass) {
  matchedClass = classes.find(c => 
    normalizeClassName(c.name).includes(normalizeClassName(row.class)) ||
    normalizeClassName(row.class).includes(normalizeClassName(c.name))
  )
}
```

#### 3.3. Tạo Học Viên

```javascript
createStudent({
  fullName: row.fullName,                    // Bắt buộc
  code: row.code || `HV${Date.now()}${i}`,   // Tự động tạo nếu thiếu
  dob: row.dob || '',
  gender: row.gender || '',
  phone: row.phone || '',
  email: row.email || '',
  parentName: row.parentName || '',
  parentPhone2: row.parentPhone2 || '',
  address: row.address || '',
  branch: row.branch || '',
  class: matchedClass?.name || row.class || '',  // Dùng tên chuẩn từ DB
  classId: matchedClass?.id || '',              // Link chính xác
  registeredSessions: parseInt(row.registeredSessions) || 0,
  attendedSessions: parseInt(row.attendedSessions) || 0,
  remainingSessions: remainingSessions,
  status: status,
  note: row.note || '',
  // ⚠️ LƯU Ý: legacyAttendedSessions KHÔNG được xử lý trong import!
})
```

## Mapping Các Cột Quan Trọng

### Cột Số Buổi

| Cột Excel | Database Field | Transform | Aliases |
|-----------|---------------|-----------|---------|
| **Số buổi đăng ký** | `registeredSessions` | `parseSessionNumber` | "SỐ BUỔI ĐĂNG KÍ KHOÁ GẦN NHẤT", "SỐ BUỔI ĐĂNG KÍ KHOÁ", "ĐĂNG KÍ KHOÁ", "SỐ BUỔI ĐĂNG KÍ", "SỐ BUỔI ĐĂNG KÝ", "Gói học" |
| **Đã điểm danh** | `attendedSessions` | `parseSessionNumber` | "ĐÃ ĐIỂM DANH", "SỐ BUỔI ĐÃ ĐIỂM DANH", "ĐIỂM DANH" |
| **Số buổi còn lại** | `remainingSessions` | `parseSessionNumber` | "SỐ BUỔI CÒN LẠI TÍNH ĐẾN", "SỐ BUỔI CÒN LẠI", "CÒN LẠI TÍNH ĐẾN", "Còn lại", "CÒN LẠI" |
| **Đã học** | `legacyAttendedSessions` | `parseSessionNumber` | "ĐÃ HỌC (CŨ)", "Đã học cũ", "SỐ BUỔI ĐÃ HỌC (CŨ)", "Legacy Attended", "ĐÃ HỌC CŨ" |

### Transform Functions

**`parseSessionNumber(val)`:**
```javascript
// Hỗ trợ số âm (nợ phí)
if (val === undefined || val === null || val === '') return undefined;
const num = parseInt(String(val).replace(/[^\d-]/g, ''));
return isNaN(num) ? undefined : num;
```

**`parseStudentStatus(val)`:**
```javascript
// Map từ nhiều format khác nhau
if (v.includes('hết phí') || v.includes('học hết')) return 'Đã học hết phí';
if (v.includes('nợ')) return 'Nợ phí';
if (v.includes('bảo lưu')) return 'Bảo lưu';
if (v.includes('nghỉ')) return 'Nghỉ học';
if (v.includes('đang học') || v.includes('active')) return 'Đang học';
if (v.includes('học thử') || v.includes('trial')) return 'Học thử';
return val; // Giữ nguyên nếu không match
```

## Xử Lý Các Trường Số Buổi

### `legacyAttendedSessions` (Đã học)

**Đã được xử lý trong import:**
```javascript
legacyAttendedSessions: typeof row.legacyAttendedSessions === 'number' 
  ? row.legacyAttendedSessions 
  : parseInt(row.legacyAttendedSessions) || 0,
```

- Nếu có giá trị trong Excel → lưu vào database
- Nếu trống hoặc không có → mặc định = 0

## Logic Tính Toán

### Tính `remainingSessions`

**Nếu có trong Excel:**
- Dùng giá trị từ Excel (có thể âm = nợ phí)

**Nếu không có trong Excel:**
- Tự động tính: `registeredSessions - attendedSessions - legacyAttendedSessions`

### Tự Động Set Status

```javascript
// Nếu remainingSessions < 0 → tự động set "Nợ phí"
if (remainingSessions < 0) {
  status = StudentStatus.DEBT; // "Nợ phí"
}
```

## Ví Dụ Import

### Excel Input:
```
Họ và tên: "Nguyễn Văn A"
Số buổi đăng ký: 48
Đã điểm danh: 8
Số buổi còn lại: 40
Đã học: 0
Tình trạng: "Đang học"
```

### Database Output:
```javascript
{
  fullName: "Nguyễn Văn A",
  registeredSessions: 48,
  attendedSessions: 8,
  remainingSessions: 40,
  legacyAttendedSessions: 0,  // ✅ Được lưu từ Excel
  status: "Đang học"
}
```

## Lưu Ý

1. **Thứ tự cột không quan trọng** - hệ thống tự động map theo tên cột
2. **Aliases hỗ trợ** - có thể dùng tên cột khác nhau (VD: "ĐÃ ĐIỂM DANH" thay vì "Đã điểm danh")
3. **Case-insensitive** - "Đã điểm danh" = "ĐÃ ĐIỂM DANH" = "đã điểm danh"
4. **Bỏ dấu tự động** - "Đã học" có thể match với "Da hoc"
5. **Partial match** - Nếu exact match không tìm thấy, sẽ thử partial match
