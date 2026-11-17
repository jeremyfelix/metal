// Compares release dates in data/releases.json with the infobox "released" field of each release's Wikipedia article.
// Usage: node scripts/verify-release-dates.mjs [--all] [--out report.json]   (default: only releases with inList:false)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureEnvProxy, api, chunk, resolveTitles } from "./wiki-client.mjs";

ensureEnvProxy();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releases = JSON.parse(fs.readFileSync(path.join(root, "data/releases.json"), "utf8"));
const all = process.argv.includes("--all");
const outIdx = process.argv.indexOf("--out");
const todo = releases.filter((r) => r.wiki && (all || !r.inList));

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const mm = (name) => MONTHS.indexOf(name.toLowerCase()) + 1;
const pad = (n) => String(n).padStart(2, "0");
function parseReleased(wikitext) {
  const m = wikitext.match(/\|\s*released\s*=([\s\S]*?)(?=\n\s*\|\s*[a-z_ ]+\s*=|\n\}\})/i);
  if (!m) return null;
  const field = m[1];
  const dates = [];
  for (const t of field.matchAll(/\{\{\s*(?:start date(?: and age)?|release date|film date|bda|dts)\s*\|([^}]*)\}\}/gi)) {
    const nums = t[1].split("|").map((s) => s.trim()).filter((s) => /^\d+$/.test(s)).map(Number);
    if (nums[0]) dates.push(nums[0] + (nums[1] ? "-" + pad(nums[1]) : "") + (nums[2] ? "-" + pad(nums[2]) : ""));
  }
  const text = field.replace(/\{\{[^}]*\}\}/g, " ").replace(/<ref[\s\S]*?(<\/ref>|\/>)/g, " ").replace(/\[\[|\]\]/g, "");
  for (const t of text.matchAll(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/g)) if (mm(t[2])) dates.push(`${t[3]}-${pad(mm(t[2]))}-${pad(+t[1])}`);
  for (const t of text.matchAll(/([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/g)) if (mm(t[1])) dates.push(`${t[3]}-${pad(mm(t[1]))}-${pad(+t[2])}`);
  for (const t of text.matchAll(/(?<![\d,]\s*)\b([A-Za-z]+)\s+(\d{4})\b/g)) if (mm(t[1]) && !dates.some((d) => d.startsWith(`${t[2]}-${pad(mm(t[1]))}`))) dates.push(`${t[2]}-${pad(mm(t[1]))}`);
  if (!dates.length) for (const t of text.matchAll(/\b(19[6-9]\d)\b/g)) dates.push(t[1]);
  return [...new Set(dates)];
}

const result = {};
for (const batch of chunk(todo, 20)) {
  const titles = [...new Set(batch.map((r) => r.wiki))];
  const r = await api("en.wikipedia.org", { action: "query", titles: titles.join("|"), redirects: "1", prop: "revisions", rvprop: "content", rvslots: "main" });
  const byTitle = new Map((r.query?.pages ?? []).map((p) => [p.title, p]));
  for (const rel of batch) {
    const p = byTitle.get(resolveTitles([r], rel.wiki));
    const text = p?.revisions?.[0]?.slots?.main?.content;
    if (!text) { result[rel.id] = { mine: rel.date, prec: rel.datePrecision, wiki: null, note: "no wikitext" }; continue; }
    result[rel.id] = { mine: rel.date, prec: rel.datePrecision, wiki: parseReleased(text) };
  }
}
const mineKey = (r) => (r.prec === "year" ? r.mine.slice(0, 4) : r.prec === "month" ? r.mine.slice(0, 7) : r.mine);
let ok = 0, upgrade = [], bad = [], none = [];
for (const [id, v] of Object.entries(result)) {
  if (!v.wiki || !v.wiki.length) { none.push(id); continue; }
  const mk = mineKey(v);
  if (v.wiki.includes(mk)) { ok++; continue; }
  const finer = v.wiki.filter((d) => d.startsWith(mk) && d.length > mk.length);
  if (finer.length) { upgrade.push([id, mk, finer]); continue; }
  bad.push([id, mk, v.wiki]);
}
console.log(`checked ${Object.keys(result).length}: exact ${ok}, finer-available ${upgrade.length}, mismatched ${bad.length}, unparsed ${none.length}`);
console.log("--- finer date available (same year/month) ---");
for (const [id, mk, w] of upgrade) console.log(`${id}: ${mk} -> ${w.join(", ")}`);
console.log("--- MISMATCH ---");
for (const [id, mk, w] of bad) console.log(`${id}: mine ${mk}; wikipedia ${w.join(", ")}`);
console.log("--- no parseable date ---");
console.log(none.join(", "));
if (outIdx > 0) fs.writeFileSync(process.argv[outIdx + 1], JSON.stringify(result, null, 2));
