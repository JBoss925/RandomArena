// Data-driven rotating attachments. Add a `weapon` object to any fighter to
// compose one onto that ball without changing the physics or combat engine.
export function collectWeaponHit(ball:Ball, rival:Ball, _dt:number):WeaponHit|null {
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
  const spinDirection=Math.sign(ball.angularVelocity||weapon.angularSpeed||1);
  const impulseDirection=weapon.type==='bat'
    ? {x:-dy*spinDirection,y:dx*spinDirection}
    : {x:awayX/awayLength,y:awayY/awayLength};
  return {
    attacker: ball,
    victim: rival,
    damage: weapon.damage * ball.f.power * ball.powerScale,
    force: Math.min(16, weapon.damage + weapon.knockback / 40),
    impulseX: impulseDirection.x * weapon.knockback,
    impulseY: impulseDirection.y * weapon.knockback,
    redirect: weapon.type==='bat'?{
      x:impulseDirection.x,
      y:impulseDirection.y,
      minimumSpeed:weapon.minimumLaunchSpeed??0,
      speedMultiplier:weapon.speedMultiplier??1,
    }:null,
    label: weapon.type === 'bat' ? 'KNOCK!' : weapon.type === 'lance' ? ((ball.joustFrames??0)>0?'JOUST!':'PRICK!') : 'SLASH!',
  };
}

export function applyWeaponMotion(hit:Pick<WeaponHit,'attacker'|'victim'|'impulseX'|'impulseY'|'redirect'>):void{
  const {attacker,victim}=hit;
  const victimMass=victim.mass??victim.f.mass,attackerMass=attacker.mass??attacker.f.mass;
  if(hit.redirect){
    const currentSpeed=Math.hypot(victim.vx,victim.vy);
    const launchSpeed=Math.max(hit.redirect.minimumSpeed,currentSpeed*hit.redirect.speedMultiplier);
    victim.vx=hit.redirect.x*launchSpeed;victim.vy=hit.redirect.y*launchSpeed;
  }else{
    victim.vx+=hit.impulseX/victimMass;victim.vy+=hit.impulseY/victimMass;
  }
  attacker.vx-=hit.impulseX/attackerMass*.18;attacker.vy-=hit.impulseY/attackerMass*.18;
}

export function collectWeaponWorldContact(ball:Ball,bounds:Bounds,hazards:Hazard[]=[]):(Point&{kind:'wall'|'hazard';normalX?:number;normalY?:number})|null{
  const weapon=ball.f.weapon;
  if(!weapon||ball.weaponWorldCooldown>0)return null;
  const dx=Math.cos(ball.angle),dy=Math.sin(ball.angle);
  const start={x:ball.x+dx*ball.radius*.55,y:ball.y+dy*ball.radius*.55};
  const end={x:ball.x+dx*(ball.radius+weapon.length),y:ball.y+dy*(ball.radius+weapon.length)};
  let contact:(Point&{kind:'wall'|'hazard';normalX?:number;normalY?:number})|null=null;
  const hitsLeft=end.x<bounds.left,hitsRight=end.x>bounds.right,hitsTop=end.y<bounds.top,hitsBottom=end.y>bounds.bottom;
  if(hitsLeft||hitsRight||hitsTop||hitsBottom){
    if((hitsLeft&&ball.vx<0)||(hitsRight&&ball.vx>0))ball.vx*=-1;
    if((hitsTop&&ball.vy<0)||(hitsBottom&&ball.vy>0))ball.vy*=-1;
    contact={x:Math.max(bounds.left,Math.min(bounds.right,end.x)),y:Math.max(bounds.top,Math.min(bounds.bottom,end.y)),kind:'wall'};
  }
  if(!contact)for(const hazard of hazards){
    const nearest=pointSegmentClosest(hazard.x,hazard.y,start.x,start.y,end.x,end.y);
    if(nearest.distance>hazard.r+weapon.width/2)continue;
    let nx=nearest.x-hazard.x,ny=nearest.y-hazard.y,length=Math.hypot(nx,ny);
    if(length<1e-6){nx=ball.x-hazard.x;ny=ball.y-hazard.y;length=Math.hypot(nx,ny)||1;}
    nx/=length;ny/=length;
    const approach=ball.vx*nx+ball.vy*ny;
    if(approach<0){ball.vx-=2*approach*nx;ball.vy-=2*approach*ny;}
    contact={x:nearest.x,y:nearest.y,kind:'hazard',normalX:nx,normalY:ny};
    break;
  }
  if(!contact)return null;
  ball.angularVelocity*=-1;ball.weaponWorldCooldown=8;
  return contact;
}

export function drawWeapon(ctx:CanvasRenderingContext2D, ball:Ball):void {
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
  } else if(weapon.type === 'lance') {
    const gripStart=ball.radius*.3,shaftEnd=ball.radius+weapon.length-22,tip=ball.radius+weapon.length;
    ctx.strokeStyle='#151515';ctx.lineWidth=weapon.width+6;ctx.beginPath();ctx.moveTo(gripStart,0);ctx.lineTo(shaftEnd,0);ctx.stroke();
    ctx.strokeStyle=(ball.joustFrames??0)>0?'#feed9a':'#8a5a2f';ctx.lineWidth=weapon.width;ctx.beginPath();ctx.moveTo(gripStart,0);ctx.lineTo(shaftEnd,0);ctx.stroke();
    ctx.fillStyle='#151515';ctx.beginPath();ctx.moveTo(shaftEnd-2,-weapon.width);ctx.lineTo(tip+4,0);ctx.lineTo(shaftEnd-2,weapon.width);ctx.closePath();ctx.fill();
    ctx.fillStyle='#f4f5ef';ctx.beginPath();ctx.moveTo(shaftEnd,-weapon.width+4);ctx.lineTo(tip,0);ctx.lineTo(shaftEnd,weapon.width-4);ctx.closePath();ctx.fill();
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

function pointSegmentDistance(px:number, py:number, ax:number, ay:number, bx:number, by:number):number {
  return pointSegmentClosest(px,py,ax,ay,bx,by).distance;
}

function pointSegmentClosest(px:number,py:number,ax:number,ay:number,bx:number,by:number):Point&{distance:number}{
  const abX = bx - ax, abY = by - ay;
  const lengthSquared = abX * abX + abY * abY;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((px - ax) * abX + (py - ay) * abY) / lengthSquared)) : 0;
  const x=ax+abX*t,y=ay+abY*t;
  return {x,y,distance:Math.hypot(px-x,py-y)};
}
import type { Ball, Bounds, Hazard, Point, WeaponHit } from './types';
