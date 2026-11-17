// Builds data/artists.json, data/releases.json, data/events.json
// Usage: node scripts/generate-data.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { artists } from "./gen-artists.mjs";
import { meta } from "./gen-releases.mjs";
import { events } from "./gen-events.mjs";
import { artists2 } from "./gen-artists2.mjs";
import { releases2a } from "./gen-releases2.mjs";
import { releases2b } from "./gen-releases3.mjs";
import { events2, removeEventIds } from "./gen-events2.mjs";
import { artistWiki, releaseWiki } from "./gen-wiki.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = (f, d) => fs.writeFileSync(path.join(root, "data", f), JSON.stringify(d, null, 2) + "\n");

const slug = (s) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/&/g, " and ").replace(/['’"]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const precOf = (d) => (d.length === 4 ? "year" : d.length === 7 ? "month" : "day");
const full = (d) => (d.length === 4 ? d + "-01-01" : d.length === 7 ? d + "-01" : d);

// artists
const tsv = fs.readFileSync(path.join(root, "data/source/albums.tsv"), "utf8").split(/\r?\n/).filter(Boolean).slice(1);
const tsvArtists = new Set(tsv.map((l) => l.split("\t")[1]));
const EXTREME = new Set(["celtic-frost", "bathory"]);
const artistRows = artists.map(([id, name, origin, country, formed, ended, genre, inList, blurb]) =>
  ({ id, name, origin, country, formed, ended, genre: EXTREME.has(id) ? "extreme" : genre, inList, wiki: artistWiki[id], blurb }));
for (const [id, name, origin, country, formed, ended, genre, blurb, wiki] of artists2)
  artistRows.push({ id, name, origin, country, formed, ended, genre, inList: false, wiki, blurb });
for (const a of artistRows) if (!a.wiki) throw new Error("no wiki for artist " + a.id);
const byName = new Map(artistRows.map((a) => [a.name, a.id]));
byName.set("Motley Crue", "motley-crue");
byName.set("Mötley Crüe", "motley-crue");

// releases
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
    inList: true,
    wiki: releaseWiki[listTitle] ?? null,
  };
});
if (!tsv.every((l) => l.split("\t")[0] in releaseWiki)) throw new Error("releaseWiki missing a TSV row");
const known = new Set(releases.map((r) => r.id));
for (const [artistId, title, d, type, lm, note, wiki] of [...releases2a, ...releases2b]) {
  const id = `${artistId}-${slug(title)}`;
  if (known.has(id)) throw new Error("duplicate release id " + id);
  known.add(id);
  releases.push({ id, title, listTitle: null, artistId, date: full(d), datePrecision: precOf(d), type, landmark: !!lm,
    note, dateNote: null, inList: false, wiki });
}
for (const k of Object.keys(meta)) if (!used.has(k)) throw new Error("unused meta " + k);
releases.sort((a, b) => a.date.localeCompare(b.date)); // stable: keeps TSV order for ties

const drop = new Set(removeEventIds);
for (const id of removeEventIds) if (!events.some((e) => e[0] === id)) throw new Error("no event " + id);
const evs = [...events.filter((e) => !drop.has(e[0])), ...events2].map(([id, d, title, description, category, artistIds, importance]) => ({
  id, date: full(d), datePrecision: precOf(d), title, description, category, artistIds, importance }));
evs.sort((a, b) => a.date.localeCompare(b.date));

out("artists.json", artistRows);
out("releases.json", releases);
out("events.json", evs);
console.log(`artists ${artistRows.length}, releases ${releases.length}, events ${evs.length}`);
