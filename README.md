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

Run `npm run balance` to simulate every unique fighter pairing from both starting sides across 500 seeds per side. The deterministic headless runner uses the production roster, behavior hooks, rotating weapons, fixed timestep, and elastic collision solver without stage hazards.

Each pairing is stored independently in `reports/matchups/`, then assembled into `reports/tier-matrix.json`, `reports/tier-matrix.md`, and the public Versus data. This lets unchanged matchup results survive targeted balancing work.

Use the focused commands while tuning:

```bash
npm run balance:matchup -- rook volt
npm run balance:fighter -- rook
npm run balance:fighters -- rook volt bubble mothership
npm run balance:assemble
```

`balance:matchup` replaces one 1,000-fight shard. `balance:fighter` reruns one fighter against the roster. `balance:fighters` reruns every unique pairing involving any listed fighter without duplicating overlaps. Each command rebuilds the aggregate automatically; `balance:assemble` only rebuilds it from existing shards. Set `RUNS` only when intentionally creating a complete alternate sample set, because the assembler rejects mixed shard sizes.

`npm run balance:optimize` searches fighter power coefficients with deterministic coordinate descent. It is an exploratory tool; apply any suggested values in `src/fighters.ts`, then verify changed fighters through the 500-seed targeted commands before publishing the matrix to the Versus viewer.

Run `npm run balance:check` before shipping roster changes. It fails if any fighter falls outside 40–60% overall or any individual matchup falls outside the 20–80% counterplay envelope.

## Sound library

Combat uses semantic sound cues backed by short, locally served CC0 recordings from OpenGameArt, with procedural layers for effects such as brambles and energy drains. Source pages, authors, licenses, and the exact `data-mp3-url` values are recorded in `public/audio/SOURCES.md` and mirrored by the typed manifest in `src/sounds.ts`.

To replace or rebalance an effect, put the audio file in `public/audio/` and edit its cue in `src/sound-map.ts`. Each cue exposes the file path, contextual volume, playback rate, pitch variance, and repeat cooldown. The prettified source manifest in `src/sound-sources.ts` has a second `volume` from 0–1 for correcting the recording's inherent loudness once across every cue that uses it. Source volume, cue volume, event volume, and the player's master volume are multiplied together, followed by the global 0.25 output ceiling in `src/sounds.ts`. New visitors begin at 50% player volume. A missing or unloadable mapped file falls back to a short generated game tone instead of becoming silent. Keep third-party source and license details in `public/audio/SOURCES.md` when adding recordings.
