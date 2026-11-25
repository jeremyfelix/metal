// The "Playlists" tab: curated lists (from playlists.json), the visitor's own lists (localStorage),
// and a read-only shared list (from the URL). All text is inserted with textContent.
import { formatDate } from './dates.js';
import { makeImg } from './images.js';
import { decodeShare, shareUrl, playlistText, copyText, listenLinks, MAX_TITLE } from './playlists.js';

const h = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const btn = (text, cls, onClick) => { const b = h('button', cls || 'btn', text); b.type = 'button'; if (onClick) b.addEventListener('click', onClick); return b; };

/** Resolve a playlist reference ('c:ID' | 'u:ID' | 's') to {ref, kind, title, description, items:[{rel, note}]} or null. */
export function resolvePlaylist(ref, { model, playlists, state }) {
  if (!ref) return null;
  if (ref === 's') {
    const d = decodeShare(state.sh, model);
    return d ? { ref, kind: 'shared', title: d.title, description: 'Shared with you via a link. It is read-only; save a copy to edit it.', items: d.ids.map((id) => ({ rel: model.byKey.get('r:' + id), note: null })) } : null;
  }
  if (ref.startsWith('c:')) {
    const p = model.playlists.find((x) => x.id === ref.slice(2));
    return p ? { ref, kind: 'curated', title: p.title, description: p.description, items: p.items } : null;
  }
  if (ref.startsWith('u:')) {
    const l = playlists.get(ref.slice(2));
    return l ? { ref, kind: 'personal', title: l.title, description: '', items: l.ids.map((id) => ({ rel: model.byKey.get('r:' + id), note: null })).filter((i) => i.rel), id: l.id } : null;
  }
  return null;
}

export function createPlaylistsView({ root, model, store, playlists, onOpenItem, onShow, onSelectRef }) {
  const side = root.querySelector('#pl-side');
  const main = root.querySelector('#pl-main');
  const ctx = () => ({ model, playlists, state: store.get() });
  let creating = false, renaming = false, confirmDel = false, status = '', statusTimer = 0;
  let focusNext = null; // {sel: css selector within main} applied after re-render

  const flash = (msg) => { status = msg; paintStatus(); clearTimeout(statusTimer); statusTimer = setTimeout(() => { status = ''; paintStatus(); }, 2500); };
  function paintStatus() { const s = main.querySelector('.pl-status'); if (s) s.textContent = status; }

  function currentRef() {
    const s = store.get();
    if (s.pl && resolvePlaylist(s.pl, ctx())) return s.pl;
    if (s.sh && decodeShare(s.sh, model)) return 's';
    if (model.playlists.length) return 'c:' + model.playlists[0].id;
    if (playlists.all().length) return 'u:' + playlists.all()[0].id;
    return null;
  }

  // On phones the list and detail are stacked: bring the detail into view and focus its heading.
  const stacked = () => matchMedia('(max-width: 860px)').matches;
  function revealDetail() {
    if (!stacked()) return;
    requestAnimationFrame(() => {
      const t = main.querySelector('.pl-title') || main;
      main.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      t.tabIndex = -1; t.focus({ preventScroll: true });
    });
  }
  function backToList() {
    const cur = side.querySelector('.pl-item.is-current') || side.querySelector('.pl-item');
    side.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    if (cur) cur.focus({ preventScroll: true });
  }

  // ---------- sidebar ----------
  function renderSide(cur) {
    side.replaceChildren();
    const mkList = (title, entries, empty) => {
      const sec = h('section', 'pl-sec');
      sec.appendChild(h('h2', 'pl-sec-h', title));
      if (!entries.length && empty) sec.appendChild(h('p', 'pl-empty', empty));
      const ul = h('ul', 'pl-list');
      for (const e of entries) {
        const li = h('li'); const b = h('button', 'pl-item'); b.type = 'button';
        if (e.ref === cur) { b.classList.add('is-current'); b.setAttribute('aria-current', 'true'); }
        b.append(h('span', 'pl-item-t', e.title), h('span', 'pl-item-n', String(e.count)));
        b.addEventListener('click', () => { onSelectRef(e.ref); revealDetail(); });
        li.appendChild(b); ul.appendChild(li);
      }
      sec.appendChild(ul);
      return sec;
    };
    if (model.playlists.length) side.appendChild(mkList('From Speed Kills', model.playlists.map((p) => ({ ref: 'c:' + p.id, title: p.title, count: p.items.length }))));
    const sh = store.get().sh && decodeShare(store.get().sh, model);
    if (sh) side.appendChild(mkList('Shared with you', [{ ref: 's', title: sh.title, count: sh.ids.length }]));

    const mine = mkList('Your playlists', playlists.all().map((l) => ({ ref: 'u:' + l.id, title: l.title, count: l.ids.length })), 'None yet.');
    if (creating) {
      const f = h('form', 'pl-new');
      const lab = h('label', 'sr-only', 'New playlist name'); lab.htmlFor = 'pl-new-name';
      const inp = document.createElement('input'); inp.id = 'pl-new-name'; inp.type = 'text'; inp.maxLength = MAX_TITLE; inp.placeholder = 'Playlist name'; inp.autocomplete = 'off';
      const ok = btn('Create', 'btn'); ok.type = 'submit';
      const cx = btn('Cancel', 'btn', () => { creating = false; render(); });
      f.addEventListener('submit', (e) => { e.preventDefault(); const l = playlists.create(inp.value.trim() || 'New playlist'); creating = false; onSelectRef('u:' + l.id); });
      f.addEventListener('keydown', (e) => { if (e.key === 'Escape') { creating = false; render(); } });
      f.append(lab, inp, ok, cx); mine.appendChild(f);
      requestAnimationFrame(() => inp.focus());
    } else {
      const nb = btn('New playlist', 'btn pl-new-btn', () => { creating = true; render(); });
      nb.id = 'pl-new-btn'; mine.appendChild(nb);
    }
    mine.appendChild(h('p', 'pl-note', playlists.persistent
      ? 'Your playlists are saved in this browser only. Use “Copy share link” to send one to someone.'
      : 'Storage is unavailable here, so your playlists last only until you close this tab. Use “Copy share link” to keep one.'));
    side.appendChild(mine);
  }

  // ---------- detail ----------
  function renderMain(cur) {
    main.replaceChildren();
    const pl = resolvePlaylist(cur, ctx());
    if (!pl) {
      main.appendChild(h('p', 'pl-empty big', playlists.all().length || model.playlists.length ? 'Choose a playlist.' : 'No playlists yet. Create one, or open any release and choose “Add to playlist”.'));
      return;
    }
    const rels = pl.items.map((i) => i.rel);
    const editable = pl.kind === 'personal';
    const head = h('header', 'pl-head');
    head.appendChild(btn('← All playlists', 'link-btn pl-back', backToList));
    if (editable && renaming) {
      const f = h('form', 'pl-rename');
      const lab = h('label', 'sr-only', 'Playlist name'); lab.htmlFor = 'pl-rename-in';
      const inp = document.createElement('input'); inp.id = 'pl-rename-in'; inp.type = 'text'; inp.maxLength = MAX_TITLE; inp.value = pl.title; inp.autocomplete = 'off';
      const ok = btn('Save', 'btn'); ok.type = 'submit';
      const cx = btn('Cancel', 'btn', () => { renaming = false; focusNext = '#pl-rename-btn'; render(); });
      f.addEventListener('submit', (e) => { e.preventDefault(); playlists.rename(pl.id, inp.value); renaming = false; focusNext = '#pl-rename-btn'; render(); });
      f.addEventListener('keydown', (e) => { if (e.key === 'Escape') { renaming = false; focusNext = '#pl-rename-btn'; render(); } });
      f.append(lab, inp, ok, cx); head.appendChild(f);
      requestAnimationFrame(() => { inp.focus(); inp.select(); });
    } else {
      const t = h('h2', 'pl-title', pl.title); head.appendChild(t);
    }
    head.appendChild(h('p', 'pl-meta', `${rels.length} release${rels.length === 1 ? '' : 's'}` + (pl.kind === 'curated' ? ' · curated' : pl.kind === 'shared' ? ' · shared, read-only' : ' · yours')));
    if (pl.description) head.appendChild(h('p', 'pl-desc', pl.description));
    main.appendChild(head);

    // actions
    const acts = h('div', 'pl-actions');
    const showB = btn('Show on timeline', 'btn primary', () => onShow(pl.ref)); showB.disabled = !rels.length;
    const copyB = btn('Copy as text', 'btn', async () => {
      const r = await copyText(playlistText(rels), main.querySelector('.pl-fallback'));
      flash(r === 'copied' ? 'Copied' : 'Select the text below and copy it');
    }); copyB.disabled = !rels.length;
    const linkB = btn('Copy share link', 'btn', async () => {
      const r = await copyText(shareUrl(pl.title, rels.map((x) => x.id)), main.querySelector('.pl-fallback'));
      flash(r === 'copied' ? 'Link copied' : 'Select the link below and copy it');
    }); linkB.disabled = !rels.length;
    acts.append(showB, copyB, linkB);
    if (pl.kind === 'curated') acts.appendChild(btn('Duplicate', 'btn', () => { const l = playlists.create(pl.title + ' (copy)', rels.map((x) => x.id)); onSelectRef('u:' + l.id); }));
    if (pl.kind === 'shared') acts.appendChild(btn('Save to my playlists', 'btn', () => { const l = playlists.create(pl.title, rels.map((x) => x.id)); flash('Saved'); onSelectRef('u:' + l.id); }));
    if (editable) {
      const rn = btn('Rename', 'btn', () => { renaming = true; render(); }); rn.id = 'pl-rename-btn'; acts.appendChild(rn);
      acts.appendChild(btn('Duplicate', 'btn', () => { const l = playlists.create(pl.title + ' (copy)', rels.map((x) => x.id)); onSelectRef('u:' + l.id); }));
      if (confirmDel) {
        const c = h('span', 'pl-confirm'); c.setAttribute('role', 'group'); c.setAttribute('aria-label', 'Confirm delete');
        c.append(h('span', 'pl-confirm-q', 'Delete?'),
          btn('Yes', 'btn danger', () => { confirmDel = false; playlists.remove(pl.id); onSelectRef(null); }),
          btn('Cancel', 'btn', () => { confirmDel = false; focusNext = '#pl-del-btn'; render(); }));
        acts.appendChild(c);
        requestAnimationFrame(() => c.querySelector('button').focus());
      } else { const d = btn('Delete', 'btn', () => { confirmDel = true; render(); }); d.id = 'pl-del-btn'; acts.appendChild(d); }
    }
    main.appendChild(acts);
    const st = h('p', 'pl-status'); st.setAttribute('role', 'status'); st.textContent = status; main.appendChild(st);
    const fb = h('textarea', 'pl-fallback'); fb.readOnly = true; fb.hidden = true; fb.rows = 4; fb.setAttribute('aria-label', 'Text to copy'); main.appendChild(fb);

    // rows
    if (!rels.length) { main.appendChild(h('p', 'pl-empty', editable ? 'This playlist is empty. Open any release and choose “Add to playlist”.' : 'Nothing here.')); return; }
    const ol = h('ol', 'pl-rows');
    pl.items.forEach((it, i) => ol.appendChild(buildRow(pl, it, i, editable)));
    main.appendChild(ol);
    if (editable) enableDrag(ol, pl);
  }

  function buildRow(pl, it, i, editable) {
    const r = it.rel;
    const li = h('li', 'pl-row'); li.dataset.i = i;
    li.appendChild(h('span', 'pl-num', String(i + 1)));
    const thumb = h('span', 'pl-thumb');
    if (r.img) thumb.appendChild(makeImg(r.img, `Cover of ${r.title}${r.artist ? ' by ' + r.artist.name : ''}`, 'pl-thumb-img', 48, 48)); else thumb.classList.add('empty');
    li.appendChild(thumb);
    const body = h('div', 'pl-body');
    const t = h('button', 'pl-row-title', r.title); t.type = 'button';
    t.addEventListener('click', () => onOpenItem(r.key));
    body.appendChild(t);
    body.appendChild(h('div', 'pl-row-sub', `${r.artist ? r.artist.name : 'Unknown'} · ${new Date(r.t).getUTCFullYear()}`));
    if (it.note) body.appendChild(h('div', 'pl-note-text', it.note));
    body.appendChild(listenLinks(r, 'compact'));
    li.appendChild(body);
    if (editable) {
      const c = h('div', 'pl-ctl');
      const handle = h('span', 'pl-handle', '⋮⋮'); handle.setAttribute('aria-hidden', 'true'); handle.title = 'Drag to reorder';
      const up = btn('↑', 'icon-btn up', () => { focusNext = `.pl-row[data-i="${Math.max(0, i - 1)}"] .up`; playlists.move(pl.id, i, i - 1); });
      up.setAttribute('aria-label', `Move “${r.title}” up`); up.disabled = i === 0;
      const dn = btn('↓', 'icon-btn down', () => { focusNext = `.pl-row[data-i="${i + 1}"] .down`; playlists.move(pl.id, i, i + 1); });
      dn.setAttribute('aria-label', `Move “${r.title}” down`); dn.disabled = i === pl.items.length - 1;
      const rm = btn('×', 'icon-btn rm', () => { focusNext = '.pl-rows .pl-row-title'; playlists.removeItem(pl.id, i); });
      rm.setAttribute('aria-label', `Remove “${r.title}” from playlist`);
      c.append(handle, up, dn, rm); li.appendChild(c);
    }
    return li;
  }

  /** Desktop drag-and-drop reordering (buttons above cover keyboard and touch). */
  function enableDrag(ol, pl) {
    let from = -1;
    ol.querySelectorAll('.pl-row').forEach((li) => {
      li.draggable = true;
      li.addEventListener('dragstart', (e) => { from = +li.dataset.i; li.classList.add('dragging'); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(from)); } catch (_) { /* ignore */ } });
      li.addEventListener('dragend', () => { li.classList.remove('dragging'); ol.querySelectorAll('.drop-target').forEach((n) => n.classList.remove('drop-target')); });
      li.addEventListener('dragover', (e) => { if (from < 0) return; e.preventDefault(); ol.querySelectorAll('.drop-target').forEach((n) => n.classList.remove('drop-target')); li.classList.add('drop-target'); });
      li.addEventListener('drop', (e) => { e.preventDefault(); const to = +li.dataset.i; const f = from; from = -1; if (f >= 0 && f !== to) { focusNext = `.pl-row[data-i="${to}"] .pl-row-title`; playlists.move(pl.id, f, to); } });
    });
  }

  function render() {
    const cur = currentRef();
    if (!(cur && cur.startsWith('u:'))) { renaming = false; confirmDel = false; }
    renderSide(cur); renderMain(cur);
    if (focusNext) { let n = main.querySelector(focusNext) || main.querySelector('.pl-row-title'); focusNext = null; if (n && n.disabled && n.parentElement) n = n.parentElement.querySelector('.icon-btn:not(:disabled)') || n; if (n && !n.disabled) n.focus(); }
  }
  playlists.subscribe(() => { if (!root.hidden) render(); });
  return { render, currentRef };
}
