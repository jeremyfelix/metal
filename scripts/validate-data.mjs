// Validates data/*.json against data/source/albums.tsv. Exit 0 on success.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errs = [];
const err = (m) => errs.push(m);
const load = (f) => {
  try { return JSON.parse(fs.readFileSync(path.join(root, "data", f), "utf8")); }
  catch (e) { err(`${f}: invalid JSON (${e.message})`); return []; }
};
const artists = load("artists.json"), releases = load("releases.json"), events = load("events.json");

const GENRES = ["proto", "punk", "hard-rock", "heavy-metal", "nwobhm", "thrash", "death"];
const TYPES = ["album", "ep", "demo", "live", "compilation"];
const CATS = ["formation", "lineup", "concert", "death", "scene", "industry", "release"];
const PRECS = ["day", "month", "year"];
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const unique = (rows, what) => {
  const s = new Set();
  for (const r of rows) { if (s.has(r.id)) err(`${what}: duplicate id ${r.id}`); s.add(r.id); if (!ID.test(r.id)) err(`${what}: bad id ${r.id}`); }
};
unique(artists, "artists"); unique(releases, "releases"); unique(events, "events");
const artistIds = new Set(artists.map((a) => a.id));

const dateOk = (d, prec) => {
  if (typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const [y, m, dd] = d.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, dd));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== dd) return false;
  if (prec === "month") return dd === 1;
  if (prec === "year") return dd === 1 && m === 1;
  return true;
};
const formedOk = (s) => typeof s === "string" && /^\d{4}(-\d{2}(-\d{2})?)?$/.test(s);

for (const a of artists) {
  for (const k of ["id", "name", "origin", "country", "formed", "genre", "blurb"]) if (!a[k]) err(`artist ${a.id}: missing ${k}`);
  if (!/^[A-Z]{2}$/.test(a.country || "")) err(`artist ${a.id}: bad country`);
  if (!GENRES.includes(a.genre)) err(`artist ${a.id}: bad genre ${a.genre}`);
  if (!formedOk(a.formed)) err(`artist ${a.id}: bad formed ${a.formed}`);
  if (a.ended !== null && !formedOk(String(a.ended))) err(`artist ${a.id}: bad ended`);
  if (typeof a.inList !== "boolean") err(`artist ${a.id}: inList must be boolean`);
}

for (const r of releases) {
  if (!artistIds.has(r.artistId)) err(`release ${r.id}: unknown artistId ${r.artistId}`);
  if (!TYPES.includes(r.type)) err(`release ${r.id}: bad type`);
  if (!PRECS.includes(r.datePrecision)) err(`release ${r.id}: bad precision`);
  if (!dateOk(r.date, r.datePrecision)) err(`release ${r.id}: date ${r.date} invalid for precision ${r.datePrecision}`);
  if (typeof r.landmark !== "boolean") err(`release ${r.id}: landmark must be boolean`);
  if (r.landmark && !r.note) err(`release ${r.id}: landmark needs note`);
  for (const k of ["title", "listTitle"]) if (!r[k]) err(`release ${r.id}: missing ${k}`);
}
for (let i = 1; i < releases.length; i++) if (releases[i].date < releases[i - 1].date) err(`releases not sorted at ${releases[i].id}`);

const lines = fs.readFileSync(path.join(root, "data/source/albums.tsv"), "utf8").split(/\r?\n/).filter(Boolean).slice(1);
if (lines.length !== releases.length) err(`TSV has ${lines.length} rows but releases.json has ${releases.length}`);
const used = new Set();
for (const line of lines) {
  const [title, , date] = line.split("\t");
  const hits = releases.filter((r) => r.listTitle === title);
  if (hits.length !== 1) { err(`TSV row "${title}" maps to ${hits.length} releases`); continue; }
  if (used.has(hits[0].id)) err(`release ${hits[0].id} matched twice`);
  used.add(hits[0].id);
  if (date) { if (hits[0].date !== date) err(`"${title}": date ${hits[0].date} != TSV ${date}`); }
}

for (const e of events) {
  if (!CATS.includes(e.category)) err(`event ${e.id}: bad category`);
  if (!PRECS.includes(e.datePrecision)) err(`event ${e.id}: bad precision`);
  if (!dateOk(e.date, e.datePrecision)) err(`event ${e.id}: date ${e.date} invalid for precision ${e.datePrecision}`);
  if (![1, 2, 3].includes(e.importance)) err(`event ${e.id}: bad importance`);
  if (!Array.isArray(e.artistIds)) err(`event ${e.id}: artistIds must be array`);
  else for (const id of e.artistIds) if (!artistIds.has(id)) err(`event ${e.id}: unknown artist ${id}`);
  if (!e.title || !e.description) err(`event ${e.id}: missing title/description`);
}
for (let i = 1; i < events.length; i++) if (events[i].date < events[i - 1].date) err(`events not sorted at ${events[i].id}`);

const lm = releases.filter((r) => r.landmark).length;
const i3 = events.filter((e) => e.importance === 3).length;
const rel = events.filter((e) => e.category === "release").length;
if (rel > 20) err(`too many release-category events (${rel})`);
console.log(`artists ${artists.length}, releases ${releases.length} (landmarks ${lm}), events ${events.length} (importance 3: ${i3}, release-category: ${rel})`);
if (errs.length) { console.error(errs.join("\n")); console.error(`FAILED: ${errs.length} problem(s)`); process.exit(1); }
console.log("OK");
