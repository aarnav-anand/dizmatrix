# DizMatrix

Draw your field on a map, and DizMatrix checks it against nearby crop-disease
field reports to give you a risk assessment — in English or Hindi.

## How it works

1. **Trace your field.** The map's polygon tool lets you click out your farm's
   boundary corner by corner.
2. **DizMatrix queries Supabase** for `disease_reports` inside a bounding box
   around your field (radius adjustable from 1–50 km).
3. **Each report is scored** on three things:
   - **Distance** — reports inside your boundary count most; farther reports
     taper off toward the edge of your search radius.
   - **Recency** — a report's influence halves roughly every 60 days.
   - **Confidence** — the detection confidence stored on the report.
4. Reports are grouped by crop + disease and turned into a 0–100 risk score
   per disease, plus an overall field score, shown in the sidebar and as
   colour-coded markers on the map (green → amber → red → bright red for
   low → moderate → high → critical).

## Tech stack

- **Vite + React + TypeScript**
- **Leaflet + Leaflet.draw** for the map and polygon drawing tool (OpenStreetMap tiles, no API key required)
- **@supabase/supabase-js** for reading the `disease_reports` table
- **react-i18next** for English/Hindi localization (toggle in the header)

All geospatial math (distance, point-in-polygon, area, bounding boxes) is
hand-rolled in `src/lib/geo.ts` — no extra mapping-math dependency needed.

## Local development

```bash
npm install
npm run dev
```

The app opens at `http://localhost:5173`.

## Configuration

Supabase credentials are read from environment variables, with the project's
own credentials baked in as a fallback so the app runs out of the box:

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://rmohiyytogusbkhmabpb.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

> The `disease_reports` table is read with the public anon key and RLS
> disabled, so it's fully readable from the client. If you later want to
> restrict access, re-enable RLS in Supabase and add a `select` policy.

## Deployment

The app builds to a static site (`dist/`), so it deploys anywhere that
serves static files.

**Vercel** — a `vercel.json` is included. Import the repo in Vercel, or run:

```bash
npm i -g vercel
vercel --prod
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project's
Environment Variables (optional — the app falls back to the built-in values
otherwise).

**Netlify** — set the build command to `npm run build` and the publish
directory to `dist`. Add a `_redirects` file with `/* /index.html 200` if you
add client-side routes later (the current single-page app doesn't need one).

**Any static host** (GitHub Pages, Cloudflare Pages, S3 + CloudFront, etc.) —
run `npm run build` and upload the contents of `dist/`.

## Project structure

```
src/
  components/       UI components (map, sidebar panels, header, legend)
  lib/
    geo.ts          Haversine distance, point-in-polygon, area, bounding box
    risk.ts         Report scoring + risk aggregation
    supabaseClient.ts
  i18n/
    locales/en.json, hi.json
  types.ts          Shared types matching the disease_reports table
```

## Notes on the risk model

This is a heuristic risk *indicator*, not a diagnosis. It highlights where
disease pressure has been reported near a field, weighted by how close, how
recent, and how confident those reports were. Treat it as a scouting
prompt — always confirm suspected disease in person before acting on it.
