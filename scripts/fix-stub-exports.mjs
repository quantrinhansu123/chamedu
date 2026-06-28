import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');

const services = fs.readdirSync(path.join(ROOT, 'src/services')).filter((f) => f.endsWith('.ts'));

const importRe = /from\s+['"](?:@\/src\/|\.\.\/)*services\/([^'"]+)['"]/g;
const namedImportRe = /import\s*\{([^}]+)\}/g;
const starImportRe = /import\s+\*\s+as\s+(\w+)\s+from\s+['"][^'"]*services\/([^'"]+)['"]/g;

const needed = new Map();

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      if (!['node_modules', 'dist'].includes(f)) walk(p);
    } else if (/\.(tsx?)$/.test(f)) {
      const c = fs.readFileSync(p, 'utf8');
      let m;
      while ((m = starImportRe.exec(c))) {
        const file = m[2].replace(/\.ts$/, '') + '.ts';
        if (!needed.has(file)) needed.set(file, new Set());
        // common service methods - add via named imports in same file
      }
      const imports = [...c.matchAll(/from\s+['"][^'"]*services\/([^'"]+)['"]/g)];
      for (const im of imports) {
        const file = im[1].replace(/\.ts$/, '') + '.ts';
        if (!needed.has(file)) needed.set(file, new Set());
      }
      const blocks = [...c.matchAll(namedImportRe)];
      for (const b of blocks) {
        const block = b[1];
        const next = c.slice(b.index).match(/from\s+['"][^'"]*services\/([^'"]+)['"]/);
        if (!next) continue;
        const file = next[1].replace(/\.ts$/, '') + '.ts';
        if (!needed.has(file)) needed.set(file, new Set());
        block.split(',').forEach((part) => {
          const name = part.trim().split(/\s+as\s+/)[0].trim();
          if (name && name !== 'type') needed.get(file).add(name);
        });
      }
    }
  }
}

walk(path.join(ROOT, 'pages'));
walk(path.join(ROOT, 'src'));
walk(path.join(ROOT, 'components'));

for (const [file, names] of needed) {
  const fp = path.join(ROOT, 'src/services', file);
  if (!fs.existsSync(fp)) continue;
  let content = fs.readFileSync(fp, 'utf8');
  if (!content.includes('Auto-stub')) continue;
  const existing = new Set([...content.matchAll(/^export (?:const|async function|function|class|type|interface) (\w+)/gm)].map((x) => x[1]));
  const lines = [];
  for (const name of names) {
    if (existing.has(name)) continue;
    if (name.endsWith('Status') || name.endsWith('Type') || name[0] === name[0].toUpperCase() && !name.startsWith('get') && !name.startsWith('create')) {
      // likely a type - skip if not found
      continue;
    }
    const isRead = /^(get|fetch|find|list|check|count|verify|parse|calculate|generate|subscribe|apply|preview|increment)/i.test(name);
    if (isRead) {
      lines.push(`export const ${name} = async (..._args: any[]): Promise<any> => { console.warn('[stub] ${name}'); return ${/null|ById|find|get/i.test(name) && !/gets|getAll/i.test(name) ? 'null' : '[]'}; };`);
    } else {
      lines.push(`export const ${name} = async (..._args: any[]): Promise<any> => { notMigrated('${name}'); };`);
    }
  }
  if (lines.length) {
    if (!content.includes('notMigrated')) {
      content = content.replace(/^/, "import { notMigrated } from '../utils/notMigrated';\n");
    }
    fs.writeFileSync(fp, content + '\n' + lines.join('\n') + '\n');
    console.log(file, '+', lines.length, 'exports');
  }
}
