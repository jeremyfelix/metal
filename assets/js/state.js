// App state + URL hash (de)serialisation. The hash is the source of truth for sharing:
//   #view=chronicle&hg=punk,death&hc=lineup&lm=1&tf=1&q=slayer&sel=r:id&x=1983.2-1988.4
// hg/hc list *hidden* genres/categories so unknown values never break a link.

export const defaults = () => ({
  view: 'timeline',
  hg: new Set(), // hidden genres
  hc: new Set(), // hidden event categories
  lm: false,     // landmarks only
  tf: false,     // thrash focus
  q: '',         // search text
  sel: null,     // 'r:ID' | 'e:ID' | 'a:ID'
  x: null,       // [t0, t1] visible time range as decimal years
});

const list = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

export function parseHash(hash) {
  const s = defaults();
  const p = new URLSearchParams(String(hash || '').replace(/^#\/?/, ''));
  if (p.get('view') === 'chronicle') s.view = 'chronicle';
  list(p.get('hg')).forEach((g) => s.hg.add(g));
  list(p.get('hc')).forEach((c) => s.hc.add(c));
  s.lm = p.get('lm') === '1';
  s.tf = p.get('tf') === '1';
  s.q = (p.get('q') || '').slice(0, 120);
  const sel = p.get('sel');
  if (sel && /^[rea]:/.test(sel)) s.sel = sel;
  const x = /^(-?\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/.exec(p.get('x') || '');
  if (x && +x[2] > +x[1]) s.x = [+x[1], +x[2]];
  return s;
}

export function serializeHash(s) {
  const parts = [];
  const add = (k, v) => parts.push(k + '=' + encodeURIComponent(v).replace(/%3A/g, ':').replace(/%2C/g, ','));
  if (s.view !== 'timeline') add('view', s.view);
  if (s.hg.size) add('hg', [...s.hg].sort().join(','));
  if (s.hc.size) add('hc', [...s.hc].sort().join(','));
  if (s.lm) add('lm', '1');
  if (s.tf) add('tf', '1');
  if (s.q) add('q', s.q);
  if (s.sel) add('sel', s.sel);
  if (s.x && s.view === 'timeline') add('x', s.x[0].toFixed(2) + '-' + s.x[1].toFixed(2));
  return parts.length ? '#' + parts.join('&') : '';
}

/** Tiny store: set(patch) notifies subscribers with the set of changed keys. */
export function createStore(initial) {
  let state = initial;
  const subs = new Set();
  const same = (a, b) => (a instanceof Set ? a.size === b.size && [...a].every((v) => b.has(v)) : Array.isArray(a) ? JSON.stringify(a) === JSON.stringify(b) : a === b);
  return {
    get: () => state,
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    /** quiet: update without notifying (used for viewport changes that the UI already reflects). */
    set(patch, { quiet = false } = {}) {
      const changed = new Set();
      const next = { ...state };
      for (const k of Object.keys(patch)) if (!same(state[k], patch[k])) { next[k] = patch[k]; changed.add(k); }
      if (!changed.size) return changed;
      const prev = state;
      state = next;
      if (!quiet) subs.forEach((fn) => fn(state, changed, prev));
      return changed;
    },
    replace(next) {
      const changed = new Set(Object.keys(next).filter((k) => !same(state[k], next[k])));
      const prev = state; state = next;
      if (changed.size) subs.forEach((fn) => fn(state, changed, prev));
      return changed;
    },
  };
}
