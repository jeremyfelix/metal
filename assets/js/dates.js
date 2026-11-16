// Date helpers. All dates in the data are "YYYY", "YYYY-MM" or "YYYY-MM-DD" strings.
// Timeline positions are UTC milliseconds.

export const DAY = 864e5;
export const YEAR = 365.2425 * DAY;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_NAMES = MONTHS;

const RE = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/;

/** Parse a date string; returns {y,m,d,prec} (m/d may be null) or null if invalid. */
export function parseParts(str) {
  const m = RE.exec(String(str == null ? '' : str).trim());
  if (!m) return null;
  const y = +m[1];
  const mo = m[2] ? +m[2] : null;
  const d = m[3] ? +m[3] : null;
  if (mo !== null && (mo < 1 || mo > 12)) return null;
  return { y, m: mo, d, prec: d ? 'day' : mo ? 'month' : 'year' };
}

/**
 * Position in time (ms). Year/month precision dates are placed in the middle of
 * their period so they do not falsely claim to be on 1 January / the 1st.
 */
export function toTime(str, precision) {
  const p = parseParts(str);
  if (!p) return NaN;
  const prec = precision || p.prec;
  if (prec === 'year') return Date.UTC(p.y, 6, 2);
  if (prec === 'month') return Date.UTC(p.y, (p.m || 1) - 1, 16);
  return Date.UTC(p.y, (p.m || 1) - 1, p.d || 1);
}

/** Start / end instants of the period a (possibly partial) date string covers. */
export function periodStart(str) {
  const p = parseParts(str);
  return p ? Date.UTC(p.y, (p.m || 1) - 1, p.d || 1) : NaN;
}
export function periodEnd(str) {
  const p = parseParts(str);
  if (!p) return NaN;
  if (p.d) return Date.UTC(p.y, p.m - 1, p.d);
  if (p.m) return Date.UTC(p.y, p.m, 0);
  return Date.UTC(p.y, 11, 31);
}

/** Format per precision: "25 Jul 1983", "Dec 1981", "1980". */
export function formatDate(str, precision) {
  const p = parseParts(str);
  if (!p) return str ? String(str) : '';
  const prec = precision || p.prec;
  if (prec === 'year' || !p.m) return String(p.y);
  if (prec === 'month' || !p.d) return `${MONTHS[p.m - 1]} ${p.y}`;
  return `${p.d} ${MONTHS[p.m - 1]} ${p.y}`;
}

/** Same as formatDate but without the year (used inside year-grouped lists). */
export function formatDayMonth(str, precision) {
  const p = parseParts(str);
  if (!p) return '';
  const prec = precision || p.prec;
  if (prec === 'year' || !p.m) return 'Year';
  if (prec === 'month' || !p.d) return MONTHS[p.m - 1];
  return `${p.d} ${MONTHS[p.m - 1]}`;
}

export const yearOf = (t) => new Date(t).getUTCFullYear();
/** Decimal year (e.g. 1983.5) for compact URLs. */
export const toDecimalYear = (t) => { const y = yearOf(t); return y + (t - Date.UTC(y, 0, 1)) / (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1)); };
export const fromDecimalYear = (v) => { const y = Math.floor(v); return Date.UTC(y, 0, 1) + (v - y) * (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1)); };
