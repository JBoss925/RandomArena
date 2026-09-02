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

const saber={f:getFighter('saber'),x:260,y:150,radius:64,angle:0,angularVelocity:2,weaponWorldCooldown:0};
assert.ok(collectWeaponWorldContact(saber,bounds));
assert.equal(saber.angularVelocity,-2,'wall contact should reverse a melee attachment');
saber.angularVelocity=2;
runBehaviorHook(saber,'dealHit',{event:{weapon:true},showImpact:()=>{}});
assert.ok(saber.angularVelocity<0,'fighter contact should reverse Saber');

const first=simulateMatch(getFighter('shotgun'),getFighter('sniper'),'ranged-determinism');
const second=simulateMatch(getFighter('shotgun'),getFighter('sniper'),'ranged-determinism');
assert.deepEqual(first,second,'ranged simulation must replay identically from the same seed');
console.log('Projectile, weapon-contact, and deterministic replay tests passed.');
