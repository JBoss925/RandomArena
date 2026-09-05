# Advanced fighter cycles

All timing uses fixed simulation ticks. Rendering and sound use presentation hooks; they never decide damage or consume the combat random stream.

## Corsair — Return to Sender

Cast launches a crescent toward the opponent's position. It ricochets against arena walls and hazards for 0.75 seconds, then Recall steers it toward its moving owner. Each leg can damage a fighter once. The return leg deals more damage, making the owner's movement part of the weapon's attack path. Catch starts the next throw's recovery timer; a lifetime limit prevents an unreachable catch from locking the kit.

The crescent is a separate visible hitbox. It uses swept collision against fighters to avoid tunneling, and its recall tether previews the return path. Backslash penetrates half of a protective bubble, keeping the shield matchup competitive without removing the shield's value.

## Dynamo — Heavy Delivery

Wind Up tracks the opponent for half a second before Dash commits to the last aim direction. One body connection lands Rocket Punch and ends the rush, preventing repeated bonus hits against a pinned opponent. A missed Dash triggers Ground Burst if the opponent is still nearby. Both outcomes brake momentum into Recovery before the next Wind Up. Impact Guard caps ordinary body hits and separately caps large melee hits; its body cap is weaker during Dash. Projectiles and internal status damage bypass both caps.

The glove extends during the dash. A growing windup ring, separate phase sound cues, and burst particles communicate the attack cycle. Rocket Punch gains a bounded bonus against heavier opponents and partially penetrates bubble shields. Weapon damage is amplified before the melee cap, leaving rapid smaller weapon hits dangerous; Poison bypasses the external padding altogether.

## Hourglass — Borrowed Time

Bookmark records position and velocity for a 1.75-second window. Incoming damage charges Time Break. Rewind restores the recorded position with reversed momentum and launches twelve purple Time Shards from the abandoned location. The first shard collision resolves the volley; movement, walls, and hazards can let the opponent escape it. Rewind does not restore HP or erase Poison, Burn, or other status effects.

The visible bookmark and dashed tether telegraph the destination. Time Shards use swept projectile collision and the shared typed damage path, including shield, armor, and retaliation interactions. Their dedicated purple Time damage also drives the health-bar damage animation.

## Verification

`npm test` checks repeated-seed outcomes and the single-punch rule. `npm run balance:fighters -- corsair dynamo hourglass` updates every matchup involving these fighters at the standard 500 seeds per side. `scripts/tune-new-fighters.ts` provides exploratory power sampling without overwriting published shards.

Sound cues are independently editable in `src/sound-map.ts` and reuse the attributed short recordings in `src/sound-sources.ts` alongside generated effects.

## Verified balance

The final assembled report contains 465 pairings at 500 seeds per side (465,000 fights). All 87 pairings involving a new fighter were generated, then every Dynamo pairing was refreshed after each final mechanical adjustment; unchanged old-roster shards were reused.

- Corsair: 56.38% overall.
- Dynamo: 51.09% overall.
- Hourglass: 46.5% overall after converting Time Break to projectile collision.
- Entire roster: 40.9–59.2% overall; all pairings within 20–80%.
- The closest existing matchup to the limit remains Ember / Moss at 79.9% / 20.1%.

These are deterministic sample results, not guarantees for all possible seeds. `npm run balance:check`, `npm test`, and `npm run build` pass. A browser smoke test of the final Dynamo / Lance kit produced no JavaScript errors.
