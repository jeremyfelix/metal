// Deploy-time cache busting. Usage: node scripts/stamp-version.mjs <version>
// Rewrites files IN PLACE (run it only in the CI checkout, never commit the result):
//   index.html    local assets/ stylesheet + script URLs get ?v=<version>, plus <meta name="build-version">
//   assets/js/**  relative static import / export-from / dynamic import() specifiers get ?v=<version>
// Why: Safari kept old ES modules after a deploy (GitHub Pages sends max-age=600) and mixed them with new HTML.
// Idempotent: existing ?v=... suffixes are replaced. Exits non-zero if nothing was stamped or a check fails.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const version = process.argv[2];
if (!version || !/^[A-Za-z0-9._-]{1,40}$/.test(version)) { console.error('usage: node scripts/stamp-version.mjs <version>  (letters, digits, . _ -)'); process.exit(2); }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fail = (msg) => { console.error('stamp-version: ' + msg); process.exit(1); };

// ---------- index.html ----------
const htmlPath = path.join(root, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
let htmlCount = 0;
html = html.replace(/\b(href|src)="(assets\/[^"?#]+)(\?v=[^"]*)?"/g, (m, attr, url) => { htmlCount++; return `${attr}="${url}?v=${version}"`; });
const meta = `<meta name="build-version" content="${version}">`;
if (/<meta name="build-version"[^>]*>/.test(html)) html = html.replace(/<meta name="build-version"[^>]*>/, meta);
else if (/<meta charset[^>]*>/i.test(html)) html = html.replace(/(<meta charset[^>]*>)/i, `$1\n  ${meta}`);
else fail('index.html has no <meta charset> to anchor the build-version meta tag');
if (!htmlCount) fail('no assets/ URLs found in index.html');
fs.writeFileSync(htmlPath, html);

// ---------- assets/js ----------
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : []));
}
const files = walk(path.join(root, 'assets', 'js'));
// import ... from '<spec>' | import '<spec>' | export ... from '<spec>'  (relative specifiers only)
const STATIC = /(\b(?:import|export)\b[^'"`;()]*?\bfrom\s*|\bimport\s*)(['"])(\.{1,2}\/[^'"?#\n]+?)(\?v=[^'"]*)?\2/g;
const DYNAMIC = /(\bimport\s*\(\s*)(['"])(\.{1,2}\/[^'"?#\n]+?)(\?v=[^'"]*)?\2(\s*\))/g;
let jsCount = 0;
for (const f of files) {
  let src = fs.readFileSync(f, 'utf8');
  src = src.replace(STATIC, (m, pre, q, spec) => { jsCount++; return `${pre}${q}${spec}?v=${version}${q}`; });
  src = src.replace(DYNAMIC, (m, pre, q, spec, old, post) => { jsCount++; return `${pre}${q}${spec}?v=${version}${q}${post}`; });
  fs.writeFileSync(f, src);
}
if (!jsCount) fail('no relative import specifiers found in assets/js');

// ---------- verification ----------
// Collect every relative specifier with a loose scan and check each has the same, single suffix
// and points at an existing module (so no module can be instantiated under two URLs).
const LOOSE = /(?:\bfrom\s*|\bimport\s*\(?\s*)(['"])(\.{1,2}\/[^'"\n]+)\1/g;
const seen = new Map();
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(LOOSE)) {
    const [spec, suffix] = m[2].split('?');
    if (suffix !== `v=${version}`) fail(`${path.relative(root, f)}: specifier "${m[2]}" is not stamped with ?v=${version}`);
    const target = path.resolve(path.dirname(f), spec);
    if (!fs.existsSync(target)) fail(`${path.relative(root, f)}: "${spec}" does not exist`);
    seen.set(target, (seen.get(target) || new Set()).add(m[2]));
  }
}
for (const [t, set] of seen) if (set.size !== 1) fail(`${path.relative(root, t)} is imported under several URLs: ${[...set].join(', ')}`);
console.log(`stamp-version: ${version}: ${htmlCount} URLs in index.html, ${jsCount} specifiers in ${files.length} modules, ${seen.size} distinct modules imported`);
