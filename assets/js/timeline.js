// The swimlane timeline (SVG). Layout:
//   .tl-head  (sticky)  era strip + year axis + events track        -> <svg>
//   .tl-body  (scrolls vertically) genre headers + one lane / artist -> <svg>
// Both SVGs share one x-scale. Panning/zooming never rebuilds the DOM: each frame only updates
// `transform`s / a few attributes of existing nodes (see render()). The artist-name gutter lives
// outside the time-dependent coordinates, so it is "sticky" while panning.
import { DAY, YEAR, MONTH_NAMES, toDecimalYear, fromDecimalYear, formatDate } from './dates.js';
import { genreClass, genreMeta, catClass, catMeta, typeMeta, releasePath, eventPath, ERAS } from './meta.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs, parent) => {
  const n = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
};

// Geometry
const ERA_H = 20, AXIS_TOP = 22, AXIS_BOT = 46, HEAD_H = 152;
// Events track: one band per importance level; crowded bands spill into extra sub-rows (see render()).
const EV_ROW_Y = { 3: [68], 2: [91, 108], 1: [127, 142] };
const EV_R = { 3: 8, 2: 6, 1: 4.4 };
const GROUP_H = 30, LANE_H = 42, TOP_PAD = 4, BOTTOM_PAD = 20;
const MIN_SPAN = 100 * DAY;

let measureCtx = null;
const widthCache = new Map();
function textWidth(text, font) {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  const key = font + '|' + text;
  let w = widthCache.get(key);
  if (w === undefined) { measureCtx.font = font; w = measureCtx.measureText(text).width; widthCache.set(key, w); }
  return w;
}
/** Fit a name into maxW px over at most two lines (truncating with an ellipsis). */
function fitLines(text, maxW, font) {
  if (textWidth(text, font) <= maxW) return [text];
  const words = text.split(/\s+/);
  let l1 = '';
  let i = 0;
  while (i < words.length && textWidth((l1 ? l1 + ' ' : '') + words[i], font) <= maxW) { l1 = (l1 ? l1 + ' ' : '') + words[i]; i++; }
  if (!l1) { l1 = words[0]; i = 1; }
  let l2 = words.slice(i).join(' ');
  const trunc = (s) => { if (textWidth(s, font) <= maxW) return s; while (s.length > 1 && textWidth(s + '…', font) > maxW) s = s.slice(0, -1); return s + '…'; };
  return l2 ? [trunc(l1), trunc(l2)] : [trunc(l1)];
}

export function createTimeline({ root, model, getState, filter, tooltip, reducedMotion, onSelect, onArtist, onViewChange }) {
  // ---------- DOM skeleton ----------
  root.replaceChildren();
  const head = document.createElement('div'); head.className = 'tl-head';
  const body = document.createElement('div'); body.className = 'tl-body';
  const empty = document.createElement('p'); empty.className = 'tl-empty'; empty.hidden = true;
  empty.textContent = 'No lanes to show. Re-enable a genre or turn off “Landmarks only”.';
  root.append(head, body, empty);
  const headSvg = el('svg', { class: 'tl-svg', role: 'img', 'aria-label': 'Time axis and key events track' });
  head.appendChild(headSvg);
  const bodySvg = el('svg', { class: 'tl-svg', role: 'group', 'aria-label': 'Artist lanes with releases' });
  body.appendChild(bodySvg);

  // ---------- state ----------
  let W = 0, G = 168, plotW = 0, bodyH = 0;
  const [D0, D1] = model.domain;
  const MAX_SPAN = D1 - D0;
  const view = { t0: D0, t1: D1 };
  let fontFamily = 'sans-serif';
  const bodyFont = () => `500 11px ${fontFamily}`;
  let groupY = new Map(); // genre id -> y of its header
  let lanes = [];        // {artist, y, barEl, nodes[], labelNodes[]}
  let nodes = [];        // all interactive/positioned nodes
  const byKey = new Map(); // item key -> nodes[]
  let navRows = [];
  let rowsForLabels = []; // arrays of marker nodes per label row
  let evNodes = [];
  let rafId = 0, anim = 0;
  let roving = null;
  let suppressClick = false;
  let selectedKey = null;

  // static head parts
  const headDefs = el('defs', null, headSvg);
  const headClip = el('clipPath', { id: 'clip-head' }, headDefs); const headClipRect = el('rect', { y: 0, height: HEAD_H }, headClip);
  const headBg = el('rect', { class: 'head-bg', x: 0, y: 0, height: HEAD_H }, headSvg);
  const headPlot = el('g', { 'clip-path': 'url(#clip-head)' }, headSvg);
  const eraG = el('g', { class: 'eras' }, headPlot);
  const axisPath = el('path', { class: 'ax-ticks' }, headPlot);
  const axisPathMajor = el('path', { class: 'ax-ticks major' }, headPlot);
  const axisLabels = el('g', { class: 'ax-labels' }, headPlot);
  const evRowLines = el('path', { class: 'ev-rowlines' }, headPlot);
  const evG = el('g', { class: 'events' }, headPlot);
  const evLabelG = el('g', { class: 'ev-labels' }, headPlot);
  const headGutter = el('g', { class: 'gutter' }, headSvg);
  const headGutterBg = el('rect', { class: 'gutter-bg', x: 0, y: 0, height: HEAD_H }, headGutter);
  const headGutterEdge = el('line', { class: 'gutter-edge', y1: 0, y2: HEAD_H }, headGutter);
  const capTitle = el('text', { class: 'cap-title', x: 12, y: 14 }, headGutter); capTitle.textContent = 'Era';
  const capAx = el('text', { class: 'cap-title', x: 12, y: 40 }, headGutter); capAx.textContent = 'Year';
  [['Key events', 3], ['Notable', 2], ['Minor', 1]].forEach(([t, i]) => { const c = el('text', { class: 'cap-row', y: EV_ROW_Y[i][0] + 4 }, headGutter); c.textContent = t; c.dataset.imp = i; });

  // pools for axis labels / eras
  const axTexts = [];
  const eraEls = ERAS.map((e) => ({ rect: el('rect', { class: 'era-rect era-' + e.id, y: 2, height: ERA_H - 4 }, eraG), text: Object.assign(el('text', { class: 'era-label', y: 15 }, eraG), { textContent: `${e.label} ${e.range}` }), era: e }));

  // ---------- building ----------
  function measureEnv() {
    const cs = getComputedStyle(root);
    fontFamily = cs.getPropertyValue('--font-body').trim() || getComputedStyle(document.body).fontFamily;
    widthCache.clear();
  }

  function layoutSize() {
    W = Math.max(280, Math.floor(root.clientWidth));
    G = W < 640 ? 104 : 172;
    plotW = W - G;
    headSvg.setAttribute('width', W); headSvg.setAttribute('height', HEAD_H);
    headClipRect.setAttribute('x', G); headClipRect.setAttribute('width', plotW);
    headBg.setAttribute('width', W);
    headGutterBg.setAttribute('width', G); headGutterEdge.setAttribute('x1', G); headGutterEdge.setAttribute('x2', G);
    headGutter.querySelectorAll('.cap-row').forEach((c) => { c.setAttribute('x', G - 10); });
    eraEls.forEach((e) => { e.text.setAttribute('x', 0); });
  }

  /** (Re)build lanes + event nodes. Called on load, resize and layout-affecting filter changes. */
  function rebuild() {
    const st = getState();
    const scrollTop = body.scrollTop;
    layoutSize();
    measureEnv();
    // clear previous
    nodes = []; byKey.clear(); groupY = new Map(); lanes = []; rowsForLabels = []; navRows = []; roving = null;
    evG.replaceChildren(); evLabelG.replaceChildren();

    // --- events track nodes
    evNodes = [];
    const evRows = { 1: [], 2: [], 3: [] };
    for (const it of model.events) {
      const imp = it.importance;
      const n = makeEventNode(it, EV_ROW_Y[imp][0], EV_R[imp], evG, evLabelG, imp);
      n.imp = imp;
      n.kind = 'event'; n.t = it.t; evNodes.push(n); evRows[imp].push(n); nodes.push(n);
      addByKey(it.key, n);
    }
    for (const i of [3, 2, 1]) rowsForLabels.push({ nodes: evRows[i], y: EV_ROW_Y[i][0], imp: i, kind: 'event' });
    navRows.push({ nodes: evNodes.slice(), isEvents: true });
    evRowLines.setAttribute('d', `M${G} ${(EV_ROW_Y[3][0] + EV_ROW_Y[2][0]) / 2}H${W}M${G} ${(EV_ROW_Y[2][1] + EV_ROW_Y[1][0]) / 2}H${W}`);

    // --- lanes
    bodySvg.replaceChildren();
    const defs = el('defs', null, bodySvg);
    const clip = el('clipPath', { id: 'clip-body' }, defs); const clipRect = el('rect', { x: G, y: 0, width: plotW }, clip);
    const plot = el('g', { 'clip-path': 'url(#clip-body)' }, bodySvg);
    const gridMinor = el('path', { class: 'grid-minor' }, plot);
    const gridMajor = el('path', { class: 'grid-major' }, plot);
    const gutter = el('g', { class: 'gutter' }, bodySvg);
    const gBg = el('rect', { class: 'gutter-bg', x: 0, y: 0, width: G }, gutter);
    const gEdge = el('line', { class: 'gutter-edge', x1: G, x2: G, y1: 0 }, gutter);
    bodyRefs = { gridMinor, gridMajor, clipRect, gBg, gEdge };

    let y = TOP_PAD;
    let laneCount = 0;
    for (const gid of model.genreIds) {
      if (st.hg.has(gid)) continue;
      let arts = model.laneArtists.filter((a) => a.genre === gid);
      if (st.lm) arts = arts.filter((a) => a.releases.some((r) => r.landmark));
      if (!arts.length) continue;
      const first = (a) => Math.min(Number.isFinite(a.formedT) ? a.formedT : Infinity, a.releases.length ? a.releases[0].t : Infinity);
      arts.sort((a, b) => first(a) - first(b) || a.name.localeCompare(b.name));
      const gm = genreMeta(gid);
      // group header
      const gcls = genreClass(gid);
      groupY.set(gid, y);
      const hdr = el('g', { class: 'grp ' + gcls }, plot);
      el('rect', { class: 'grp-band', x: G, y, width: plotW, height: GROUP_H }, hdr);
      const hdrG = el('g', { class: 'grp-head ' + gcls }, gutter);
      el('rect', { class: 'grp-band', x: 0, y, width: G, height: GROUP_H }, hdrG);
      el('rect', { class: 'grp-swatch', x: 10, y: y + 9, width: 12, height: 12 }, hdrG);
      const gt = el('text', { class: 'grp-name', x: 28, y: y + 20 }, hdrG); gt.textContent = gm.label;
      const gc = el('text', { class: 'grp-count', x: G - 10, y: y + 20, 'text-anchor': 'end' }, hdrG); gc.textContent = String(arts.length);
      y += GROUP_H;
      for (const a of arts) {
        const lane = buildLane(a, y, gcls, plot, gutter);
        lanes.push(lane); laneCount++;
        y += LANE_H;
      }
    }
    bodyH = y + BOTTOM_PAD;
    bodySvg.setAttribute('width', W); bodySvg.setAttribute('height', bodyH);
    clipRect.setAttribute('height', bodyH); gBg.setAttribute('height', bodyH); gEdge.setAttribute('y2', bodyH);
    empty.hidden = laneCount > 0;
    body.scrollTop = scrollTop;

    // roving tabindex: first lane marker (or the events track)
    const firstNode = (navRows[1] && navRows[1].nodes[0]) || navRows[0].nodes[0];
    if (firstNode) setRoving(firstNode);
    refresh();
  }
  let bodyRefs = null;

  function buildLane(a, y, gcls, plot, gutter) {
    const lane = { artist: a, y, nodes: [], markers: [], cls: gcls };
    const g = el('g', { class: 'lane ' + gcls }, plot);
    el('line', { class: 'lane-line', x1: G, x2: W, y1: y + LANE_H, y2: y + LANE_H }, g);
    lane.bar = el('rect', { class: 'lane-bar', y: y + LANE_H / 2 - 2, height: 4, rx: 2 }, g);
    lane.g = g;
    const tickG = el('g', null, g), markG = el('g', null, g), labG = el('g', { class: 'mk-labels' }, g);
    const cy = y + LANE_H / 2;

    // artist label (gutter)
    const lg = el('g', { class: 'lane-label node ' + gcls, tabindex: -1, role: 'button', 'data-artist': a.id, 'aria-label': `${a.name}: artist details` }, gutter);
    el('rect', { class: 'hit', x: 0, y, width: G - 1, height: LANE_H }, lg);
    el('rect', { class: 'lane-swatch', x: 0, y: y + 8, width: 4, height: LANE_H - 16 }, lg);
    const lines = fitLines(a.name, G - 24, `600 13px ${fontFamily}`);
    const tt = el('text', { class: 'lane-name' }, lg);
    lines.forEach((ln, i) => { const s = el('tspan', { x: 14, y: lines.length === 1 ? cy + 4.5 : cy - 2 + i * 14 }, tt); s.textContent = ln; });
    const lnode = { el: lg, isLabel: true, artist: a, t: -Infinity, hidden: false, vis: true, lane };
    lane.labelNode = lnode;

    const row = { nodes: [lnode], lane };
    // release markers
    for (const r of a.releases) {
      if (getState().lm && !r.landmark) continue;
      const tm = typeMeta(r.type);
      const radius = tm.r * (r.landmark ? 1.38 : 1);
      const n = el('g', { class: `node mk mk-${tm.id} ${r.landmark ? 'landmark' : ''}`, tabindex: -1, role: 'button', 'data-key': r.key, 'aria-label': `${r.title}, ${a.name}, ${formatDate(r.date, r.prec)}, ${tm.label}${r.landmark ? ', landmark release' : ''}` }, markG);
      el('circle', { class: 'hit', r: 13 }, n);
      if (r.landmark) el('path', { class: 'mk-halo', d: releasePath(r.type, radius + 3.4) }, n);
      el('path', { class: 'mk-shape', d: releasePath(r.type, radius) }, n);
      const lab = el('text', { class: 'mk-label' + (r.landmark ? ' lm' : ''), y: cy + 4 }, labG); lab.textContent = r.listTitle || r.title;
      const node = { el: n, label: lab, item: r, kind: 'release', t: r.t, y: cy, r: radius, lane, hidden: false, vis: false, labW: textWidth(lab.textContent, `${r.landmark ? 600 : 500} 11px ${fontFamily}`) };
      lane.nodes.push(node); lane.markers.push(node); nodes.push(node); row.nodes.push(node); addByKey(r.key, node);
    }
    // artist-linked event ticks (small, below the markers)
    for (const ev of a.events) {
      const t = el('g', { class: `node ev-tick ${catClass(ev.category)}`, 'data-key': ev.key, 'aria-hidden': 'true' }, tickG);
      el('rect', { class: 'hit', x: -6, y: -8, width: 12, height: 16 }, t);
      el('rect', { class: 'tick-shape', x: -1.2, y: -4.5, width: 2.4, height: 9, rx: 1 }, t);
      const node = { el: t, item: ev, kind: 'tick', t: ev.t, y: y + LANE_H - 9, lane, hidden: false, vis: false, aux: true };
      nodes.push(node); lane.nodes.push(node); addByKey(ev.key, node);
    }
    lane.markers.sort((p, q) => p.t - q.t);
    row.nodes.sort((p, q) => p.t - q.t);
    rowsForLabels.push({ nodes: lane.markers, y: cy, kind: 'release', lane });
    navRows.push(row);
    nodes.push(lnode);
    return lane;
  }

  function makeEventNode(it, cy, r, glyphParent, labelParent, imp) {
    const g = el('g', { class: `node ev ev-${imp} ${catClass(it.category)}`, tabindex: -1, role: 'button', 'data-key': it.key, 'aria-label': `${it.title}, ${formatDate(it.date, it.prec)}, ${catMeta(it.category).label}` }, glyphParent);
    el('circle', { class: 'hit', r: Math.max(12, r + 4) }, g);
    el('path', { class: 'ev-shape', d: eventPath(it.category, r) }, g);
    const lab = el('text', { class: 'ev-label imp' + imp, y: cy + 4 }, labelParent); lab.textContent = it.title;
    return { el: g, label: lab, item: it, t: it.t, y: cy, r, hidden: false, vis: false, labW: textWidth(it.title, `${imp === 3 ? 600 : 500} 11px ${fontFamily}`) };
  }
  function addByKey(k, n) { let a = byKey.get(k); if (!a) byKey.set(k, (a = [])); a.push(n); }

  // ---------- filter / highlight states (cheap; no DOM creation) ----------
  function refresh() {
    const searching = filter.searching();
    const tf = getState().tf;
    const qMatchArtist = new Map();
    for (const n of nodes) {
      if (n.isLabel) {
        const a = n.artist;
        const dim = (tf && a.genre !== 'thrash') || (searching && !filter.artistMatches(a));
        n.el.classList.toggle('is-dim', dim);
        n.lane.g.classList.toggle('is-dim', dim);
        continue;
      }
      const it = n.item;
      const hidden = !filter.passes(it);
      if (hidden !== n.hidden) { n.hidden = hidden; n.vis = null; n.el.setAttribute('display', hidden ? 'none' : ''); if (hidden && n.label) setLabel(n, false); }
      const dim = filter.dimmed(it);
      const match = searching && filter.matches(it);
      n.el.classList.toggle('is-dim', dim);
      n.el.classList.toggle('is-match', match);
      if (n.label) { n.label.classList.toggle('is-dim', dim); n.label.classList.toggle('is-match', match); }
    }
    applySelected();
    schedule();
  }

  function applySelected() {
    for (const n of nodes) {
      const sel = selectedKey && ((n.item && n.item.key === selectedKey) || (n.isLabel && 'a:' + n.artist.id === selectedKey));
      n.el.classList.toggle('is-selected', !!sel);
    }
  }
  function setSelected(key) { selectedKey = key; applySelected(); }

  // ---------- rendering ----------
  function schedule() { if (!rafId) rafId = requestAnimationFrame(render); }

  function setLabel(n, show) { if (n.labShown !== show) { n.labShown = show; n.label.setAttribute('display', show ? '' : 'none'); } }

  function render() {
    rafId = 0;
    if (!plotW) return;
    const { t0, t1 } = view;
    const k = plotW / (t1 - t0);
    const X = (t) => G + (t - t0) * k;
    const ppy = k * YEAR; // pixels per year
    renderAxis(X, ppy);
    // eras
    for (const e of eraEls) {
      const a = X(fromDecimalYear(e.era.from)), b = X(fromDecimalYear(e.era.to));
      const vis = b > G && a < W;
      e.rect.setAttribute('display', vis ? '' : 'none'); e.text.setAttribute('display', vis ? '' : 'none');
      if (!vis) continue;
      e.rect.setAttribute('x', a.toFixed(1)); e.rect.setAttribute('width', Math.max(0, b - a).toFixed(1));
      const lw = e.w || (e.w = textWidth(e.text.textContent, `600 11px ${fontFamily}`));
      const tx = Math.max(a, G) + 6;
      const fits = b - Math.max(a, G) > lw + 12;
      e.text.setAttribute('x', tx.toFixed(1)); e.text.setAttribute('display', fits ? '' : 'none');
    }
    // lane bars
    for (const ln of lanes) {
      const a = ln.artist;
      const s = Number.isFinite(a.formedT) ? a.formedT : (a.releases[0] ? a.releases[0].t : t0);
      const e = Number.isFinite(a.endedT) ? a.endedT : D1;
      const x0 = Math.max(G, Math.min(W, X(s))), x1 = Math.max(G, Math.min(W, X(e)));
      const vis = x1 - x0 > 0.5;
      ln.bar.setAttribute('display', vis ? '' : 'none');
      if (vis) { ln.bar.setAttribute('x', x0.toFixed(1)); ln.bar.setAttribute('width', (x1 - x0).toFixed(1)); }
    }
    // node positions
    const xmin = G - 16, xmax = W + 16;
    for (const n of nodes) {
      if (n.isLabel || n.hidden) continue;
      const x = X(n.t);
      n.x = x;
      const vis = x > xmin && x < xmax;
      if (vis !== n.vis) { n.vis = vis; n.el.setAttribute('display', vis ? '' : 'none'); }
      if (vis) n.el.setAttribute('transform', `translate(${x.toFixed(1)} ${n.y})`);
    }
    packEvents(X);
    layoutLabels(ppy, xmax);
    renderGrid(X, ppy);
  }

  /**
   * Greedy sub-row packing for the events track: nodes are in time order, so each one goes into the
   * first sub-row of its importance band that has room (otherwise the least crowded one).
   */
  function packEvents(X) {
    for (const imp of [3, 2, 1]) {
      const rows = EV_ROW_Y[imp];
      const last = rows.map(() => -1e9);
      const gap = EV_R[imp] * 2 + 2;
      for (const n of evNodes) {
        if (n.imp !== imp || n.hidden || !n.vis) continue;
        let j = last.findIndex((l) => n.x - l >= gap);
        if (j < 0) j = last.indexOf(Math.min(...last));
        last[j] = n.x;
        n.sub = j;
        const y = rows[j];
        if (n.y !== y) { n.y = y; n.el.setAttribute('transform', `translate(${n.x.toFixed(1)} ${y})`); n.label.setAttribute('y', y + 4); }
      }
    }
  }

  /** Year/month ticks, grid lines and axis labels. */
  function renderAxis(X, ppy) {
    const { t0, t1 } = view;
    const y0 = new Date(t0).getUTCFullYear(), y1 = new Date(t1).getUTCFullYear() + 1;
    const step = ppy >= 34 ? 1 : ppy >= 17 ? 2 : ppy >= 7.5 ? 5 : 10;
    let minor = '', major = '';
    let ti = 0;
    const put = (text, x, cls) => {
      let t = axTexts[ti++];
      if (!t) { t = el('text', { y: 38 }, axisLabels); axTexts.push(t); }
      if (t._txt !== text) { t.textContent = text; t._txt = text; }
      if (t._cls !== cls) { t.setAttribute('class', cls); t._cls = cls; }
      t.setAttribute('x', x.toFixed(1)); t.removeAttribute('display');
    };
    const monthMode = ppy >= 300;
    for (let y = y0; y <= y1; y++) {
      const x = X(Date.UTC(y, 0, 1));
      const dec = y % 10 === 0;
      if (y % step !== 0 && !dec) continue;
      if (x < G - 60 || x > W + 4) continue;
      if (dec) major += `M${x.toFixed(1)} ${AXIS_TOP}V${AXIS_BOT}`; else minor += `M${x.toFixed(1)} ${AXIS_TOP + 8}V${AXIS_BOT}`;
      put(String(y), x + 4, 'ax-label' + (dec ? ' decade' : ''));
    }
    if (monthMode) {
      const full = ppy / 12 >= 36;
      for (let y = y0; y <= y1; y++) for (let m = 1; m < 12; m++) {
        if (!full && m % 3) continue;
        const x = X(Date.UTC(y, m, 1));
        if (x < G || x > W) continue;
        minor += `M${x.toFixed(1)} ${AXIS_TOP + 14}V${AXIS_BOT}`;
        put(MONTH_NAMES[m], x + 3, 'ax-label month');
      }
    }
    for (; ti < axTexts.length; ti++) { axTexts[ti].setAttribute('display', 'none'); axTexts[ti]._txt = null; }
    axisPath.setAttribute('d', minor); axisPathMajor.setAttribute('d', major);
    axisState = { step, monthMode, full: ppy / 12 >= 36, y0, y1 };
  }
  let axisState = null;

  function renderGrid(X, ppy) {
    if (!bodyRefs || !axisState) return;
    const { step, monthMode, y0, y1, full } = axisState;
    let minor = '', major = '';
    for (let y = y0; y <= y1; y++) {
      const x = X(Date.UTC(y, 0, 1));
      if (x < G - 2 || x > W + 2) continue;
      const dec = y % 10 === 0;
      if (dec) major += `M${x.toFixed(1)} 0V${bodyH}`;
      else if (y % step === 0 || ppy >= 60) minor += `M${x.toFixed(1)} 0V${bodyH}`;
    }
    if (monthMode) for (let y = y0; y <= y1; y++) for (let m = 1; m < 12; m++) {
      if (!full && m % 3) continue;
      const x = X(Date.UTC(y, m, 1));
      if (x > G && x < W) minor += `M${x.toFixed(1)} 0V${bodyH}`;
    }
    bodyRefs.gridMinor.setAttribute('d', minor); bodyRefs.gridMajor.setAttribute('d', major);
  }

  /** Greedy label placement per row: a label is shown only if it fits before the next mark. */
  function layoutLabels(ppy, xmax) {
    for (const row of rowsForLabels) {
      let mode;
      if (row.kind === 'event') mode = row.imp === 3 ? ppy >= 18 : row.imp === 2 ? ppy >= 150 : ppy >= 420;
      else mode = ppy >= 150 ? 2 : ppy >= 18 ? 1 : 0;
      const list = row.nodes;
      for (let i = 0; i < list.length; i++) {
        const n = list[i];
        if (!n.label) continue;
        let show = false;
        if (!n.hidden && n.vis) {
          const wanted = row.kind === 'event' ? mode : (mode === 2 || (mode === 1 && n.item.landmark));
          if (wanted) {
            // next non-hidden node in this row
            let nx = Infinity;
            for (let j = i + 1; j < list.length; j++) if (!list[j].hidden && (row.kind !== 'event' || list[j].sub === n.sub || !list[j].vis)) { nx = list[j].x; break; }
            const start = n.x + n.r + (n.item.landmark && n.kind === 'release' ? 9 : 5);
            const need = n.labW + 6;
            show = start + need <= nx - (list[i + 1] ? 3 : -1e9) && start + need <= W - 4;
            if (show) n.label.setAttribute('x', start.toFixed(1));
          }
        }
        setLabel(n, show);
      }
    }
  }

  // ---------- view (pan / zoom) ----------
  function clampView(t0, t1) {
    let span = t1 - t0;
    const cx = (t0 + t1) / 2;
    if (span < MIN_SPAN) span = MIN_SPAN;
    if (span > MAX_SPAN) span = MAX_SPAN;
    t0 = cx - span / 2; t1 = cx + span / 2;
    const pad = span * 0.04;
    if (t0 < D0 - pad) { t0 = D0 - pad; t1 = t0 + span; }
    if (t1 > D1 + pad) { t1 = D1 + pad; t0 = t1 - span; }
    return [t0, t1];
  }
  function setView(t0, t1, opts = {}) {
    [t0, t1] = clampView(t0, t1);
    view.t0 = t0; view.t1 = t1;
    schedule();
    notifyView();
  }
  let notifyTimer = 0;
  function notifyView() {
    clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => onViewChange && onViewChange([toDecimalYear(view.t0), toDecimalYear(view.t1)]), 250);
  }
  function cancelAnim() { if (anim) { cancelAnimationFrame(anim); anim = 0; } }
  function animateTo(t0, t1) {
    cancelAnim();
    [t0, t1] = clampView(t0, t1);
    if (reducedMotion()) { setView(t0, t1); return; }
    const a0 = view.t0, a1 = view.t1, start = performance.now(), dur = 380;
    // interpolate centre and log-span so zooming feels uniform
    const c0 = (a0 + a1) / 2, c1 = (t0 + t1) / 2, s0 = Math.log(a1 - a0), s1 = Math.log(t1 - t0);
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - p, 3);
      const c = c0 + (c1 - c0) * e, s = Math.exp(s0 + (s1 - s0) * e);
      setView(c - s / 2, c + s / 2);
      anim = p < 1 ? requestAnimationFrame(tick) : 0;
    };
    anim = requestAnimationFrame(tick);
  }
  /** Zoom by factor (>1 zooms in) keeping plot-x `px` fixed. */
  function zoomAt(px, factor, animate) {
    const span = view.t1 - view.t0;
    const ns = Math.min(MAX_SPAN, Math.max(MIN_SPAN, span / factor));
    const tAnchor = view.t0 + (px / plotW) * span;
    const t0 = tAnchor - (px / plotW) * ns;
    if (animate) animateTo(t0, t0 + ns); else { cancelAnim(); setView(t0, t0 + ns); }
  }
  function panBy(dxPx, animate) {
    const span = view.t1 - view.t0;
    const dt = (dxPx / plotW) * span;
    if (animate) animateTo(view.t0 + dt, view.t1 + dt); else { cancelAnim(); setView(view.t0 + dt, view.t1 + dt); }
  }

  // ---------- pointer interaction ----------
  const pointers = new Map();
  let drag = null, pinch = null;
  const plotX = (clientX) => clientX - root.getBoundingClientRect().left - G;

  root.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    cancelAnim();
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
      drag = null; suppressClick = true;
      hideTip();
    } else if (pointers.size === 1) {
      drag = { id: e.pointerId, x: e.clientX, moved: false, startX: e.clientX, startY: e.clientY };
    }
  });
  root.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (p) {
      const prev = { ...p };
      p.x = e.clientX; p.y = e.clientY;
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        zoomAt(plotX((a.x + b.x) / 2), d / pinch.d, false);
        pinch.d = d;
        return;
      }
      if (drag && drag.id === e.pointerId) {
        if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 5) {
          // vertical drags are left to the browser on touch (touch-action: pan-y) so this only fires for horizontal intent
          drag.moved = true; root.classList.add('is-dragging'); hideTip();
          try { root.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        }
        if (drag.moved) { panBy(-(e.clientX - prev.x), false); }
        return;
      }
    }
    if (e.pointerType === 'mouse' && !drag) hoverMove(e);
  });
  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    if (pinch && pointers.size < 2) pinch = null;
    if (drag && drag.id === e.pointerId) {
      if (drag.moved) { suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); }
      drag = null; root.classList.remove('is-dragging');
    }
    if (!pointers.size) setTimeout(() => { if (!drag) suppressClick = false; }, 50);
  };
  root.addEventListener('pointerup', endPointer);
  root.addEventListener('pointercancel', endPointer);

  root.addEventListener('wheel', (e) => {
    if (!plotW) return;
    const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const dx = e.deltaX * scale, dy = e.deltaY * scale;
    const inBody = body.contains(e.target);
    const canScrollY = body.scrollHeight > body.clientHeight + 2;
    if (e.ctrlKey || e.metaKey || e.altKey) { // pinch on trackpads arrives as ctrl+wheel
      e.preventDefault(); zoomAt(plotX(e.clientX), Math.exp(-dy * (e.ctrlKey ? 0.012 : 0.0018)), false);
    } else if (e.shiftKey || Math.abs(dx) > Math.abs(dy)) {
      e.preventDefault(); panBy(e.shiftKey && !dx ? dy : dx, false);
    } else if (!inBody || !canScrollY) {
      e.preventDefault(); zoomAt(plotX(e.clientX), Math.exp(-dy * 0.0018), false);
    } // else: plain vertical wheel over the lanes scrolls them natively
    hideTip();
  }, { passive: false });

  root.addEventListener('click', (e) => {
    if (suppressClick) { suppressClick = false; return; }
    const node = e.target.closest('.node');
    if (!node || !root.contains(node)) return;
    activate(node);
  });
  function activate(domNode) {
    if (domNode.dataset.artist) { onArtist(domNode.dataset.artist); return; }
    const key = domNode.dataset.key;
    if (key) onSelect(key);
  }

  // ---------- tooltip ----------
  function tipContent(node) {
    const it = node.item;
    const frag = document.createDocumentFragment();
    const add = (cls, text) => { const d = document.createElement('div'); d.className = cls; d.textContent = text; frag.appendChild(d); };
    if (node.isLabel) { add('tip-title', node.artist.name); add('tip-meta', `${genreMeta(node.artist.genre).label} · ${node.artist.origin || ''}`.replace(/ · $/, '')); add('tip-date', 'Click for artist details'); return frag; }
    add('tip-title', it.title);
    if (it.artists.length) add('tip-artist', it.artists.map((a) => a.name).join(', '));
    add('tip-date', formatDate(it.date, it.prec));
    add('tip-meta', it.kind === 'release' ? `${typeMeta(it.type).label}${it.landmark ? ' · Landmark' : ''}` : `${catMeta(it.category).label}`);
    return frag;
  }
  function nodeOf(domNode) { return domNode && (domNode._node || (domNode._node = nodes.find((n) => n.el === domNode) || null)); }
  let tipFor = null;
  function showTip(domNode, x, y) {
    const n = nodeOf(domNode);
    if (!n) return;
    if (tipFor !== domNode) { tooltip.replaceChildren(tipContent(n)); tipFor = domNode; }
    tooltip.hidden = false;
    const r = tooltip.getBoundingClientRect();
    let left = x + 14, top = y + 16;
    if (left + r.width > window.innerWidth - 8) left = Math.max(8, x - r.width - 14);
    if (top + r.height > window.innerHeight - 8) top = Math.max(8, y - r.height - 14);
    tooltip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }
  function hideTip() { tooltip.hidden = true; tipFor = null; }
  function hoverMove(e) {
    const d = e.target.closest && e.target.closest('.node');
    if (d && root.contains(d)) showTip(d, e.clientX, e.clientY); else hideTip();
  }
  root.addEventListener('pointerleave', hideTip);
  root.addEventListener('scroll', hideTip, true);

  // ---------- keyboard ----------
  function setRoving(n) {
    if (roving && roving !== n) roving.el.setAttribute('tabindex', '-1');
    roving = n; n.el.setAttribute('tabindex', '0');
  }
  root.addEventListener('focusin', (e) => {
    const d = e.target.closest && e.target.closest('.node');
    if (!d) return;
    const n = nodeOf(d);
    if (n) { setRoving(n); if (e.target.matches(':focus-visible')) { const r = d.getBoundingClientRect(); showTip(d, r.left + r.width / 2, r.top + r.height); } }
  });
  root.addEventListener('focusout', hideTip);

  function visibleRowNodes(ri) { const row = navRows[ri]; return row ? row.nodes.filter((n) => !n.hidden) : []; }
  function focusNode(n) {
    ensureVisible(n);
    n.el.focus({ preventScroll: true });
  }
  function ensureVisible(n) {
    if (n.isLabel || !Number.isFinite(n.t)) { scrollLaneIntoView(n); return; }
    const x = G + (n.t - view.t0) * (plotW / (view.t1 - view.t0));
    if (x < G + 24 || x > W - 24) { const half = (view.t1 - view.t0) / 2; setView(n.t - half, n.t + half); }
    scrollLaneIntoView(n);
  }
  function scrollLaneIntoView(n) {
    if (!n.lane) return;
    const top = n.lane.y, bot = top + LANE_H;
    if (top < body.scrollTop) body.scrollTop = Math.max(0, top - GROUP_H);
    else if (bot > body.scrollTop + body.clientHeight) body.scrollTop = bot - body.clientHeight + 8;
  }
  function rowIndexOf(n) { return navRows.findIndex((r) => r.nodes.includes(n)); }

  root.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const d = e.target.closest && e.target.closest('.node');
    const n = d ? nodeOf(d) : null;
    const k = e.key;
    const zoomKeys = { '+': 1.5, '=': 1.5, '-': 1 / 1.5, '_': 1 / 1.5 };
    if (k in zoomKeys) { e.preventDefault(); zoomAt(plotW / 2, zoomKeys[k], true); return; }
    if (k === '0') { e.preventDefault(); fit(); return; }
    if (!n) { // viewport itself is focused
      if (e.target !== root) return;
      if (k === 'ArrowLeft') { e.preventDefault(); panBy(-plotW * 0.2, true); }
      else if (k === 'ArrowRight') { e.preventDefault(); panBy(plotW * 0.2, true); }
      else if (k === 'ArrowUp') { e.preventDefault(); body.scrollTop -= 80; }
      else if (k === 'ArrowDown') { e.preventDefault(); body.scrollTop += 80; }
      return;
    }
    if (k === 'Enter' || k === ' ') { e.preventDefault(); activate(d); return; }
    const ri = rowIndexOf(n);
    const row = visibleRowNodes(ri);
    const idx = row.indexOf(n);
    let target = null;
    if (k === 'ArrowRight') target = row[idx + 1];
    else if (k === 'ArrowLeft') target = row[idx - 1];
    else if (k === 'Home') target = row[0];
    else if (k === 'End') target = row[row.length - 1];
    else if (k === 'ArrowUp' || k === 'ArrowDown') {
      const dir = k === 'ArrowUp' ? -1 : 1;
      let rj = ri + dir;
      let cand = [];
      while (rj >= 0 && rj < navRows.length && !(cand = visibleRowNodes(rj)).length) rj += dir;
      if (cand.length) {
        if (n.isLabel) target = cand[0];
        else { target = cand.filter((c) => !c.isLabel).reduce((best, c) => (!best || Math.abs(c.t - n.t) < Math.abs(best.t - n.t) ? c : best), null) || cand[0]; }
      }
    } else return;
    e.preventDefault();
    if (target) focusNode(target);
  });

  // ---------- public helpers ----------
  function fit(instant) { if (instant) setView(D0, D1); else animateTo(D0, D1); }
  function goTo(fromYear, toYear, genre) {
    animateTo(fromDecimalYear(fromYear), fromDecimalYear(toYear));
    // optionally bring the relevant genre group to the top of the lanes
    if (genre && groupY.has(genre)) body.scrollTo({ top: Math.max(0, groupY.get(genre) - 2), behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  /** Bring an item into view (pan, and scroll to its lane). center=true always centres horizontally. */
  function reveal(key, { center = false, flash = true, insetR = 0, insetB = 0 } = {}) {
    const list = byKey.get(key) || [];
    let n = list.find((x) => !x.aux && !x.hidden) || list.find((x) => !x.hidden);
    if (key.startsWith('a:')) { const lane = lanes.find((l) => 'a:' + l.artist.id === key); n = lane && lane.labelNode; }
    if (!n) return false;
    const visibleH = body.clientHeight - insetB;
    if (n.isLabel) { scrollLaneIntoView(n); return true; }
    const span = view.t1 - view.t0;
    const x = G + (n.t - view.t0) * (plotW / span);
    if (center || x < G + 30 || x > W - insetR - 30) {
      const px = (plotW - insetR) / 2; // aim for the middle of the unobscured area
      const t0 = n.t - (px / plotW) * span;
      animateTo(t0, t0 + span);
    }
    if (n.lane) {
      const top = n.lane.y - GROUP_H - 4, bottom = n.lane.y + LANE_H + 8;
      if (top < body.scrollTop || bottom > body.scrollTop + visibleH) body.scrollTo({ top: Math.max(0, n.lane.y - visibleH / 2 + LANE_H / 2), behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
    if (flash) { n.el.classList.remove('flash'); void n.el.getBoundingClientRect(); n.el.classList.add('flash'); setTimeout(() => n.el.classList.remove('flash'), 1600); }
    return true;
  }

  // fonts (async) and resize can change measurements
  const ro = new ResizeObserver(() => { if (root.clientWidth && Math.abs(root.clientWidth - W) > 1) { rebuild(); } });
  ro.observe(root);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (W) rebuild(); });

  // keyboard focus on viewport
  root.tabIndex = 0;
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Timeline. Arrow keys pan, plus and minus zoom, zero fits everything. Focus a marker with Tab, then use arrow keys to move between marks.');

  return {
    rebuild, refresh, fit, goTo, reveal, setSelected,
    zoomBy: (f) => zoomAt(plotW / 2, f, true),
    setViewYears(a, b) { setView(fromDecimalYear(a), fromDecimalYear(b)); },
    getViewYears: () => [toDecimalYear(view.t0), toDecimalYear(view.t1)],
    get laneCount() { return lanes.length; },
    hideTip,
  };
}
