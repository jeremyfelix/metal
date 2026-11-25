// Builds data/links.json (direct Apple Music album URLs) from Apple's public iTunes Search API.
// Usage: node scripts/fetch-apple-links.mjs [--report path]   (APPLE_CACHE_DIR sets the cache directory)
// Only confident matches are written; anything else gets no entry (the site falls back to search). Never guesses.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(process.execPath, ["--no-warnings", ...process.argv.slice(1)], { stdio: "inherit", env: { ...process.env, NODE_USE_ENV_PROXY: "1" } });
  process.exit(r.status ?? 1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));
const artists = new Map(readJson("data/artists.json").map((a) => [a.id, a]));
const releases = readJson("data/releases.json");
const overrides = readJson("scripts/apple-overrides.json");
const reportArg = process.argv.indexOf("--report");
const reportPath = reportArg > 0 ? process.argv[reportArg + 1] : null;
const cacheDir = process.env.APPLE_CACHE_DIR || path.join(os.tmpdir(), "metal-apple-cache");
fs.mkdirSync(cacheDir, { recursive: true });

const SPACING_MS = 3200;
let last = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function search(term, limit = 10) {
  const qs = new URLSearchParams({ term, entity: "album", country: "US", limit: String(limit) }).toString();
  const file = path.join(cacheDir, crypto.createHash("sha1").update(qs).digest("hex") + ".json");
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8")).results ?? [];
  for (let attempt = 0; attempt < 8; attempt++) {
    const wait = last + SPACING_MS - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      const res = await fetch(`https://itunes.apple.com/search?${qs}`, { headers: { "User-Agent": "metal-timeline-build/1.0 (static site link index)", Accept: "application/json" } });
      last = Date.now();
      if (res.status === 403 || res.status === 429 || res.status >= 500) { await sleep(Math.min(120000, 20000 * 2 ** attempt)); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      fs.writeFileSync(file, JSON.stringify(json));
      return json.results ?? [];
    } catch (e) { last = Date.now(); await sleep(5000 * (attempt + 1)); }
  }
  throw new Error("giving up on " + term);
}

// ---------- normalization ----------
const strip = (s) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
const EDITION = /\s*[\(\[][^\)\]]*(remaster|deluxe|expanded|edition|bonus|version|anniversary|reissue|mono|stereo|explicit|original)[^\)\]]*[\)\]]/gi;
function normTitle(t) {
  let s = strip(t).replace(/\s+-\s+(ep|single)\s*$/i, "").replace(EDITION, "");
  s = s.replace(/&/g, " and ").replace(/['’`.]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  return s;
}
const normArtist = (a) => strip(a).replace(/&/g, "and").replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, "");
const ARTIST_ALIASES = {
  "sod": ["stormtroopersofdeath", "sod"], dri: ["dri", "dirtyrottenimbeciles"], gbh: ["gbh", "chargedgbh"],
  "jimi-hendrix": ["jimihendrix", "jimihendrixexperience"], rainbow: ["rainbow", "ritchieblackmoresrainbow"],
  "ac-dc": ["acdc"], "motley-crue": ["motleycrue"], motorhead: ["motorhead"], "ozzy-osbourne": ["ozzyosbourne"],
  "guns-n-roses": ["gunsnroses", "gunsandroses"], "blue-oyster-cult": ["blueoystercult"], "alice-cooper": ["alicecooper"],
};
const artistKeys = (a) => new Set([normArtist(a.name), ...(ARTIST_ALIASES[a.id] ?? [])]);
// title variants: "Killing Machine (US: Hell Bent for Leather)" -> both names; "Vol. 4" -> also "Black Sabbath Vol. 4"
function titleVariants(r, a) {
  const v = new Set([normTitle(r.title)]);
  const m = r.title.match(/^(.*?)\s*\((?:US:\s*)?([^)]*)\)\s*$/);
  if (m) { v.add(normTitle(m[1])); v.add(normTitle(m[2])); }
  v.add(normTitle(`${a.name} ${r.title}`));
  if (/^[a-z]+(?:\s+[a-z]+)?\s+version$/.test(normTitle(r.title))) v.add(normTitle(r.title.replace(/\s*\(.*\)/, "")));
  // Australian / international High Voltage and T.N.T. keep their base names
  v.add(normTitle(r.title.replace(/\s*\((australian|international)[^)]*\)/i, "")));
  return [...v].filter(Boolean);
}
const BAD_WORDS = /\b(live|greatest hits|best of|collection|anthology|box set|essentials|karaoke|tribute|instrumental|demos?|sessions|bootleg|singles|rarities|b sides)\b/;

function evaluate(r, a, cand) {
  if (cand.collectionType !== "Album") return null;
  if (!artistKeys(a).has(normArtist(cand.artistName))) return null;
  const rawName = cand.collectionName;
  if (/\s-\s+single\s*$/i.test(rawName)) return null;
  const isEp = /\s-\s+ep\s*$/i.test(rawName);
  if (isEp && r.type !== "ep") return null;
  const name = normTitle(rawName);
  if (BAD_WORDS.test(name) && !BAD_WORDS.test(normTitle(r.title)) && r.type !== "live" && r.type !== "compilation") return null;
  let score = 0, exact = false;
  for (const v of titleVariants(r, a)) {
    if (name === v) { exact = true; score = 20; break; }
    const [s, l] = name.length < v.length ? [name, v] : [v, name];
    if (s.length >= 12 && l.startsWith(s + " ")) score = Math.max(score, 8);
  }
  if (!score) return null;
  const edition = /[\(\[]/.test(rawName.replace(/\s-\s+ep\s*$/i, ""));
  if (!edition) score += 3; else if (/remaster/i.test(rawName)) score += 2;
  const y = +String(cand.releaseDate).slice(0, 4), ry = +r.date.slice(0, 4);
  const dy = Math.abs(y - ry);
  score += dy <= 1 ? 3 : dy <= 2 ? 1 : -4;
  if (cand.trackCount && cand.trackCount < 3 && r.type !== "ep") score -= 5;
  return { score, exact, dy, cand, id: cand.collectionId };
}
const cleanUrl = (u) => u.replace(/[?#].*$/, "");

const artistScans = new Map();
async function scanArtist(a) {
  if (!artistScans.has(a.id)) artistScans.set(a.id, await search(a.name, 200));
  return artistScans.get(a.id);
}

const links = {}, report = [];
let done = 0;
for (const r of releases) {
  done++;
  const a = artists.get(r.artistId);
  const entry = { id: r.id, ours: `${a.name} - ${r.title} (${r.date.slice(0, 4)})` };
  if (overrides.skip.includes(r.id)) { entry.result = "skipped (override)"; report.push(entry); continue; }
  if (overrides.url[r.id]) { links[r.id] = overrides.url[r.id]; entry.result = "override url"; report.push(entry); continue; }
  let best = null, tried = [];
  const consider = (results) => {
    for (const c of results) {
      const e = evaluate(r, a, c);
      if (!e) continue;
      if (overrides.pick[r.id] && String(c.collectionId) !== String(overrides.pick[r.id])) continue;
      if (!best || e.score > best.score) best = e;
    }
  };
  tried.push("q1");
  consider(await search(`${a.name} ${r.title}`.replace(/\s+/g, " "), 10));
  if (!best && r.type !== "demo") { tried.push("title"); consider(await search(r.title, 25)); }
  if (!best && r.type !== "demo") { tried.push("artist-scan"); consider(await scanArtist(a)); }
  if (best) {
    links[r.id] = cleanUrl(best.cand.collectionViewUrl);
    Object.assign(entry, { result: "match", apple: `${best.cand.artistName} - ${best.cand.collectionName} (${String(best.cand.releaseDate).slice(0, 4)})`, exact: best.exact, yearDiff: best.dy, tracks: best.cand.trackCount, url: links[r.id], tried: tried.join(",") });
  } else Object.assign(entry, { result: "no match", tried: tried.join(",") });
  report.push(entry);
  if (done % 25 === 0) console.log(`${done}/${releases.length} processed, ${Object.keys(links).length} matched`);
}

const sorted = Object.fromEntries(releases.filter((r) => links[r.id]).map((r) => [r.id, links[r.id]]));
fs.writeFileSync(path.join(root, "data/links.json"), JSON.stringify({ generated: new Date().toISOString().slice(0, 10), apple: sorted }, null, 2) + "\n");
if (reportPath) fs.writeFileSync(reportPath, JSON.stringify(report, null, 1));
const flagged = report.filter((e) => e.result === "match" && (!e.exact || e.yearDiff > 2));
console.log(`matched ${Object.keys(sorted).length}/${releases.length}; flagged (non-exact title or year diff > 2): ${flagged.length}`);
for (const e of flagged) console.log(`  FLAG ${e.id}: ${e.ours} -> ${e.apple} [exact=${e.exact}, dy=${e.yearDiff}]`);
console.log("unmatched: " + report.filter((e) => e.result === "no match").map((e) => e.id).join(", "));
