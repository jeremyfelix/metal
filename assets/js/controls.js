// Filter chips, toggles, search box, tabs, era/zoom buttons and the theme switch.
import { GENRES, CATEGORIES, genreMeta, genreClass, catMeta, catClass, releasePath, eventPath, ERAS } from './meta.js';
import { shapeIcon } from './chronicle.js';

const h = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const $ = (id) => document.getElementById(id);

export function createControls({ model, store, tl, onJump, onClear }) {
  // ---- genre chips (one per genre present in the data) ----
  const gWrap = $('genre-chips');
  gWrap.replaceChildren();
  const gBtns = new Map();
  for (const gid of model.genreIds) {
    const m = genreMeta(gid);
    const b = h('button', 'chip-btn ' + genreClass(gid)); b.type = 'button'; b.dataset.genre = gid;
    b.appendChild(h('span', 'swatch'));
    b.appendChild(h('span', 'chip-label', m.label));
    b.addEventListener('click', () => {
      const hg = new Set(store.get().hg);
      hg.has(gid) ? hg.delete(gid) : hg.add(gid);
      store.set({ hg });
    });
    gWrap.appendChild(b); gBtns.set(gid, b);
  }
  // ---- event category chips ----
  const cWrap = $('cat-chips');
  cWrap.replaceChildren();
  const cBtns = new Map();
  const catIds = CATEGORIES.map((c) => c.id);
  for (const e of model.events) if (!catIds.includes(e.category)) catIds.push(e.category);
  for (const cid of catIds) {
    const m = catMeta(cid);
    const b = h('button', 'chip-btn cat ' + catClass(cid)); b.type = 'button'; b.dataset.cat = cid;
    const ic = shapeIcon(eventPath(cid, 5.2), 'ev-icon'); ic.classList.add('swatch-icon');
    b.append(ic, h('span', 'chip-label', m.label));
    b.addEventListener('click', () => {
      const hc = new Set(store.get().hc);
      hc.has(cid) ? hc.delete(cid) : hc.add(cid);
      store.set({ hc });
    });
    cWrap.appendChild(b); cBtns.set(cid, b);
  }
  // ---- toggles ----
  const tLm = $('tgl-landmarks'), tTf = $('tgl-thrash');
  tLm.addEventListener('click', () => store.set({ lm: !store.get().lm }));
  tTf.addEventListener('click', () => store.set({ tf: !store.get().tf }));
  $('btn-clear').addEventListener('click', () => onClear());

  // ---- search ----
  const q = $('q');
  let timer = 0;
  q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => store.set({ q: q.value.trim() }), 140); });
  q.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); clearTimeout(timer); store.set({ q: q.value.trim() }); onJump(e.shiftKey ? -1 : 1); }
    else if (e.key === 'Escape' && q.value) { q.value = ''; store.set({ q: '' }); }
  });
  $('q-next').addEventListener('click', () => onJump(1));
  $('q-prev').addEventListener('click', () => onJump(-1));
  $('q-clear').addEventListener('click', () => { q.value = ''; store.set({ q: '' }); q.focus(); });

  // ---- tabs ----
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  tabs.forEach((t) => {
    t.addEventListener('click', () => store.set({ view: t.dataset.view }));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const i = tabs.indexOf(t), n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      n.focus(); store.set({ view: n.dataset.view }); e.preventDefault();
    });
  });

  // ---- era + zoom buttons ----
  const eraWrap = $('era-btns');
  eraWrap.replaceChildren();
  for (const e of ERAS) {
    const b = h('button', 'btn era-btn'); b.type = 'button';
    b.append(h('span', 'era-name', e.label), h('span', 'era-range', ' ' + e.range));
    b.addEventListener('click', () => tl.goTo(e.from, e.to));
    eraWrap.appendChild(b);
  }
  $('zoom-in').addEventListener('click', () => tl.zoomBy(1.6));
  $('zoom-out').addEventListener('click', () => tl.zoomBy(1 / 1.6));
  $('zoom-fit').addEventListener('click', () => tl.fit());

  // ---- legend (generated so it always matches the shapes drawn on the timeline) ----
  const lgE = $('lg-events'); lgE.replaceChildren();
  for (const c of CATEGORIES) { const li = h('li', catClass(c.id)); li.append(shapeIcon(eventPath(c.id, 6), 'ev-icon'), document.createTextNode(' ' + c.label)); lgE.appendChild(li); }
  const lgG = $('lg-genres'); lgG.replaceChildren();
  for (const gid of model.genreIds) { const li = h('li', genreClass(gid)); li.append(h('span', 'swatch'), document.createTextNode(' ' + genreMeta(gid).label)); lgG.appendChild(li); }

  // ---- filters panel: open on desktop, collapsible on phones ----
  const details = $('filters');
  const mq = matchMedia('(min-width: 861px)');
  const applyMq = () => { if (mq.matches) details.open = true; };
  mq.addEventListener('change', applyMq); applyMq();

  // ---- theme ----
  const themeBtn = $('theme-toggle');
  const effective = () => document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  const paintTheme = () => { const t = effective(); themeBtn.setAttribute('aria-label', `Switch to ${t === 'dark' ? 'light' : 'dark'} theme`); themeBtn.dataset.theme = t; themeBtn.querySelector('.theme-label').textContent = t === 'dark' ? 'Dark' : 'Light'; };
  themeBtn.addEventListener('click', () => {
    const next = effective() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('metal-theme', next); } catch (_) { /* storage unavailable */ }
    paintTheme();
  });
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', paintTheme);
  paintTheme();

  return {
    sync(s) {
      gBtns.forEach((b, id) => { const on = !s.hg.has(id); b.setAttribute('aria-pressed', String(on)); });
      cBtns.forEach((b, id) => { const on = !s.hc.has(id); b.setAttribute('aria-pressed', String(on)); });
      tLm.setAttribute('aria-pressed', String(s.lm)); tTf.setAttribute('aria-pressed', String(s.tf));
      if (document.activeElement !== q && q.value !== s.q) q.value = s.q;
      $('q-clear').hidden = !s.q;
      const active = s.hg.size + s.hc.size + (s.lm ? 1 : 0) + (s.tf ? 1 : 0);
      const badge = $('filters-badge'); badge.textContent = active ? String(active) : ''; badge.hidden = !active;
      $('btn-clear').hidden = !(active || s.q);
      tabs.forEach((t) => { const on = t.dataset.view === s.view; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
    },
    setSearchStatus(text, hasMatches, searching) {
      $('q-status').textContent = text;
      $('q-prev').hidden = $('q-next').hidden = !searching || !hasMatches;
    },
  };
}
