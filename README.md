# Speed Kills: a heavy metal timeline (1967–1994)

An interactive, static website that charts the history of heavy metal, with the emphasis on thrash. Three views (the first two share the same filters and search):

- **Timeline**: a zoomable, pannable swimlane chart. One lane per artist, grouped and color-coded by genre, release markers by date, and an events track along the top.
- **Chronicle**: a vertical, year-grouped list of everything, comfortable on phones.
- **Playlists**: curated lists from `data/playlists.json`, plus your own (saved in this browser only), with share links and "listen on" search links.

Plain HTML, CSS and vanilla ES modules. No build step, no npm dependencies, no CDN libraries. (The page optionally requests Google Fonts; it falls back to system fonts if that is blocked.)

## Run locally

Browsers will not `fetch()` JSON from `file://`, so serve the folder:

```sh
python3 -m http.server 8000
# open http://localhost:8000/
```

To develop against the small sample data in `fixtures/` instead of `data/`:

```
http://localhost:8000/?data=fixtures/
```

(`?data=` accepts relative paths only.)

## Project layout

```
index.html              page shell
assets/css/             tokens.css (design tokens, themes), app.css, timeline.css, panel.css
assets/js/
  main.js               entry: wiring, URL hash sync, global keys
  data.js               fetch + normalise the three JSON files
  dates.js              date parsing/formatting (YYYY, YYYY-MM, YYYY-MM-DD)
  meta.js               genre/category/type metadata, marker geometry
  state.js              state store and URL-hash (de)serialization
  filters.js            filter, search and "thrash focus" predicates
  timeline.js           SVG swimlane timeline (zoom, pan, labels, keyboard)
  chronicle.js          year-grouped list view
  panel.js              details drawer / bottom sheet
  images.js             image URL validation, attribution, cover/photo elements
  controls.js           chips, search box, tabs, theme switch, legend, image credits
  theme-init.js         applies the saved theme before first paint
data/                   artists.json, releases.json, events.json  (the real content)
fixtures/               small sample data for development (incl. a placeholder images.json)
scripts/                data tooling (generators, validate-data.mjs, fetch-images.mjs)
.github/workflows/      GitHub Pages deployment
```

## Data

The site loads three files from `data/` (all URLs are relative, so it works from a sub-path such as `https://user.github.io/metal/`).

### `artists.json`

```json
{ "id": "slayer", "name": "Slayer", "origin": "Huntington Park, US", "country": "US",
  "formed": "1981", "ended": null, "genre": "thrash", "blurb": "…", "inList": true }
```

- `genre`: `proto`, `hard-rock`, `punk`, `heavy-metal`, `nwobhm`, `thrash`, `death` or `extreme` (shown as "Black / grind"). Unknown values get a neutral "Other" lane group.
- `wiki`: English Wikipedia article title, or `null`. Used for the "Wikipedia" link in panels.
- `formed` / `ended`: `YYYY`, `YYYY-MM` or `YYYY-MM-DD`; `ended` may be `null` (the active bar then runs to the end of the axis).
- `inList`: the artist has releases in the owner's personal list. **Lanes are shown for any artist that has at least one release**, whatever this flag says; artists without releases exist only so events can reference them.

### `releases.json`

```json
{ "id": "slayer-reign-in-blood", "title": "Reign in Blood", "listTitle": "Reign in Blood",
  "artistId": "slayer", "date": "1986-10-07", "datePrecision": "day",
  "type": "album", "landmark": true, "note": "…", "dateNote": null }
```

- `type`: `album`, `ep`, `demo`, `live` or `compilation` (changes the marker shape).
- `datePrecision`: `day`, `month` or `year`. It controls how the date is *displayed* in US style (`Oct 7, 1986`, `Oct 1986`, `1986`). Month/year dates are placed mid-period on the axis.
- `landmark`: emphasized marker, labeled when there is room.
- `listTitle`: the shorter label drawn on the timeline.
- `dateNote`: shown in the details panel as a subtle "Date note".
- `inList`: `true` = from the owner's personal album list, `false` = added for context (then `listTitle` may be `null`; the full title is used on the timeline). A missing flag counts as `true`. The **My list only** toggle hides the added ones.
- `wiki`: English Wikipedia article title for the album, or `null`.

### `events.json`

```json
{ "id": "ev-cliff-burton-dies", "date": "1986-09-27", "datePrecision": "day",
  "title": "Cliff Burton dies", "description": "…", "category": "death",
  "artistIds": ["metallica"], "importance": 3 }
```

- `category`: `formation`, `lineup`, `concert`, `death`, `scene`, `industry`, `release` or `world`. `world` marks real-world events outside music (politics, war, disasters, film, books) that shaped metal; they get their own "World" row above the music events, are never dimmed by Thrash focus, and normally have an empty `artistIds`.
- `importance`: `1`–`3`. Higher means a bigger glyph on a higher row; level 3 events get labels first.
- `artistIds`: events that list artists also appear as a small tick on those artists' lanes.

### `images.json` (optional)

Generated, not hand-written; the site works without it (and tolerates missing entries).

```json
{ "generated": "2026-11-17",
  "artists":  { "slayer": { "src": "https://upload.wikimedia.org/…/480px-….jpg", "width": 480, "height": 320,
                            "page": "https://en.wikipedia.org/wiki/Slayer", "file": "https://commons.wikimedia.org/wiki/File:….jpg",
                            "credit": "Author Name", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/" } },
  "releases": { "slayer-reign-in-blood": { "src": "https://upload.wikimedia.org/…", "width": 250, "height": 250,
                                           "page": "https://en.wikipedia.org/wiki/Reign_in_Blood" } } }
```

Regenerate it (network access to Wikipedia/Commons required) with:

```sh
node scripts/fetch-images.mjs
```

**Image rules the site enforces**
- Only `https:` URLs whose host ends in `wikimedia.org` or `wikipedia.org` are used; anything else is ignored.
- Images use `loading="lazy"`, `decoding="async"` and `referrerpolicy="no-referrer"`. If one fails to load it is removed entirely (no broken-image icons).
- Artist photos are free-licensed Commons files and are always shown with an attribution line ("Photo: author · license · Wikimedia Commons", each linking to its source). All of them are listed in the **Image credits** section at the bottom of the page.
- Album covers are non-free images. They are **hotlinked from Wikipedia, never copied into this repository**, link back to their article, and remain the property of their rights holders.

### `playlists.json` (optional)

Curated playlists shown under "From Speed Kills". If the file is missing the section is simply not shown.

```json
[ { "id": "roots-of-thrash", "title": "Roots of Thrash", "description": "…",
    "items": [ { "releaseId": "black-sabbath-black-sabbath", "note": "The tritone riff that started it." },
               { "releaseId": "slayer-reign-in-blood", "note": null } ] } ]
```

To add a curated playlist, append an object with a unique `id` and its `items` in listening order. `releaseId` must match a release `id`; items that do not resolve are ignored, and a playlist with no valid items is hidden.

### Adding an album or event

1. Open `data/releases.json` (or `events.json`), copy an existing object, give it a unique `id`, and fill in the fields. The `artistId` must match an artist `id` in `artists.json`.
2. A new band? Add it to `artists.json` first.
3. Reload. Counts in the header update automatically. Missing optional fields are tolerated; entries with an unparseable `date` are skipped with a console warning.

## URL state

Everything shareable is in the hash, e.g. `#hg=punk&cg=nwobhm&ol=1&tf=1&q=slayer&sel=r:slayer-reign-in-blood&x=1983.00-1988.00` (hidden genres, collapsed genre groups, My list only, thrash focus, search, selected item, visible years, `view=chronicle` or `view=playlists`, plus `pl=` open playlist, `hl=` highlighted playlist and `sh=` shared playlist).

## Using the timeline at scale

Genre groups collapse (click or press Enter on a group header; **Collapse all / Expand all** in the toolbar). A collapsed group becomes one thin row with all of that genre's releases compressed onto it, so the shape of the era stays visible. The era buttons re-expand the relevant group. Lanes within a group are ordered by first release date. At full zoom the events track hides the lowest-importance events that cannot fit; zoom in to reveal them.

## Playlists

- **Curated lists** come from `playlists.json`. Open one to see its releases in order with covers, notes and "listen on" links. **Duplicate** makes an editable copy.
- **Your playlists are saved in this browser only** (`localStorage`, key `speedkills:playlists:v1`). They are not synced anywhere; clearing site data removes them. If storage is blocked the site still works and says so: lists then last only for the session. Use **Copy share link** to keep or send one.
- Add a release from its details panel with **Add to playlist** (pick a list or create one inline). In a personal list you can rename, remove items, reorder (drag on desktop, or the up/down buttons) and delete (with an inline confirmation).
- **Share links** encode the title and release ids in the URL hash (`#view=playlists&sh=Title~id1,id2,...`, at most 60 items, no notes). Opening one shows the list read-only with **Save to my playlists**. Everything parsed from the hash is validated: unknown ids are dropped, titles are length-capped, and text is only ever inserted as text.
- **Show on timeline** dims everything except the playlist's releases, draws a thin numbered dashed path through them in order, and shows a banner with **Clear** (`hl=` in the hash).
- **Copy as text** copies lines like `Artist – Album (Year)`; if the clipboard is unavailable a text box is selected for manual copying.
- **Listen on** links open a search for "artist title" on Spotify, Apple Music and YouTube Music in a new tab. They are plain search links, not integrations.

## Keyboard

`Tab` into the timeline, then arrow keys move between marks (left/right within a lane, up/down between lanes), `Enter` opens details, `Esc` closes the panel. With the timeline background focused: arrows pan, `+` / `-` zoom, `0` fits everything. `/` focuses search.

## Deploy to GitHub Pages

1. Push this repository to GitHub (default branch `main`).
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The workflow in `.github/workflows/pages.yml` publishes the repository root on every push to `main` (or run it manually from the Actions tab). `.nojekyll` is included so files are served as-is.
