// Data-driven rotating attachments. Add a `weapon` object to any fighter to
// compose one onto that ball without changing the physics or combat engine.
export function collectWeaponHit(ball, rival, dt) {
  const weapon = ball.f.weapon;
  if (!weapon || weapon.projectile || ball.frozen || ball.stunned) return null;
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

export function collectWeaponWorldContact(ball,bounds,hazards=[]){
  const weapon=ball.f.weapon;
  if(!weapon?.reversesOnContact||ball.weaponWorldCooldown>0)return null;
  const dx=Math.cos(ball.angle),dy=Math.sin(ball.angle);
  const start={x:ball.x+dx*ball.radius*.55,y:ball.y+dy*ball.radius*.55};
  const end={x:ball.x+dx*(ball.radius+weapon.length),y:ball.y+dy*(ball.radius+weapon.length)};
  let contact=null;
  if(end.x<bounds.left||end.x>bounds.right||end.y<bounds.top||end.y>bounds.bottom)contact={x:Math.max(bounds.left,Math.min(bounds.right,end.x)),y:Math.max(bounds.top,Math.min(bounds.bottom,end.y))};
  if(!contact)for(const hazard of hazards)if(pointSegmentDistance(hazard.x,hazard.y,start.x,start.y,end.x,end.y)<=hazard.r+weapon.width/2){contact={x:hazard.x,y:hazard.y};break;}
  if(!contact)return null;
  ball.angularVelocity*=-1;ball.weaponWorldCooldown=8;
  return contact;
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
  } else if(weapon.projectile){
    const start=ball.radius*.4,end=ball.radius+weapon.length;
    ctx.strokeStyle='#151515';ctx.lineWidth=weapon.width+6;ctx.beginPath();ctx.moveTo(start,0);ctx.lineTo(end,0);ctx.stroke();
    ctx.strokeStyle=weapon.type==='sniper'?'#d9d5c6':'#6f6b60';ctx.lineWidth=weapon.width;ctx.beginPath();ctx.moveTo(start,0);ctx.lineTo(end,0);ctx.stroke();
    ctx.fillStyle='#151515';ctx.fillRect(start+10,-weapon.width*.72,weapon.type==='sniper'?30:22,weapon.width*1.44);
    if(weapon.type==='sniper'){ctx.beginPath();ctx.arc(start+18,-weapon.width,7,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#f3efdf';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(end-18,0);ctx.lineTo(end,0);ctx.stroke();}
    else{ctx.strokeStyle='#f6b817';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(end-15,-weapon.width*.28);ctx.lineTo(end,-weapon.width*.4);ctx.moveTo(end-15,weapon.width*.28);ctx.lineTo(end,weapon.width*.4);ctx.stroke();}
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
