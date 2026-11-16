// Loads and normalises the three JSON files into one in-memory model.
import { toTime, periodStart, periodEnd, parseParts } from './dates.js';
import { genreMeta, GENRES } from './meta.js';

const str = (v, d = '') => (v == null ? d : String(v));

/** Fetch JSON relative to the page. `base` is e.g. "data/" or "fixtures/". */
async function getJSON(base, name) {
  const url = base + name;
  let res;
  try { res = await fetch(url, { cache: 'no-cache' }); }
  catch (err) { const e = new Error(`Could not fetch ${url} (${err.message})`); e.network = true; throw e; }
  if (!res.ok) { const e = new Error(`Could not load ${url}: HTTP ${res.status}`); e.status = res.status; throw e; }
  try { return await res.json(); }
  catch (err) { throw new Error(`${url} is not valid JSON (${err.message})`); }
}

export async function loadData(base) {
  const b = base.endsWith('/') ? base : base + '/';
  const [a, r, e] = await Promise.all([getJSON(b, 'artists.json'), getJSON(b, 'releases.json'), getJSON(b, 'events.json')]);
  return buildModel(a, r, e, b);
}

const asArray = (x) => (Array.isArray(x) ? x : []);

export function buildModel(rawArtists, rawReleases, rawEvents, base = '') {
  const warnings = [];
  const artists = [];
  const artistById = new Map();
  for (const a of asArray(rawArtists)) {
    if (!a || a.id == null) continue;
    const id = str(a.id);
    if (artistById.has(id)) continue;
    const art = {
      id, name: str(a.name, id), origin: str(a.origin), country: str(a.country),
      formed: str(a.formed), ended: a.ended ? str(a.ended) : null,
      genre: str(a.genre, 'other').toLowerCase(), blurb: str(a.blurb),
      inList: a.inList !== false, releases: [], events: [],
    };
    art.genreMeta = genreMeta(art.genre);
    art.formedT = art.formed ? periodStart(art.formed) : NaN;
    art.endedT = art.ended ? periodEnd(art.ended) : NaN;
    artists.push(art); artistById.set(id, art);
  }

  const items = [];
  const byKey = new Map();
  const releases = [];
  for (const r of asArray(rawReleases)) {
    if (!r || r.id == null) continue;
    const t = toTime(r.date, r.datePrecision);
    if (!Number.isFinite(t)) { warnings.push(`Release "${r.id}" has an invalid date and was skipped.`); continue; }
    const artist = artistById.get(str(r.artistId)) || null;
    if (!artist) warnings.push(`Release "${r.id}" refers to unknown artist "${r.artistId}".`);
    const prec = ['day', 'month', 'year'].includes(r.datePrecision) ? r.datePrecision : (parseParts(r.date) || {}).prec || 'day';
    const title = str(r.title, str(r.id));
    const it = {
      key: 'r:' + r.id, kind: 'release', id: str(r.id), t, date: str(r.date), prec,
      title, listTitle: str(r.listTitle, title), artistId: artist ? artist.id : str(r.artistId),
      artist, artists: artist ? [artist] : [], genre: artist ? artist.genre : 'other',
      type: str(r.type, 'album').toLowerCase(), landmark: r.landmark === true,
      note: r.note ? str(r.note) : null, dateNote: r.dateNote ? str(r.dateNote) : null,
    };
    if (byKey.has(it.key)) continue;
    if (artist) artist.releases.push(it);
    items.push(it); releases.push(it); byKey.set(it.key, it);
  }

  const events = [];
  for (const e of asArray(rawEvents)) {
    if (!e || e.id == null) continue;
    const t = toTime(e.date, e.datePrecision);
    if (!Number.isFinite(t)) { warnings.push(`Event "${e.id}" has an invalid date and was skipped.`); continue; }
    const ids = asArray(e.artistIds).map(str);
    const arts = ids.map((i) => artistById.get(i)).filter(Boolean);
    const prec = ['day', 'month', 'year'].includes(e.datePrecision) ? e.datePrecision : (parseParts(e.date) || {}).prec || 'day';
    const imp = Math.min(3, Math.max(1, Math.round(+e.importance) || 1));
    const it = {
      key: 'e:' + e.id, kind: 'event', id: str(e.id), t, date: str(e.date), prec,
      title: str(e.title, str(e.id)), description: str(e.description), category: str(e.category, 'scene').toLowerCase(),
      artistIds: ids, artists: arts, artist: arts[0] || null, importance: imp,
      genre: arts[0] ? arts[0].genre : null, landmark: imp === 3,
    };
    if (byKey.has(it.key)) continue;
    for (const a of arts) a.events.push(it);
    items.push(it); events.push(it); byKey.set(it.key, it);
  }

  const cmp = (a, b) => a.t - b.t || (a.kind === b.kind ? 0 : a.kind === 'event' ? -1 : 1) || a.title.localeCompare(b.title);
  items.sort(cmp); releases.sort(cmp); events.sort(cmp);
  items.forEach((it, i) => { it.seq = i; });
  for (const a of artists) { a.releases.sort(cmp); a.events.sort(cmp); }

  // Lanes: artists flagged inList, or that have releases (so nothing with data is lost).
  const laneArtists = artists.filter((a) => a.inList || a.releases.length);

  // Genres present in the data (known ones keep their order; unknown ones are appended).
  const genreIds = [];
  for (const a of laneArtists) if (!genreIds.includes(a.genre)) genreIds.push(a.genre);

  const order = (g) => { const i = GENRES.findIndex((x) => x.id === g); return i < 0 ? 99 : i; };
  genreIds.sort((a, b) => order(a) - order(b));

  // Time domain: at least 1965–1997, extended if data reaches outside.
  let lo = Date.UTC(1965, 0, 1), hi = Date.UTC(1997, 0, 1);
  if (items.length) {
    lo = Math.min(lo, Date.UTC(new Date(items[0].t).getUTCFullYear(), 0, 1));
    hi = Math.max(hi, Date.UTC(new Date(items[items.length - 1].t).getUTCFullYear() + 1, 0, 1));
  }

  return { base, artists, artistById, releases, events, items, byKey, laneArtists, genreIds, domain: [lo, hi], warnings };
}
