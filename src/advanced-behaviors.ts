import { applyDamage } from "./damage.js";
import type { Behavior, BehaviorContext, CombatEvent, Point } from "./types.js";

type Dispatch = (
  ball: BehaviorContext["ball"],
  hook: "modifyIncoming" | "takeHit",
  context: Partial<BehaviorContext>,
) => void;

// Shared tunables: exploratory runners can vary these without editing the kit.
export const rocketBoxerTuning = {
  guardCap: 12,
  dashGuardCap: 16,
  weaponVulnerability: 1.3,
  punchDamage: 22,
  heavyweightBonus: 20,
  shieldPenetration: 0.5,
  meleeDamageCap: 20,
};

// These kits own their attack cycles; all damage still traverses defender hooks.
export function advancedBehaviors(
  dispatch: Dispatch,
): Record<string, Behavior> {
  function strike(
    c: BehaviorContext,
    damage: number,
    label: string,
    point: Point,
    type: CombatEvent["damageType"] = "physical",
  ): void {
    const { ball, rival, sim } = c,
      before = { left: sim.balls[0].hp, right: sim.balls[1].hp };
    const event: CombatEvent = {
      force: 10,
      damage: damage * ball.f.power,
      ability: true,
      damageType: type,
      shieldPenetration: label === "BACKSLASH!" ? 0.5 : undefined,
    };
    rival.incoming++;
    ball.hits++;
    dispatch(rival, "modifyIncoming", { ...c, rival: ball, event });
    applyDamage(rival, event.damage, event.damageType);
    dispatch(rival, "takeHit", { ...c, rival: ball, event });
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
    rival.flash = 7;
    c.showImpact(label, point);
    c.emitParticles(point, {
      count: 16,
      color: ball.f.accent,
      speed: 340,
      gravity: 120,
      kind: type === "echo" ? "ring" : "star",
      size: 8,
    });
  }
  const ring = (
    c: BehaviorContext,
    p: Point,
    r: number,
    color: string,
  ): void => {
    c.ctx.save();
    c.ctx.strokeStyle = color;
    c.ctx.lineWidth = 4;
    c.ctx.beginPath();
    c.ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    c.ctx.stroke();
    c.ctx.restore();
  };
  return {
    crescentRaider: {
      tick(c) {
        const { ball, rival, sim } = c;
        ball.crescentCooldown ??= 45;
        if (!ball.crescent) {
          if (ball.frozen || ball.stunned) return;
          if (--ball.crescentCooldown > 0) return;
          const a = Math.atan2(rival.y - ball.y, rival.x - ball.x);
          ball.crescent = {
            x: ball.x,
            y: ball.y,
            vx: Math.cos(a) * 760,
            vy: Math.sin(a) * 760,
            age: 0,
            returning: false,
            outHit: false,
            backHit: false,
          };
          c.showImpact("CAST!", ball);
          c.playSound("crescentCast");
        }
        const w = ball.crescent,
          old = { x: w.x, y: w.y };
        w.age++;
        if (w.age === 45) {
          w.returning = true;
          c.showImpact("RECALL!", w);
          c.playSound("crescentRecall");
        }
        if (w.returning) {
          const dx = ball.x - w.x,
            dy = ball.y - w.y,
            d = Math.hypot(dx, dy) || 1;
          w.vx = (dx / d) * 950;
          w.vy = (dy / d) * 950;
        }
        w.x += w.vx / 60;
        w.y += w.vy / 60;
        if (!w.returning) {
          if (w.x < 42 || w.x > sim.width - 42) {
            w.x = Math.max(42, Math.min(sim.width - 42, w.x));
            w.vx *= -1;
            c.playSound("sword");
          }
          if (w.y < 94 || w.y > sim.height - 42) {
            w.y = Math.max(94, Math.min(sim.height - 42, w.y));
            w.vy *= -1;
            c.playSound("sword");
          }
          for (const h of sim.hazards) {
            const dx = w.x - h.x,
              dy = w.y - h.y,
              d = Math.hypot(dx, dy) || 1;
            if (d < h.r + 14) {
              const dot = (w.vx * dx) / d + (w.vy * dy) / d;
              w.x = h.x + (dx / d) * (h.r + 14);
              w.y = h.y + (dy / d) * (h.r + 14);
              if (dot < 0) {
                w.vx -= (2 * dot * dx) / d;
                w.vy -= (2 * dot * dy) / d;
                c.playSound("sword");
              }
            }
          }
        }
        const dx = w.x - old.x,
          dy = w.y - old.y,
          t = Math.max(
            0,
            Math.min(
              1,
              ((rival.x - old.x) * dx + (rival.y - old.y) * dy) /
                (dx * dx + dy * dy || 1),
            ),
          );
        if (
          Math.hypot(old.x + dx * t - rival.x, old.y + dy * t - rival.y) <
            rival.radius + 16 &&
          !(w.returning ? w.backHit : w.outHit)
        ) {
          strike(
            c,
            w.returning ? 17 : 10,
            w.returning ? "BACKSLASH!" : "CRESCENT!",
            w,
          );
          c.playSound("crescentHit");
          if (w.returning) w.backHit = true;
          else w.outHit = true;
        }
        if (
          (w.returning &&
            Math.hypot(w.x - ball.x, w.y - ball.y) < ball.radius + 12) ||
          w.age > 160
        ) {
          ball.crescent = undefined;
          ball.crescentCooldown = 85;
          c.playSound("crescentCatch");
        }
      },
      drawFront(c) {
        const { ball, ctx, sim } = c,
          w = ball.crescent;
        const p = w ?? { x: ball.x + ball.radius * 0.65, y: ball.y };
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(w ? sim.ticks * 0.32 : ball.angle);
        ctx.fillStyle = ball.f.accent;
        ctx.strokeStyle = "#151515";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-9, -25);
        ctx.quadraticCurveTo(39, 0, -9, 25);
        ctx.quadraticCurveTo(12, 0, -9, -25);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        if (w?.returning) {
          ctx.save();
          ctx.strokeStyle = ball.f.accent;
          ctx.globalAlpha = 0.35;
          ctx.setLineDash([5, 9]);
          ctx.beginPath();
          ctx.moveTo(w.x, w.y);
          ctx.lineTo(ball.x, ball.y);
          ctx.stroke();
          ctx.restore();
        }
      },
    },
    rocketBoxer: {
      modifyIncoming({ ball, event }) {
        if (!event.projectile && !event.weapon && !event.ability) {
          const cap =
            ball.rocket?.phase === "dash"
              ? rocketBoxerTuning.dashGuardCap
              : rocketBoxerTuning.guardCap;
          event.rocketGuard = event.damage > cap;
          event.damage = Math.min(event.damage, cap);
        }
        if (event.projectile || event.weapon)
          event.damage *= rocketBoxerTuning.weaponVulnerability;
        if (
          event.weapon &&
          !event.projectile &&
          event.damage > rocketBoxerTuning.meleeDamageCap
        ) {
          event.damage = rocketBoxerTuning.meleeDamageCap;
          event.rocketGuard = true;
        }
      },
      takeHit(c) {
        if (!c.event.rocketGuard) return;
        c.ball.visualStates.boxerGuard = 12;
        c.emitParticles(c.ball, {
          count: 6,
          color: c.ball.f.accent,
          speed: 130,
          kind: "ring",
          size: 7,
        });
        c.playSound("materialSoft");
      },
      draw(c) {
        if ((c.ball.visualStates.boxerGuard ?? 0) > 0)
          ring(c, c.ball, c.ball.radius + 7, c.ball.f.accent);
      },
      tick(c) {
        const { ball, rival } = c;
        ball.rocketCooldown ??= 55;
        if (!ball.rocket) {
          if (ball.frozen || ball.stunned || --ball.rocketCooldown > 0) return;
          ball.rocket = {
            phase: "windup",
            frames: 30,
            angle: Math.atan2(rival.y - ball.y, rival.x - ball.x),
            hit: false,
          };
          c.showImpact("WIND UP!", ball);
          c.playSound("rocketWindup");
        }
        const r = ball.rocket;
        if (r.phase === "windup") {
          if (ball.frozen || ball.stunned) return;
          r.angle = Math.atan2(rival.y - ball.y, rival.x - ball.x);
          if (--r.frames <= 0) {
            r.phase = "dash";
            r.frames = 28;
            ball.vx = Math.cos(r.angle) * 1250;
            ball.vy = Math.sin(r.angle) * 1250;
            c.showImpact("DASH!", ball);
            c.playSound("rocketPunch");
          }
        } else if (r.phase === "dash") {
          if (--r.frames <= 0) {
            r.phase = "recovery";
            r.frames = 30;
            ball.vx *= 0.45;
            ball.vy *= 0.45;
            if (!r.hit) {
              if (
                Math.hypot(rival.x - ball.x, rival.y - ball.y) <
                ball.radius + rival.radius + 65
              )
                strike(c, 13, "GROUND BURST!", ball, "explosive");
              ball.visualStates.rocketBurst = 24;
              c.playSound("rocketBurst");
              c.emitParticles(ball, {
                count: 24,
                color: ball.f.accent,
                speed: 400,
                gravity: 100,
                kind: "bolt",
                size: 9,
              });
            }
          }
        } else if (--r.frames <= 0) {
          ball.rocket = undefined;
          ball.rocketCooldown = 110;
        }
      },
      modifyOutgoing({ ball, rival, event }) {
        if (
          ball.rocket?.phase === "dash" &&
          !ball.rocket.hit &&
          !event.projectile &&
          !event.weapon
        ) {
          const heavyweightBonus = Math.min(
            12,
            Math.max(0, (rival.mass ?? rival.f.mass) - ball.f.mass) *
              rocketBoxerTuning.heavyweightBonus,
          );
          event.damage +=
            (rocketBoxerTuning.punchDamage + heavyweightBonus) * ball.f.power;
          event.shieldPenetration = rocketBoxerTuning.shieldPenetration;
          event.ability = true;
        }
      },
      dealHit(c) {
        const r = c.ball.rocket;
        if (r?.phase !== "dash" || r.hit) return;
        r.hit = true;
        r.phase = "recovery";
        r.frames = 30;
        c.ball.vx *= 0.45;
        c.ball.vy *= 0.45;
        c.showImpact("ROCKET PUNCH!", c.rival);
        c.playSound("rocketPunch");
        c.emitParticles(c.rival, {
          count: 24,
          color: c.ball.f.accent,
          speed: 440,
          kind: "star",
          size: 10,
        });
      },
      drawFront(c) {
        const { ball, ctx } = c,
          r = ball.rocket,
          a = r?.angle ?? ball.angle,
          d = ball.radius + (r?.phase === "dash" ? 34 : 6);
        ctx.save();
        ctx.translate(ball.x + Math.cos(a) * d, ball.y + Math.sin(a) * d);
        ctx.rotate(a);
        ctx.fillStyle = ball.f.accent;
        ctx.strokeStyle = "#151515";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.roundRect(-14, -19, 38, 38, 9);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(9, -14);
        ctx.lineTo(9, 14);
        ctx.stroke();
        ctx.restore();
        if (r?.phase === "windup")
          ring(
            c,
            ball,
            ball.radius + 12 + (30 - r.frames) * 0.6,
            ball.f.accent,
          );
        if ((ball.visualStates.rocketBurst ?? 0) > 0)
          ring(
            c,
            ball,
            ball.radius + 65 * (1 - (ball.visualStates.rocketBurst ?? 0) / 24),
            ball.f.accent,
          );
      },
    },
    timeThief: {
      tick(c) {
        const { ball, rival, sim } = c;
        ball.timeCooldown ??= 75;
        if (!ball.timeAnchor) {
          if (ball.frozen || ball.stunned || --ball.timeCooldown > 0) return;
          ball.timeAnchor = {
            x: ball.x,
            y: ball.y,
            vx: ball.vx,
            vy: ball.vy,
            frames: 105,
            damage: 0,
          };
          c.showImpact("BOOKMARK!", ball);
          c.playSound("timeMark");
        }
        const a = ball.timeAnchor;
        if (--a.frames > 0) return;
        const abandoned = { x: ball.x, y: ball.y };
        ball.x = Math.max(
          28 + ball.radius,
          Math.min(sim.width - 28 - ball.radius, a.x),
        );
        ball.y = Math.max(
          80 + ball.radius,
          Math.min(sim.height - 28 - ball.radius, a.y),
        );
        for (const h of sim.hazards) {
          const dx = ball.x - h.x,
            dy = ball.y - h.y,
            d = Math.hypot(dx, dy) || 1;
          if (d < ball.radius + h.r) {
            ball.x = h.x + (dx / d) * (ball.radius + h.r);
            ball.y = h.y + (dy / d) * (ball.radius + h.r);
          }
        }
        ball.vx = -a.vx;
        ball.vy = -a.vy;
        const volleyId=`time-${ball.side}-${sim.ticks}`;
        const shardSpeed=960,offset=(sim.ticks*.173+(ball.side==='left'?0:Math.PI/12))%(Math.PI*2);
        for(let index=0;index<12;index++){
          const angle=offset+index*Math.PI/6;
          sim.projectiles.push({shooter:ball,side:ball.side,x:abandoned.x,y:abandoned.y,previousX:abandoned.x,previousY:abandoned.y,vx:Math.cos(angle)*shardSpeed,vy:Math.sin(angle)*shardSpeed,radius:9,damage:(3+Math.min(5.5,a.damage*.1))*ball.f.power,force:7,life:22,color:ball.f.color,type:'timeShard',dead:false,armingFrames:2,rotation:angle,spin:7,volleyId});
        }
        c.showImpact("REWIND!", ball);
        c.emitParticles(abandoned, {
          count: 30,
          color: ball.f.accent,
          speed: 350,
          gravity: 0,
          kind: "ring",
          size: 12,
        });
        c.emitParticles(ball, {
          count: 20,
          color: ball.f.color,
          speed: 230,
          gravity: 0,
          kind: "pixel",
          size: 8,
        });
        c.playSound("timeRewind");
        ball.timeAnchor = undefined;
        ball.timeCooldown = 100;
      },
      takeHit({ ball, event }) {
        if (ball.timeAnchor)
          ball.timeAnchor.damage += Math.max(0, event.damage);
      },
      drawBack(c) {
        const a = c.ball.timeAnchor;
        if (!a) return;
        const { ctx, ball } = c;
        ring(c, a, ball.radius, ball.f.accent);
        ctx.save();
        ctx.strokeStyle = ball.f.accent;
        ctx.globalAlpha = 0.75;
        ctx.setLineDash([7, 9]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(ball.x, ball.y);
        ctx.stroke();
        ctx.restore();
      },
      draw(c) {
        if (c.ball.timeAnchor)
          ring(c, c.ball, c.ball.radius + 11, c.ball.f.accent);
      },
    },
  };
}
