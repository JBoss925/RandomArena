# Legend fighter cycles

These kits use simulation ticks and the seeded bout PRNG only. Their rendering and audio consume combat state without feeding nondeterministic data back into it.

## Phantom — Second Self

Phantom records a rolling path, then spawns an Afterimage that replays that path from the past. The replay is a temporary offensive hurtbox, while its continued existence arms one defensive Misdirect. The same object therefore creates pressure and an opponent-readable escape window.

## Alchemist — Volatile Theory

Alchemist cycles through three fixed flask types with a seeded starting point. Acid and Tonic Flasks leave persistent pools with opposite incentives. Catalyst Flasks turn nearby pools into damage or healing bursts, making their landing positions matter beyond the initial throw. All flask and pool checks use shared start-of-tick positions so loop order cannot change a result.

## Ronin — One Clean Line

Ronin alternates between vulnerable Focus, a committed Draw Cut, and Recovery. A direct Body Hit during Focus becomes Counter, while weapons and abilities punish the stance. Successful cuts build Resolve toward Final Cut. Counter uses the attacker’s speed, while explicit defenses against linear rams and charges keep the matchup fantasy readable without rerolling base stats.
