# Random Arena

A deterministic, frontend-only daily prediction game. Pick the winner of five ball fights and chase a perfect card.

## Run locally

```bash
npm install
npm run dev
```

Production output is generated with `npm run build` and can be deployed directly to Netlify. The game uses a date-derived card seed, per-bout pseudo-random seeds, and a fixed 60 Hz simulation timestep.

All application, physics, and simulation tooling is written in strict TypeScript. Run `npm run typecheck` for a compiler-only validation; `npm run build` runs that check automatically.

## Game modes

- `/daily` uses a locked seed derived from the local calendar date.
- `/endless?seed=YOUR-SEED` accepts any seed and produces a shareable five-bout card.
- `/versus?left=anchor&right=void&seed=YOUR-SEED` is an unlinked 1v1 laboratory with selectable fighters.

Netlify SPA redirects are included in `public/_redirects` so all routes work when opened directly.

## Balance testing

Run `npm run balance` to simulate every unique fighter pairing from both starting sides across 24 seeds per side. The deterministic headless runner uses the production roster, behavior hooks, rotating weapons, fixed timestep, and elastic collision solver without stage hazards.

Results are written to `reports/tier-matrix.json` and `reports/tier-matrix.md`. Override the sample count with `RUNS=100 npm run balance` when a larger study is needed.

`npm run balance:optimize` searches fighter power coefficients with deterministic coordinate descent. For fine tuning around an established roster, use the same production sample set with `RUNS=24 SWEEPS=1 LOCAL_STEP=0.001 npm run balance:optimize`, apply the suggested values in `src/fighters.ts`, then run `npm run balance` to publish the verified matrix to the Versus viewer.

Run `npm run balance:check` before shipping roster changes. It fails if any fighter falls outside 40–60% overall or any individual matchup falls outside the 20–80% counterplay envelope.
