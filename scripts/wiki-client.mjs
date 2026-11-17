// Minimal, polite Wikimedia API client: sequential, cached, retrying. No dependencies (Node 18+).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

export const USER_AGENT = "metal-timeline-build/1.0 (static site image index)";
const DELAY_MS = 1500;

// Node's built-in fetch only honours HTTPS_PROXY when NODE_USE_ENV_PROXY=1; re-run ourselves once with it set.
export function ensureEnvProxy() {
  if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
    const r = spawnSync(process.execPath, ["--no-warnings", ...process.argv.slice(1)],
      { stdio: "inherit", env: { ...process.env, NODE_USE_ENV_PROXY: "1" } });
    process.exit(r.status ?? 1);
  }
}

const cacheDir = process.env.WIKI_CACHE_DIR || path.join(os.tmpdir(), "metal-wiki-cache");
fs.mkdirSync(cacheDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastRequest = 0;

export async function api(host, params) {
  const p = { format: "json", formatversion: "2", ...params };
  const qs = Object.keys(p).sort().map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(p[k])}`).join("&");
  const key = crypto.createHash("sha1").update(host + "?" + qs).digest("hex");
  const file = path.join(cacheDir, key + ".json");
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  const url = `https://${host}/w/api.php?${qs}`;
  let lastErr;
  for (let attempt = 0; attempt < 6; attempt++) {
    const wait = lastRequest + DELAY_MS - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept": "application/json" } });
      lastRequest = Date.now();
      if (res.status === 429 || res.status >= 500) {
        const ra = Number(res.headers.get("retry-after"));
        lastErr = new Error(`HTTP ${res.status}`);
        await sleep(Math.max(ra ? ra * 1000 : 0, 2000 * 2 ** attempt));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const json = await res.json();
      fs.writeFileSync(file, JSON.stringify(json));
      return json;
    } catch (e) {
      lastErr = e;
      lastRequest = Date.now();
      await sleep(2000 * 2 ** attempt);
    }
  }
  throw lastErr;
}

export const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

// Resolve input titles through the normalized/redirects maps of a formatversion=2 response.
export function resolveTitles(responses, title) {
  let t = title;
  for (const r of responses) {
    for (const n of r.query?.normalized ?? []) if (n.from === t) { t = n.to; break; }
    for (const n of r.query?.redirects ?? []) if (n.from === t) { t = n.to; break; }
  }
  return t;
}
export const pageUrl = (title) => "https://en.wikipedia.org/wiki/" + encodeURIComponent(title.replace(/ /g, "_")).replace(/%2F/g, "/").replace(/%3A/g, ":").replace(/%28/g, "(").replace(/%29/g, ")").replace(/%2C/g, ",");
