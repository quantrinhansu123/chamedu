import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const IMPORT_LINE = `import { collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, writeBatch, runTransaction, arrayUnion, Timestamp, db } from '@/src/utils/legacyFirestoreStub';\n`;

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      if (!['node_modules', 'dist', 'scripts'].includes(f)) walk(p, out);
    } else if (/\.(tsx|ts)$/.test(f)) out.push(p);
  }
  return out;
}

for (const fp of walk(path.join(ROOT, 'pages')).concat(walk(path.join(ROOT, 'src/features')))) {
  let c = fs.readFileSync(fp, 'utf8');
  if (!/collection\(|getDocs\(|onSnapshot\(|runTransaction\(/.test(c)) continue;
  if (c.includes('legacyFirestoreStub')) continue;
  c = IMPORT_LINE + c;
  fs.writeFileSync(fp, c);
  console.log('patched', path.relative(ROOT, fp));
}
