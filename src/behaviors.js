// Composable fighter behaviors. The physics engine owns movement and collision;
// these small scripts opt individual fighters into exceptions through hooks.
export const behaviors = {
  wallCharge: {
    wallHit({ ball }) {
      ball.wallBoost = Math.min(1.65, ball.wallBoost * 1.035);
      ball.vx *= 1.035;
      ball.vy *= 1.035;
    },
    draw({ ball, ctx }) {
      if (ball.wallBoost <= 1) return;
      ctx.save(); ctx.translate(ball.x, ball.y); ctx.strokeStyle = '#e6ff34'; ctx.lineWidth = 4;
      ctx.setLineDash([5, 7]); ctx.rotate(ball.wallBoost * 2);
      ctx.beginPath(); ctx.arc(0, 0, ball.radius + 10, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    },
  },
  armor: {
    modifyIncoming({ event }) { event.damage *= 0.78; },
    draw({ ball, ctx }) {
      ctx.save(); ctx.strokeStyle='#ffffff'; ctx.lineWidth=4; ctx.beginPath();
      ctx.arc(ball.x,ball.y,ball.radius-8,0,Math.PI*2); ctx.stroke(); ctx.restore();
    },
  },
  regeneration: {
    tick({ ball, sim }) {
      if (sim.ticks % 120 === 0) ball.hp = Math.min(100, ball.hp + 1.5);
    },
    draw({ ball, ctx, sim }) {
      const a=(sim.ticks%120)/120*Math.PI*2, r=ball.radius+13;
      ctx.save();ctx.translate(ball.x+Math.cos(a)*r,ball.y+Math.sin(a)*r);ctx.fillStyle='#ffffff';ctx.strokeStyle='#151515';ctx.lineWidth=2;ctx.fillRect(-8,-8,16,16);ctx.strokeRect(-8,-8,16,16);ctx.fillStyle='#20c997';ctx.fillRect(-2,-6,4,12);ctx.fillRect(-6,-2,12,4);ctx.restore();
    },
  },
  compoundPower: {
    dealHit({ ball }) { ball.powerScale *= 1.04; },
  },
  siphon: {
    dealHit({ ball, event }) { ball.hp = Math.min(100, ball.hp + event.damage * 0.22); },
  },
  dodge: {
    modifyIncoming({ event, random, showImpact }) {
      if (random() < 0.18) { event.damage = 0; showImpact('MISS!'); }
    },
  },
  thorns: {
    takeHit({ rival, event }) {
      if (event.damage > 0) rival.hp = Math.max(0, rival.hp - event.damage * 0.2);
    },
  },
  blink: {
    tick({ ball, sim, random, showImpact }) {
      if (sim.ticks % 240 === 0) {
        ball.x = 100 + random() * (sim.width - 200);
        ball.y = 110 + random() * (sim.height - 190);
        showImpact('BLINK!');
      }
    },
    draw({ ball, ctx, sim }) {
      ctx.save();ctx.globalAlpha=.28;ctx.strokeStyle=ball.f.color;ctx.lineWidth=4;
      for(let i=1;i<=3;i++){const offset=((sim.ticks+i*7)%18)-9;ctx.strokeRect(ball.x-ball.radius+offset,ball.y-ball.radius-offset,ball.radius*2,ball.radius*2);}ctx.restore();
    },
  },
  coldSnap: {
    dealHit({ event, rival, showImpact }) {
      if (event.force > 9) { rival.stunned += 45; showImpact('FROZEN!'); }
    },
  },
  afterburn: {
    dealHit({ rival }) { rival.burn = 120; },
  },
  echo: {
    dealHit({ sim, rival, event }) {
      if (event.damage > 0) sim.echoes.push({ victim: rival, frames: 18, damage: event.damage * 0.35 });
    },
  },
  thirdHitBlock: {
    modifyIncoming({ ball, event, showImpact }) {
      if (ball.incoming % 3 === 0) { event.damage = 0; showImpact('BLOCK!'); }
    },
    draw({ ball, ctx }) {
      const remaining=3-(ball.incoming%3);
      ctx.save();
      for(let i=0;i<3;i++){const a=-Math.PI*.78+i*Math.PI*.28,x=ball.x+Math.cos(a)*(ball.radius+17),y=ball.y+Math.sin(a)*(ball.radius+17);ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.fillStyle=i<remaining?'#ffffff':'#6f6c64';ctx.fill();ctx.strokeStyle='#151515';ctx.lineWidth=2;ctx.stroke();}
      ctx.restore();
    },
  },
  continuousAcceleration: {
    beforeMove({ ball }) { ball.vx *= 1.0012; ball.vy *= 1.0012; },
    dealHit({ ball }) { ball.vx *= 0.88; ball.vy *= 0.88; },
    drawBack({ ball, ctx }) {
      const speed=Math.hypot(ball.vx,ball.vy)||1,nx=ball.vx/speed,ny=ball.vy/speed;
      ctx.save();ctx.strokeStyle=ball.f.color;ctx.lineWidth=ball.radius*.65;ctx.globalAlpha=.3;ctx.beginPath();ctx.moveTo(ball.x-nx*ball.radius*.6,ball.y-ny*ball.radius*.6);ctx.lineTo(ball.x-nx*Math.min(95,speed*.22),ball.y-ny*Math.min(95,speed*.22));ctx.stroke();ctx.restore();
    },
  },
  fourthStrike: {
    modifyOutgoing({ ball, event, sim, showImpact }) {
      if (ball.hits % 4 === 0) { event.damage += 7; sim.hitStop += 5; showImpact('ZAP!'); }
    },
    draw({ ball, ctx }) {
      const charge=ball.hits%4;ctx.save();
      for(let i=0;i<4;i++){const a=i*Math.PI/2-Math.PI/2,x=ball.x+Math.cos(a)*(ball.radius+14),y=ball.y+Math.sin(a)*(ball.radius+14);ctx.fillStyle=i<charge?'#e5ff00':'#57554d';ctx.fillRect(x-4,y-4,8,8);ctx.strokeStyle='#151515';ctx.lineWidth=1.5;ctx.strokeRect(x-4,y-4,8,8);}ctx.restore();
    },
  },
  woundedPower: {
    modifyOutgoing({ ball, event }) { event.damage *= 1 + (100 - ball.hp) / 160; },
  },
  orbitalPulse: {
    tick({ sim, rival, audioTone, showImpact }) {
      if (sim.ticks % 180 === 0) {
        rival.hp = Math.max(0, rival.hp - 3);
        rival.flash = 6;
        showImpact('PULSE!');
        audioTone(240, 0.12, 'sine', 0.06);
      }
    },
    drawBack({ ball, ctx, sim }) {
      const a=sim.ticks*.055,r=ball.radius+29,sx=ball.x+Math.cos(a)*r,sy=ball.y+Math.sin(a)*r;
      ctx.save();ctx.strokeStyle='#151515';ctx.lineWidth=2;ctx.globalAlpha=.55;ctx.beginPath();ctx.arc(ball.x,ball.y,r,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;ctx.fillStyle='#e6ff34';ctx.lineWidth=3;ctx.beginPath();ctx.arc(sx,sy,12,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#151515';ctx.beginPath();ctx.arc(sx,sy,3,0,Math.PI*2);ctx.fill();ctx.restore();
    },
  },

  // Ready for future fighters. These are deliberately not part of base physics.
  randomSteering: {
    beforeMove({ ball, random }) { ball.vx += (random() - 0.5) * 20; ball.vy += (random() - 0.5) * 20; },
  },
  combatPull: {
    beforeMove({ ball, rival, event }) {
      const dx = rival.x - ball.x, dy = rival.y - ball.y, d = Math.hypot(dx, dy) || 1;
      ball.vx += (dx / d) * 90 * event.dt;
      ball.vy += (dy / d) * 90 * event.dt;
    },
  },
  speedLimit: {
    beforeMove({ ball }) {
      const max = 255 * ball.f.speed * ball.wallBoost;
      const speed = Math.hypot(ball.vx, ball.vy);
      if (speed > max) { ball.vx *= max / speed; ball.vy *= max / speed; }
    },
  },
};

export function runBehaviorHook(ball, hook, context) {
  for (const name of ball.f.behaviors ?? []) behaviors[name]?.[hook]?.({ ...context, ball });
}
