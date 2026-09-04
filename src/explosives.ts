import type {Ball,Mine,MineHit,Projectile,Simulation} from './types.js';

const MINE_RADIUS=16;

export function deployMine(owner:Ball,sim:Simulation):Mine{
  const speed=Math.hypot(owner.vx,owner.vy),dx=speed?owner.vx/speed:Math.cos(owner.angle),dy=speed?owner.vy/speed:Math.sin(owner.angle),distance=owner.radius+MINE_RADIUS+10;
  const x=Math.max(28+MINE_RADIUS,Math.min(sim.width-28-MINE_RADIUS,owner.x-dx*distance));
  const y=Math.max(80+MINE_RADIUS,Math.min(sim.height-28-MINE_RADIUS,owner.y-dy*distance));
  const owned=sim.mines.filter(mine=>mine.owner===owner&&!mine.dead);if(owned.length>=5)owned[0].dead=true;
  const mine={id:`${owner.side}-${sim.ticks}-${sim.mines.length}`,owner,side:owner.side,x,y,radius:MINE_RADIUS,damage:38*owner.f.power*owner.powerScale,launchSpeed:1280,armingFrames:18,dead:false};sim.mines.push(mine);return mine;
}

export function stepMines(sim:Simulation):MineHit[]{
  const hits:MineHit[]=[];
  for(const mine of sim.mines){
    if(mine.dead)continue;mine.armingFrames=Math.max(0,mine.armingFrames-1);if(mine.armingFrames)continue;
    const target=sim.balls.find(ball=>ball.hp>0&&Math.hypot(ball.x-mine.x,ball.y-mine.y)<ball.radius+mine.radius);
    if(!target)continue;
    const dx=target.x-mine.x,dy=target.y-mine.y,d=Math.hypot(dx,dy),nx=d?dx/d:target.side==='left'?-1:1,ny=d?dy/d:0;
    mine.dead=true;hits.push({mine,target,x:mine.x+nx*mine.radius,y:mine.y+ny*mine.radius,damage:mine.damage,force:18,launchX:nx*mine.launchSpeed,launchY:ny*mine.launchSpeed});
  }
  sim.mines=sim.mines.filter(mine=>!mine.dead);return hits;
}

export function throwGrenade(owner:Ball,rival:Ball,sim:Simulation):Projectile{
  const angle=Math.atan2(rival.y-owner.y,rival.x-owner.x),distance=owner.radius+14,x=owner.x+Math.cos(angle)*distance,y=owner.y+Math.sin(angle)*distance;
  const grenade:Projectile={shooter:owner,side:owner.side,x,y,previousX:x,previousY:y,vx:Math.cos(angle)*540,vy:Math.sin(angle)*540,radius:10,damage:0,force:0,life:120,color:owner.f.accent,type:'grenade',dead:false,armingFrames:12,rotation:angle,spin:2.4};sim.projectiles.push(grenade);return grenade;
}

export function explodeGrenade(projectile:Simulation['projectiles'][number],sim:Simulation):void{
  const offset=sim.rng()*Math.PI*2;
  for(let index=0;index<12;index++){
    const angle=offset+index*Math.PI/6,speed=920;
    sim.projectiles.push({shooter:projectile.shooter,side:projectile.side,x:projectile.x,y:projectile.y,previousX:projectile.x,previousY:projectile.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,radius:4,damage:4.2*projectile.shooter.f.power*projectile.shooter.powerScale,force:7,life:52,color:'#ffb14a',type:'shrapnel',dead:false,armingFrames:3,rotation:angle,spin:8});
  }
}
