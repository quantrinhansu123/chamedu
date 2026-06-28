/**
 * One-time: replace Firebase service/hook files with Supabase stubs (reads return empty).
 * Run: node scripts/remove-firebase-stubs.mjs
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');

const STUB_SERVICES = [
  'attendanceService.ts',
  'adminFixService.ts',
  'campaignService.ts',
  'centerService.ts',
  'checkInService.ts',
  'curriculumService.ts',
  'dataIntegrityService.ts',
  'debtService.ts',
  'feedbackService.ts',
  'financialReportService.ts',
  'holidayService.ts',
  'invoiceService.ts',
  'leadService.ts',
  'leaveBalanceService.ts',
  'leaveRequestService.ts',
  'legacy-session-import-service.ts',
  'monthlyReportService.ts',
  'photoUploadService.ts',
  'productService.ts',
  'revenueService.ts',
  'salaryConfigService.ts',
  'settlementInvoiceService.ts',
  'staffSalaryService.ts',
  'tutoringService.ts',
  'wifiConfigService.ts',
  'workGeneratorService.ts',
  'workSessionService.ts',
];

const STUB_HOOKS = [
  'useAutoWorkSessions.ts',
  'useCurriculums.ts',
  'useHolidays.ts',
  'useLeads.ts',
  'useLeaveBalance.ts',
  'useLeaveRequests.ts',
  'useMonthlySalary.ts',
  'useParents.ts',
  'useRooms.ts',
  'useSettlementInvoices.ts',
];

const extractExports = (content) => {
  const exports = [];
  const patterns = [
    /^export (interface|type) (\w+)/gm,
    /^export class (\w+)/gm,
    /^export const (\w+)/gm,
    /^export async function (\w+)/gm,
    /^export function (\w+)/gm,
    /^export default (\w+)/gm,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(content))) exports.push({ kind: m[1], name: m[2] });
  }
  const seen = new Set();
  return exports.filter((e) => {
    if (!e?.name || seen.has(e.name)) return false;
    seen.add(e.name);
    return true;
  });
};

const stubServiceFile = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const exports = extractExports(content);
  const interfaces = content.match(/^export interface [\s\S]*?^}/gm) || [];
  const types = content.match(/^export type [\s\S]*?;/gm) || [];

  const lines = [
    '/** Auto-stub: Firebase removed. Migrate to Supabase. */',
    "import { notMigrated } from '../utils/notMigrated';",
    '',
    ...interfaces,
    ...(interfaces.length ? [''] : []),
    ...types,
    ...(types.length ? [''] : []),
  ];

  for (const e of exports) {
    if (!e?.name) continue;
    if (e.kind === 'interface' || e.kind === 'type') continue;
    if (e.kind === 'class') {
      lines.push(`export class ${e.name} {`);
      lines.push(`  static notReady() { notMigrated('${e.name}'); }`);
      lines.push('}');
      lines.push('');
      continue;
    }
    if (e.name === 'default') continue;
    // Heuristic: read-like names return empty
    const isRead =
      /^(get|fetch|find|list|subscribe|check|count|verify|parse|calculate|generate)/i.test(e.name) ||
      e.name.startsWith('is') ||
      e.name.includes('Summary') ||
      e.name.includes('Report');
    if (isRead) {
      if (/subscribe/i.test(e.name)) {
        lines.push(`export const ${e.name} = (_cb: (data: any[]) => void) => { _cb([]); return () => {}; };`);
      } else if (/parse|calculate|generate/i.test(e.name) && !/ForClass|ForWeek/i.test(e.name)) {
        lines.push(`export const ${e.name} = (..._args: any[]) => { notMigrated('${e.name}'); };`);
      } else {
        lines.push(`export const ${e.name} = async (..._args: any[]): Promise<any> => {`);
        lines.push(`  console.warn('[stub] ${e.name} chưa migrate Supabase');`);
        lines.push(`  return ${/null/i.test(e.name) || /ById|find|get.*Comment/i.test(e.name) ? 'null' : '[]'};`);
        lines.push('};');
      }
    } else {
      lines.push(`export const ${e.name} = async (..._args: any[]): Promise<any> => {`);
      lines.push(`  notMigrated('${e.name}');`);
      lines.push('};');
    }
    lines.push('');
  }

  fs.writeFileSync(filePath, lines.join('\n'));
  console.log('stubbed service', path.basename(filePath));
};

const stubHookFile = (filePath) => {
  const base = path.basename(filePath, '.ts');
  const hookName = base;
  const content = `/** Auto-stub: Firebase removed */\nimport { useState, useEffect } from 'react';\n\nexport const ${hookName} = (..._args: any[]) => {\n  const [data, setData] = useState<any[]>([]);\n  const [loading, setLoading] = useState(false);\n  const [error, setError] = useState<string | null>(null);\n  useEffect(() => { setLoading(false); }, []);\n  return { data, loading, error, refresh: async () => setData([]) };\n};\n`;
  fs.writeFileSync(filePath, content);
  console.log('stubbed hook', path.basename(filePath));
};

for (const f of STUB_SERVICES) {
  stubServiceFile(path.join(ROOT, 'src/services', f));
}

for (const f of STUB_HOOKS) {
  stubHookFile(path.join(ROOT, 'src/hooks', f));
}

// batchQueries + test setup
fs.writeFileSync(
  path.join(ROOT, 'src/utils/batchQueries.ts'),
  `/** Firebase removed */\nexport const batchGetByIds = async <T>(_table: string, _ids: string[]): Promise<T[]> => [];\nexport const batchQuery = async <T>(_fn: () => Promise<T[]>): Promise<T[]> => [];\n`
);

fs.writeFileSync(
  path.join(ROOT, 'src/test/setup.ts'),
  `import '@testing-library/jest-dom';\n`
);

console.log('Done');
