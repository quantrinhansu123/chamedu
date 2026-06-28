import fs from 'fs';

const REPLACEMENTS = [
  // Undo bad global replacements
  [' điểm danh', 'Điểm danh'],
  [' điểm', 'Điểm'],
  [' đi tạo', ' để tạo'],
  [' đi xóa', ' để xóa'],
  [' đi nhập', ' để nhập'],
  [' đi  điểm', ' để điểm'],
  [' đi  đi', ' để đi'],
  ['Rà soát  điểm', 'Rà soát điểm'],
  ['*  điểm', '* Điểm'],

  // Syllables
  ['l:p', 'lớp'],
  ['l9ch', 'lịch'],
  ['L9ch', 'Lịch'],
  ['bu"i', 'buổi'],
  ['Bu"i', 'Buổi'],
  ['v:i', 'với'],
  ['Tr& giờ', 'Trễ giờ'],
  ['Tr&', 'Trễ'],
  ['l& tân', 'lễ tân'],
  ['l&', 'lễ'],
  ['trư:c', 'trước'],
  ['m:i', 'mới'],
  ['ch0', 'chỉ'],
  ['Ch0', 'Chỉ'],
  ['muđn', 'muốn'],
  ['đượcc', 'được'],
  ['kiỒm', 'kiểm'],
  ['KiỒm', 'Kiểm'],
  ['chuyỒn', 'chuyển'],
  ['ChuyỒn', 'Chuyển'],
  ['đ"ng', 'động'],
  ['đ"', 'độ'],
  ['chế đ" ', 'chế độ '],
  ['tự đ"ng', 'tự động'],
  ['Li', 'Lỗi'],
  ['đ9nh', 'định'],
  ['ch0nh', 'chỉnh'],
  ['hi!n', 'hiện'],
  ['hiỒn th9', 'hiển thị'],
  ['hiỒn', 'hiển'],
  ['th9', 'thị'],
  ['li!u', 'liệu'],
  ['học li!u', 'học liệu'],
  ['khđi/', 'khối/'],
  ['đ"i', 'đổi'],
  ['sđ', 'số'],
  ['phân bi!t', 'phân biệt'],
  ['hậu tố', 'hậu tố'],
  ['L`CH NGH CHUNG', 'LỊCH NGHỈ CHUNG'],
  ['NGH CHUNG', 'NGHỈ CHUNG'],
  ['ngh0', 'nghỉ'],
  ['NGH', 'NGHỈ'],
  ['HỢP L ', 'HỢP LỆ '],
  ['HỢP Lệ', 'HỢP LỆ'],
  ['NGìY', 'NGÀY'],
  ['NGY', 'NGÀY'],
  [' -- Chọn buổi học --', ' -- Chọn buổi học --'],
  ['Ghi chú', 'Ghi chú'],
];

function fixFile(filePath) {
  let text = fs.readFileSync(filePath, 'utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  for (const [from, to] of REPLACEMENTS) {
    text = text.split(from).join(to);
  }
  fs.writeFileSync(filePath, text, 'utf8');
  return text;
}

const att = fixFile('pages/Attendance.tsx');
fixFile('src/utils/learningMaterialNotes.ts');

const checks = [
  'Điểm danh lớp học',
  'Trễ giờ',
  'Rà soát điểm danh',
  'KHÔNG THỂ ĐIỂM DANH',
  'Nhận xét ý thức',
  'Lưu điểm danh',
  'Chọn từ học liệu',
  'buổi học',
  'lịch học',
];
for (const c of checks) {
  console.log(c, att.includes(c) ? 'OK' : 'MISSING');
}

const bad = (s) => /l:p|l9ch|bu"i|Tr&|thỒ|Ã|Ä|á»| điểm|li!u|đ9nh|Li/.test(s);
console.log('bad lines:', att.split('\n').filter(bad).length);
