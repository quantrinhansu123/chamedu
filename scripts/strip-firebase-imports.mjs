import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const files = `pages/Attendance.tsx
pages/AttendanceHistory.tsx
pages/ContractCreation.tsx
pages/ContractList.tsx
pages/CurriculumManager.tsx
pages/CustomerDatabase.tsx
pages/Dashboard.tsx
pages/DashboardCSKH.tsx
pages/DashboardGV.tsx
pages/DebtManagement.tsx
pages/HomeworkManager.tsx
pages/InventoryManager.tsx
pages/MonthlyReport.tsx
pages/ProductManager.tsx
pages/ProfileSettings.tsx
pages/RoomManager.tsx
pages/SalaryConfig.tsx
pages/SalaryReportTeacher.tsx
pages/Schedule.tsx
pages/StaffManager.tsx
pages/StaffRewardPenalty.tsx
pages/StudentDetail.tsx
pages/StudentManager.tsx
pages/TodayAttendance.tsx
pages/TrainingReport.tsx
pages/TrialStudents.tsx
pages/WorkConfirmation.tsx
src/features/classes/components/ClassDetailModal.tsx
src/features/classes/components/ClassFormModal.tsx
src/features/classes/components/StudentsInClassModal.tsx
src/features/classes/hooks/useClassManager.ts
src/features/debt/components/SettlementModal.tsx
src/features/reports/components/MonthlyCommentTab.tsx
src/features/reports/components/test-comment-edit-modal.tsx
src/features/reports/components/test-comment-template-modal.tsx
src/features/reports/components/TestCommentTab.tsx`
  .trim()
  .split('\n');

const strip = (content) => {
  let c = content;
  c = c.replace(/^import\s+.*from\s+['"]firebase\/[^'"]+['"];?\s*\n/gm, '');
  c = c.replace(/^import\s+.*from\s+['"].*config\/firebase['"];?\s*\n/gm, '');
  c = c.replace(/const\s*\{\s*db\s*\}\s*=\s*await\s+import\([^)]+\);?\s*\n/g, '');
  c = c.replace(/\bdb\b/g, 'null as any /* firebase removed */');
  c = c.replace(/\bauth\b/g, 'null as any /* firebase removed */');
  return c;
};

for (const rel of files) {
  const fp = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) continue;
  const out = strip(fs.readFileSync(fp, 'utf8'));
  fs.writeFileSync(fp, out);
  console.log('stripped', rel);
}
