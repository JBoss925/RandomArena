# Fighter info card style guide

Fighter cards answer two different questions:

1. **Description:** What is this fighter's game plan, and how do its named moves interact?
2. **Info blocks:** What exact, decision-useful numbers should a player remember?

## Description rules

- Write two to four short sentences in plain game language.
- Introduce every named move in Title Case and use that exact name everywhere: description, info blocks, mechanic popups, and tests. Pure sound-effect callouts such as `BLAM!` may remain flavor text rather than move names.
- Explain sequencing, targeting, movement, state changes, and unusual rules here. These belong in prose even when they are strategically important.
- Do not put raw engine measurements in the card. Never expose pixels, ticks, acceleration constants, projectile speed, or force.
- Do not repeat exact numbers from the blocks unless the threshold is essential to explaining the sequence.
- Describe what happens, not how the implementation detects it. Say “a heavy direct hit,” not a force threshold.

## Info block admission rule

An info block must contain a concrete value that a player can visualize or use when making a pick. Appropriate values include damage, healing, duration, cooldown, rotation time, chance, range, count, stacks, health thresholds, percentage modifiers, and finite triggers such as “Every 4th hit.”

Every damage-over-time effect must expose its damage rate per stack (when stackable) and its duration. Permanent damage-over-time effects must say `Permanent` explicitly.

Movement redirection, valid targets, projectile absorption, state transitions, and similar nonnumeric rules belong in the description. A block must not exist merely to restate prose.

## Labels and values

Use the named move first when a number belongs to a move. Keep labels short and use these patterns consistently:

| Concept | Label pattern | Value pattern |
| --- | --- | --- |
| Direct damage | `{Move} damage` | `12 HP` |
| Added damage | `{Move} bonus damage` | `+12 HP` |
| Damage over time | `{Status} damage` | `1.2 HP/s per stack` |
| Healing rate | `{Move} healing` | `4.2 HP/s` |
| Lifesteal | `{Move} healing` | `18% of damage dealt` |
| Duration/window | `{Move} duration` or `{Move} window` | `1.5 seconds` |
| Repeat timing | `{Move} interval` | `2–3 seconds` |
| Recharge | `{Move} recharge` | `4 seconds` |
| Rotation | `{Object} spin` | `2.3 seconds/spin` |
| Stack gain | `{Stack} gained` | `1 per hit` |
| Stack cap | `{Stack} limit` | `5 stacks` |
| Count | `{Object} count` | `12 projectiles` |
| Trigger | `{Move} trigger` | `Every 4th hit`, `At 33 HP`, or `5 Coins` |
| Damage reduction | `{Source} damage reduction` | `26%` |
| Vulnerability | `{Source} vulnerability` | `+30% damage` |
| Penetration/bypass | `{Move} shield penetration` | `50%` |
| Growth/scaling | `{Stat} per {event}` | `+5% per Coin` |

## Formatting rules

- Use `HP`, `HP/s`, `%`, `seconds`, `seconds/spin`, `stacks`, and `projectiles` exactly as shown.
- Prefix additive bonuses and vulnerabilities with `+`; do not prefix ordinary damage or reductions.
- Use an en dash for ranges: `3–4 seconds`, not `3-4 seconds`.
- Prefer one decimal place only when the simulation meaningfully uses it; otherwise use whole numbers.
- Do not combine unrelated stats in one block. Split them unless they are two states of the same rule.
- Order blocks by the fighter's gameplay cycle: setup/trigger, payoff, duration/recharge, then defenses or vulnerabilities.
- Keep the core-stat footer separate. These rules govern the ability description and info-block grid only.

## Icon vocabulary

Use the same icon for the same kind of fact across the roster:

| Icon key | Use |
| --- | --- |
| `damage` | Direct damage, bonus damage, or damage vulnerability |
| `plus` | Healing |
| `clock` | Duration, delay, interval, window, stun, or recharge |
| `rotate` | Rotation time |
| `stack` | Stack or object count and count-based triggers |
| `trend` | Growth, scaling, or percentage gained per event |
| `shield` / `block` | Reduction, penetration, bypass, immunity, or blocking |
| `heart` | HP threshold |
| `projectile` | Projectile count |
| `drop` | Poison-specific modifier |
| `impact` | Contact-based trigger |

The remaining themed icons (`bolt`, `flame`, `snow`, `orbit`, `sword`, `bat`, `thorns`, and others) may replace the generic key when they depict the exact mechanic. Every key must have an explicit SVG in `src/spec-icons.ts`; unknown keys must never silently stand in for a different concept.

## Review checklist

- Every move name matches its popup and behavior terminology.
- Every block passes the admission rule and contains no engine units.
- Damage, healing, timing, stacks, triggers, rotation, defenses, and vulnerabilities use the patterns above.
- The description includes important qualitative behavior omitted from the blocks.
- The same fact is not repeated in both prose and a block without a clear reason.
