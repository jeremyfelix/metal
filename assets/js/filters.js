// Filter / search / "thrash focus" predicates shared by the timeline and the chronicle.

export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function createFilter(model, getState) {
  // Pre-compute search haystacks once.
  const hay = new Map();
  for (const it of model.items) {
    const names = it.artists.map((a) => a.name).join(' ');
    const year = new Date(it.t).getUTCFullYear();
    hay.set(it.key, norm(`${it.title} ${it.listTitle || ''} ${names} ${year}`));
  }
  const artistHay = new Map(model.artists.map((a) => [a.id, norm(a.name)]));

  const thrashRe = /thrash/i;
  const thrashCache = new Map();

  const api = {
    tokens() { return norm(getState().q).split(/\s+/).filter(Boolean); },
    searching() { return api.tokens().length > 0; },

    /** Does the item pass the genre/category/landmark filters (not search)? */
    passes(it) {
      const s = getState();
      if (it.kind === 'release') {
        if (s.hg.has(it.genre)) return false;
        if (s.lm && !it.landmark) return false;
        if (s.ol && it.inList === false) return false;
        return true;
      }
      if (s.hc.has(it.category)) return false;
      if (s.lm && it.importance < 2) return false;
      // events tied to artists vanish only when every artist's genre is hidden
      if (it.artists.length && it.artists.every((a) => s.hg.has(a.genre))) return false;
      return true;
    },

    /** Search match (true for everything when no query). */
    matches(it) {
      const t = api.tokens();
      if (!t.length) return true;
      const h = hay.get(it.key) || '';
      return t.every((x) => h.includes(x));
    },
    artistMatches(a) {
      const t = api.tokens();
      if (!t.length) return true;
      const h = artistHay.get(a.id) || '';
      return t.every((x) => h.includes(x)) || a.releases.some((r) => api.matches(r));
    },

    /** Is the item related to thrash (for the "Thrash focus" dimming)? */
    thrash(it) {
      if (thrashCache.has(it.key)) return thrashCache.get(it.key);
      let v;
      if (it.kind === 'release') v = it.genre === 'thrash';
      else v = it.artists.some((a) => a.genre === 'thrash') || thrashRe.test(it.title + ' ' + it.description);
      thrashCache.set(it.key, v);
      return v;
    },

    /** Dimmed (shown but de-emphasised) given search and thrash focus. */
    dimmed(it) {
      const s = getState();
      if (s.tf && !api.thrash(it)) return true;
      if (api.searching() && !api.matches(it)) return true;
      return false;
    },

    /** Items passing filters, chronological. */
    visibleItems() { return model.items.filter((it) => api.passes(it)); },
    /** Items passing filters AND search, chronological. */
    matchingItems() { return model.items.filter((it) => api.passes(it) && api.matches(it)); },
  };
  return api;
}
