import assert from 'node:assert/strict';
import {stepProjectiles} from '../src/projectiles.js';
import {applyWeaponMotion,collectWeaponHit,collectWeaponWorldContact} from '../src/weapons.js';
import {runBehaviorHook} from '../src/behaviors.js';
import {getFighter} from '../src/fighters.js';
import {simulateMatch} from '../src/headless-simulation.js';
import {createInitialBall} from '../src/initial-conditions.js';
import type {Ball, Fighter, Hazard, Projectile, Side} from '../src/types.js';

const bounds={left:0,right:300,top:0,bottom:300};
const fighter=(id:string):Fighter=>{const result=getFighter(id);assert.ok(result);return result;};
const makeBall=(id:string,side:Side):Ball=>createInitialBall(fighter(id),side,()=>.5);
const shooter=makeBall('shotgun','left');
const target=makeBall('sniper','right');Object.assign(target,{x:180,y:100,radius:12,hp:100});
const projectile=():Projectile=>({shooter,side:'left',x:100,y:100,previousX:100,previousY:100,vx:1000,vy:0,radius:3,damage:10,force:10,life:10,type:'sniper',color:'#000',dead:false});

let sim={balls:[shooter,target],projectiles:[projectile()]};
assert.equal(stepProjectiles(sim,.1,bounds).length,1,'a clear projectile should hit the fighter');

sim={balls:[shooter,target],projectiles:[projectile()]};
const obstacle:Hazard={id:'test',type:'pillar',x:145,y:100,r:10,value:0};
assert.equal(stepProjectiles(sim,.1,bounds,[obstacle]).length,0,'terrain before a fighter should absorb the projectile');
assert.equal(sim.projectiles.length,0);

const saber=makeBall('saber','left');Object.assign(saber,{x:260,y:150,radius:64,angle:0,angularVelocity:2,weaponWorldCooldown:0,vx:120,vy:35});
assert.ok(collectWeaponWorldContact(saber,bounds));
assert.equal(saber.angularVelocity,-2,'wall contact should reverse a melee attachment');
assert.equal(saber.vx,-120,'right-wall weapon contact should reverse inward x velocity');
assert.equal(saber.vy,35,'right-wall weapon contact should preserve y velocity');
saber.x=150;saber.y=40;saber.angle=-Math.PI/2;saber.vx=25;saber.vy=-140;saber.weaponWorldCooldown=0;
assert.ok(collectWeaponWorldContact(saber,bounds));
assert.equal(saber.vx,25,'top-wall weapon contact should preserve x velocity');
assert.equal(saber.vy,140,'top-wall weapon contact should reverse inward y velocity');
saber.x=100;saber.y=150;saber.angle=0;saber.vx=100;saber.vy=0;saber.weaponWorldCooldown=0;
assert.equal(collectWeaponWorldContact(saber,bounds,[{...obstacle,x:210,y:150,r:18}])?.kind,'hazard');
assert.ok(saber.vx<0,'obstacle weapon contact should reflect velocity along its surface normal');
saber.angularVelocity=2;
runBehaviorHook(saber,'dealHit',{event:{weapon:true,force:0,damage:0},showImpact:()=>{}});
assert.ok(saber.angularVelocity<0,'fighter contact should reverse Saber');

for(const id of ['slugger','shotgun','sniper']){
  const holder=makeBall(id,'left');Object.assign(holder,{x:260,y:150,radius:64,angle:0,angularVelocity:2,weaponWorldCooldown:0,vx:120,vy:20});
  assert.ok(collectWeaponWorldContact(holder,bounds),`${id} attachment should collide with the world`);
  assert.equal(holder.vx,-120,`${id} should ricochet away from a right-wall attachment hit`);
  assert.equal(holder.angularVelocity,-2,`${id} attachment should reverse its rotation on contact`);
}

const slugger=makeBall('slugger','left');Object.assign(slugger,{x:100,y:150,radius:64,angle:0,angularVelocity:3,weaponCooldown:0,powerScale:1,vx:0,vy:0});
const struck=makeBall('brick','right');Object.assign(struck,{x:205,y:150,radius:32,vx:100,vy:0});
let batHit=collectWeaponHit(slugger,struck,1/60);
assert.ok(batHit,'bat should connect with a fighter crossing its swing');
assert.ok(Math.abs(batHit.impulseX)<1e-9,'a horizontal bat should not launch radially along its shaft');
assert.equal(batHit.impulseY,245,'counterclockwise bat motion should launch along its positive tangent');
applyWeaponMotion(batHit);
assert.ok(Math.abs(struck.vx)<1e-9,'bat launch should fully redirect the target');
assert.equal(struck.vy,850,'bat launch should enforce its minimum speed');
slugger.weaponCooldown=0;slugger.angularVelocity=-3;
struck.vx=0;struck.vy=1000;
batHit=collectWeaponHit(slugger,struck,1/60);
assert.ok(batHit);
assert.equal(batHit.impulseY,-245,'clockwise bat motion should reverse the tangential launch');
applyWeaponMotion(batHit);
assert.equal(struck.vy,-1120,'a faster target should retain and multiply its speed along the new tangent');

const first=simulateMatch(fighter('shotgun'),fighter('sniper'),'ranged-determinism');
const second=simulateMatch(fighter('shotgun'),fighter('sniper'),'ranged-determinism');
assert.deepEqual(first,second,'ranged simulation must replay identically from the same seed');
console.log('Projectile, weapon-contact, and deterministic replay tests passed.');
