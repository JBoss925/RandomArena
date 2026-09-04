import assert from 'node:assert/strict';
import {stepProjectiles} from '../src/projectiles.js';
import {applyWeaponMotion,collectWeaponHit,collectWeaponWorldContact} from '../src/weapons.js';
import {runBehaviorHook} from '../src/behaviors.js';
import {matchupKey,runMatchup} from './balance-core.js';
import {fighters,getFighter} from '../src/fighters.js';
import {simulateMatch} from '../src/headless-simulation.js';
import {createInitialBall} from '../src/initial-conditions.js';
import {SOUND_OUTPUT_GAIN,soundCues,soundSources} from '../src/sounds.js';
import {contactFeedback} from '../src/materials.js';
import {impactSpeedScale} from '../src/combat-config.js';
import {statSync} from 'node:fs';
import {audioDurationSeconds} from './audio-duration.js';
import {contrastForeground,contrastRatio} from '../src/color-contrast.js';
import {castGrapple,grappleHeadContact} from '../src/grapple.js';
import {wallCollisionSide} from '../src/physics.js';
import {deployMine,explodeGrenade,stepMines,throwGrenade} from '../src/explosives.js';
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

const seeker:Projectile={shooter,side:'left',x:80,y:80,previousX:80,previousY:80,vx:100,vy:0,radius:4,damage:8,force:7,life:30,type:'heatseeker',color:'#c8ff65',dead:false,homingAcceleration:100,maxSpeed:300,turnRate:1};
Object.assign(target,{x:230,y:180,radius:12,hp:100});sim={balls:[shooter,target],projectiles:[seeker]};
stepProjectiles(sim,.1,bounds);
assert.ok(seeker.vy>0,'a heatseeker should turn toward an offset target');
assert.ok(Math.abs(Math.hypot(seeker.vx,seeker.vy)-110)<.001,'a heatseeker should accelerate deterministically toward its speed ceiling');
const mothership=makeBall('mothership','left');Object.assign(mothership,{carrierCooldown:1});
const carrierSim={balls:[mothership,target],projectiles:[],ticks:1,hitStop:0} as never;
runBehaviorHook(mothership,'tick',{sim:carrierSim,rival:target,event:{dt:1/60,force:0,damage:0},random:()=>.5});
assert.equal((carrierSim as {projectiles:Projectile[]}).projectiles[0]?.type,'heatseeker','Mothership should launch a triangular heatseeker when its bay is ready');

const claymore=makeBall('claymore','left'),mineTarget=makeBall('brick','right');Object.assign(claymore,{x:150,y:150,vx:400,vy:0,powerScale:1});
const explosiveSim={balls:[claymore,mineTarget],projectiles:[],mines:[],rng:()=>.25,ticks:20,width:300,height:300} as never;
const mine=deployMine(claymore,explosiveSim);assert.ok(mine.x<claymore.x,'Claymore should lay mines behind its current travel direction');
Object.assign(mine,{armingFrames:0});Object.assign(mineTarget,{x:mine.x,y:mine.y});
const mineHits=stepMines(explosiveSim);assert.equal(mineHits[0]?.target,mineTarget,'an armed mine should trigger on any overlapping fighter');
assert.equal(Math.hypot(mineHits[0].launchX,mineHits[0].launchY),1280,'a mine blast should enforce its massive launch speed');
const resistedBlast={damage:40,force:18,explosive:true};runBehaviorHook(claymore,'modifyIncoming',{event:resistedBlast});assert.equal(resistedBlast.damage,14,'Claymore should resist 65% of explosive damage');
Object.assign(mineTarget,{x:240,y:150});const grenade=throwGrenade(claymore,mineTarget,explosiveSim);assert.ok(grenade.vx>0&&Math.abs(grenade.vy)<1e-9,'a grenade should aim at the opponent current position');
Object.assign(mineTarget,{x:100,y:40});
Object.assign(grenade,{x:285,y:150,previousX:285,previousY:150,vx:1000,vy:0,armingFrames:0});
const grenadeImpacts=stepProjectiles(explosiveSim,.1,bounds);assert.equal(grenadeImpacts[0]?.world,true,'a grenade should detonate when geometry intercepts it');
explodeGrenade(grenadeImpacts[0].projectile,explosiveSim);assert.equal((explosiveSim as {projectiles:Projectile[]}).projectiles.filter(projectile=>projectile.type==='shrapnel').length,12,'a grenade should burst into twelve radial shrapnel pieces');

const spider=makeBall('spider','left'),webTarget=makeBall('brick','right');
Object.assign(spider,{x:80,y:150,vx:600,vy:0});Object.assign(webTarget,{x:180,y:150,radius:25});
assert.equal(castGrapple(spider,webTarget,bounds,[],0).type,'fighter','a grapple ray should web a fighter before the wall');
assert.equal(castGrapple(spider,webTarget,bounds,[],Math.PI).type,'geometry','a grapple ray should anchor to geometry when no fighter intercepts it');
assert.ok(spider.radius<makeBall('mint','left').radius,'Spider should have a deliberately small collision body');
const castingSpider=makeBall('spider','left');Object.assign(castingSpider,{x:80,y:150,grappleCooldown:0});
runBehaviorHook(castingSpider,'tick',{sim:{width:300,height:300,hazards:[],ticks:1} as never,rival:webTarget,event:{dt:1/60,force:0,damage:0},random:()=>.5,showImpact:()=>{}});
assert.equal(castingSpider.grappleMode,'casting','a launched grapple should visibly travel before attaching');
assert.equal(castingSpider.grappleTravel,0,'the grapple head should begin at Spider');
runBehaviorHook(castingSpider,'tick',{sim:{width:300,height:300,hazards:[],ticks:2} as never,rival:webTarget,event:{dt:1/60,force:0,damage:0},random:()=>.5,showImpact:()=>{}});
assert.equal(castingSpider.grappleTravel,15,'the grapple head should advance at a fixed deterministic speed');
const castFrames=Math.ceil(((castingSpider.grappleRange??0)-(castingSpider.grappleTravel??0))/15);
for(let frame=0;frame<castFrames;frame++)runBehaviorHook(castingSpider,'tick',{sim:{width:300,height:300,hazards:[],ticks:frame+3} as never,rival:webTarget,event:{dt:1/60,force:0,damage:0},random:()=>.5,showImpact:()=>{}});
assert.equal(castingSpider.grappleMode,'swinging','a geometry grapple should begin swinging only after its line arrives');
assert.deepEqual(grappleHeadContact({x:100,y:100},{x:180,y:100},{x:150,y:100},10),{x:140,y:100},'the moving grapple head should use swept fighter collision');
const latchingSpider=makeBall('spider','left'),latchTarget=makeBall('brick','right');
Object.assign(latchingSpider,{x:20,y:100,vx:400,vy:50,grappleMode:'casting',grappleOriginX:20,grappleOriginY:100,grappleDirectionX:1,grappleDirectionY:0,grappleTravel:0,grappleRange:200});
Object.assign(latchTarget,{x:100,y:100,radius:20,vx:-300,vy:80});
runBehaviorHook(latchingSpider,'tick',{sim:{width:300,height:300,hazards:[],ticks:1} as never,rival:latchTarget,event:{dt:.1,force:0,damage:0},random:()=>.5,showImpact:()=>{}});
assert.equal(latchingSpider.grappleMode,'pulling','a grapple head should begin its pull immediately after touching the opponent');
assert.equal(Math.hypot(latchingSpider.vx,latchingSpider.vy),0,'Spider should dead-stop on a fighter latch');
assert.equal(Math.hypot(latchTarget.vx,latchTarget.vy),0,'the webbed fighter should dead-stop before the pull');
runBehaviorHook(latchingSpider,'tick',{sim:{width:300,height:300,hazards:[],ticks:2} as never,rival:latchTarget,event:{dt:1/60,force:0,damage:0},random:()=>.5,showImpact:()=>{}});
assert.equal(Math.hypot(latchingSpider.vx,latchingSpider.vy),0,'Spider should hold position while reeling the opponent in');
assert.equal(Math.hypot(latchTarget.vx,latchTarget.vy),150,'the whip pull should accelerate the opponent sharply on its first fixed step');
Object.assign(spider,{grappleMode:'swinging',grappleX:80,grappleY:50,grappleLength:100,grappleDirection:1,vx:500,vy:0});
runBehaviorHook(spider,'beforeMove',{event:{dt:1/60,force:0,damage:0}});
assert.ok(Math.hypot(spider.vx,spider.vy)>760,'a tethered swing should gain speed along its tangent');
runBehaviorHook(spider,'geometryHit',{event:{force:0,damage:0,geometry:{x:80,y:0,nx:0,ny:1,type:'wall'}},showImpact:()=>{}});
assert.equal(spider.grappleMode,'perched','touching geometry during a swing should enter the perch state');
assert.equal(Math.hypot(spider.vx,spider.vy),0,'a perched Spider should stop at the contact point');
const perchedLeft=28+spider.radius-Number.EPSILON*32;
assert.equal(wallCollisionSide(perchedLeft,spider.radius,28,692,0),0,'stationary floating-point residue at the left wall must not retrigger contact');
assert.equal(wallCollisionSide(perchedLeft,spider.radius,28,692,-1),-1,'outward motion from the left wall should still register contact');
assert.equal(wallCollisionSide(28+spider.radius-.01,spider.radius,28,692,0),-1,'real wall penetration should resolve even at zero velocity');
Object.assign(spider,{grappleFrames:1});
runBehaviorHook(spider,'tick',{sim:{width:300,height:300,hazards:[],ticks:1} as never,rival:webTarget,event:{dt:1/60,force:0,damage:0},random:()=>.5,showImpact:()=>{}});
assert.equal(spider.grappleMode,undefined,'Spider should leave its perch after the hold');
assert.ok(Math.hypot(spider.vx,spider.vy)>=900,'a wall leap should eject Spider at its minimum speed');
const webDamage={force:6,damage:3,targetSpeed:1220};Object.assign(spider,{grappleMode:'pulling'});
runBehaviorHook(spider,'modifyOutgoing',{event:webDamage});
assert.ok(webDamage.damage>15,'Web Pull should scale from the pulled opponent speed');
const swingDamage={force:8,damage:4,attackerSpeed:1100};Object.assign(spider,{grappleMode:'swinging',grappleX:20,grappleY:20,grappleLength:100,vx:700,vy:250});
runBehaviorHook(spider,'modifyOutgoing',{event:swingDamage});
assert.ok(swingDamage.damage>=30,'a committed swing connection should deal one large speed-scaled hit');
const ricochetVelocity={x:spider.vx,y:spider.vy};
runBehaviorHook(spider,'dealHit',{rival:webTarget,event:swingDamage,random:()=>.5,showImpact:()=>{}});
assert.equal(spider.grappleMode,undefined,'a swing connection should immediately release its tether');
assert.deepEqual({x:spider.vx,y:spider.vy},ricochetVelocity,'releasing the tether must preserve the elastic ricochet velocity');
const spiderReplayA=simulateMatch(fighter('spider'),fighter('anchor'),'web-determinism');
const spiderReplayB=simulateMatch(fighter('spider'),fighter('anchor'),'web-determinism');
assert.deepEqual(spiderReplayA,spiderReplayB,'Spider grapples must replay identically from the same seed');

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
assert.equal(contactFeedback('plastic','plastic',5).cue,'materialPlastic','ordinary balls should make a light plastic clack');
assert.equal(contactFeedback('plastic','plastic',5,{wall:true}).cue,'materialWall','ordinary wall contacts should use the lighter arena tap');
assert.equal(contactFeedback('metal','plastic',5).cue,'materialMetal','metal bodies should retain their metallic contact');
assert.equal(contactFeedback('rubber','metal',5).cue,'materialSoft','rubber should damp contact with a hard body');
assert.equal(contactFeedback(fighter('mint').material,fighter('anchor').material,5).cue,'materialSoft','Mint versus Anchor should route to an audible mixed-material cue');
assert.equal(contactFeedback('wood','metal',5,{primary:true}).cue,'materialWood','a wooden bat should sound like wood regardless of its target');
for(const id of ['brick','mint','goldie','moss','frost','rook','anchor'])assert.ok(fighter(id).material,`${id} should declare a body material`);
for(const current of fighters){
  const foreground=contrastForeground(current.color),chosen=foreground==='light'?'#fff':'#151515',other=foreground==='light'?'#151515':'#fff';
  assert.ok(contrastRatio(current.color,chosen)>=contrastRatio(current.color,other),`${current.name} should receive its highest-contrast card foreground`);
  for(const item of current.specs)assert.doesNotMatch(`${item.label} ${item.value}`,/px\/s|px\/s²|rad\/s|projectile width|force above/i,`${current.name} should explain engine-space behavior in plain language`);
}
const fixedStats=createInitialBall(fighter('flail'),'left',()=>.99);
assert.equal(fixedStats.powerScale,1,'seeds must not reroll fighter damage');
assert.equal(impactSpeedScale(600,600),1,'equal-speed impacts should preserve base damage');
assert.equal(impactSpeedScale(1200,0),1.15,'impact damage should respect its upper speed cap');
assert.equal(impactSpeedScale(0,1200),.85,'impact damage should respect its lower speed cap');
runBehaviorHook(fixedStats,'tick',{sim:{ticks:0,balls:[fixedStats]} as never,rival:makeBall('brick','right'),event:{dt:0,force:0,damage:0},random:()=>.01});
assert.equal(fixedStats.flailSpeed,8.6,'Flail base spin must not reroll with the seed');
assert.equal(fighter('saber').weapon?.material,'metal');
assert.equal(fighter('slugger').weapon?.material,'wood');
for(const source of Object.values(soundSources)){
  assert.equal(source.license,'CC0');
  assert.ok(source.volume>=0&&source.volume<=1,`${source.localUrl} source volume should remain between 0 and 1`);
  assert.match(source.sourcePage,/^https:\/\/opengameart\.org\//);
  assert.match(source.dataMp3Url,/^https:\/\/opengameart\.org\/sites\/default\/files\//);
  assert.ok(statSync(new URL(`../public${source.localUrl}`,import.meta.url)).size>2_000,`${source.localUrl} should contain a downloaded audio asset`);
}
assert.ok(Object.keys(soundSources).length>=19,'the library should include distinct material recordings');
assert.ok(Object.keys(soundCues).length>=20,'the semantic sound library should cover combat and fighter abilities');
assert.equal(SOUND_OUTPUT_GAIN,.25,'100% player volume should cap output at one quarter of the original level');
for(const [cue,definition] of Object.entries(soundCues)){
  assert.ok(definition.file||definition.synth,`${cue} needs a recording or synthesized fallback`);
  if(definition.file)assert.ok(statSync(new URL(`../public${definition.file}`,import.meta.url)).size>2_000,`${cue} should map to an available audio file`);
}
assert.equal(soundCues.coin.file,'/audio/goldie-coin.mp3','Goldie stacks should use the dedicated coin cue');
assert.equal(soundCues.jackpot.file,'/audio/goldie-jackpot.mp3','Goldie jackpot should use the dedicated cash-register cue');
for(const cue of ['lanceCharge','lanceHit','grow','flail','magnetPull','magnetPush'] as const)assert.ok(soundCues[cue],`${cue} should have an editable sound mapping`);
for(const cue of ['droneLaunch','droneHit'] as const)assert.ok(soundCues[cue],`${cue} should have an editable sound mapping`);
for(const cue of ['webShot','webSwing','webImpact','webPerch'] as const)assert.ok(soundCues[cue],`${cue} should have an editable sound mapping`);
for(const cue of ['mineDeploy','explosion','grenade','shrapnel'] as const)assert.ok(soundCues[cue],`${cue} should have an editable sound mapping`);
assert.ok(soundCues.coin.volume>=.7,'Goldie stacks should remain audible in the combat mix');
assert.ok(soundCues.bodyContact.file,'ordinary fighter collisions need an audible foundation recording');
assert.ok(soundCues.wallContact.file,'ordinary arena contacts need an audible foundation recording');
assert.ok(soundCues.materialSoft.volume>=.5,'mixed soft/hard contacts such as Mint versus Anchor must remain audible');
const goldie=makeBall('goldie','left'),goldieSounds:string[]=[];
runBehaviorHook(goldie,'dealHit',{event:{damage:5,force:5},playSound:cue=>goldieSounds.push(cue)});
runBehaviorHook(goldie,'dealHit',{event:{damage:17,force:5,jackpot:true},playSound:cue=>goldieSounds.push(cue)});
assert.deepEqual(goldieSounds,['coin','jackpot'],'Goldie should sound both a stack gain and jackpot cashout');
const lance=makeBall('lance','left'),lanceRival=makeBall('brick','right');
Object.assign(lance,{joustCooldown:1,angle:0,vx:0,vy:0});Object.assign(lanceRival,{x:lance.x+300,y:lance.y});
runBehaviorHook(lance,'tick',{sim:{ticks:10,hitStop:0} as never,rival:lanceRival,event:{dt:1/60,force:0,damage:0},showImpact:()=>{}});
assert.ok((lance.joustFrames??0)>0,'Lance should enter a timed joust when its charge comes ready');
assert.ok(Math.hypot(lance.vx,lance.vy)>=1200,'a joust should commit Lance to a visibly fast charge');
const joustDefense={damage:30,force:10};runBehaviorHook(lance,'modifyIncoming',{rival:lanceRival,event:joustDefense});
assert.equal(joustDefense.damage,0,'Lance should be invulnerable during its committed joust');
const grower=makeBall('grower','left'),startingRadius=grower.radius;
runBehaviorHook(grower,'wallHit',{rival:lance,event:{damage:0,force:0}});
assert.ok(grower.radius>startingRadius,'Grower should change its real collision radius on a rebound');
const polar=makeBall('polar','left'),polarTarget=makeBall('mint','right');Object.assign(polar,{polarity:1,x:100,y:100});Object.assign(polarTarget,{x:200,y:100,vx:0,vy:0});
runBehaviorHook(polar,'dealHit',{rival:polarTarget,event:{damage:5,force:5},showImpact:()=>{}});
assert.equal(polar.polarity,-1,'Polar should reverse polarity after a direct hit');
assert.ok(polarTarget.vx>=760,'repulsion should guarantee a legible minimum launch speed');
for(const id of ['lance','grower','flail','polar'])assert.ok(fighter(id),`${id} should be addressable by the seeded roster`);
const duration=(source:keyof typeof soundSources):number=>audioDurationSeconds(new URL(`../public${soundSources[source].localUrl}`,import.meta.url));
const cueDuration=(cue:keyof typeof soundCues):number=>{
  const definition=soundCues[cue];
  assert.ok(definition.file,`${cue} should map to a recording`);
  return audioDurationSeconds(new URL(`../public${definition.file}`,import.meta.url))/definition.rate;
};
assert.ok(duration('rubberBoing')<.1,'rapid rubber contacts need a naturally tiny source sample');
assert.ok(duration('bodyContact')<.25,'ordinary collisions need a naturally short contact transient');
assert.ok(duration('metalTap')<.35,'routine metal contacts need a naturally short source sample');
assert.ok(duration('pinballBumper')<.4,'pinball bumpers need a compact source sample');
for(const source of ['freeze','iceShatter','healing','coin','burstFire','shotgunFire','laserFire','teleport','completion'] as const){
  assert.ok(duration(source)<.8,`${source} should use a standalone effect below 800ms`);
}
assert.equal(soundCues.shotgun.file,'/audio/shotgun-fire.mp3','Shotgun should use the browser-ready real firearm recording');
assert.ok(soundCues.shotgun.volume*soundSources.shotgunFire.volume>=.9,'Shotgun blast must remain prominent in the combat mix');
assert.ok(duration('fire')/soundCues.fire.rate<.8,'fire ignition should finish below 800ms at its intended playback rate');
for(const cue of ['bodyContact','wallContact','materialPlastic','materialWall','materialRubber','materialWood','materialStone','materialGlass','materialSoft','materialMetal','materialEnergy','coin','sword','bat','pinball'] as const){
  assert.ok(cueDuration(cue)<.4,`${cue} should use a true contact transient below 400ms`);
}
for(const [cue,definition] of Object.entries(soundCues))if(definition.file){
  assert.ok(audioDurationSeconds(new URL(`../public${definition.file}`,import.meta.url))/definition.rate<=2,`${cue} should finish within two seconds at its intended rate`);
}
const balanceSample=runMatchup(fighter('rook'),fighter('volt'),2);
assert.equal(matchupKey('volt','rook'),'rook--volt','matchup shards should use a stable unordered key');
assert.equal(balanceSample.simulations,4,'a matchup should run the requested seed count from both sides');
assert.equal(balanceSample.results.rook.games,4,'each fighter should receive every mirrored matchup result');
assert.equal(balanceSample.results.rook.asLeft.games,2,'literal left-side results should be tracked independently');
assert.equal(balanceSample.results.rook.asRight.games,2,'literal right-side results should be tracked independently');
console.log('Projectile, weapon-contact, deterministic replay, and CC0 sound-library tests passed.');
