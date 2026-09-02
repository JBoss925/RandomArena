export function fireRangedWeapon(ball,sim){
  const weapon=ball.f.weapon;
  if(!weapon?.projectile||ball.frozen||ball.stunned||ball.fireCooldown>0)return null;
  ball.fireCooldown=weapon.fireInterval;
  const count=weapon.projectiles??1,spread=weapon.spread??0;
  const muzzleDistance=ball.radius+weapon.length;
  const muzzle={x:ball.x+Math.cos(ball.angle)*muzzleDistance,y:ball.y+Math.sin(ball.angle)*muzzleDistance};
  for(let i=0;i<count;i++){
    const offset=count===1?0:(i/(count-1)-.5)*spread;
    const angle=ball.angle+offset;
    sim.projectiles.push({shooter:ball,side:ball.side,x:muzzle.x,y:muzzle.y,previousX:muzzle.x,previousY:muzzle.y,vx:Math.cos(angle)*weapon.projectileSpeed,vy:Math.sin(angle)*weapon.projectileSpeed,radius:weapon.projectileRadius,damage:weapon.projectileDamage*ball.f.power*ball.powerScale,force:weapon.projectileForce??weapon.projectileDamage,life:weapon.projectileLife??90,color:ball.f.color,type:weapon.type,dead:false});
  }
  return{...muzzle,label:weapon.fireLabel??'FIRE!'};
}

export function stepProjectiles(sim,dt,bounds,hazards=[]){
  const hits=[];
  for(const projectile of sim.projectiles){
    const from={x:projectile.x,y:projectile.y},to={x:projectile.x+projectile.vx*dt,y:projectile.y+projectile.vy*dt};
    projectile.previousX=from.x;projectile.previousY=from.y;
    let first=boundaryHit(from,to,bounds,projectile.radius);
    for(const hazard of hazards){
      const hit=segmentCircleHit(from,to,hazard.x,hazard.y,hazard.r+projectile.radius);
      if(hit&&(!first||hit.t<first.t))first={...hit,type:'world'};
    }
    const target=sim.balls.find(ball=>ball.side!==projectile.side&&ball.hp>0);
    if(target){
      const hit=segmentCircleHit(from,to,target.x,target.y,target.radius+projectile.radius);
      if(hit&&(!first||hit.t<first.t))first={...hit,type:'fighter',target};
    }
    if(first){
      projectile.x=first.x;projectile.y=first.y;projectile.dead=true;
      if(first.type==='fighter')hits.push({projectile,target:first.target,x:first.x,y:first.y});
    }else{projectile.x=to.x;projectile.y=to.y;projectile.life--;if(projectile.life<=0)projectile.dead=true;}
  }
  sim.projectiles=sim.projectiles.filter(projectile=>!projectile.dead);
  return hits;
}

function segmentCircleHit(from,to,cx,cy,radius){
  const dx=to.x-from.x,dy=to.y-from.y,fx=from.x-cx,fy=from.y-cy;
  const a=dx*dx+dy*dy,b=2*(fx*dx+fy*dy),c=fx*fx+fy*fy-radius*radius;
  if(c<=0)return{t:0,x:from.x,y:from.y};
  const discriminant=b*b-4*a*c;if(discriminant<0||a===0)return null;
  const root=Math.sqrt(discriminant),near=(-b-root)/(2*a),far=(-b+root)/(2*a);
  const t=near>=0&&near<=1?near:far>=0&&far<=1?far:null;
  return t===null?null:{t,x:from.x+dx*t,y:from.y+dy*t};
}

function boundaryHit(from,to,bounds,radius){
  if(from.x<bounds.left+radius||from.x>bounds.right-radius||from.y<bounds.top+radius||from.y>bounds.bottom-radius)return{t:0,x:from.x,y:from.y,type:'world'};
  let best=null;
  const candidates=[];
  if(to.x<bounds.left+radius)candidates.push((bounds.left+radius-from.x)/(to.x-from.x));
  if(to.x>bounds.right-radius)candidates.push((bounds.right-radius-from.x)/(to.x-from.x));
  if(to.y<bounds.top+radius)candidates.push((bounds.top+radius-from.y)/(to.y-from.y));
  if(to.y>bounds.bottom-radius)candidates.push((bounds.bottom-radius-from.y)/(to.y-from.y));
  for(const t of candidates)if(t>=0&&t<=1&&(!best||t<best.t))best={t,x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t,type:'world'};
  return best;
}
