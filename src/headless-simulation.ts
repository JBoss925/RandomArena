import { runBehaviorHook } from './behaviors.js';
import { resolveElasticCollision, wallCollisionSide } from './physics.js';
import { applyWeaponMotion, collectWeaponHit, collectWeaponWorldContact } from './weapons.js';
import { fireRangedWeapon, stepProjectiles } from './projectiles.js';
import { createInitialBall } from './initial-conditions.js';
import { contactForce, impactSpeedScale } from './combat-config.js';
import { resolveOutcome } from './outcome.js';
import {explodeGrenade,stepMines} from './explosives.js';
import {applyDamage,poisonDamagePerTick} from './damage.js';
import type { Ball, CombatEvent, Fighter, MineHit, Outcome, ProjectileHit, Simulation, WeaponHit, Winner } from './types';

const W=720,H=720,DT=1/60,BOUNDS={left:28,right:W-28,top:80,bottom:H-28};
const noop=()=>{};
export type MatchResult=Omit<Partial<Outcome>,'winner'>&{winner:Winner;hp:{left:number;right:number};ticks:number;events:Record<string,number>};
type CombatItem={attacker:Ball;victim:Ball;force:number;damage:number;impulseX?:number;impulseY?:number;redirect?:WeaponHit['redirect'];weapon?:boolean;projectile?:boolean;ability?:boolean;unblockable?:boolean;explosive?:boolean;damageType?:CombatEvent['damageType'];attackerSpeed?:number;targetSpeed?:number};

export function simulateMatch(leftFighter:Fighter,rightFighter:Fighter,seed:string,{maxTicks=60*40}:{maxTicks?:number}={}):MatchResult{
  const rng=mulberry32(hashString(`balance:v1:${seed}`));
  const sim:Simulation={balls:[createInitialBall(leftFighter,'left',rng),createInitialBall(rightFighter,'right',rng)],projectiles:[],mines:[],rng,visualRng:rng,ticks:0,hitStop:0,echoes:[],events:{},hazards:[],particles:[],impactPopups:[],lastExchange:null,width:W,height:H,finished:false};
  for(let tick=0;tick<maxTicks;tick++){
    if(sim.hitStop>0){sim.hitStop--;continue;}
    sim.ticks++;
    for(const echo of sim.echoes){echo.frames--;if(echo.frames===0){const event:CombatEvent={damage:echo.damage,force:echo.damage,echo:true,ability:true,damageType:'echo'};const context={...ctx(sim,echo.attacker,event),rival:echo.attacker};runBehaviorHook(echo.victim,'modifyIncoming',context);applyDamage(echo.victim,event.damage,event.damageType);runBehaviorHook(echo.victim,'takeHit',context);}}
    sim.echoes=sim.echoes.filter(e=>e.frames>0);
    for(const ball of sim.balls){
      ball.cooldown=Math.max(0,ball.cooldown-1);ball.weaponCooldown=Math.max(0,ball.weaponCooldown-1);ball.weaponWorldCooldown=Math.max(0,ball.weaponWorldCooldown-1);ball.fireCooldown=Math.max(0,ball.fireCooldown-1);ball.stunned=Math.max(0,ball.stunned-1);ball.flash=Math.max(0,ball.flash-1);
      if(ball.burn>0){ball.burn--;if(ball.burn%12===0)applyDamage(ball,.18*(ball.burnStacks||1),'burn');if(!ball.burn)ball.burnStacks=0;}
      if(ball.poisonStacks>0){ball.poisonTick=(ball.poisonTick+1)%30;if(ball.poisonTick===0)applyDamage(ball,poisonDamagePerTick(ball.poisonStacks,ball.f.poisonDamageScale),'poison');}
      if(ball.wallCrash&&ball.wallCrash.frames>0)ball.wallCrash.frames--;
      const rival=sim.balls.find(other=>other!==ball)!,context=ctx(sim,rival,{dt:DT,force:0,damage:0});
      runBehaviorHook(ball,'tick',context);
      if(ball.frozen||ball.stunned)continue;
      runBehaviorHook(ball,'beforeMove',context);
      ball.angle=(ball.angle+ball.angularVelocity*DT)%(Math.PI*2);ball.x+=ball.vx*DT;ball.y+=ball.vy*DT;
      let hitWall=false,wallX=ball.x,wallY=ball.y,normalX=0,normalY=0;
      const xWall=wallCollisionSide(ball.x,ball.radius,BOUNDS.left,BOUNDS.right,ball.vx);
      if(xWall){const left=xWall===-1;ball.x=left?BOUNDS.left+ball.radius:BOUNDS.right-ball.radius;wallX=left?BOUNDS.left:BOUNDS.right;wallY=ball.y;normalX=left?1:-1;ball.vx*=-1;hitWall=true;runBehaviorHook(ball,'wallHit',context);}
      const yWall=wallCollisionSide(ball.y,ball.radius,BOUNDS.top,BOUNDS.bottom,ball.vy);
      if(yWall){const top=yWall===-1;ball.y=top?BOUNDS.top+ball.radius:BOUNDS.bottom-ball.radius;wallX=normalX?wallX:ball.x;wallY=top?BOUNDS.top:BOUNDS.bottom;normalY=top?1:-1;ball.vy*=-1;hitWall=true;runBehaviorHook(ball,'wallHit',context);}
      if(hitWall)runBehaviorHook(ball,'geometryHit',{...context,event:{...context.event,geometry:{x:wallX,y:wallY,nx:normalX,ny:normalY,type:'wall'}}});
      if(hitWall&&ball.wallCrash&&ball.wallCrash.frames>0){applyDamage(ball,ball.wallCrash.damage,'physical');ball.wallCrash=null;sim.events['WALL SLAM!']=(sim.events['WALL SLAM!']??0)+1;}
      if(collectWeaponWorldContact(ball,BOUNDS))sim.events['CLANG!']=(sim.events['CLANG!']??0)+1;
      const shot=fireRangedWeapon(ball,sim);if(shot)sim.events[shot.label]=(sim.events[shot.label]??0)+1;
    }
    resolveMineHits(stepMines(sim),sim);
    resolveProjectileHits(stepProjectiles(sim,DT,BOUNDS),sim);
    resolveWeaponHits(sim.balls.map((ball,index)=>collectWeaponHit(ball,sim.balls[1-index],DT)).filter((hit):hit is WeaponHit=>hit!==null),sim);
    resolveBodyHit(sim);
    if(sim.ticks>60*24){applyDamage(sim.balls[0],.18,'fatigue');applyDamage(sim.balls[1],.18,'fatigue');}
    const result=winner(sim);
    if(result)return {...result,hp:{left:sim.balls[0].hp,right:sim.balls[1].hp},ticks:sim.ticks,events:sim.events};
  }
  return {winner:'draw',hp:{left:sim.balls[0].hp,right:sim.balls[1].hp},ticks:sim.ticks,events:sim.events};
}

function resolveBodyHit(sim:Simulation):void{
  const [a,b]=sim.balls,speedA=Math.hypot(a.vx,a.vy),speedB=Math.hypot(b.vx,b.vy),collision=resolveElasticCollision(a,b);if(!collision||a.cooldown||b.cooldown)return;
  const force=contactForce(collision.relativeNormalSpeed);a.cooldown=b.cooldown=9;a.stunned=b.stunned=Math.round(3+force*.45);sim.hitStop=Math.round(2+force*.32);
  resolveCombatEvents([{attacker:a,victim:b,force,damage:force*a.f.power*a.powerScale*(a.f.bodyDamageScale??1)*impactSpeedScale(speedA,speedB),attackerSpeed:speedA,targetSpeed:speedB},{attacker:b,victim:a,force,damage:force*b.f.power*b.powerScale*(b.f.bodyDamageScale??1)*impactSpeedScale(speedB,speedA),attackerSpeed:speedB,targetSpeed:speedA}],sim,'body collision');
}

function resolveWeaponHits(hits:WeaponHit[],sim:Simulation):void{
  if(!hits.length)return;
  resolveCombatEvents(hits.map(hit=>({attacker:hit.attacker,victim:hit.victim,force:hit.force,damage:hit.damage,impulseX:hit.impulseX,impulseY:hit.impulseY,redirect:hit.redirect})),sim,'weapon exchange');
}

function resolveProjectileHits(hits:ProjectileHit[],sim:Simulation):void{
  if(!hits.length)return;
  for(const hit of hits.filter(hit=>hit.projectile.type==='grenade')){explodeGrenade(hit.projectile,sim);sim.events['BOOM!']=(sim.events['BOOM!']??0)+1;}
  const damaging=hits.filter((hit):hit is ProjectileHit&{target:Ball}=>hit.projectile.type!=='grenade'&&Boolean(hit.target));
  if(damaging.length)resolveCombatEvents(damaging.map(hit=>{const seeker=hit.projectile.type==='heatseeker',shrapnel=hit.projectile.type==='shrapnel',interceptScale=seeker?1+Math.min(1.5,Math.hypot(hit.target.vx,hit.target.vy)/550):1;return{attacker:hit.projectile.shooter,victim:hit.target,force:hit.projectile.force,damage:hit.projectile.damage*interceptScale,weapon:true,projectile:true,ability:seeker||shrapnel,explosive:shrapnel,damageType:shrapnel?'explosive' as const:'physical' as const};}),sim,'projectile volley');
}

function resolveMineHits(hits:MineHit[],sim:Simulation):void{
  if(!hits.length)return;
  resolveCombatEvents(hits.map(hit=>({attacker:hit.mine.owner,victim:hit.target,force:hit.force,damage:hit.damage,ability:true,unblockable:true,explosive:true,damageType:'explosive'})),sim,'mine blast');
  for(const hit of hits){hit.target.vx=hit.launchX;hit.target.vy=hit.launchY;sim.events['MINE!']=(sim.events['MINE!']??0)+1;}
}

function resolveCombatEvents(events:CombatItem[],sim:Simulation,source:string):void{
  const before={left:sim.balls[0].hp,right:sim.balls[1].hp};
  const prepared=events.map(item=>{
    item.attacker.hits++;item.victim.incoming++;
    const event:CombatEvent={force:item.force,damage:item.damage,weapon:item.weapon??Boolean(item.impulseX||item.impulseY),projectile:Boolean(item.projectile),ability:Boolean(item.ability),unblockable:Boolean(item.unblockable),explosive:Boolean(item.explosive),damageType:item.damageType??'physical',attackerSpeed:item.attackerSpeed,targetSpeed:item.targetSpeed};
    const context=ctx(sim,item.victim,event);
    runBehaviorHook(item.attacker,'modifyOutgoing',context);
    runBehaviorHook(item.victim,'modifyIncoming',{...context,rival:item.attacker});
    return {...item,event,context};
  });
  for(const hit of prepared)applyDamage(hit.victim,hit.event.damage,hit.event.damageType);
  for(const hit of prepared){if(hit.impulseX!==undefined&&hit.impulseY!==undefined){applyWeaponMotion({attacker:hit.attacker,victim:hit.victim,impulseX:hit.impulseX,impulseY:hit.impulseY,redirect:hit.redirect??null});sim.hitStop=Math.max(sim.hitStop,Math.round(2+hit.event.force*.25));}runBehaviorHook(hit.attacker,'dealHit',hit.context);runBehaviorHook(hit.victim,'takeHit',{...hit.context,rival:hit.attacker});}
  const [left,right]=sim.balls;sim.lastExchange={tick:sim.ticks,source,before,after:{left:left.hp,right:right.hp},damageTaken:{left:before.left-left.hp,right:before.right-right.hp}};
}

function winner(sim:Simulation):Outcome|null{
  const [left,right]=sim.balls,outcome=resolveOutcome(left,right,{lastExchange:sim.lastExchange,tick:sim.ticks});
  return outcome;
}
function ctx(sim:Simulation,rival:Ball,event:CombatEvent){return{sim,rival,event,random:sim.rng,showImpact:(label:string)=>{sim.events[label]=(sim.events[label]??0)+1;},emitParticles:noop,audioTone:noop,audioHit:noop,playSound:noop};}
function hashString(str:string):number{let h=2166136261>>>0;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function mulberry32(seed:number):()=>number{return()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
