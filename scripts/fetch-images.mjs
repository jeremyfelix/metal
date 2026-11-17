// Builds data/images.json (Wikipedia-sourced image index) and verifies wiki titles.
// Usage: node scripts/fetch-images.mjs [--report path]   (WIKI_CACHE_DIR sets the cache directory)
// Artist photos: free-licensed only (pilicense=free) with Commons licence metadata.
// Release covers: URL only (non-free); the site hotlinks them and links back to the article.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureEnvProxy, api, chunk, resolveTitles, pageUrl } from "./wiki-client.mjs";

ensureEnvProxy();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));
const artists = readJson("data/artists.json");
const releases = readJson("data/releases.json");
const allow = fs.existsSync(path.join(root, "scripts/wiki-verified.json")) ? readJson("scripts/wiki-verified.json") : { artists: {}, releases: {} };
const reportArg = process.argv.indexOf("--report");
const reportPath = reportArg > 0 ? process.argv[reportArg + 1] : null;

const EN = "en.wikipedia.org", COMMONS = "commons.wikimedia.org";

// Query en.wikipedia for a list of titles; returns Map(inputTitle -> page)
async function queryPages(titles, extra) {
  const uniq = [...new Set(titles)];
  const responses = [];
  const pagesByTitle = new Map();
  for (const batch of chunk(uniq, 50)) {
    const r = await api(EN, { action: "query", titles: batch.join("|"), redirects: "1", prop: "pageimages|description|pageprops",
      piprop: "thumbnail|name", ppprop: "disambiguation", ...extra });
    responses.push(r);
    for (const p of r.query?.pages ?? []) pagesByTitle.set(p.title, p);
    for (const t of batch) {
      const final = resolveTitles([r], t);
      pagesByTitle.set("in:" + t, pagesByTitle.get(final));
    }
  }
  return (t) => pagesByTitle.get("in:" + t);
}

const stripHtml = (s) => s.replace(/<[^>]*>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/\s+/g, " ").trim();
const clip = (s, n = 120) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

const flags = { artists: {}, releases: {} };
const flag = (kind, id, why, extra = {}) => { flags[kind][id] = { why, ...extra }; };

// ---------- artists ----------
const getA = await queryPages(artists.map((a) => a.wiki), { pilicense: "free", pithumbsize: "640" });
const BAND = /band|group|musician|singer|guitarist|duo|trio|songwriter|rock|metal|punk|vocalist|bassist|drummer|composer|act\b|supergroup|project/i;
const out = { generated: new Date().toISOString().slice(0, 10), artists: {}, releases: {} };
const wantFiles = [];
for (const a of artists) {
  const p = getA(a.wiki);
  if (!p || p.missing) { flag("artists", a.id, "missing page", { wiki: a.wiki }); continue; }
  const desc = p.description ?? null;
  const dab = p.pageprops && "disambiguation" in p.pageprops;
  if (dab) flag("artists", a.id, "disambiguation page", { wiki: a.wiki, title: p.title });
  else if (!desc) flag("artists", a.id, "no short description", { wiki: a.wiki, title: p.title });
  else if (!BAND.test(desc)) flag("artists", a.id, "description does not look like a band/musician", { wiki: a.wiki, title: p.title, desc });
  a._p = p; a._desc = desc;
  if (p.thumbnail && p.pageimage) wantFiles.push({ id: a.id, file: p.pageimage, thumb: p.thumbnail, title: p.title });
}
// Commons licence metadata
const meta = new Map();
for (const batch of chunk([...new Set(wantFiles.map((w) => "File:" + w.file))], 50)) {
  const r = await api(COMMONS, { action: "query", titles: batch.join("|"), prop: "imageinfo", iiprop: "extmetadata|url", iiextmetadatafilter: "Artist|Credit|LicenseShortName|LicenseUrl|NonFree|Restrictions" });
  for (const p of r.query?.pages ?? []) {
    const ii = p.imageinfo?.[0];
    if (ii) meta.set(p.title, ii);
  }
  for (const n of r.query?.normalized ?? []) if (meta.has(n.to)) meta.set(n.from, meta.get(n.to));
}
const noImage = { artists: [], releases: [] };
for (const w of wantFiles) {
  const ii = meta.get("File:" + w.file) ?? meta.get("File:" + w.file.replace(/_/g, " "));
  const em = ii?.extmetadata;
  const val = (k) => (em?.[k]?.value ?? "").toString();
  const license = stripHtml(val("LicenseShortName"));
  if (!ii || !license || val("NonFree") === "true" || val("NonFree") === "1") { noImage.artists.push(w.id + " (no licence metadata)"); continue; }
  let credit = stripHtml(val("Artist")) || stripHtml(val("Credit"));
  if (!credit) { noImage.artists.push(w.id + " (no author)"); continue; }
  const isPD = /^(public domain|pd\b|cc0)/i.test(license);
  out.artists[w.id] = {
    src: w.thumb.source, width: w.thumb.width, height: w.thumb.height,
    page: pageUrl(w.title), file: ii.descriptionurl || `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(w.file)}`,
    credit: clip(credit), license: isPD && /^pd\b/i.test(license) ? "Public domain" : license, licenseUrl: stripHtml(val("LicenseUrl")) || null,
  };
}
for (const a of artists) if (!out.artists[a.id] && !noImage.artists.some((s) => s.startsWith(a.id + " "))) noImage.artists.push(a.id + " (no free image)");

// ---------- releases ----------
const getR = await queryPages(releases.filter((r) => r.wiki).map((r) => r.wiki), { pilicense: "any", pithumbsize: "300" });
const KIND = /album|\bep\b|extended play|demo|compilation|single|song|recording|mixtape|soundtrack|collection|release/i;
const norm = (s) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ");
const ARTIST_ALIASES = { "motley-crue": ["motley", "crue"], "ac-dc": ["ac", "dc"], sod: ["stormtroopers", "s o d", "sod"], "sex-pistols": ["pistols"] };
for (const r of releases) {
  if (!r.wiki) { noImage.releases.push(r.id + " (no wiki article)"); continue; }
  const p = getR(r.wiki);
  if (!p || p.missing) { flag("releases", r.id, "missing page", { wiki: r.wiki }); continue; }
  const desc = p.description ?? null;
  if (p.pageprops && "disambiguation" in p.pageprops) { flag("releases", r.id, "disambiguation page", { wiki: r.wiki, title: p.title }); continue; }
  if (!desc) flag("releases", r.id, "no short description", { wiki: r.wiki, title: p.title });
  else {
    const why = [];
    if (!KIND.test(desc)) why.push("description does not look like an album/EP/demo");
    const ym = desc.match(/\b(19[6-9]\d)\b/);
    if (ym && Math.abs(+ym[1] - +r.date.slice(0, 4)) > 1) why.push(`year ${ym[1]} vs ${r.date.slice(0, 4)}`);
    const art = artists.find((a) => a.id === r.artistId);
    const toks = ARTIST_ALIASES[art.id] ?? (norm(art.name).split(" ").filter((t) => t.length >= 3).length ? norm(art.name).split(" ").filter((t) => t.length >= 3) : [norm(art.name).trim().replace(/\s+/g, " ")]);
    const nd = norm(desc).replace(/\s+/g, " ");
    if (!toks.some((t) => nd.includes(t))) why.push(`artist "${art.name}" not named in description`);
    if (why.length) flag("releases", r.id, why.join("; "), { wiki: r.wiki, title: p.title, desc });
  }
  if (p.thumbnail) out.releases[r.id] = { src: p.thumbnail.source, width: p.thumbnail.width, height: p.thumbnail.height, page: pageUrl(p.title) };
  else noImage.releases.push(r.id + " (no image)");
}

// Flagged entries are dropped from the index unless allow-listed (scripts/wiki-verified.json) after manual review.
let dropped = 0;
const unresolved = { artists: [], releases: [] };
for (const kind of ["artists", "releases"]) {
  for (const id of Object.keys(flags[kind])) {
    if (allow[kind]?.[id]) continue;
    unresolved[kind].push(id);
    if (out[kind][id]) { delete out[kind][id]; dropped++; }
  }
}
const stripPrivate = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v]));
fs.writeFileSync(path.join(root, "data/images.json"), JSON.stringify(stripPrivate, null, 2) + "\n");

if (reportPath) fs.writeFileSync(reportPath, JSON.stringify({ flags, unresolved, noImage }, null, 2));
console.log(`artists: ${Object.keys(out.artists).length}/${artists.length} with free photo; releases: ${Object.keys(out.releases).length}/${releases.length} with cover`);
console.log(`flagged: ${Object.keys(flags.artists).length} artists, ${Object.keys(flags.releases).length} releases; unresolved (excluded): ${unresolved.artists.length} + ${unresolved.releases.length}`);
for (const k of ["artists", "releases"]) for (const id of unresolved[k]) console.log(`  FLAG ${k}/${id}: ${flags[k][id].why} | ${flags[k][id].wiki ?? ""} -> ${flags[k][id].title ?? ""} | ${flags[k][id].desc ?? ""}`);
