import { fighters, getFighter } from "../src/fighters.js";
import { runMatchup } from "./balance-core.js";

// Exploratory only: never overwrites authoritative 500-seed matchup shards.
const ids = process.argv.slice(2),
  runs = Number(process.env.RUNS ?? 30);
for (const id of ids) {
  const fighter = getFighter(id);
  if (!fighter) throw new Error(id);
  let low = 0.1,
    high = 2;
  for (let pass = 0; pass < 7; pass++) {
    fighter.power = (low + high) / 2;
    const scores = fighters
      .filter((f) => f !== fighter)
      .map((opponent) => runMatchup(fighter, opponent, runs).results[id].score);
    const score = scores.reduce((a, b) => a + b, 0) / scores.length;
    console.log(
      id,
      "power",
      fighter.power.toFixed(4),
      "overall",
      (score * 100).toFixed(1),
      "range",
      (Math.min(...scores) * 100).toFixed(1),
      (Math.max(...scores) * 100).toFixed(1),
    );
    if (score > 0.5) high = fighter.power;
    else low = fighter.power;
  }
}
