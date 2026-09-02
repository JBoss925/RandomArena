import assert from 'node:assert/strict';
import {stepProjectiles} from '../src/projectiles.js';
import {collectWeaponWorldContact} from '../src/weapons.js';
import {runBehaviorHook} from '../src/behaviors.js';
import {getFighter} from '../src/fighters.js';
import {simulateMatch} from '../src/headless-simulation.js';

const bounds={left:0,right:300,top:0,bottom:300};
const shooter={side:'left'};
const target={side:'right',x:180,y:100,radius:12,hp:100};
const projectile=()=>({shooter,side:'left',x:100,y:100,previousX:100,previousY:100,vx:1000,vy:0,radius:3,damage:10,force:10,life:10,type:'sniper'});

let sim={balls:[shooter,target],projectiles:[projectile()]};
assert.equal(stepProjectiles(sim,.1,bounds).length,1,'a clear projectile should hit the fighter');

sim={balls:[shooter,target],projectiles:[projectile()]};
assert.equal(stepProjectiles(sim,.1,bounds,[{x:145,y:100,r:10}]).length,0,'terrain before a fighter should absorb the projectile');
assert.equal(sim.projectiles.length,0);

const saber={f:getFighter('saber'),x:260,y:150,radius:64,angle:0,angularVelocity:2,weaponWorldCooldown:0,vx:120,vy:35};
assert.ok(collectWeaponWorldContact(saber,bounds));
assert.equal(saber.angularVelocity,-2,'wall contact should reverse a melee attachment');
assert.equal(saber.vx,-120,'right-wall weapon contact should reverse inward x velocity');
assert.equal(saber.vy,35,'right-wall weapon contact should preserve y velocity');
saber.x=150;saber.y=40;saber.angle=-Math.PI/2;saber.vx=25;saber.vy=-140;saber.weaponWorldCooldown=0;
assert.ok(collectWeaponWorldContact(saber,bounds));
assert.equal(saber.vx,25,'top-wall weapon contact should preserve x velocity');
assert.equal(saber.vy,140,'top-wall weapon contact should reverse inward y velocity');
saber.x=100;saber.y=150;saber.angle=0;saber.vx=100;saber.vy=0;saber.weaponWorldCooldown=0;
assert.equal(collectWeaponWorldContact(saber,bounds,[{x:210,y:150,r:18}]).kind,'hazard');
assert.ok(saber.vx<0,'obstacle weapon contact should reflect velocity along its surface normal');
saber.angularVelocity=2;
runBehaviorHook(saber,'dealHit',{event:{weapon:true},showImpact:()=>{}});
assert.ok(saber.angularVelocity<0,'fighter contact should reverse Saber');

for(const id of ['slugger','shotgun','sniper']){
  const holder={f:getFighter(id),x:260,y:150,radius:64,angle:0,angularVelocity:2,weaponWorldCooldown:0,vx:120,vy:20};
  assert.ok(collectWeaponWorldContact(holder,bounds),`${id} attachment should collide with the world`);
  assert.equal(holder.vx,-120,`${id} should ricochet away from a right-wall attachment hit`);
  assert.equal(holder.angularVelocity,-2,`${id} attachment should reverse its rotation on contact`);
}

const first=simulateMatch(getFighter('shotgun'),getFighter('sniper'),'ranged-determinism');
const second=simulateMatch(getFighter('shotgun'),getFighter('sniper'),'ranged-determinism');
assert.deepEqual(first,second,'ranged simulation must replay identically from the same seed');
console.log('Projectile, weapon-contact, and deterministic replay tests passed.');
