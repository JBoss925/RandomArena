import { runBehaviorHook } from './behaviors.js';
import { resolveElasticCollision } from './physics.js';
import { applyWeaponMotion, collectWeaponHit, collectWeaponWorldContact } from './weapons.js';
import { fireRangedWeapon, stepProjectiles } from './projectiles.js';
import { createInitialBall } from './initial-conditions.js';
import { contactForce } from './combat-config.js';
import { resolveOutcome } from './outcome.js';
import type { Ball, CombatEvent, Fighter, Outcome, ProjectileHit, Simulation, WeaponHit, Winner } from './types';

const W=720,H=720,DT=1/60,BOUNDS={left:28,right:W-28,top:80,bottom:H-28};
const noop=()=>{};
export type MatchResult=Omit<Partial<Outcome>,'winner'>&{winner:Winner;hp:{left:number;right:number};ticks:number;events:Record<string,number>};
type CombatItem={attacker:Ball;victim:Ball;force:number;damage:number;impulseX?:number;impulseY?:number;redirect?:WeaponHit['redirect'];weapon?:boolean;projectile?:boolean};

export function simulateMatch(leftFighter:Fighter,rightFighter:Fighter,seed:string,{maxTicks=60*40}:{maxTicks?:number}={}):MatchResult{
  const rng=mulberry32(hashString(`balance:v1:${seed}`));
  const sim:Simulation={balls:[createInitialBall(leftFighter,'left',rng),createInitialBall(rightFighter,'right',rng)],projectiles:[],rng,visualRng:rng,ticks:0,hitStop:0,echoes:[],events:{},hazards:[],particles:[],impactPopups:[],lastExchange:null,width:W,height:H,finished:false};
  for(let tick=0;tick<maxTicks;tick++){
    if(sim.hitStop>0){sim.hitStop--;continue;}
    sim.ticks++;
    for(const echo of sim.echoes){echo.frames--;if(echo.frames===0){const event={damage:echo.damage,force:echo.damage,echo:true};echo.victim.hp-=event.damage;runBehaviorHook(echo.victim,'takeHit',{...ctx(sim,echo.attacker,event),rival:echo.attacker});}}
    sim.echoes=sim.echoes.filter(e=>e.frames>0);
    for(const ball of sim.balls){
      ball.cooldown=Math.max(0,ball.cooldown-1);ball.weaponCooldown=Math.max(0,ball.weaponCooldown-1);ball.weaponWorldCooldown=Math.max(0,ball.weaponWorldCooldown-1);ball.fireCooldown=Math.max(0,ball.fireCooldown-1);ball.stunned=Math.max(0,ball.stunned-1);ball.flash=Math.max(0,ball.flash-1);
      if(ball.burn>0){ball.burn--;if(ball.burn%12===0)ball.hp-=.18*(ball.burnStacks||1);if(!ball.burn)ball.burnStacks=0;}
      if(ball.wallCrash&&ball.wallCrash.frames>0)ball.wallCrash.frames--;
      const rival=sim.balls.find(other=>other!==ball)!,context=ctx(sim,rival,{dt:DT,force:0,damage:0});
      runBehaviorHook(ball,'tick',context);
      if(ball.frozen||ball.stunned)continue;
      runBehaviorHook(ball,'beforeMove',context);
      ball.angle=(ball.angle+ball.angularVelocity*DT)%(Math.PI*2);ball.x+=ball.vx*DT;ball.y+=ball.vy*DT;
      let hitWall=false;
      if(ball.x-ball.radius<BOUNDS.left||ball.x+ball.radius>BOUNDS.right){ball.x=Math.max(BOUNDS.left+ball.radius,Math.min(BOUNDS.right-ball.radius,ball.x));ball.vx*=-1;hitWall=true;runBehaviorHook(ball,'wallHit',context);}
      if(ball.y-ball.radius<BOUNDS.top||ball.y+ball.radius>BOUNDS.bottom){ball.y=Math.max(BOUNDS.top+ball.radius,Math.min(BOUNDS.bottom-ball.radius,ball.y));ball.vy*=-1;hitWall=true;runBehaviorHook(ball,'wallHit',context);}
      if(hitWall&&ball.wallCrash&&ball.wallCrash.frames>0){ball.hp-=ball.wallCrash.damage;ball.wallCrash=null;sim.events['WALL SLAM!']=(sim.events['WALL SLAM!']??0)+1;}
      if(collectWeaponWorldContact(ball,BOUNDS))sim.events['CLANG!']=(sim.events['CLANG!']??0)+1;
      const shot=fireRangedWeapon(ball,sim);if(shot)sim.events[shot.label]=(sim.events[shot.label]??0)+1;
    }
    resolveProjectileHits(stepProjectiles(sim,DT,BOUNDS),sim);
    resolveWeaponHits(sim.balls.map((ball,index)=>collectWeaponHit(ball,sim.balls[1-index],DT)).filter((hit):hit is WeaponHit=>hit!==null),sim);
    resolveBodyHit(sim);
    if(sim.ticks>60*24){sim.balls[0].hp-=.18;sim.balls[1].hp-=.18;}
    const result=winner(sim);
    if(result)return {...result,hp:{left:sim.balls[0].hp,right:sim.balls[1].hp},ticks:sim.ticks,events:sim.events};
  }
  return {winner:'draw',hp:{left:sim.balls[0].hp,right:sim.balls[1].hp},ticks:sim.ticks,events:sim.events};
}

function resolveBodyHit(sim:Simulation):void{
  const [a,b]=sim.balls,collision=resolveElasticCollision(a,b);if(!collision||a.cooldown||b.cooldown)return;
  const force=contactForce(collision.relativeNormalSpeed);a.cooldown=b.cooldown=9;a.stunned=b.stunned=Math.round(3+force*.45);sim.hitStop=Math.round(2+force*.32);
  resolveCombatEvents([{attacker:a,victim:b,force,damage:force*a.f.power*a.powerScale*(a.f.bodyDamageScale??1)},{attacker:b,victim:a,force,damage:force*b.f.power*b.powerScale*(b.f.bodyDamageScale??1)}],sim,'body collision');
}

function resolveWeaponHits(hits:WeaponHit[],sim:Simulation):void{
  if(!hits.length)return;
  resolveCombatEvents(hits.map(hit=>({attacker:hit.attacker,victim:hit.victim,force:hit.force,damage:hit.damage,impulseX:hit.impulseX,impulseY:hit.impulseY,redirect:hit.redirect})),sim,'weapon exchange');
}

function resolveProjectileHits(hits:ProjectileHit[],sim:Simulation):void{
  if(!hits.length)return;
  resolveCombatEvents(hits.map(hit=>({attacker:hit.projectile.shooter,victim:hit.target,force:hit.projectile.force,damage:hit.projectile.damage,weapon:true,projectile:true})),sim,'projectile volley');
}

function resolveCombatEvents(events:CombatItem[],sim:Simulation,source:string):void{
  const before={left:sim.balls[0].hp,right:sim.balls[1].hp};
  const prepared=events.map(item=>{
    item.attacker.hits++;item.victim.incoming++;
    const event={force:item.force,damage:item.damage,weapon:item.weapon??Boolean(item.impulseX||item.impulseY),projectile:Boolean(item.projectile)};
    const context=ctx(sim,item.victim,event);
    runBehaviorHook(item.attacker,'modifyOutgoing',context);
    runBehaviorHook(item.victim,'modifyIncoming',{...context,rival:item.attacker});
    return {...item,event,context};
  });
  for(const hit of prepared)hit.victim.hp-=hit.event.damage;
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
