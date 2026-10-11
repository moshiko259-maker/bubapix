# bubapix

Website of BubaPix, an AI film and animation studio. Plain HTML, CSS and JavaScript, hosted free on GitHub Pages, with a free admin panel. English and Hebrew (right-to-left) throughout.

| Page | English | Hebrew |
|---|---|---|
| Home | `/` | `/he/` |
| Work, with category filter | `/work/` | `/he/work/` |
| One page per project | `/work/<name>/` | `/he/work/<name>/` |
| Services and process | `/services/` | `/he/services/` |
| About (and team, when added) | `/about/` | `/he/about/` |
| Testimonials (only when there are any) | `/testimonials/` | `/he/testimonials/` |
| Contact | `/contact/` | `/he/contact/` |
| Extra pages | `/pages/<name>/` | `/he/pages/<name>/` |
| Admin panel | `/admin/` | |

## Managing the site (no code)

The admin panel ([Sveltia CMS](https://github.com/sveltia/sveltia-cms), free, MIT licence) edits the files in `content/` and uploads files to `assets/uploads/`.

What you can do there:

- **Projects:** create, edit, duplicate, hide, delete; main image, more images (drag to reorder), video link or short video file, categories, details, order number, "show on the homepage".
- **Homepage:** main image, tagline, short intro.
- **Categories, services, process steps, about text, team, contact details, social links.**
- **Testimonials** (the page appears only when there is at least one) and **extra pages**.
- Every text has an English and a Hebrew field. A missing translation falls back to the other language.

### Drafts, preview and publishing

1. Every change is saved as a **draft** first. The live site does not change.
2. About a minute later a **BubaPix preview** link appears on the draft. It opens the whole site with the draft. It is view-only; never type your token there.
3. Press **Publish** in the panel. The site is rebuilt automatically within a few minutes.

Videos: GitHub is not made for large files. Upload films to YouTube or Vimeo (free) and paste the link. Use the video file field only for short clips (up to 25 MB).

### Signing in (only you can edit)

Saving requires a GitHub account with write access to this repository **and** a personal token. Without both, the admin page cannot change anything.

1. On GitHub: **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
   - Repository access: **Only select repositories → bubapix**.
   - Permissions: **Contents: Read and write** and **Pull requests: Read and write** (drafts use pull requests).
   - Expiration: for example 90 days. Create a new one when it expires.
2. Open the admin panel **on your own site address only** (`moshiko259-maker.github.io/bubapix/admin/`, later `bubapix.com/admin/`). Choose **Sign In Using Access Token** and paste the token. Do not use "Sign In with GitHub" (it needs a sign-in server this site does not use).
3. The token stays in that browser. Sign out on shared computers. Never paste it on any other address, including preview links.

### Which branch the panel edits

`admin/config.yml` → `backend.branch`: `redesign-v2` during the redesign; change to `main` when the redesign is approved and merged.

## Projects (admin: Projects / פרויקטים)

- **New** → type the project name → **Save**. That creates the project and its
  own page at `/work/<name>/`. Everything else is optional.
- Optional parts, shown only when filled in: cover or poster, synopsis, and
  page sections in any order (drag to reorder, "Hide this section" to hide
  without deleting): words from the creators, behind the scenes, image
  gallery, videos, text, details list.
- Each image can have a title and a note (Hebrew and English) and a choice of
  where they appear: hidden, project page only, or also under the image on
  the homepage. "Also show this image in the homepage gallery" adds it there.
- A project with no image yet is not shown anywhere, so nothing appears
  half-finished. "Show on the site" off hides a project without deleting it.
- Pages that stop being shown are never deleted; they turn into a short
  "page not found" notice that search engines ignore.
- Image picking offers only your own uploaded files (stock photo sites are
  turned off). There are no categories.

## Visitor comments, ratings, ideas and consultations

**All four are off by default.** Turn them on in Settings › Visitor
participation, after creating your sign-in for the moderation page.

Visitors can comment on or ask about a project, rate it (1–5 stars), send an
idea (Ideas page) or a private consultation (Contact page). Everything is
stored in a free Supabase project (`bubapix`, Frankfurt) and **nothing is
published before you approve it**.

- Moderate at `/admin/community/` (Hebrew). Sign in with your Supabase account
  (created once in the Supabase dashboard: Authentication → Users → Add user,
  with "Auto Confirm"). Only addresses listed in the `admin_emails` table get
  access; the database itself enforces this.
- Pending / Approved / Rejected / Archive, search, type filter, approve,
  reject, reply on the site, edit text (marked "edited"), delete, and real
  rating numbers. Ratings cannot be changed by anyone.
- Private consultations can never be published (blocked in the database).
  Ideas can be published only if the visitor ticked the consent box.
- Email addresses are kept in a separate table and are never public.
- Spam protection: hidden trap field, minimum fill time, link limit, per-visitor
  and site-wide rate limits, one rating per project per connection. IP
  addresses are not stored, only a keyed one-way hash.
- Free-plan note: a Supabase free project is **paused after 7 days without
  activity**; restore it from the Supabase dashboard (data is kept).
- Code: `js/community.js` (site), `admin/community/` (moderation),
  `supabase/functions/community/` (the only way in), `supabase/migrations/`
  (database rules). The key in `build.js` is the public "anon" key; never put
  the service_role key in this repository.

Testimonials are added in the site admin and are shown only when "The client
approved publishing" and "Show on the site" are both on.

## How the build works

`node build.js` turns `content/` into all pages, in both languages, plus `404.html`, `sitemap.xml` and `robots.txt`. The workflow `.github/workflows/build-pages.yml` runs it automatically:

- on `main`: clean addresses, committed to `main`, published by GitHub Pages;
- on `redesign-v2`: addresses ending in `index.html` (`--preview-links`), so the branch can be viewed on preview hosts;
- on admin drafts (`cms/…` branches): builds into a separate `preview/cms/…` branch and attaches the preview link; that branch is deleted when the draft is published or discarded.

If the free `sharp` library is installed (the workflow installs it), smaller copies of each image are made in `assets/resized/` so phones download less.

Interface labels (menu, headings, buttons) live in `src/i18n/en.json` and `src/i18n/he.json`. Edit both with the same keys; the build stops if one language misses a key. Do not edit the generated `index.html` files by hand.

## Settings (in `build.js`)

- `url`: public address of the site. Change to `https://bubapix.com/` when the domain is connected.
- `analyticsHead`: empty. A free analytics snippet can be pasted here later; nothing is loaded until then.

## Free-plan limits (GitHub)

- Repository: recommended up to 1 GB. Published site: up to 1 GB. Files: up to 100 MB each.
- Bandwidth: soft limit of 100 GB per month.
- Actions: free for public repositories.
- GitHub Pages is not allowed for online shops or commercial software services; a studio portfolio is fine.

Sources: [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), [GitHub Actions billing](https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions).

## Files

| Path | Purpose |
|---|---|
| `content/` | All site content (edited in the admin panel) |
| `assets/uploads/` | Files uploaded in the admin panel |
| `assets/work/`, `assets/brand/` | Original poster and logo files |
| `assets/resized/` | Smaller image copies (generated) |
| `admin/` | Admin panel page and its settings |
| `.github/workflows/build-pages.yml` | Builds pages and draft previews |
| `build.js`, `src/render.js`, `src/images.js`, `src/markdown.js` | The site generator |
| `src/i18n/*.json` | Interface labels per language |
| `css/styles.css`, `js/main.js` | Styles (one file for LTR and RTL) and small scripts |
| `src/template.js` | Previous one-page template, no longer used (kept until you approve deleting it) |
| `assets/scenes/` | Earlier placeholder artwork, no longer shown (kept until you approve deleting it) |
