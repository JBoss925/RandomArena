// Data-driven rotating attachments. Add a `weapon` object to any fighter to
// compose one onto that ball without changing the physics or combat engine.
export function collectWeaponHit(ball, rival, dt) {
  const weapon = ball.f.weapon;
  if (!weapon || ball.frozen || ball.stunned) return null;
  if (ball.weaponCooldown > 0) return null;

  const dx = Math.cos(ball.angle);
  const dy = Math.sin(ball.angle);
  const startX = ball.x + dx * (ball.radius * 0.55);
  const startY = ball.y + dy * (ball.radius * 0.55);
  const endX = ball.x + dx * (ball.radius + weapon.length);
  const endY = ball.y + dy * (ball.radius + weapon.length);
  const distance = pointSegmentDistance(rival.x, rival.y, startX, startY, endX, endY);
  if (distance > rival.radius + weapon.width / 2) return null;

  ball.weaponCooldown = weapon.cooldown;
  const awayX = rival.x - ball.x;
  const awayY = rival.y - ball.y;
  const awayLength = Math.hypot(awayX, awayY) || 1;
  return {
    attacker: ball,
    victim: rival,
    damage: weapon.damage * ball.f.power * ball.powerScale,
    force: Math.min(16, weapon.damage + weapon.knockback / 40),
    impulseX: (awayX / awayLength) * weapon.knockback,
    impulseY: (awayY / awayLength) * weapon.knockback,
    label: weapon.type === 'bat' ? 'KNOCK!' : 'SLASH!',
  };
}

export function drawWeapon(ctx, ball) {
  const weapon = ball.f.weapon;
  if (!weapon) return;
  ctx.save();
  ctx.translate(ball.x, ball.y);
  ctx.rotate(ball.angle);
  ctx.lineCap = 'round';
  if (weapon.type === 'sword') {
    const gripStart = ball.radius * 0.35;
    const bladeStart = ball.radius * 0.78;
    const tip = ball.radius + weapon.length;
    ctx.strokeStyle = '#5b3421'; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(gripStart, 0); ctx.lineTo(bladeStart + 8, 0); ctx.stroke();
    ctx.strokeStyle = '#151515'; ctx.lineWidth = weapon.width + 6;
    ctx.beginPath(); ctx.moveTo(bladeStart, 0); ctx.lineTo(tip, 0); ctx.stroke();
    ctx.strokeStyle = '#f4f5ef'; ctx.lineWidth = weapon.width;
    ctx.beginPath(); ctx.moveTo(bladeStart, 0); ctx.lineTo(tip, 0); ctx.stroke();
    ctx.fillStyle = '#151515'; ctx.fillRect(bladeStart - 7, -15, 8, 30);
  } else {
    const start = ball.radius * 0.45;
    const end = ball.radius + weapon.length;
    ctx.strokeStyle = '#151515'; ctx.lineWidth = weapon.width + 6;
    ctx.beginPath(); ctx.moveTo(start, 0); ctx.lineTo(end, 0); ctx.stroke();
    ctx.strokeStyle = '#d89a54'; ctx.lineWidth = weapon.width;
    ctx.beginPath(); ctx.moveTo(start, 0); ctx.lineTo(end, 0); ctx.stroke();
    ctx.strokeStyle = '#f1c590'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(start + 8, -4); ctx.lineTo(end - 10, -4); ctx.stroke();
  }
  ctx.restore();
}

function pointSegmentDistance(px, py, ax, ay, bx, by) {
  const abX = bx - ax, abY = by - ay;
  const lengthSquared = abX * abX + abY * abY;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((px - ax) * abX + (py - ay) * abY) / lengthSquared)) : 0;
  return Math.hypot(px - (ax + abX * t), py - (ay + abY * t));
}
