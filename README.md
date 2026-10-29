# Ad Watch

A demo dashboard: Google ads from 19 direct-to-consumer brands, in a fast filterable table with linked charts.
Built with Angular and TypeScript by [Ashith Prakas](https://ashithprakas.github.io).

**Live demo:** https://ashithprakas.github.io/ad-watch-demo/

## What it shows

- A one-sentence summary that updates with the filters.
- **Ads per brand, by format** (text, image, video) as stacked bars. Click a brand to filter everything else.
- **New ads started per week** over the last 26 weeks, with a hover tooltip.
- A table of every ad: sortable, with column filters, quick search, links to Google's own page for each ad, and
  CSV export. Each chart also has a "chart data as table" view.
- Light and dark themes, keyboard focus on the bars, and reduced-motion support.

## The data

`public/data/ads.json` is a single snapshot: **4,687 ads, 19 brands, US, fetched 2026-10-27**, collected with the
author's Google Ads Transparency scraper. It holds derived fields only (brand, format, first and last date shown,
and a link to Google's Ads Transparency Center page for each ad). No ad images or video are copied.

Limits, stated plainly:
- One snapshot, so there is no "what changed since last time" and no live feed.
- Counts reflect what Google's Transparency Center showed on the snapshot date. They are not a complete record of
  any brand's advertising.
- The "stress test" switch pads the table with synthetic copies of the real rows (up to 10,000) to show grid
  speed. It is labelled on the page, and the counts shown while it is on are not real.
- Brand names only label the data. This project is not affiliated with, or endorsed by, any brand or Google.

## Run it

```bash
npm install
npm start          # http://localhost:4200
npm test           # unit tests for the filtering and counting logic
npm run build      # static build in dist/ad-watch/browser
```

For GitHub Pages under a repo path: `npx ng build --base-href /ad-watch-demo/`.

## How it is built

- Angular 22 (standalone components, signals, strict TypeScript).
- [AG Grid Community](https://www.ag-grid.com/) for the table, with only the modules it needs registered.
- Charts are hand-written SVG, so there is no chart library.
- The filtering, counting and weekly bucketing live in `src/app/ads-logic.ts`, free of Angular and the DOM, and are
  covered by 17 unit tests.
- One font family (IBM Plex Sans, self-hosted through `@fontsource`). The three format colours were checked for
  colour-blind separation and contrast in light and dark; aqua is below 3:1 on the light background, so every chart
  has direct labels and a table view.

## Measured

On a production build, in one local browser (not a benchmark):
- 238 kB transferred (995 kB raw).
- 4,687 rows loaded into the grid in roughly 50 ms, with about 24 row elements in the page at a time (virtual scrolling).
- Switching between 4,687 and 10,000 rows produced no main-thread task over 50 ms.

Not measured: low-end devices, slow networks, other browsers.
