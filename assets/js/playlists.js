// Playlists: the visitor's own lists (localStorage, versioned key, every access guarded), share-link
// encoding/decoding, plain-text export and "listen on" links. Nothing here touches the network.
const KEY = 'speedkills:playlists:v1';
export const MAX_ITEMS = 60;
export const MAX_TITLE = 80;

const clean = (s) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE);
const newId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** Personal playlists. `persistent` is false when localStorage is unavailable (session-only lists). */
export function createPlaylistStore(model) {
  let lists = [];
  let persistent = true;
  const subs = new Set();
  const valid = (id) => model.byKey.has('r:' + id);

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return [];
      const d = JSON.parse(raw);
      if (!d || d.v !== 1 || !Array.isArray(d.lists)) return [];
      return d.lists.filter((l) => l && typeof l.id === 'string' && Array.isArray(l.ids)).slice(0, 100).map((l) => ({
        id: String(l.id).slice(0, 40), title: clean(l.title) || 'Untitled', ids: l.ids.map(String).filter(valid).slice(0, MAX_ITEMS),
      }));
    } catch (_) { persistent = false; return []; }
  }
  function write() {
    try { localStorage.setItem(KEY, JSON.stringify({ v: 1, lists })); persistent = true; } catch (_) { persistent = false; }
  }
  // Probe storage once so the UI can say so if it is blocked.
  try { localStorage.getItem(KEY); } catch (_) { persistent = false; }
  lists = read();

  const emit = () => subs.forEach((f) => f());
  const find = (id) => lists.find((l) => l.id === id);
  const commit = () => { write(); emit(); };

  return {
    get persistent() { return persistent; },
    subscribe(f) { subs.add(f); return () => subs.delete(f); },
    all: () => lists,
    get: find,
    create(title, ids = []) {
      const l = { id: newId(), title: clean(title) || 'Untitled playlist', ids: [...new Set(ids.filter(valid))].slice(0, MAX_ITEMS) };
      lists.push(l); commit(); return l;
    },
    rename(id, title) { const l = find(id); if (l) { l.title = clean(title) || l.title; commit(); } },
    remove(id) { const i = lists.findIndex((l) => l.id === id); if (i >= 0) { lists.splice(i, 1); commit(); } },
    has(id, relId) { const l = find(id); return !!l && l.ids.includes(relId); },
    /** Add if absent, remove if present. Returns true when now included. */
    toggle(id, relId) {
      const l = find(id); if (!l || !valid(relId)) return false;
      const i = l.ids.indexOf(relId);
      if (i >= 0) l.ids.splice(i, 1); else if (l.ids.length < MAX_ITEMS) l.ids.push(relId);
      commit(); return l.ids.includes(relId);
    },
    removeItem(id, index) { const l = find(id); if (l && index >= 0 && index < l.ids.length) { l.ids.splice(index, 1); commit(); } },
    move(id, from, to) {
      const l = find(id); if (!l || from === to || from < 0 || to < 0 || from >= l.ids.length || to >= l.ids.length) return;
      const [x] = l.ids.splice(from, 1); l.ids.splice(to, 0, x); commit();
    },
  };
}

// ---------- share links: #view=playlists&sh=<title>~<id,id,...> ----------
export function encodeShare(title, ids) {
  return clean(title) + '~' + ids.slice(0, MAX_ITEMS).join(',');
}
/** Parse + validate a share value; unknown ids are dropped. Returns {title, ids} or null. */
export function decodeShare(raw, model) {
  if (!raw || typeof raw !== 'string') return null;
  const i = raw.lastIndexOf('~');
  if (i < 0) return null;
  const title = clean(raw.slice(0, i)) || 'Shared playlist';
  const ids = [];
  for (const id of raw.slice(i + 1).split(',')) {
    const t = id.trim();
    if (/^[\w.\-]{1,120}$/.test(t) && model.byKey.has('r:' + t) && !ids.includes(t)) ids.push(t);
    if (ids.length >= MAX_ITEMS) break;
  }
  return ids.length ? { title, ids } : null;
}
export function shareUrl(title, ids) {
  const h = '#view=playlists&sh=' + encodeURIComponent(encodeShare(title, ids)).replace(/%2C/g, ',').replace(/%7E/g, '~');
  return location.origin + location.pathname + location.search + h;
}

// ---------- text export + clipboard ----------
export const playlistText = (rels) => rels.map((r) => `${r.artist ? r.artist.name : 'Unknown'} – ${r.title} (${new Date(r.t).getUTCFullYear()})`).join('\n');

/** Copy text; falls back to selecting a textarea. Resolves to 'copied' or 'selected'. */
export async function copyText(text, fallbackArea) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return 'copied'; }
  } catch (_) { /* fall through */ }
  if (fallbackArea) {
    fallbackArea.hidden = false; fallbackArea.value = text; fallbackArea.focus(); fallbackArea.select();
    try { if (document.execCommand && document.execCommand('copy')) return 'copied'; } catch (_) { /* ignore */ }
  }
  return 'selected';
}

// ---------- listen-on links ----------
export function listenUrls(rel) {
  const q = encodeURIComponent(`${rel.artist ? rel.artist.name : ''} ${rel.title}`.trim());
  return [
    ['Spotify', `https://open.spotify.com/search/${q}`],
    ['Apple Music', `https://music.apple.com/us/search?term=${q}`],
    ['YouTube Music', `https://music.youtube.com/search?q=${q}`],
  ];
}
export function listenLinks(rel, cls) {
  const wrap = document.createElement('span');
  wrap.className = 'listen ' + (cls || '');
  for (const [name, href] of listenUrls(rel)) {
    const a = document.createElement('a');
    a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = name;
    a.className = 'listen-link';
    a.setAttribute('aria-label', `${name}: search for ${rel.title} by ${rel.artist ? rel.artist.name : ''} (opens in a new tab)`);
    wrap.appendChild(a);
  }
  return wrap;
}
