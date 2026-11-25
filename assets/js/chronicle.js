// Chronicle: a vertical, year-grouped list of everything that passes the current filters/search.
import { formatDayMonth, formatDate } from './dates.js';
import { makeImg } from './images.js';
import { genreClass, genreMeta, catClass, catMeta, typeMeta, releasePath, eventPath } from './meta.js';

const NS = 'http://www.w3.org/2000/svg';
const h = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

/** Tiny inline SVG with the same marker shape used in the timeline. */
export function shapeIcon(d, cls) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '-9 -9 18 18'); s.setAttribute('width', 16); s.setAttribute('height', 16); s.setAttribute('aria-hidden', 'true');
  s.setAttribute('class', 'shape-icon ' + (cls || ''));
  const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); s.appendChild(p);
  return s;
}

export function createChronicle({ root, model, getState, filter, onSelect }) {
  const index = root.querySelector('#chr-index');
  const list = root.querySelector('#chr-list');
  const status = root.querySelector('#chr-status');
  let dirty = true;
  let selectedKey = null;

  function build() {
    const st = getState();
    const searching = filter.searching();
    const rows = model.items.filter((it) => filter.passes(it) && filter.matches(it));
    list.replaceChildren(); index.replaceChildren();
    status.textContent = rows.length ? `${rows.length} entries` : 'Nothing matches the current filters.';
    status.classList.toggle('empty', !rows.length);
    let curYear = null, ul = null;
    const years = [];
    for (const it of rows) {
      const y = new Date(it.t).getUTCFullYear();
      if (y !== curYear) {
        curYear = y; years.push(y);
        const sec = h('section', 'chr-year'); sec.id = 'y' + y; sec.setAttribute('aria-labeledby', 'yh' + y);
        const hd = h('h3', 'chr-year-h', String(y)); hd.id = 'yh' + y; sec.appendChild(hd);
        ul = h('ul', 'chr-items'); sec.appendChild(ul); list.appendChild(sec);
      }
      ul.appendChild(buildItem(it, st));
    }
    // decade grouping in the index
    let lastDec = null;
    for (const y of years) {
      const dec = Math.floor(y / 10) * 10;
      if (dec !== lastDec) { lastDec = dec; index.appendChild(h('span', 'chr-dec', dec + 's')); }
      const a = h('a', 'chr-idx', String(y)); a.href = '#y' + y; a.dataset.year = y;
      a.addEventListener('click', (e) => { e.preventDefault(); const t = document.getElementById('y' + y); if (t) t.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); });
      index.appendChild(a);
    }
    dirty = false;
    applySelected();
  }

  function buildItem(it, st) {
    const li = h('li', 'chr-li ' + it.kind);
    li.dataset.key = it.key;
    const b = h('button', 'chr-item'); b.type = 'button'; b.dataset.key = it.key;
    const cls = it.kind === 'release' ? genreClass(it.genre) : catClass(it.category);
    b.classList.add(cls);
    if (it.landmark) b.classList.add('landmark');
    if ((st.tf && !filter.thrash(it)) || !filter.inHighlight(it)) b.classList.add('is-dim');
    const date = h('span', 'chr-date', formatDayMonth(it.date, it.prec));
    const icon = shapeIcon(it.kind === 'release' ? releasePath(it.type, 5.4) : eventPath(it.category, 5.4), it.kind === 'release' ? 'mk-icon' : 'ev-icon');
    const main = h('span', 'chr-main');
    const row = h('span', 'chr-row');
    const text = h('span', 'chr-text');
    text.appendChild(h('span', 'chr-title', it.title));
    const sub = h('span', 'chr-sub');
    const parts = [];
    if (it.artists.length) parts.push(it.artists.map((a) => a.name).join(', '));
    parts.push(it.kind === 'release' ? typeMeta(it.type).label : catMeta(it.category).label);
    if (it.kind === 'release') parts.push(genreMeta(it.genre).label);
    sub.textContent = parts.join(' · ');
    text.appendChild(sub);
    if (it.kind === 'event' && it.description) text.appendChild(h('span', 'chr-desc', it.description));
    if (it.kind === 'release' && it.note) text.appendChild(h('span', 'chr-desc', it.note));
    if (it.landmark) text.appendChild(h('span', 'chr-badge', it.kind === 'release' ? 'Landmark' : 'Key event'));
    row.appendChild(text);
    if (it.kind === 'release' && it.img) {
      // reserved 56px box; the whole box disappears if the image cannot load
      const box = h('span', 'chr-thumb');
      box.appendChild(makeImg(it.img, `Cover of ${it.title}${it.artist ? ' by ' + it.artist.name : ''}`, 'chr-thumb-img', 56, 56, box));
      row.appendChild(box);
    }
    main.appendChild(row);
    b.append(date, icon, main);
    b.setAttribute('aria-label', `${it.title}, ${it.artists.map((a) => a.name).join(', ') || catMeta(it.category).label}, ${formatDate(it.date, it.prec)}`);
    li.appendChild(b);
    return li;
  }

  list.addEventListener('click', (e) => { const b = e.target.closest('.chr-item'); if (b) onSelect(b.dataset.key); });

  function applySelected() {
    list.querySelectorAll('.chr-item.is-selected').forEach((n) => n.classList.remove('is-selected'));
    if (!selectedKey) return;
    const n = list.querySelector(`.chr-item[data-key="${CSS.escape(selectedKey)}"]`);
    if (n) n.classList.add('is-selected');
  }

  // keep the year index highlighting the year in view
  let obs = null;
  function observeYears() {
    if (obs) obs.disconnect();
    if (!('IntersectionObserver' in window)) return;
    obs = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) {
        const y = en.target.id.slice(1);
        index.querySelectorAll('.chr-idx.current').forEach((a) => a.classList.remove('current'));
        const a = index.querySelector(`.chr-idx[data-year="${y}"]`);
        if (a) { a.classList.add('current'); if (index.scrollWidth > index.clientWidth && getComputedStyle(index).overflowX !== 'visible') a.scrollIntoView({ inline: 'center', block: 'nearest' }); }
      }
    }, { rootMargin: '-120px 0px -75% 0px' });
    list.querySelectorAll('.chr-year').forEach((s) => obs.observe(s));
  }

  return {
    markDirty() { dirty = true; },
    render(force) { if (dirty || force) { build(); observeYears(); } },
    setSelected(key) { selectedKey = key; applySelected(); },
    scrollToSelected() {
      if (!selectedKey) return;
      const n = list.querySelector(`.chr-item[data-key="${CSS.escape(selectedKey)}"]`);
      if (n) n.scrollIntoView({ block: 'center' });
    },
    scrollToKey(key) {
      const n = list.querySelector(`.chr-item[data-key="${CSS.escape(key)}"]`);
      if (n) { n.scrollIntoView({ block: 'center' }); n.classList.remove('flash'); void n.offsetWidth; n.classList.add('flash'); }
    },
    isDirty: () => dirty,
  };
}
