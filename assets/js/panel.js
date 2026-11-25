// Details panel: side drawer on desktop, bottom sheet on small screens (layout is CSS only).
// All text is inserted with textContent; nothing from the data is ever parsed as HTML.
import { formatDate, parseParts } from './dates.js';
import { genreMeta, genreClass, catMeta, catClass, typeMeta } from './meta.js';
import { coverFigure, photoFigure, wikiLink } from './images.js';
import { listenLinks, MAX_TITLE } from './playlists.js';

const h = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

function lifespan(a) {
  const f = a.formed ? formatDate(a.formed) : '';
  const e = a.ended ? formatDate(a.ended) : '';
  if (f && e) return `${f} – ${e}`;
  if (f) return `Formed ${f}`;
  return '';
}

export function createPanel({ root, model, playlists, onSelect, onArtist, onClose }) {
  const content = root.querySelector('#panel-content');
  const closeBtn = root.querySelector('#panel-close');
  let opener = null;

  closeBtn.addEventListener('click', () => onClose());

  function chip(text, cls) { return h('span', 'chip ' + (cls || ''), text); }
  function linkBtn(text, handler, cls) { const b = h('button', 'link-btn ' + (cls || ''), text); b.type = 'button'; b.addEventListener('click', handler); return b; }

  function artistBox(a, withPhoto) {
    const box = h('section', 'pn-artist-box ' + genreClass(a.genre));
    box.appendChild(h('h3', 'pn-sub', 'The artist'));
    const nm = h('p', 'pn-artist-name');
    nm.appendChild(linkBtn(a.name, () => onArtist(a.id), 'strong'));
    nm.appendChild(chip(genreMeta(a.genre).label, 'chip-genre'));
    box.appendChild(nm);
    const facts = [a.origin, lifespan(a)].filter(Boolean).join(' · ');
    if (facts) box.appendChild(h('p', 'pn-meta', facts));
    const ph = withPhoto ? photoFigure(a, 'sm') : null;
    if (ph) box.appendChild(ph);
    if (a.blurb) box.appendChild(h('p', 'pn-blurb', a.blurb));
    const wl = wikiLink(a, 'Wikipedia ↗'); if (wl) box.appendChild(h('p', 'pn-ext')).appendChild(wl);
    return box;
  }

  /** "Add to playlist" menu for a release: toggles membership, can create a playlist inline. */
  function addMenu(rel) {
    const wrap = h('div', 'add-pl');
    const btn = h('button', 'btn add-pl-btn', 'Add to playlist'); btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-expanded', 'false');
    const menu = h('div', 'add-pl-menu'); menu.hidden = true; menu.setAttribute('role', 'group'); menu.setAttribute('aria-label', 'Your playlists');
    const status = h('p', 'add-pl-status'); status.setAttribute('role', 'status');
    wrap.append(btn, menu, status);
    let creating = false;
    function paint(focusIdx) {
      menu.replaceChildren();
      const lists = playlists.all();
      if (!lists.length && !creating) menu.appendChild(h('p', 'add-pl-empty', 'You have no playlists yet.'));
      lists.forEach((l, idx) => {
        const on = playlists.has(l.id, rel.id);
        const b = h('button', 'add-pl-item'); b.type = 'button';
        b.setAttribute('role', 'menuitemcheckbox'); b.setAttribute('aria-checked', String(on));
        b.append(h('span', 'add-pl-check', on ? '✓' : ''), h('span', 'add-pl-name', l.title), h('span', 'add-pl-count', String(l.ids.length)));
        b.addEventListener('click', () => { const now = playlists.toggle(l.id, rel.id); status.textContent = now ? `Added to “${l.title}”` : `Removed from “${l.title}”`; paint(idx); });
        menu.appendChild(b);
      });
      if (creating) {
        const f = h('form', 'add-pl-new');
        const lab = h('label', 'sr-only', 'New playlist name'); lab.htmlFor = 'new-pl-name';
        const inp = document.createElement('input'); inp.id = 'new-pl-name'; inp.type = 'text'; inp.maxLength = MAX_TITLE; inp.placeholder = 'Playlist name'; inp.autocomplete = 'off';
        const ok = h('button', 'btn', 'Create'); ok.type = 'submit';
        const cx = h('button', 'btn', 'Cancel'); cx.type = 'button';
        cx.addEventListener('click', () => { creating = false; paint(); });
        f.addEventListener('submit', (e) => { e.preventDefault(); const l = playlists.create(inp.value.trim() || 'New playlist', [rel.id]); creating = false; status.textContent = `Created “${l.title}” and added this release`; paint(); btn.focus(); });
        f.append(lab, inp, ok, cx); menu.appendChild(f);
        requestAnimationFrame(() => inp.focus());
      } else {
        const n = h('button', 'add-pl-item add-pl-create', 'New playlist…'); n.type = 'button';
        n.addEventListener('click', () => { creating = true; paint(); });
        menu.appendChild(n);
      }
      if (focusIdx != null) { const it = menu.querySelectorAll('.add-pl-item[role="menuitemcheckbox"]')[focusIdx]; if (it) it.focus(); }
      menu.appendChild(h('p', 'add-pl-note', playlists.persistent ? 'Saved in this browser only.' : 'Storage is unavailable, so playlists last only for this session.'));
    }
    btn.addEventListener('click', () => { const open = menu.hidden; menu.hidden = !open; btn.setAttribute('aria-expanded', String(open)); if (open) paint(); });
    wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { e.stopPropagation(); menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); btn.focus(); } });
    return wrap;
  }

  function nav(key, seq) {
    const wrap = h('nav', 'pn-nav'); wrap.setAttribute('aria-label', 'Chronological navigation');
    const i = seq.indexOf(key);
    const mk = (dir, idx) => {
      const k = seq[idx];
      const it = k && model.byKey.get(k);
      const b = h('button', 'nav-btn ' + dir);
      b.type = 'button';
      if (!it) { b.disabled = true; b.appendChild(h('span', 'nav-dir', dir === 'prev' ? '← Earlier' : 'Later →')); b.appendChild(h('span', 'nav-title', '—')); return b; }
      b.appendChild(h('span', 'nav-dir', dir === 'prev' ? '← Earlier' : 'Later →'));
      b.appendChild(h('span', 'nav-title', it.title));
      b.appendChild(h('span', 'nav-date', formatDate(it.date, it.prec)));
      b.addEventListener('click', () => onSelect(k));
      return b;
    };
    if (i < 0) return null;
    wrap.append(mk('prev', i - 1), mk('next', i + 1));
    return wrap;
  }

  function renderItem(it, seq) {
    const frag = document.createDocumentFragment();
    const kick = h('div', 'pn-kicker');
    if (it.kind === 'release') {
      kick.appendChild(chip(typeMeta(it.type).label, 'chip-type'));
      if (it.landmark) kick.appendChild(chip('Landmark', 'chip-landmark'));
    } else {
      kick.appendChild(chip(catMeta(it.category).label, 'chip-cat ' + catClass(it.category)));
      kick.appendChild(chip(['', 'Minor event', 'Notable event', 'Key event'][it.importance], 'chip-plain'));
    }
    frag.appendChild(kick);
    const t = h('h2', 'pn-title', it.title); t.id = 'panel-title'; frag.appendChild(t);
    if (it.kind === 'release' && it.listTitle && it.listTitle !== it.title) frag.appendChild(h('p', 'pn-meta', `Listed as “${it.listTitle}”`));
    if (it.artists.length) {
      const p = h('p', 'pn-byline');
      it.artists.forEach((a, i) => { if (i) p.appendChild(document.createTextNode(', ')); p.appendChild(linkBtn(a.name, () => onArtist(a.id), 'strong')); });
      frag.appendChild(p);
    }
    if (it.kind === 'release') { const cv = coverFigure(it); if (cv) frag.appendChild(cv); }
    const dateP = h('p', 'pn-date');
    dateP.appendChild(h('time', null, formatDate(it.date, it.prec)));
    if (it.prec !== 'day') dateP.appendChild(h('span', 'pn-approx', it.prec === 'month' ? ' · day not recorded' : ' · month not recorded'));
    frag.appendChild(dateP);
    if (it.kind === 'release' && it.dateNote) frag.appendChild(h('p', 'pn-datenote', 'Date note: ' + it.dateNote));
    const text = it.kind === 'release' ? it.note : it.description;
    if (text) frag.appendChild(h('p', 'pn-text', text));
    if (it.kind === 'release') { const wl = wikiLink(it, 'Wikipedia article ↗'); if (wl) frag.appendChild(h('p', 'pn-ext')).appendChild(wl); }
    if (it.kind === 'release') {
      const ls = h('div', 'pn-listen'); ls.appendChild(h('h3', 'pn-sub', 'Listen on')); ls.appendChild(listenLinks(it, 'big'));
      frag.appendChild(ls);
      frag.appendChild(addMenu(it));
    }
    it.artists.slice(0, 2).forEach((a, i) => frag.appendChild(artistBox(a, it.kind === 'release' || i === 0)));
    const n = nav(it.key, seq); if (n) frag.appendChild(n);
    return frag;
  }

  function renderArtist(a) {
    const frag = document.createDocumentFragment();
    const kick = h('div', 'pn-kicker'); kick.appendChild(chip(genreMeta(a.genre).label, 'chip-genre ' + genreClass(a.genre))); kick.appendChild(chip('Artist', 'chip-plain'));
    frag.appendChild(kick);
    const t = h('h2', 'pn-title', a.name); t.id = 'panel-title'; frag.appendChild(t);
    const facts = [a.origin, a.country, lifespan(a)].filter(Boolean).join(' · ');
    if (facts) frag.appendChild(h('p', 'pn-meta', facts));
    const ph = photoFigure(a, 'lg'); if (ph) frag.appendChild(ph);
    if (a.blurb) frag.appendChild(h('p', 'pn-text', a.blurb));
    const wl = wikiLink(a, 'Wikipedia ↗'); if (wl) frag.appendChild(h('p', 'pn-ext')).appendChild(wl);
    const all = [...a.releases, ...a.events].sort((x, y) => x.t - y.t);
    frag.appendChild(h('h3', 'pn-sub', `${a.releases.length} release${a.releases.length === 1 ? '' : 's'} · ${a.events.length} event${a.events.length === 1 ? '' : 's'}`));
    if (!all.length) frag.appendChild(h('p', 'pn-meta', 'Nothing recorded for this artist yet.'));
    const ol = h('ol', 'pn-list');
    for (const it of all) {
      const li = h('li', 'pn-li ' + it.kind);
      const b = h('button', 'pn-li-btn'); b.type = 'button';
      b.appendChild(h('span', 'pn-li-date', formatDate(it.date, it.prec)));
      const tt = h('span', 'pn-li-title', it.title);
      b.appendChild(tt);
      b.appendChild(h('span', 'pn-li-kind', it.kind === 'release' ? typeMeta(it.type).label + (it.landmark ? ' ★' : '') : catMeta(it.category).label));
      b.addEventListener('click', () => onSelect(it.key));
      li.appendChild(b); ol.appendChild(li);
    }
    frag.appendChild(ol);
    return frag;
  }

  return {
    /** sel: 'r:ID' | 'e:ID' | 'a:ID' | null.  seq: chronological array of item keys for prev/next. */
    render(sel, seq, { focus = false } = {}) {
      if (!sel) { root.hidden = true; root.classList.remove('open'); document.body.classList.remove('panel-open'); return; }
      let frag = null;
      if (sel.startsWith('a:')) { const a = model.artistById.get(sel.slice(2)); if (a) frag = renderArtist(a); }
      else { const it = model.byKey.get(sel); if (it) frag = renderItem(it, seq); }
      if (!frag) { content.replaceChildren(h('p', 'pn-meta', 'That entry was not found in the data.')); }
      else content.replaceChildren(frag);
      const wasHidden = root.hidden;
      if (wasHidden) opener = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
      root.hidden = false;
      document.body.classList.add('panel-open');
      requestAnimationFrame(() => root.classList.add('open'));
      root.scrollTop = 0; content.scrollTop = 0;
      if (focus || wasHidden) { const t = content.querySelector('#panel-title'); if (t) { t.tabIndex = -1; t.focus({ preventScroll: true }); } }
    },
    restoreFocus() { if (opener && document.contains(opener) && !opener.closest('[hidden]')) { try { opener.focus({ preventScroll: true }); } catch (_) { /* ignore */ } } opener = null; },
    isOpen: () => !root.hidden,
  };
}
