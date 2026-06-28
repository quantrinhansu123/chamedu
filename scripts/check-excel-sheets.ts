import pkg from 'xlsx';
const { readFile, utils } = pkg;
import * as path from 'path';

const excelPath = path.resolve('assets/Phần Mềm v2 GVTG.xlsx');

try {
  const workbook = readFile(excelPath);
  
  const sheetsToInspect = ['DS HV', 'DS Nhân Viên', 'DS Lớp Học', 'Hợp đồng', 'Điểm Danh'];
  
  for (const sheetName of sheetsToInspect) {
    if (!workbook.SheetNames.includes(sheetName)) {
      console.log(`\nSheet "${sheetName}" does not exist.`);
      continue;
    }
    const worksheet = workbook.Sheets[sheetName];
    const data = utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    console.log(`\nSheet "${sheetName}" has ${data.length} rows.`);
    
    // Find first non-empty row to get headers
    let headerRowIdx = 0;
    while (headerRowIdx < data.length && (!data[headerRowIdx] || data[headerRowIdx].filter(x => x !== null && x !== '').length < 2)) {
      headerRowIdx++;
    }
    
    if (headerRowIdx < data.length) {
      console.log('Headers:', data[headerRowIdx].slice(0, 10));
      console.log('Sample Row 1:', data[headerRowIdx + 1]?.slice(0, 10));
      console.log('Sample Row 2:', data[headerRowIdx + 2]?.slice(0, 10));
    } else {
      console.log('No data rows found.');
    }
  }
} catch (err: any) {
  console.error('Error reading Excel file:', err.message);
}
