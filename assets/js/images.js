// Image helpers. Every URL from images.json is validated: https only, and the host must be
// wikimedia.org / wikipedia.org (or a subdomain). Anything else is ignored.
import { wikiUrl } from './meta.js';

const HOST_OK = /(^|\.)(wikimedia|wikipedia)\.org$/i;
export function safeUrl(u) {
  try {
    const url = new URL(String(u));
    return url.protocol === 'https:' && HOST_OK.test(url.hostname) ? url.href : null;
  } catch (_) { return null; }
}
const httpsUrl = (u) => { try { const x = new URL(String(u)); return x.protocol === 'https:' ? x.href : null; } catch (_) { return null; } };

/** Validate one images.json entry; returns a clean object or null. */
export function cleanImage(e, isArtist) {
  if (!e || typeof e !== 'object') return null;
  const src = safeUrl(e.src);
  if (!src) return null;
  const out = {
    src, width: +e.width > 0 ? +e.width : 0, height: +e.height > 0 ? +e.height : 0,
    page: safeUrl(e.page),
  };
  if (isArtist) {
    out.file = safeUrl(e.file);
    out.credit = e.credit ? String(e.credit).slice(0, 200) : '';
    out.license = e.license ? String(e.license).slice(0, 80) : '';
    out.licenseUrl = httpsUrl(e.licenseUrl);
  }
  return out;
}

const h = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

/** Create an <img> that removes `removeTarget` (default: itself) if it fails to load. */
export function makeImg(im, alt, cls, maxW, maxH, removeTarget) {
  const img = document.createElement('img');
  img.className = cls || '';
  img.alt = alt;
  img.loading = 'lazy'; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
  if (im.width && im.height) {
    // reserve the box up front so nothing shifts when the image arrives
    const k = Math.min(maxW / im.width, maxH / im.height, 1e6);
    img.width = Math.round(im.width * k); img.height = Math.round(im.height * k);
    img.style.aspectRatio = `${im.width} / ${im.height}`;
  }
  img.src = im.src;
  img.addEventListener('error', () => { (removeTarget || img).remove(); });
  return img;
}

export function link(href, text, cls) {
  const a = h('a', cls || 'ext', text);
  a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
  return a;
}

/** "Photo: credit · license · Wikimedia Commons" with working links. */
export function attribution(im) {
  const p = h('p', 'photo-credit');
  p.appendChild(document.createTextNode('Photo: ' + (im.credit || 'unknown author') + ' · '));
  if (im.license) { p.appendChild(im.licenseUrl ? link(im.licenseUrl, im.license) : document.createTextNode(im.license)); p.appendChild(document.createTextNode(' · ')); }
  p.appendChild(im.file ? link(im.file, 'Wikimedia Commons') : document.createTextNode('Wikimedia Commons'));
  return p;
}

/** Artist photo figure (with attribution). size: 'lg' | 'sm'. Removes itself if the image fails. */
export function photoFigure(artist, size) {
  const im = artist.img;
  if (!im) return null;
  const fig = h('figure', 'photo photo-' + size);
  const [mw, mh] = size === 'lg' ? [380, 260] : [120, 120];
  const img = makeImg(im, artist.name, 'photo-img', mw, mh, fig);
  fig.appendChild(img);
  fig.appendChild(attribution(im));
  return fig;
}

/** Release cover figure (non-free image hotlinked from Wikipedia; links back to the article). */
export function coverFigure(rel) {
  const im = rel.img;
  if (!im) return null;
  const fig = h('figure', 'cover');
  fig.appendChild(makeImg(im, `Cover of ${rel.title}${rel.artist ? ' by ' + rel.artist.name : ''}`, 'cover-img', 240, 240, fig));
  const cap = h('figcaption', 'cover-credit');
  cap.appendChild(im.page ? link(im.page, 'Cover via Wikipedia') : document.createTextNode('Cover via Wikipedia'));
  fig.appendChild(cap);
  return fig;
}

/** Wikipedia link for an item or artist (wiki title, else image page). */
export function wikiLink(thing, label) {
  const href = thing.wiki ? wikiUrl(thing.wiki) : (thing.img && thing.img.page) || null;
  return href ? link(href, label || 'Wikipedia ↗', 'ext wiki-link') : null;
}
