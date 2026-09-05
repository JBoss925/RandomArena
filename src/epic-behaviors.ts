import { applyDamage } from "./damage.js";
import type {
  Ball,
  Behavior,
  BehaviorContext,
  CombatEvent,
  Point,
  Portal,
  Projectile,
} from "./types.js";

type Dispatch = (
  ball: Ball,
  hook: "modifyIncoming" | "takeHit",
  context: Partial<BehaviorContext>,
) => void;

export function epicBehaviors(dispatch: Dispatch): Record<string, Behavior> {
  function hit(
    c: BehaviorContext,
    damage: number,
    label: string,
    point: Point,
    type: CombatEvent["damageType"] = "physical",
    weapon = false,
  ): void {
    const { ball, rival, sim } = c,
      before = { left: sim.balls[0].hp, right: sim.balls[1].hp };
    const event: CombatEvent = {
      force: damage,
      damage: damage * ball.f.power * ball.powerScale,
      ability: true,
      weapon,
      damageType: type,
    };
    ball.hits++;
    rival.incoming++;
    dispatch(rival, "modifyIncoming", { ...c, rival: ball, event });
    applyDamage(rival, event.damage, event.damageType);
    dispatch(rival, "takeHit", { ...c, rival: ball, event });
    rival.flash = 7;
    sim.lastExchange = {
      tick: sim.ticks,
      source: label,
      before,
      after: { left: sim.balls[0].hp, right: sim.balls[1].hp },
      damageTaken: {
        left: before.left - sim.balls[0].hp,
        right: before.right - sim.balls[1].hp,
      },
    };
    c.showImpact(label, point);
    c.emitParticles(point, {
      count: 14,
      color: ball.f.accent,
      speed: 320,
      gravity: 80,
      kind: type === "electric" ? "bolt" : "star",
      size: 8,
    });
  }
  function placePortal(c: BehaviorContext): void {
    const { ball, sim, random } = c,
      other = ball.portals?.[(ball.portalNextIndex ?? 0) === 0 ? 1 : 0];
    let wall = Math.floor(random() * 4);
    if (other && wall === other.wall)
      wall = (wall + 1 + Math.floor(random() * 3)) % 4;
    const horizontal = wall < 2,
      margin = 105;
    const portal: Portal = horizontal
      ? {
          x: wall === 0 ? 28 : sim.width - 28,
          y: margin + random() * (sim.height - margin - 58),
          nx: wall === 0 ? 1 : -1,
          ny: 0,
          color: (ball.portalNextIndex ?? 0) === 0 ? "#54e7ff" : "#d86cff",
          wall,
        }
      : {
          x: margin + random() * (sim.width - margin * 2),
          y: wall === 2 ? 80 : sim.height - 28,
          nx: 0,
          ny: wall === 2 ? 1 : -1,
          color: (ball.portalNextIndex ?? 0) === 0 ? "#54e7ff" : "#d86cff",
          wall,
        };
    ball.portals ??= [];
    ball.portals[ball.portalNextIndex ?? 0] = portal;
    ball.portalNextIndex = (ball.portalNextIndex ?? 0) === 0 ? 1 : 0;
    ball.portalTransfers = 0;
    c.showImpact(ball.portals.length === 2 ? "LINKED!" : "PORTAL!", portal);
    c.emitParticles(portal, {
      count: 18,
      color: portal.color,
      speed: 220,
      gravity: 0,
      kind: "ring",
      size: 9,
    });
    c.playSound("portalOpen");
    ball.portalPlacementCooldown = ball.portals.length === 2 ? 180 : 70;
  }
  function transferVelocity(
    object: { vx: number; vy: number },
    entry: Portal,
    exit: Portal,
  ): void {
    const tx = -entry.ny,
      ty = entry.nx,
      outTx = -exit.ny,
      outTy = exit.nx;
    const normalSpeed = Math.max(
        80,
        Math.abs(object.vx * entry.nx + object.vy * entry.ny),
      ),
      tangentSpeed = object.vx * tx + object.vy * ty;
    object.vx = exit.nx * normalSpeed + outTx * tangentSpeed;
    object.vy = exit.ny * normalSpeed + outTy * tangentSpeed;
  }
  function canEnter(
    object: Point & { vx: number; vy: number; radius: number },
    portal: Portal,
    padding: number,
  ): boolean {
    const dx = object.x - portal.x,
      dy = object.y - portal.y,
      normal = dx * portal.nx + dy * portal.ny,
      tangent = dx * -portal.ny + dy * portal.nx;
    return (
      normal >= 0 &&
      normal < object.radius + padding &&
      Math.abs(tangent) < 42 + object.radius &&
      Math.abs(object.vx * portal.nx + object.vy * portal.ny) > 20
    );
  }
  function teleportBall(
    c: BehaviorContext,
    target: Ball,
    entry: Portal,
    exit: Portal,
  ): void {
    transferVelocity(target, entry, exit);
    target.x = exit.x + exit.nx * (target.radius + 12);
    target.y = exit.y + exit.ny * (target.radius + 12);
    target.portalCooldown = 14;
    if (target === c.ball) target.portalStrikeFrames = 75;
    c.showImpact("WARP!", exit);
    c.emitParticles(entry, {
      count: 12,
      color: entry.color,
      speed: 190,
      gravity: 0,
      kind: "ring",
      size: 8,
    });
    c.emitParticles(exit, {
      count: 18,
      color: exit.color,
      speed: 250,
      gravity: 0,
      kind: "pixel",
      size: 8,
    });
    c.playSound("portalTravel");
  }
  function teleportProjectile(
    c: BehaviorContext,
    target: Projectile,
    entry: Portal,
    exit: Portal,
  ): void {
    transferVelocity(target, entry, exit);
    target.x = exit.x + exit.nx * (target.radius + 9);
    target.y = exit.y + exit.ny * (target.radius + 9);
    target.previousX = target.x;
    target.previousY = target.y;
    target.portalCooldown = 10;
    c.emitParticles(exit, {
      count: 8,
      color: exit.color,
      speed: 180,
      gravity: 0,
      kind: "pixel",
      size: 6,
    });
    c.playSound("portalTravel", { volume: 0.55, rate: 1.3 });
  }
  const pointSegment = (
    p: Point,
    a: Point,
    b: Point,
  ): { distance: number; point: Point } => {
    const dx = b.x - a.x,
      dy = b.y - a.y,
      t = Math.max(
        0,
        Math.min(
          1,
          ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
        ),
      ),
      point = { x: a.x + dx * t, y: a.y + dy * t };
    return { distance: Math.hypot(p.x - point.x, p.y - point.y), point };
  };
  const crosses = (a: Point, b: Point, c: Point, d: Point): boolean => {
    if (Math.hypot(b.x - a.x, b.y - a.y) < 0.01) return false;
    const turn = (p: Point, q: Point, r: Point) =>
        (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x),
      overlap = (p1: number, p2: number, q1: number, q2: number) =>
        Math.max(Math.min(p1, p2), Math.min(q1, q2)) <=
        Math.min(Math.max(p1, p2), Math.max(q1, q2));
    return (
      overlap(a.x, b.x, c.x, d.x) &&
      overlap(a.y, b.y, c.y, d.y) &&
      turn(a, b, c) * turn(a, b, d) <= 0 &&
      turn(c, d, a) * turn(c, d, b) <= 0
    );
  };
  function shellBurst(
    c: BehaviorContext,
    count: number,
    damage: number,
    coreBurst = false,
  ): void {
    const { ball, sim } = c,
      offset =
        (sim.ticks * 0.137 + (ball.side === "left" ? 0 : 0.21)) % (Math.PI * 2);
    for (let i = 0; i < count; i++) {
      const angle = offset + (i * Math.PI * 2) / count,
        speed = coreBurst ? 880 : 660;
      sim.projectiles.push({
        shooter: ball,
        side: ball.side,
        x: ball.x,
        y: ball.y,
        previousX: ball.x,
        previousY: ball.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: coreBurst ? 6 : 5,
        damage: damage * ball.f.power * ball.powerScale,
        force: coreBurst ? 9 : 6,
        life: coreBurst ? 38 : 28,
        color: coreBurst ? "#ffef9e" : ball.f.accent,
        type: "shellShard",
        dead: false,
        armingFrames: 3,
        rotation: angle,
        spin: 8,
        coreBurst,
      });
    }
  }
  function changeForm(c: BehaviorContext, phase: 2 | 3): void {
    const { ball } = c;
    base(ball);
    ball.nestPhase = phase;
    ball.radius =
      (ball.nestBaseRadius ?? ball.radius) * (phase === 2 ? 0.76 : 0.52);
    ball.mass = ball.f.mass * (phase === 2 ? 0.76 : 0.48);
    ball.angularVelocity = phase === 2 ? 6.2 : 8;
    ball.vx *= phase === 2 ? 1.18 : 1.28;
    ball.vy *= phase === 2 ? 1.18 : 1.28;
    ball.formColor = phase === 2 ? "#e76f51" : "#ffcf4a";
    shellBurst(c, phase === 2 ? 8 : 12, phase === 2 ? 2.2 : 3);
    c.showImpact(phase === 2 ? "SHELL BREAK!" : "CORE EXPOSED!", ball);
    c.emitParticles(ball, {
      count: 28,
      color: phase === 2 ? "#ef9a72" : "#ffe39a",
      speed: 430,
      gravity: 320,
      kind: "debris",
      size: 10,
    });
    c.playSound("shellBreak");
    if (phase === 3) ball.coreCountdown = 180;
  }
  function base(ball: Ball): void {
    ball.nestBaseRadius ??= ball.radius;
    ball.nestPhase ??= 1;
    ball.nestWeaponCooldown ??= 0;
    if (ball.nestPhase === 1 && Math.abs(ball.angularVelocity) < 3.2)
      ball.angularVelocity = ball.angularVelocity < 0 ? -3.2 : 3.2;
  }

  return {
    portalArchitect: {
      tick(c) {
        const { ball, sim } = c;
        ball.portalPlacementCooldown ??= 1;
        ball.portalNextIndex ??= 0;
        ball.portalStrikeFrames = Math.max(
          0,
          (ball.portalStrikeFrames ?? 0) - 1,
        );
        for (const target of sim.balls)
          target.portalCooldown = Math.max(0, (target.portalCooldown ?? 0) - 1);
        for (const p of sim.projectiles)
          p.portalCooldown = Math.max(0, (p.portalCooldown ?? 0) - 1);
        if (--ball.portalPlacementCooldown <= 0) placePortal(c);
        const pair = ball.portals;
        if (pair?.length !== 2 || !pair[0] || !pair[1]) return;
        for (const target of sim.balls) {
          if (target.portalCooldown) continue;
          for (let i = 0; i < 2; i++)
            if (canEnter(target, pair[i], 18)) {
              teleportBall(c, target, pair[i], pair[1 - i]);
              ball.portalTransfers = (ball.portalTransfers ?? 0) + 1;
              break;
            }
        }
        for (const p of sim.projectiles) {
          if (p.dead || p.portalCooldown) continue;
          for (let i = 0; i < 2; i++)
            if (canEnter(p, pair[i], 24)) {
              teleportProjectile(c, p, pair[i], pair[1 - i]);
              ball.portalTransfers = (ball.portalTransfers ?? 0) + 1;
              break;
            }
        }
        if ((ball.portalTransfers ?? 0) >= 6) {
          for (const p of pair)
            c.emitParticles(p, {
              count: 22,
              color: p.color,
              speed: 300,
              gravity: 0,
              kind: "ring",
              size: 11,
            });
          ball.portals = [];
          ball.portalNextIndex = 0;
          ball.portalPlacementCooldown = 160;
          c.showImpact("COLLAPSE!", ball);
          c.playSound("portalCollapse");
        }
      },
      modifyOutgoing({ ball, event }) {
        if ((ball.portalStrikeFrames ?? 0) > 0 && !event.projectile) {
          event.damage += 8 * ball.f.power;
          event.portalStrike = true;
          event.ability = true;
        }
      },
      dealHit({ ball, rival, event, showImpact, emitParticles, playSound }) {
        if (!event.portalStrike) return;
        ball.portalStrikeFrames = 0;
        showImpact("CROSSCUT!", rival);
        emitParticles(rival, {
          count: 20,
          color: "#54e7ff",
          speed: 390,
          gravity: 0,
          kind: "pixel",
          size: 8,
        });
        playSound("portalTravel", { volume: 0.9, rate: 0.8 });
      },
      drawBack({ ball, ctx, sim }) {
        for (const p of ball.portals ?? []) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.atan2(p.ny, p.nx) + Math.PI / 2);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 7;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 13;
          ctx.beginPath();
          ctx.ellipse(0, 0, 36, 11, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.75;
          ctx.beginPath();
          ctx.ellipse(
            0,
            0,
            27 + Math.sin(sim.ticks * 0.15) * 3,
            5,
            0,
            0,
            Math.PI * 2,
          );
          ctx.stroke();
          ctx.restore();
        }
      },
    },
    circuitArchitect: {
      geometryHit(c) {
        const g = c.event.geometry;
        if (!g || g.type !== "wall" || (c.ball.circuitOvercharge ?? 0) > 0)
          return;
        const { ball } = c,
          d = Math.hypot(g.nx, g.ny) || 1,
          node = {
            x: g.x + (g.nx / d) * 8,
            y: g.y + (g.ny / d) * 8,
            nx: g.nx / d,
            ny: g.ny / d,
            born: c.sim.ticks,
          };
        ball.circuitNodes ??= [];
        if (
          ball.circuitNodes.some(
            (n) => Math.hypot(n.x - node.x, n.y - node.y) < 65,
          )
        )
          return;
        if (ball.circuitNodes.length === 3) ball.circuitNodes.shift();
        ball.circuitNodes.push(node);
        ball.circuitVersion = (ball.circuitVersion ?? 0) + 1;
        c.showImpact("PYLON!", node);
        c.emitParticles(node, {
          count: 14,
          color: ball.f.accent,
          speed: 210,
          gravity: 0,
          kind: "bolt",
          size: 8,
        });
        c.playSound("pylonPlace");
        if (ball.circuitNodes.length === 3) {
          ball.circuitOvercharge = 120;
          c.showImpact("OVERCHARGE!", ball);
          c.playSound("arcZap");
        }
      },
      tick(c) {
        const { ball, rival, sim } = c,
          nodes = ball.circuitNodes ?? [];
        if (nodes.length < 2) return;
        const id = `${ball.side}-${ball.circuitVersion ?? 0}`;
        rival.circuitCooldowns ??= {};
        rival.circuitCooldowns[id] = Math.max(
          0,
          (rival.circuitCooldowns[id] ?? 0) - 1,
        );
        const links =
          nodes.length === 3
            ? [
                [0, 1],
                [1, 2],
                [2, 0],
              ]
            : [[0, 1]];
        for (const [ai, bi] of links) {
          const a = nodes[ai],
            b = nodes[bi],
            near = pointSegment(rival, a, b);
          if (near.distance < rival.radius + 5 && !rival.circuitCooldowns[id]) {
            const interruptedCharge = (rival.joustFrames ?? 0) > 0;
            if (interruptedCharge) rival.joustFrames = 0;
            hit(
              c,
              ((ball.circuitOvercharge ?? 0) > 0 ? 5 : 3) +
                (interruptedCharge ? 5 : 0),
              interruptedCharge ? "SHORT CIRCUIT!" : "ARC!",
              near.point,
              "electric",
            );
            rival.stunned += 6;
            rival.circuitCooldowns[id] = 30;
            c.playSound("arcZap");
            break;
          }
          for (const p of sim.projectiles) {
            if (p.dead || (p.chargedNetworks ?? []).includes(id)) continue;
            if (crosses({ x: p.previousX, y: p.previousY }, p, a, b)) {
              p.damage *= 1.25;
              p.force *= 1.15;
              p.electricCharge = true;
              p.color = ball.f.accent;
              p.chargedNetworks = [...(p.chargedNetworks ?? []), id];
              c.showImpact("CHARGED!", p);
              c.emitParticles(p, {
                count: 8,
                color: ball.f.accent,
                speed: 170,
                gravity: 0,
                kind: "bolt",
                size: 6,
              });
              c.playSound("arcZap", { volume: 0.55, rate: 1.35 });
            }
          }
        }
        if ((ball.circuitOvercharge ?? 0) > 0) {
          ball.circuitOvercharge = (ball.circuitOvercharge ?? 0) - 1;
          if (ball.circuitOvercharge === 0) {
            ball.circuitNodes?.shift();
            ball.circuitVersion = (ball.circuitVersion ?? 0) + 1;
            c.showImpact("BURNOUT!", ball);
          }
        }
      },
      drawBack({ ball, ctx, sim }) {
        const nodes = ball.circuitNodes ?? [];
        if (!nodes.length) return;
        ctx.save();
        const hot = (ball.circuitOvercharge ?? 0) > 0;
        ctx.strokeStyle = ball.f.accent;
        ctx.fillStyle = hot ? "#fff6a3" : ball.f.color;
        ctx.lineWidth = hot ? 6 : 3;
        ctx.shadowColor = ball.f.accent;
        ctx.shadowBlur = hot ? 14 : 5;
        const links =
          nodes.length === 3
            ? [
                [0, 1],
                [1, 2],
                [2, 0],
              ]
            : [[0, 1]];
        for (const [a, b] of links) {
          if (!nodes[b]) continue;
          ctx.beginPath();
          ctx.moveTo(nodes[a].x, nodes[a].y);
          ctx.lineTo(nodes[b].x, nodes[b].y);
          ctx.stroke();
        }
        for (const n of nodes) {
          ctx.beginPath();
          ctx.arc(
            n.x,
            n.y,
            9 + Math.sin(sim.ticks * 0.2 + n.born) * 2,
            0,
            Math.PI * 2,
          );
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      },
    },
    nestedArsenal: {
      tick(c) {
        const { ball, rival, sim } = c;
        base(ball);
        ball.nestWeaponCooldown = Math.max(
          0,
          (ball.nestWeaponCooldown ?? 0) - 1,
        );
        if (ball.hp <= 66 && ball.nestPhase === 1) changeForm(c, 2);
        if (ball.hp <= 33 && ball.nestPhase !== 3) changeForm(c, 3);
        if (ball.nestPhase === 1 && !ball.nestWeaponCooldown) {
          const a = ball.angle,
            tip = {
              x: ball.x + Math.cos(a) * (ball.radius + 58),
              y: ball.y + Math.sin(a) * (ball.radius + 58),
            };
          if (
            Math.hypot(tip.x - rival.x, tip.y - rival.y) <
            rival.radius + 20
          ) {
            hit(c, 14, "HAMMER BLOW!", tip, "physical", true);
            const dx = rival.x - ball.x,
              dy = rival.y - ball.y,
              d = Math.hypot(dx, dy) || 1,
              speed = Math.max(820, Math.hypot(rival.vx, rival.vy));
            rival.vx = (dx / d) * speed;
            rival.vy = (dy / d) * speed;
            ball.nestWeaponCooldown = 24;
            c.playSound("rocketPunch");
          }
        }
        if (ball.nestPhase === 2 && !ball.nestWeaponCooldown) {
          for (let i = 0; i < 2; i++) {
            const a = ball.angle + i * Math.PI,
              start = {
                x: ball.x + Math.cos(a) * (ball.radius - 3),
                y: ball.y + Math.sin(a) * (ball.radius - 3),
              },
              end = {
                x: ball.x + Math.cos(a) * (ball.radius + 62),
                y: ball.y + Math.sin(a) * (ball.radius + 62),
              },
              near = pointSegment(rival, start, end);
            if (near.distance < rival.radius + 8) {
              hit(c, 7, "TWIN SLASH!", near.point, "physical", true);
              ball.nestWeaponCooldown = 15;
              c.playSound("sword");
              break;
            }
          }
        }
        if (ball.nestPhase === 3) {
          if (sim.ticks % 3 === 0)
            c.emitParticles(ball, {
              count: 1,
              color: "#ffd75e",
              speed: 65,
              gravity: 0,
              kind: "fire",
              size: 7,
            });
          ball.coreCountdown = Math.max(0, (ball.coreCountdown ?? 180) - 1);
          if (ball.coreCountdown === 0) {
            shellBurst(c, 16, 6, true);
            applyDamage(ball, 8, "explosive");
            ball.coreCountdown = 240;
            ball.visualStates.coreBurst = 28;
            c.showImpact("MELTDOWN!", ball);
            c.emitParticles(ball, {
              count: 36,
              color: "#ffcf4a",
              speed: 520,
              gravity: 0,
              kind: "star",
              size: 11,
            });
            c.playSound("coreBurst");
          }
        }
      },
      beforeMove({ ball }) {
        if (ball.nestPhase === 3) {
          ball.vx *= 1.0015;
          ball.vy *= 1.0015;
        }
      },
      modifyIncoming({ ball, event }) {
        base(ball);
        if (ball.nestPhase === 1) event.damage *= 0.72;
        else if (ball.nestPhase === 3) event.damage *= 1.18;
      },
      drawFront({ ball, ctx, sim }) {
        base(ball);
        if (ball.nestPhase === 1) {
          const a = ball.angle;
          ctx.save();
          ctx.translate(ball.x, ball.y);
          ctx.rotate(a);
          ctx.strokeStyle = "#151515";
          ctx.fillStyle = "#d8b07a";
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(ball.radius * 0.55, 0);
          ctx.lineTo(ball.radius + 52, 0);
          ctx.stroke();
          ctx.fillRect(ball.radius + 38, -19, 31, 38);
          ctx.strokeRect(ball.radius + 38, -19, 31, 38);
          ctx.restore();
        } else if (ball.nestPhase === 2) {
          for (let i = 0; i < 2; i++) {
            const a = ball.angle + i * Math.PI;
            ctx.save();
            ctx.translate(ball.x, ball.y);
            ctx.rotate(a);
            ctx.fillStyle = "#f4f0e5";
            ctx.strokeStyle = "#151515";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(ball.radius - 5, -8);
            ctx.lineTo(ball.radius + 64, 0);
            ctx.lineTo(ball.radius - 5, 8);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }
        } else {
          ctx.save();
          ctx.strokeStyle = "#fff2a8";
          ctx.lineWidth = 5;
          ctx.globalAlpha = 0.65 + 0.3 * Math.sin(sim.ticks * 0.3);
          ctx.beginPath();
          ctx.arc(ball.x, ball.y, ball.radius + 9, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      },
    },
  };
}
