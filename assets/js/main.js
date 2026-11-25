// Entry point: loads data, wires state <-> timeline / chronicle / panel / controls.
import { loadData } from './data.js';
import { parseHash, serializeHash, createStore } from './state.js';
import { createFilter } from './filters.js';
import { createTimeline } from './timeline.js';
import { createChronicle } from './chronicle.js';
import { createPanel } from './panel.js';
import { createControls } from './controls.js';
import { toDecimalYear } from './dates.js';
import { createPlaylistStore } from './playlists.js';
import { createPlaylistsView, resolvePlaylist } from './playlists-view.js';

const $ = (id) => document.getElementById(id);
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Optional web fonts: loaded from JS so a blocked/slow request never delays rendering.
// The CSS font stacks have solid system fallbacks.
function loadFonts() {
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap';
  document.head.appendChild(l);
}

/** `?data=fixtures/` overrides the data directory (relative paths only). */
function dataBase() {
  const v = new URLSearchParams(location.search).get('data');
  if (v && /^[\w.\-/]+$/.test(v) && !v.startsWith('/') && !v.includes('..')) return v.endsWith('/') ? v : v + '/';
  return 'data/';
}

function showError(err, base) {
  $('loading').hidden = true;
  const box = $('error');
  box.hidden = false;
  const msg = box.querySelector('.error-msg');
  msg.textContent = err && err.message ? err.message : String(err);
  const file = location.protocol === 'file:';
  box.querySelector('.error-hint').textContent = file
    ? 'This page was opened from a file:// URL, where browsers block loading the JSON data. Serve the folder instead, e.g. run  python3 -m http.server  in the repository root and open http://localhost:8000/.'
    : `The site reads ${base}artists.json, ${base}releases.json and ${base}events.json. Check that they exist and are valid JSON. When running locally, serve the repository root with  python3 -m http.server  (opening index.html directly will not work).`;
}

async function start() {
  const base = dataBase();
  let model;
  try { model = await loadData(base); } catch (err) { showError(err, base); return; }
  if (model.warnings.length) console.warn('[data]', model.warnings.join('\n'));
  $('loading').hidden = true;
  $('app').hidden = false;
  init(model);
}

function init(model) {
  // header counts
  $('count-releases').textContent = model.releases.length;
  $('count-events').textContent = model.events.length;
  $('count-artists').textContent = model.laneArtists.length;

  const store = createStore(parseHash(location.hash));
  const get = () => store.get();
  const filter = createFilter(model, get);
  const panelEl = $('panel');

  // ---------- selection / navigation ----------
  const select = (key) => store.set({ sel: key });
  const selectArtist = (id) => store.set({ sel: 'a:' + id });
  const closePanel = () => store.set({ sel: null });

  let tl; // assigned below
  const playlists = createPlaylistStore(model);
  const panel = createPanel({ root: panelEl, model, playlists, onSelect: (k) => { select(k); revealSelected(); }, onArtist: (id) => { selectArtist(id); revealSelected(); }, onClose: closePanel });
  const chronicle = createChronicle({ root: $('view-chronicle'), model, getState: get, filter, onSelect: select });
  tl = createTimeline({
    root: $('tl'), model, getState: get, filter, tooltip: $('tooltip'), reducedMotion,
    onSelect: select, onArtist: selectArtist,
    onToggleGroup: (gid) => { const cg = new Set(get().cg); cg.has(gid) ? cg.delete(gid) : cg.add(gid); store.set({ cg }); },
    onViewChange: (x) => { store.set({ x }, { quiet: true }); writeHash(false); },
  });
  const controls = createControls({ model, store, tl, onJump: (d) => jump(d), onClear: () => store.set({ hg: new Set(), hc: new Set(), lm: false, tf: false, ol: false, q: '' }) });

  const plView = createPlaylistsView({
    root: $('view-playlists'), model, store, playlists,
    onOpenItem: (k) => select(k),
    onSelectRef: (ref) => store.set({ pl: ref }),
    onShow: (ref) => showOnTimeline(ref),
  });
  const resolveRef = (ref) => resolvePlaylist(ref, { model, playlists, state: get() });

  /** Highlight a playlist on the timeline: dim the rest, draw the numbered path, show the banner. */
  function showOnTimeline(ref) {
    const pl = resolveRef(ref);
    if (!pl) return;
    // Collapse every genre group that has none of the playlist's releases (restored on Clear)
    if (!savedCg) { savedCg = new Set(get().cg); persistSaved(); }
    const keep = new Set(pl.items.map((i) => i.rel.genre));
    const cg = new Set(model.genreIds.filter((g) => !keep.has(g)));
    const ys = pl.items.map((i) => toDecimalYear(i.rel.t));
    let a = Math.min(...ys) - 0.7, b = Math.max(...ys) + 0.7;
    if (b - a < 3) { const m = (a + b) / 2; a = m - 1.5; b = m + 1.5; }
    store.set({ view: 'timeline', hl: ref, cg, sel: null });
    tl.goTo(a, b);
    requestAnimationFrame(() => {
      // bring the banner + toolbar + timeline to the top of the page (below the sticky bar)
      const top = document.querySelector('.bar').offsetHeight + $('pl-banner').offsetHeight + 8;
      const tb = document.querySelector('.tl-toolbar').getBoundingClientRect();
      window.scrollTo(0, Math.max(0, tb.top + window.scrollY - top));
      tl.scrollToLane(pl.items[0].rel.key);
    });
  }
  // collapse state before a playlist was shown (kept in sessionStorage so Clear still restores it after a reload)
  const SKEY = 'speedkills:savedcg';
  let savedCg = null;
  try { const v = sessionStorage.getItem(SKEY); if (v !== null) savedCg = new Set(v.split(',').filter(Boolean)); } catch (_) { /* ignore */ }
  const persistSaved = () => { try { savedCg ? sessionStorage.setItem(SKEY, [...savedCg].join(',')) : sessionStorage.removeItem(SKEY); } catch (_) { /* ignore */ } };
  function syncHighlight() {
    const pl = resolveRef(get().hl);
    const keys = pl ? pl.items.map((i) => i.rel.key) : [];
    filter.setHighlight(keys);
    tl.setPath(keys);
    const banner = $('pl-banner');
    banner.hidden = !pl;
    if (pl) $('pl-banner-text').textContent = `Showing: ${pl.title} (${keys.length} release${keys.length === 1 ? '' : 's'}, in order)`;
    return !!pl;
  }
  playlists.subscribe(() => { const hl = get().hl; if (hl && hl.startsWith('u:')) { syncHighlight(); tl.refresh(); chronicle.markDirty(); } });
  $('pl-banner-clear').addEventListener('click', () => store.set({ hl: null }));

  /** Pan so the selected mark is visible and not hidden under the drawer / sheet. */
  function revealSelected() {
    const s = get();
    if (!s.sel || s.view !== 'timeline') return;
    const pr = panelEl.getBoundingClientRect();
    const tr = $('tl').getBoundingClientRect();
    const open = !panelEl.hidden;
    const side = open && pr.width < window.innerWidth * 0.9 && pr.left > window.innerWidth * 0.4;
    const insetR = side ? Math.max(0, tr.right - pr.left) : 0;
    const insetB = open && !side ? Math.max(0, tr.bottom - pr.top) : 0;
    tl.reveal(s.sel, { insetR, insetB, flash: false });
  }

  // ---------- search jump ----------
  let jumpIdx = -1;
  function jump(dir) {
    const list = filter.matchingItems();
    if (!list.length) return;
    jumpIdx = (jumpIdx + dir + list.length * 4) % list.length;
    const s = get();
    for (let tries = 0; tries < list.length; tries++) {
      const it = list[(jumpIdx + tries * dir + list.length * 4) % list.length];
      if (s.view === 'chronicle') { chronicle.scrollToKey(it.key); jumpIdx = list.indexOf(it); return; }
      if (tl.reveal(it.key, { center: true, flash: true })) { jumpIdx = list.indexOf(it); return; }
    }
  }
  function updateSearchStatus() {
    const s = get();
    if (!filter.searching()) { controls.setSearchStatus('', false, false); return; }
    const n = filter.matchingItems().length;
    controls.setSearchStatus(n ? `${n} match${n === 1 ? '' : 'es'}` : 'No matches', n > 0, true);
  }

  // ---------- panel rendering ----------
  function renderPanel(focus) {
    const s = get();
    if (!s.sel) { panel.render(null); panel.restoreFocus(); return; }
    let seq = filter.matchingItems().map((i) => i.key);
    if (s.view === 'playlists') { // prev/next follows the open playlist's order
      const pl = resolveRef(plView.currentRef());
      const pk = pl ? pl.items.map((i) => i.rel.key) : [];
      if (pk.includes(s.sel)) seq = pk;
    }
    if (!seq.includes(s.sel)) seq = model.items.map((i) => i.key);
    panel.render(s.sel, seq, { focus });
  }

  // ---------- view switching ----------
  function applyView() {
    const s = get();
    const isTl = s.view === 'timeline';
    $('view-timeline').hidden = !isTl;
    $('view-chronicle').hidden = s.view !== 'chronicle';
    $('view-playlists').hidden = s.view !== 'playlists';
    if (s.view === 'playlists') plView.render();
    document.body.dataset.view = s.view;
    if (s.view === 'chronicle') { chronicle.render(); requestAnimationFrame(() => chronicle.scrollToSelected()); }
  }

  // ---------- hash ----------
  let fromHash = false;
  function writeHash(push) {
    if (fromHash) return;
    const hash = serializeHash(get());
    if (hash === location.hash || (!hash && !location.hash)) return;
    const url = location.pathname + location.search + hash;
    try { push ? history.pushState(null, '', url) : history.replaceState(null, '', url); } catch (_) { /* sandboxed */ }
  }

  store.subscribe((s, changed) => {
    const layout = changed.has('hg') || changed.has('lm') || changed.has('ol') || changed.has('cg');
    const filt = layout || changed.has('hc') || changed.has('tf') || changed.has('q');
    if (filt) {
      if (layout) tl.rebuild(); else tl.refresh();
      if (!(changed.size === 1 && changed.has('cg'))) { chronicle.markDirty(); if (s.view === 'chronicle') chronicle.render(); }
      controls.sync(s);
      updateSearchStatus();
      if (changed.has('q')) jumpIdx = -1;
      if (s.sel && !panelEl.hidden) renderPanel(false);
    }
    if (changed.has('hl')) {
      if (!s.hl && savedCg) { const prev = savedCg; savedCg = null; persistSaved(); store.set({ cg: prev }); }
      syncHighlight(); tl.refresh(); chronicle.markDirty(); if (s.view === 'chronicle') chronicle.render(); }
    if (changed.has('view')) { applyView(); controls.sync(s); }
    else if (s.view === 'playlists' && (changed.has('pl') || changed.has('sh'))) plView.render();
    if (changed.has('sel')) {
      tl.setSelected(s.sel); chronicle.setSelected(s.sel);
      renderPanel(false);
      if (s.sel && !fromHash) revealSelected();
    }
    if (changed.has('x') && s.x) tl.setViewYears(s.x[0], s.x[1]);
    writeHash(changed.has('sel') || changed.has('view') || changed.has('pl') || changed.has('sh'));
  });

  window.addEventListener('hashchange', () => {
    if (location.hash === serializeHash(get()) || (!location.hash && !serializeHash(get()))) return;
    fromHash = true;
    const next = parseHash(location.hash);
    if (!next.x) next.x = get().x;
    store.replace(next);
    fromHash = false;
  });

  // ---------- global keys ----------
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panelEl.hidden) { e.preventDefault(); closePanel(); }
    else if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || '')) && !e.ctrlKey && !e.metaKey) { e.preventDefault(); $('q').focus(); }
  });
  $('backdrop').addEventListener('click', closePanel);

  // sticky offsets (chronicle year headings) depend on the control bar's height
  const bar = document.querySelector('.bar');
  const setBarH = () => document.documentElement.style.setProperty('--bar-h', bar.offsetHeight + 'px');
  new ResizeObserver(setBarH).observe(bar); setBarH();

  // ---------- initial paint ----------
  const s0 = get();
  tl.rebuild();
  if (s0.x) tl.setViewYears(s0.x[0], s0.x[1]); else tl.fit(true);
  controls.sync(s0);
  updateSearchStatus();
  applyView();
  syncHighlight(); tl.refresh();
  tl.setSelected(s0.sel); chronicle.setSelected(s0.sel);
  if (s0.sel) { renderPanel(false); setTimeout(revealSelected, 60); }
  window.__metal = { store, model, tl }; // handy for debugging in the console
}

loadFonts();
start();
