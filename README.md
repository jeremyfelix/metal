# Speed Kills: a heavy metal timeline (1967–1994)

An interactive, static website that charts the history of heavy metal, with the emphasis on thrash. Two views share the same filters and search:

- **Timeline**: a zoomable, pannable swimlane chart. One lane per artist, grouped and colour-coded by genre, release markers by date, and an events track along the top.
- **Chronicle**: a vertical, year-grouped list of everything, comfortable on phones.

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
  state.js              state store and URL-hash (de)serialisation
  filters.js            filter, search and "thrash focus" predicates
  timeline.js           SVG swimlane timeline (zoom, pan, labels, keyboard)
  chronicle.js          year-grouped list view
  panel.js              details drawer / bottom sheet
  controls.js           chips, search box, tabs, theme switch, legend
  theme-init.js         applies the saved theme before first paint
data/                   artists.json, releases.json, events.json  (the real content)
fixtures/               small sample data for development
.github/workflows/      GitHub Pages deployment
```

## Data

The site loads three files from `data/` (all URLs are relative, so it works from a sub-path such as `https://user.github.io/metal/`).

### `artists.json`

```json
{ "id": "slayer", "name": "Slayer", "origin": "Huntington Park, US", "country": "US",
  "formed": "1981", "ended": null, "genre": "thrash", "blurb": "…", "inList": true }
```

- `genre`: `proto`, `punk`, `hard-rock`, `heavy-metal`, `nwobhm`, `thrash` or `death` (unknown values get a neutral "Other" lane group).
- `formed` / `ended`: `YYYY`, `YYYY-MM` or `YYYY-MM-DD`; `ended` may be `null` (the active bar then runs to the end of the axis).
- `inList`: `true` gives the artist a lane. `false` means the artist has no releases and exists only so events can reference it. (An artist with releases always gets a lane.)

### `releases.json`

```json
{ "id": "slayer-reign-in-blood", "title": "Reign in Blood", "listTitle": "Reign in Blood",
  "artistId": "slayer", "date": "1986-10-07", "datePrecision": "day",
  "type": "album", "landmark": true, "note": "…", "dateNote": null }
```

- `type`: `album`, `ep`, `demo`, `live` or `compilation` (changes the marker shape).
- `datePrecision`: `day`, `month` or `year`. It controls how the date is *displayed* (`7 Oct 1986`, `Oct 1986`, `1986`). Month/year dates are placed mid-period on the axis.
- `landmark`: emphasised marker, labelled when there is room.
- `listTitle`: the shorter label drawn on the timeline.
- `dateNote`: shown in the details panel as a subtle "Date note".

### `events.json`

```json
{ "id": "ev-cliff-burton-dies", "date": "1986-09-27", "datePrecision": "day",
  "title": "Cliff Burton dies", "description": "…", "category": "death",
  "artistIds": ["metallica"], "importance": 3 }
```

- `category`: `formation`, `lineup`, `concert`, `death`, `scene`, `industry` or `release`.
- `importance`: `1`–`3`. Higher means a bigger glyph on a higher row; level 3 events get labels first.
- `artistIds`: events that list artists also appear as a small tick on those artists' lanes.

### Adding an album or event

1. Open `data/releases.json` (or `events.json`), copy an existing object, give it a unique `id`, and fill in the fields. The `artistId` must match an artist `id` in `artists.json`.
2. A new band? Add it to `artists.json` first.
3. Reload. Counts in the header update automatically. Missing optional fields are tolerated; entries with an unparseable `date` are skipped with a console warning.

## URL state

Everything shareable is in the hash, e.g. `#hg=punk&tf=1&q=slayer&sel=r:slayer-reign-in-blood&x=1983.00-1988.00` (hidden genres, thrash focus, search, selected item, visible years, `view=chronicle`).

## Keyboard

`Tab` into the timeline, then arrow keys move between marks (left/right within a lane, up/down between lanes), `Enter` opens details, `Esc` closes the panel. With the timeline background focused: arrows pan, `+` / `-` zoom, `0` fits everything. `/` focuses search.

## Deploy to GitHub Pages

1. Push this repository to GitHub (default branch `main`).
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The workflow in `.github/workflows/pages.yml` publishes the repository root on every push to `main` (or run it manually from the Actions tab). `.nojekyll` is included so files are served as-is.
