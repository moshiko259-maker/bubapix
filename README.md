# bubapix

Website for BubaPix, an AI film and animation studio. Plain HTML, CSS and JavaScript, hosted free on GitHub Pages.

- English: `/bubapix/` (file `index.html`)
- Hebrew: `/bubapix/he/` (file `he/index.html`)

## Changing text

All wording lives in two files, one per language:

- `src/i18n/en.json` (English)
- `src/i18n/he.json` (Hebrew)

1. Edit the text in **both** files. Keep the keys (the names on the left) the same in both.
2. Run `node build.js` (needs Node.js, which is free).
3. Commit the changed files, including the regenerated `index.html` and `he/index.html`.

`build.js` stops with an error if one language is missing a key the other has.

Do not edit `index.html` or `he/index.html` by hand: the next build overwrites them.

## Settings (in `build.js`)

- `url`: the public address of the site. Change it to `https://bubapix.com/` when the domain is connected.
- `contactEmail`: leave empty until the mailbox exists and has been tested. While it is empty, the page says the contact address is being set up.

## Placeholders to replace

Every image is labelled placeholder artwork, in `assets/scenes/`:

| File | Used in |
|---|---|
| `dusk-sea.svg` | Hero frame (default), process frames, work item 2 |
| `northern-night.svg` | Hero option, final call-to-action background |
| `second-sun.svg` | Hero option, work item 1 (the large one) |
| `forest-morning.svg` | Hero option, work item 3 |
| `snow-valley.svg` | Hero option, work item 4 |
| `desert-noon.svg` | Hero option, work item 5 |

To use real film stills: add them (for example `assets/stills/my-film.jpg`, about 1600×900, under 300 KB), point `src/template.js` and the `work.items` entries in both JSON files at them, then replace the "Film title to come" text and remove the placeholder labels.

## Files

| Path | Purpose |
|---|---|
| `src/template.js` | Page structure, shared by both languages |
| `src/i18n/*.json` | All text, per language |
| `build.js` | Generates the two HTML pages |
| `css/styles.css` | All styles; uses logical properties so one stylesheet serves left-to-right and right-to-left |
| `js/main.js` | Hero frame switcher, mobile menu, language memory |
| `assets/scenes/` | Placeholder artwork |
| `.nojekyll` | Tells GitHub Pages to serve files as they are |
