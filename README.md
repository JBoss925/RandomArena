# Random Arena

A deterministic, frontend-only daily prediction game. Pick the winner of five ball fights and chase a perfect card.

## Run locally

```bash
npm install
npm run dev
```

Production output is generated with `npm run build` and can be deployed directly to Netlify. The game uses a date-derived card seed, per-bout pseudo-random seeds, and a fixed 60 Hz simulation timestep.

## Game modes

- `/daily` uses a locked seed derived from the local calendar date.
- `/endless?seed=YOUR-SEED` accepts any seed and produces a shareable five-bout card.

Netlify SPA redirects are included in `public/_redirects` so both routes work when opened directly.
