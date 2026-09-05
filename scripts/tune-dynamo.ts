import { fighters, getFighter } from "../src/fighters.js";
import { rocketBoxerTuning as tuning } from "../src/advanced-behaviors.js";
import { runMatchup } from "./balance-core.js";

// Read-only exploratory sweep; authoritative shards remain untouched.
const runs = Number(process.env.RUNS ?? 30);
const fighter = getFighter("dynamo")!;
const opponents = fighters.filter((f) => f !== fighter);
for (const guard of [8, 10, 12])
  for (const weapon of [0.8, 1]) {
    Object.assign(tuning, {
      guardCap: guard,
      dashGuardCap: guard + 4,
      weaponVulnerability: weapon,
    });
    let low = 0.6,
      high = 1.5;
    for (let i = 0; i < 5; i++) {
      fighter.power = (low + high) / 2;
      const rows = opponents.map((o) => ({
        id: o.id,
        score: runMatchup(fighter, o, runs).results.dynamo.score,
      }));
      const score = rows.reduce((n, r) => n + r.score, 0) / rows.length;
      if (i === 4)
        console.log(
          JSON.stringify({
            guard,
            weapon,
            power: fighter.power,
            score,
            outliers: rows.filter((r) => r.score < 0.2 || r.score > 0.8),
            range: [
              Math.min(...rows.map((r) => r.score)),
              Math.max(...rows.map((r) => r.score)),
            ],
          }),
        );
      if (score > 0.5) high = fighter.power;
      else low = fighter.power;
    }
  }
