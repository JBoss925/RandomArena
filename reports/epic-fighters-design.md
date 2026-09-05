# Epic fighter cycles

These fighters use deterministic simulation ticks and the bout PRNG only. Their visuals and audio react to simulation events but never feed state back into combat.

## Gatekeeper — Two-Way Street

Gatekeeper builds a linked Portal pair on different arena walls. Fighters and projectiles preserve their speed but redirect along the exit wall. Gatekeeper's own transfer arms Crosscut; six combined transfers collapse the network. This makes positioning unpredictable without making the replay nondeterministic.

## Conductor — Live Circuit

Each distinct wall impact installs a Pylon. Two Pylons create a damaging Arc; three create a temporarily Overcharged Circuit. Arcs interrupt active charges and empower any projectile crossing them, including hostile fire. When Overcharge expires, the oldest Pylon burns out and the network topology changes.

## Matryoshka — Final Form

Matryoshka changes kits at fixed health thresholds. Outer Shell is large, armored, and carries a launching Hammer. Shell Break reveals a smaller Twin Blade form. Core Exposed is tiny, accelerates continuously, and spends its own health on periodic radial Meltdown volleys. Each transformation releases physical shell projectiles rather than applying invisible radius damage.
