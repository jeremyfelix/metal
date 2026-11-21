// Static metadata: genre order/labels, event categories, release types and the marker/glyph geometry.
// Unknown genres/categories/types fall back to neutral entries so odd data never crashes the UI.

export const GENRES = [
  { id: 'proto', label: 'Proto-metal', short: 'Proto' },
  { id: 'hard-rock', label: 'Hard rock', short: 'Hard rock' },
  { id: 'punk', label: 'Punk', short: 'Punk' },
  { id: 'heavy-metal', label: 'Heavy metal', short: 'Heavy metal' },
  { id: 'nwobhm', label: 'NWOBHM', short: 'NWOBHM' },
  { id: 'thrash', label: 'Thrash', short: 'Thrash' },
  { id: 'death', label: 'Death metal', short: 'Death' },
  { id: 'extreme', label: 'Black / grind', short: 'Black / grind' },
];
const GENRE_BY_ID = new Map(GENRES.map((g) => [g.id, g]));

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'other';
const title = (s) => String(s).replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function genreMeta(id) {
  const k = String(id || '').toLowerCase();
  return GENRE_BY_ID.get(k) || { id: k || 'other', label: k ? title(k) : 'Other', short: k ? title(k) : 'Other', cls: 'g-other', unknown: true };
}
export const genreClass = (id) => (GENRE_BY_ID.has(String(id || '').toLowerCase()) ? 'g-' + String(id).toLowerCase() : 'g-other');

export const CATEGORIES = [
  { id: 'formation', label: 'Formation' },
  { id: 'lineup', label: 'Line-up change' },
  { id: 'concert', label: 'Concert / festival' },
  { id: 'death', label: 'Death' },
  { id: 'scene', label: 'Scene' },
  { id: 'industry', label: 'Industry' },
  { id: 'release', label: 'Release news' },
  { id: 'world', label: 'World events' },
];
const CAT_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));
export function catMeta(id) {
  const k = String(id || '').toLowerCase();
  return CAT_BY_ID.get(k) || { id: k || 'other', label: k ? title(k) : 'Other', unknown: true };
}
export const catClass = (id) => (CAT_BY_ID.has(String(id || '').toLowerCase()) ? 'c-' + String(id).toLowerCase() : 'c-other');

export const TYPES = [
  { id: 'album', label: 'Album', r: 5.6 },
  { id: 'ep', label: 'EP', r: 5 },
  { id: 'demo', label: 'Demo', r: 4.4 },
  { id: 'live', label: 'Live album', r: 4.8 },
  { id: 'compilation', label: 'Compilation', r: 5 },
];
const TYPE_BY_ID = new Map(TYPES.map((t) => [t.id, t]));
export const typeMeta = (id) => TYPE_BY_ID.get(String(id || '').toLowerCase()) || { id: 'other', label: title(id || 'Release'), r: 4.8 };

export const wikiUrl = (title) => 'https://en.wikipedia.org/wiki/' + encodeURIComponent(String(title).trim().replace(/ /g, '_')).replace(/%3A/g, ':').replace(/%2C/g, ',').replace(/%28/g, '(').replace(/%29/g, ')');

export const ERAS = [
  { id: 'roots', label: 'Roots', range: '1967–75', from: 1966.5, to: 1976, genre: 'proto' },
  { id: 'nwobhm', label: 'NWOBHM', range: '1976–82', from: 1976, to: 1983, genre: 'nwobhm' },
  { id: 'thrash', label: 'Thrash', range: '1983–91', from: 1983, to: 1992, genre: 'thrash' },
  { id: 'after', label: 'After', range: '1992–96', from: 1992, to: 1997, genre: 'death' },
];

/* ---- Geometry (paths centered on 0,0) ---- */
const f = (n) => Math.round(n * 100) / 100;

/** Release markers: shape encodes type. */
export function releasePath(type, r) {
  switch (type) {
    case 'ep': { const a = r * 1.25; return `M0 ${-a}L${a} 0L0 ${a}L${-a} 0Z`; } // diamond
    case 'demo': { const a = r * 1.05; return `M0 ${f(-a)}L${f(a)} ${f(a * 0.8)}L${f(-a)} ${f(a * 0.8)}Z`; } // triangle
    case 'live': { const a = r * 0.88; return `M${-a} ${-a}H${a}V${a}H${-a}Z`; } // square
    case 'compilation': { // hexagon
      const pts = []; for (let i = 0; i < 6; i++) { const t = Math.PI / 6 + (i * Math.PI) / 3; pts.push(`${f(Math.cos(t) * r * 1.1)} ${f(Math.sin(t) * r * 1.1)}`); }
      return 'M' + pts.join('L') + 'Z';
    }
    default: return `M${-r} 0A${r} ${r} 0 1 0 ${r} 0A${r} ${r} 0 1 0 ${-r} 0Z`; // circle
  }
}

/** Event glyphs: shape encodes category. Returns {d, ring} (ring=true -> hollow). */
export function eventPath(cat, r) {
  switch (cat) {
    case 'formation': { const t = r * 0.38; return `M${-t} ${-r}H${t}V${-t}H${r}V${t}H${t}V${r}H${-t}V${t}H${-r}V${-t}H${-t}Z`; } // plus
    case 'lineup': return `M${-r} ${-r * 0.8}L0 0L${-r} ${r * 0.8}ZM${r} ${-r * 0.8}L0 0L${r} ${r * 0.8}Z`; // bow-tie
    case 'concert': { const p = []; for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.48 : r * 1.15; const t = -Math.PI / 2 + (i * Math.PI) / 5; p.push(`${f(Math.cos(t) * rr)} ${f(Math.sin(t) * rr)}`); } return 'M' + p.join('L') + 'Z'; } // star
    case 'death': return `M${-r} ${-r * 0.8}H${r}L0 ${r * 1.05}Z`; // down triangle
    case 'scene': { const p = []; for (let i = 0; i < 6; i++) { const t = (i * Math.PI) / 3; p.push(`${f(Math.cos(t) * r * 1.1)} ${f(Math.sin(t) * r * 1.1)}`); } return 'M' + p.join('L') + 'Z'; } // hexagon
    case 'industry': { const a = r * 0.85; return `M${-a} ${-a}H${a}V${a}H${-a}Z`; } // square
    case 'release': return `M${-r} 0A${r} ${r} 0 1 0 ${r} 0A${r} ${r} 0 1 0 ${-r} 0Z`; // circle
    default: { const a = r * 1.15; return `M0 ${-a}L${a} 0L0 ${a}L${-a} 0Z`; } // diamond (world events, unknown)
  }
}
export const slugify = slug;
