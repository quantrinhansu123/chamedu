import fs from 'fs';
import path from 'path';

const dir = path.resolve(import.meta.dirname);
let removed = 0;
for (const f of fs.readdirSync(dir)) {
  if (!/\.(ts|js|cjs)$/.test(f)) continue;
  const fp = path.join(dir, f);
  const c = fs.readFileSync(fp, 'utf8');
  if (/from ['"]firebase|firebase-admin|firebase\/firestore/.test(c)) {
    fs.unlinkSync(fp);
    console.log('removed', f);
    removed++;
  }
}
console.log(`Done: ${removed} firebase scripts removed`);
