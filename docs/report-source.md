# Fighter expansion research source

## Scope

Research focused on the mechanics that make Earclacks fighters readable and surprising, then translated those patterns into deterministic, composable Random Arena kits. The implementation deliberately avoids copying visual identities or exact values.

## Findings

- Earclacks' Weapon Balls are built around one escalating rule per fighter: Sword gains damage, Dagger gains rotation speed, Spear gains reach and damage, Hammer converts rotation speed into damage, and Flask creates persistent damage zones. This makes progression visible during a bout rather than hiding it in base stats.
- Lance is a high-variance mode-switch fighter: negligible default damage, periodically replaced by a fast and invulnerable joust. Its source presentation also pairs the state with a shield symbol, whoosh, and cleave sound.
- Grower changes its physical size on rebounds. The larger hitbox increases contact pressure but is explicitly documented as a weakness against weapons and trapping effects.
- Flail owns an independently moving weapon head whose direction is difficult to predict. Successful head hits increase both its damage and its size, while opponents can still get inside its effective arc.
- Boomerang demonstrates another recurring design pattern: infrequent, spatially legible attacks that scale only when the special object—not the body—connects.

## Design translation

- **Lance / TILT AT FATE:** deterministic lead targeting with a seeded wobble, a committed 1,220 px/s charge, temporary immunity, low neutral damage, joust scaling, and a high-speed brace. Loose ability objects bypass its conventional guard to preserve counterplay.
- **Grower / NO ROOM LEFT:** its real physics radius grows on wall rebounds and body connections, capped at 155% of its starting radius. Damage does not scale with size, preserving the source mechanic's key downside.
- **Flail / LOOSE CANNON:** a separate chained collision head rotates at a seeded 7.2–10 rad/s with deterministic modulation. Head hits grow damage and hitbox size; body damage remains deliberately poor.
- **Polar / FIELD REVERSAL:** an original roster-gap concept. Attraction and repulsion alternate after direct hits. The force is deterministic and isolated to this composable behavior; its magnetic field takes extra damage from projectiles and loose ability objects.

## Balance method

The production headless simulation runs every unique pairing from both sides with 24 deterministic seeds per side. The committed matrix covers 13,248 fights across 276 pairings. Acceptance targets are 40–60% overall score and no matchup beyond 80/20.

## Sources

- [Earclacks Weapon Balls overview](https://earclacks-fighting.fandom.com/wiki/Weapon_Ball)
- [Lance](https://earclacks-fighting.fandom.com/wiki/Lance)
- [Grower](https://earclacks-fighting.fandom.com/wiki/Grower)
- [Flail](https://earclacks-fighting.fandom.com/wiki/Flail)
- [Boomerang](https://earclacks-fighting.fandom.com/wiki/Boomerang)
- [Official Earclacks game and archive overview](https://www.earclacks.com/)
- [OpenGameArt: Swishes Sound Pack (CC0)](https://opengameart.org/content/swishes-sound-pack)
- [OpenGameArt: Mechanical Sounds (CC0)](https://opengameart.org/content/mechanical-sounds)
