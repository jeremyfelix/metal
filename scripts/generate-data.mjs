// Builds data/artists.json, data/releases.json, data/events.json
// Usage: node scripts/generate-data.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { artists } from "./gen-artists.mjs";
import { meta } from "./gen-releases.mjs";
import { events } from "./gen-events.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = (f, d) => fs.writeFileSync(path.join(root, "data", f), JSON.stringify(d, null, 2) + "\n");

const slug = (s) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/&/g, " and ").replace(/['’"]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const precOf = (d) => (d.length === 4 ? "year" : d.length === 7 ? "month" : "day");
const full = (d) => (d.length === 4 ? d + "-01-01" : d.length === 7 ? d + "-01" : d);

// artists
const artistRows = artists.map(([id, name, origin, country, formed, ended, genre, inList, blurb]) =>
  ({ id, name, origin, country, formed, ended, genre, inList, blurb }));
const byName = new Map(artistRows.map((a) => [a.name, a.id]));
byName.set("Motley Crue", "motley-crue");
byName.set("Mötley Crüe", "motley-crue");

// releases
const tsv = fs.readFileSync(path.join(root, "data/source/albums.tsv"), "utf8").split(/\r?\n/).filter(Boolean).slice(1);
const used = new Set();
const releases = tsv.map((line) => {
  const [listTitle, artist, rawDate] = line.split("\t");
  const m = meta[listTitle];
  if (!m) throw new Error("no meta for " + listTitle);
  used.add(listTitle);
  const artistId = byName.get(artist);
  if (!artistId) throw new Error("no artist " + artist);
  const [title, type, prec, landmark, note, dateNote] = m;
  const t = title || listTitle;
  const date = rawDate || "1982-01-01";
  return {
    id: `${artistId}-${slug(t)}`,
    title: t, listTitle, artistId, date,
    datePrecision: prec || (rawDate ? "day" : "year"),
    type: type || "album",
    landmark: !!landmark,
    note: note || null,
    dateNote: dateNote || null,
  };
});
for (const k of Object.keys(meta)) if (!used.has(k)) throw new Error("unused meta " + k);
releases.sort((a, b) => a.date.localeCompare(b.date)); // stable: keeps TSV order for ties

const evs = events.map(([id, d, title, description, category, artistIds, importance]) => ({
  id, date: full(d), datePrecision: precOf(d), title, description, category, artistIds, importance }));
evs.sort((a, b) => a.date.localeCompare(b.date));

out("artists.json", artistRows);
out("releases.json", releases);
out("events.json", evs);
console.log(`artists ${artistRows.length}, releases ${releases.length}, events ${evs.length}`);
