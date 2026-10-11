# bubapix

Website for BubaPix, an AI film and animation studio. Plain HTML, CSS and JavaScript, hosted free on GitHub Pages, with a free admin panel for images and projects.

- English: `/bubapix/` (file `index.html`)
- Hebrew: `/bubapix/he/` (file `he/index.html`)
- Admin panel: `/bubapix/admin/`

## Managing images and projects (no code)

The admin panel ([Sveltia CMS](https://github.com/sveltia/sveltia-cms), free, MIT licence) edits `content/site.json` and uploads images to `assets/uploads/`. Every save is a commit in this repository. The workflow `.github/workflows/build-pages.yml` then rebuilds the two pages automatically (free for public repositories).

In the panel you can:

- replace the main image;
- add and remove projects, mark them as featured (shown large, first);
- upload a main image and more images for each project;
- drag projects and images to change their order;
- edit names, short texts, tagline, about text and contact email, in English and Hebrew.

Uploaded photos are converted to WebP and scaled down to at most 2400 px. They are never cropped or enlarged.

### Signing in

1. Create a token on GitHub: **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
   - Repository access: **Only select repositories → bubapix**.
   - Permissions: **Contents: Read and write** (Metadata: read is added automatically).
   - Expiration: choose a date (for example 90 days) and create a new token when it expires.
2. Open the admin panel on **your own site address** and choose **Sign In Using Access Token**. Paste the token.
   Do not use "Sign In with GitHub" (it needs a separate sign-in server that this site does not use).
3. The token is stored only in that browser. Sign out from the panel on shared computers.

Never paste the token into a page on another address (for example a preview service). It is a password for your repository.

### Which branch the panel edits

`admin/config.yml` → `backend.branch`. It is `redesign-v2` while the redesign is being reviewed. Change it to `main` after the redesign is approved and merged.

## Changing interface labels (menu, headings)

Labels live in `src/i18n/en.json` and `src/i18n/he.json`. Edit both, keep the keys the same, run `node build.js` and commit. `build.js` stops with an error if one language is missing a key.

Do not edit `index.html` or `he/index.html` by hand: the next build overwrites them.

## Settings (in `build.js`)

- `url`: the public address of the site. Change it to `https://bubapix.com/` when the domain is connected.

## Free-plan limits (GitHub)

- Repository: recommended up to 1 GB. Published site: up to 1 GB.
- Bandwidth: soft limit of 100 GB per month.
- GitHub Pages is not allowed for online shops or commercial software services; a studio portfolio is fine.

Source: [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

## Files

| Path | Purpose |
|---|---|
| `content/site.json` | Images, project names and short texts (edited in the admin panel) |
| `assets/uploads/` | Images uploaded from the admin panel |
| `assets/work/`, `assets/brand/` | Original poster and logo files |
| `admin/` | Admin panel page and its settings |
| `.github/workflows/build-pages.yml` | Rebuilds the pages after every change |
| `src/template.js` | Page structure, shared by both languages |
| `src/i18n/*.json` | Interface labels, per language |
| `build.js` | Generates the two HTML pages |
| `css/styles.css` | All styles; logical properties serve left-to-right and right-to-left |
| `js/main.js` | Opening fade, language memory |
| `assets/scenes/` | Earlier placeholder artwork, no longer shown (kept until you approve deleting it) |
| `.nojekyll` | Tells GitHub Pages to serve files as they are |
