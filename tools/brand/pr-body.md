## What changes

The plain `# Title` at the top of the README becomes a generated banner, followed by a row of links to entry points that exist in this repository. **Nothing else in the README changes.** If the line under the title only repeated the banner's tagline word for word, it is removed.

| Added | What it is |
|---|---|
| `docs/brand/banner-{light,dark}.svg` | 1280×400 banner (~30 KB). Text is outlined, so every reader sees the same type. |
| `docs/brand/compact-{light,dark}.svg` | Phone version, served under 600 px wide, where the wide banner's labels would shrink to ~4 px. |
| README block between `brand:start` and `brand:end` | A `<picture>` that picks light or dark and wide or phone, plus the link row. |

## Why

The README is the page people land on. It now shows what the project is and its workflow in one consistent visual system across all 19 portfolio repositories. It links to the code walkthrough, the handoff and the live demo where those exist. It also links to [homenshum.github.io](https://homenshum.github.io/), which gives each project its own indexable page.

## Evidence

- **Rendering on github.com:** checked on a pushed branch. GitHub keeps the `<picture>` media queries and rewrites the relative `srcset` paths. Desktop light and dark load the wide banners (838 px). Phone light and dark load the phone banners (324 px). All four images loaded.
- **Motion contract** (`tools/brand/motion-check.mjs`, real Chromium, `<img>` embed):
  - The first frame is already complete. Nothing animates in, so a frozen or offscreen render still shows the whole banner.
  - Mid-run, a single accent signal runs the steps in order, then settles on the outcome.
  - With `prefers-reduced-motion`, every frame is pixel-identical to the final one.
- **The README injector** (`tools/brand/readme.test.mjs`) passes 8 scenarios:
  - `#` lines inside code fences are left alone.
  - A duplicate subtitle is removed; a different subtitle is kept.
  - Re-running refreshes the block instead of adding a second one.
  - A README with no H1 is an error, not a silent insert.
  - CRLF line endings are preserved.

## To change it

Edit this repository's entry in [`tools/brand/repos.json`](https://github.com/HomenShum/HomenShum.github.io/blob/main/tools/brand/repos.json), rebuild with `npm run brand`, then run `node tools/brand/readme.mjs <this checkout> <Repo>`. Edit there, not here: the block is regenerated.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
