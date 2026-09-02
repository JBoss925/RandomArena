import './style.css';
import { runBehaviorHook } from './behaviors.js';
import { resolveElasticCollision } from './physics.js';
import { collectWeaponHit, collectWeaponWorldContact, drawWeapon } from './weapons.js';
import { fireRangedWeapon, stepProjectiles } from './projectiles.js';
import { drawFighterIcon } from './icons.js';
import { fighters, getFighter } from './fighters.js';
import { createInitialBall } from './initial-conditions.js';
import { contactForce } from './combat-config.js';
import { specIcon } from './spec-icons.js';
import { resolveOutcome } from './outcome.js';

const $ = (id) => document.getElementById(id);
const canvas = $('arena');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const STEP = 1 / 60;
const ARENA_BOUNDS={left:28,right:W-28,top:80,bottom:H-28};
const BUMPER_REFERENCE_SPEED=650;
const state = { date: localDateKey(), mode: 'daily', seed: '', versusLeft:'volt', versusRight:'brick', bouts: [], index: 0, selected: null, highlightedSide: null, running: false, paused: false, simulationSpeed:1, result: null, wins: 0, losses: 0, cardComplete: false, sound: true, sim: null, accumulator: 0, lastTime: 0 };

function localDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function randomSeed(){
  const words=new Uint32Array(2);crypto.getRandomValues(words);
  return `${words[0].toString(16).padStart(8,'0')}-${words[1].toString(16).padStart(8,'0')}`.toUpperCase();
}
function cleanSeed(value){return value.trim().slice(0,64)||randomSeed();}
function hashString(str) { let h = 2166136261 >>> 0; for (let i=0;i<str.length;i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(seed) { return () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function generateCard(seed) {
  const random = mulberry32(hashString(`random-arena:v3:${seed}`));
  const order=[0,1,2,3,4];
  for(let i=order.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  const hazardousBouts=new Set(order.slice(0,2));
  return Array.from({ length: 5 }, (_, i) => {
    const left = fighters[Math.floor(random() * fighters.length)];
    let right = fighters[Math.floor(random() * fighters.length)];
    while (right === left) right = fighters[Math.floor(random() * fighters.length)];
    return { left, right, hazards:hazardousBouts.has(i)?generateHazards(random):[], seed: Math.floor(random() * 0xffffffff) >>> 0 };
  });
}

function generateHazards(random){
  const types=['pillar','spikes','medbay','pinball'];
  for(let i=types.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[types[i],types[j]]=[types[j],types[i]];}
  const count=1+Math.floor(random()*3),hazards=[];
  const ranges={pillar:[30,46],spikes:[27,39],medbay:[30,42],pinball:[23,31]};
  for(let i=0;i<count;i++){
    const type=types[i],[minR,maxR]=ranges[type],r=Math.round(minR+random()*(maxR-minR));
    let x,y,attempt=0;
    do{
      x=Math.round(ARENA_BOUNDS.left+r+18+random()*(ARENA_BOUNDS.right-ARENA_BOUNDS.left-r*2-36));
      y=Math.round(ARENA_BOUNDS.top+r+18+random()*(ARENA_BOUNDS.bottom-ARENA_BOUNDS.top-r*2-36));
      attempt++;
    }while(attempt<30&&(hazards.some(h=>Math.hypot(h.x-x,h.y-y)<h.r+r+34)||Math.hypot(x-165,y-H/2)<r+105||Math.hypot(x-(W-165),y-H/2)<r+105));
    const value=type==='spikes'?Math.round(3+random()*6):type==='medbay'?Math.round(4+random()*7):type==='pinball'?Math.round((1.8+random()*.7)*10)/10:0;
    hazards.push({id:`${type}-${i}`,type,x,y,r,value});
  }
  return hazards;
}

function createSim(bout) {
  const r = mulberry32(bout.seed);
  return { balls: [createInitialBall(bout.left,'left',r),createInitialBall(bout.right,'right',r)], projectiles:[], rng:r, visualRng:mulberry32(bout.seed^0x9e3779b9), ticks:0, hitStop:0, particles:[], impactPopups:[], echoes:[], hazards:bout.hazards, lastExchange:null, width:W, height:H, finished:false };
}

function setupBout() {
  const b = state.bouts[state.index];
  state.selected = null; state.running = false; state.paused = false; state.result = null; state.sim = createSim(b); state.accumulator = 0;
  const num = String(state.index + 1).padStart(2,'0');
  $('left-name').textContent = $('left-pick-name').textContent = b.left.name;
  $('right-name').textContent = $('right-pick-name').textContent = b.right.name;
  setDossier('left', b.left); setDossier('right', b.right);
  $('left-number').textContent = String(fighters.indexOf(b.left)+1).padStart(2,'0'); $('right-number').textContent = String(fighters.indexOf(b.right)+1).padStart(2,'0');
  const hazardNames=b.hazards.length?b.hazards.map(h=>h.type.toUpperCase()).join(' + '):'OPEN';
  $('round-label').textContent = state.mode==='versus'?'1V1 LAB':`BOUT ${num} / 05`; $('seed-label').textContent = `SEED ${b.seed.toString(16).toUpperCase().padStart(8,'0')} / ${hazardNames}`;
  document.documentElement.style.setProperty('--red', b.left.color); document.documentElement.style.setProperty('--blue', b.right.color);
  document.querySelectorAll('.pick-card').forEach(el => el.classList.remove('selected'));
  $('lock-pick').disabled = true; $('lock-pick').hidden = state.mode==='versus'; $('pick-list').hidden = state.mode==='versus'; $('versus-controls').hidden=state.mode!=='versus'; $('result-card').hidden = true; $('result-card').classList.remove('loss','close-call');$('result-breakdown').hidden=true;
  $('arena-stamp').textContent = state.mode==='versus'?'READY':'MAKE YOUR PICK'; $('arena-stamp').classList.remove('hidden');
  $('bet-title').hidden=false;$('fight-instruction').hidden=false;
  $('global-pause').textContent = 'Ⅱ PAUSE FIGHT'; $('global-pause').classList.remove('active');
  updatePips(); updateHud(); draw();
}

function resetCard(){
  state.index=0;state.wins=0;state.losses=0;state.cardComplete=false;
  state.bouts=state.mode==='versus'?[{left:getFighter(state.versusLeft),right:getFighter(state.versusRight),hazards:[],seed:hashString(`versus:${state.seed}`)}]:generateCard(state.seed);
  $('record').textContent='0—0';setupBout();
}

function setMode(mode,seed,{push=true,left=state.versusLeft,right=state.versusRight}={}){
  state.mode=mode==='versus'?'versus':mode==='endless'?'endless':'daily';
  state.versusLeft=getFighter(left)?.id??'volt';state.versusRight=getFighter(right)?.id??'brick';
  state.seed=state.mode==='daily'?`DAILY-${state.date}`:cleanSeed(seed||randomSeed());
  document.querySelectorAll('[data-route]').forEach(link=>link.classList.toggle('active',link.dataset.route===state.mode));
  document.body.classList.toggle('versus-mode',state.mode==='versus');
  $('stats-viewer').hidden=state.mode!=='versus';
  $('seed-title').textContent=state.mode==='daily'?'DAILY SEED':state.mode==='versus'?'MATCH SEED':'ENDLESS SEED';
  $('seed-input').value=state.seed;$('seed-input').readOnly=state.mode==='daily';
  $('load-seed').disabled=state.mode==='daily';
  $('random-seed').disabled=state.mode==='daily';
  $('seed-help').textContent=state.mode==='daily'?"Today's seed is locked, but you can copy it.":state.mode==='versus'?'Fighters and seed are encoded in this shareable URL.':'Enter any seed, load it, then share the link with a friend.';
  $('mode-label').textContent=state.mode==='daily'?'Daily fight card':state.mode==='versus'?'1v1 laboratory':'Endless fight card';
  $('today-label').textContent=state.mode==='daily'?new Date(state.date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'}).toUpperCase():state.mode==='versus'?'HIDDEN TEST ROUTE':'ENDLESS EXHIBITION';
  $('bet-title').innerHTML=state.mode==='versus'?'BUILD A<br />1V1 FIGHT':'WHO LEAVES<br />THE RING?';
  $('fight-instruction').textContent=state.mode==='versus'?'Choose two fighters and run an open-arena deterministic matchup.':'Choose one fighter. The simulation is locked until your pick is in.';
  $('versus-left').value=state.versusLeft;$('versus-right').value=state.versusRight;
  const url=state.mode==='daily'?'/daily':state.mode==='versus'?`/versus?left=${state.versusLeft}&right=${state.versusRight}&seed=${encodeURIComponent(state.seed)}`:`/endless?seed=${encodeURIComponent(state.seed)}`;
  history[push?'pushState':'replaceState']({},'',url);
  resetCard();
  if(state.mode==='versus')loadBalanceStats();
}

let balanceReportPromise;
function loadBalanceStats(){
  balanceReportPromise??=fetch('/data/tier-matrix.json').then(response=>{if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw Error('Balance report unavailable');return response.json();});
  balanceReportPromise.then(report=>renderBalanceStats(report,$('versus-left').value,$('versus-right').value)).catch(()=>$('stats-content').innerHTML='<p>Balance data unavailable. Run <code>"npm run balance"</code> to generate it.</p>');
}
function renderBalanceStats(report,leftId,rightId){
  const leftRank=report.rankings.find(row=>row.id===leftId),rightRank=report.rankings.find(row=>row.id===rightId),leftF=getFighter(leftId),rightF=getFighter(rightId);
  if(!leftRank||!rightRank)return;
  const leftMatch=report.matrix[leftId][rightId],rightMatch=report.matrix[rightId][leftId],pct=value=>`${(value*100).toFixed(1)}%`,num=value=>Number(value).toFixed(1);
  $('stats-sample').textContent=`${report.method.totalSimulations.toLocaleString()} FIGHTS / ${report.method.seedsPerSide} SEEDS PER SIDE`;
  if(!leftMatch||!rightMatch){$('stats-content').innerHTML=`<div class="stat-fighter"><h3>${leftF.name} MIRROR MATCH</h3><p>The balance suite measures unique fighter pairings, so same-fighter mirrors are intentionally excluded. This 1v1 can still be run and shared.</p></div>`;return;}
  const card=(fighter,rank,match,currentSide)=>`<article class="stat-fighter"><h3>${fighter.name}<span>${rank.tier} / #${report.rankings.indexOf(rank)+1}</span></h3><div class="stat-grid"><div><small>OVERALL SCORE</small><strong>${pct(rank.score)}</strong></div><div><small>HEAD-TO-HEAD</small><strong>${pct(match.score)}</strong></div><div><small>WINNING FROM LEFT</small><strong>${pct(match.asLeft.winRate)}</strong></div><div><small>WINNING FROM RIGHT</small><strong>${pct(match.asRight.winRate)}</strong></div><div><small>CURRENT SIDE (${currentSide})</small><strong>${pct(match[currentSide==='LEFT'?'asLeft':'asRight'].score)}</strong></div><div><small>AVG. REMAINING HP</small><strong>${num(match.averageRemainingHp)}</strong></div></div></article>`;
  const currentLeft=leftMatch.asLeft,currentRight=rightMatch.asRight,sideBias=leftMatch.asLeft.score-leftMatch.asRight.score;
  const matchupRows=report.rankings.filter(row=>row.id!==leftId).map(opponent=>{const m=report.matrix[leftId][opponent.id];return`<tr><td>${opponent.name}</td><td>${pct(m.score)}</td><td>${pct(m.asLeft.winRate)}</td><td>${pct(m.asRight.winRate)}</td><td>${m.wins}–${m.losses}–${m.draws}</td><td>${num(m.averageSeconds)}s</td><td>${num(m.averageRemainingHp)}</td></tr>`;}).join('');
  const rosterRows=report.rankings.map((rank,index)=>`<tr><td>#${index+1} ${rank.name}</td><td>${rank.tier}</td><td>${pct(rank.score)}</td><td>${pct(rank.asLeft.score)}</td><td>${pct(rank.asRight.score)}</td><td>${rank.wins}–${rank.losses}–${rank.draws}</td></tr>`).join('');
  $('stats-content').innerHTML=`<div class="stat-comparison">${card(leftF,leftRank,leftMatch,'LEFT')}${card(rightF,rightRank,rightMatch,'RIGHT')}</div><div class="insight-strip"><div><small>CURRENT-SIDE FORECAST</small><strong>${leftF.name} ${pct(currentLeft.score)} / ${rightF.name} ${pct(currentRight.score)}</strong></div><div><small>LEFT-FIGHTER SIDE BIAS</small><strong>${sideBias>=0?'+':''}${pct(sideBias)}</strong></div><div><small>AVERAGE DURATION</small><strong>${num(leftMatch.averageSeconds)} SECONDS</strong></div><div><small>SAMPLE RECORD</small><strong>${leftMatch.wins}–${leftMatch.losses}–${leftMatch.draws}</strong></div></div><div class="stats-table-wrap"><table class="stats-table"><caption>${leftF.name} MATCHUP SPREAD</caption><thead><tr><th>Opponent</th><th>Score</th><th>Wins left</th><th>Wins right</th><th>W–L–D</th><th>Duration</th><th>End HP</th></tr></thead><tbody>${matchupRows}</tbody></table></div><div class="stats-table-wrap" style="margin-top:14px"><table class="stats-table"><caption>FULL ROSTER STANDING</caption><thead><tr><th>Fighter</th><th>Tier</th><th>Overall</th><th>As left</th><th>As right</th><th>W–L–D</th></tr></thead><tbody>${rosterRows}</tbody></table></div>`;
}

function startFight() {
  if ((!state.selected&&state.mode!=='versus') || state.running) return;
  state.running = true; $('lock-pick').hidden = true; if(state.mode==='versus')$('versus-controls').hidden=true; $('arena-stamp').classList.add('hidden');
  audioTone(110, .08, 'sawtooth', .12); setTimeout(() => audioTone(180, .09, 'square', .1), 80);
}

function update(dt) {
  const s = state.sim;
  if (!state.running || state.paused || s.finished) return;
  if (s.hitStop > 0) { s.hitStop--; return; }
  s.ticks++;
  for (const e of s.echoes) { e.frames--; if(e.frames===0){const event={damage:e.damage,force:e.damage,echo:true};e.victim.hp-=event.damage;runBehaviorHook(e.victim,'takeHit',{sim:s,rival:e.attacker,event,random:s.rng,showImpact:impact,audioTone,audioHit});e.victim.flash=6;impact('ECHO!',e.victim);audioHit(.45);} }
  s.echoes=s.echoes.filter(e=>e.frames>0);
  for (const p of s.particles) { p.x += p.vx*dt; p.y += p.vy*dt; p.vy += (p.gravity??500)*dt;p.rotation=(p.rotation??0)+(p.spin??0)*dt;p.life--; }
  s.particles = s.particles.filter(p => p.life > 0);
  for (const b of s.balls) {
    b.cooldown = Math.max(0,b.cooldown-1); b.weaponCooldown=Math.max(0,b.weaponCooldown-1);b.weaponWorldCooldown=Math.max(0,b.weaponWorldCooldown-1);b.fireCooldown=Math.max(0,b.fireCooldown-1); b.stunned = Math.max(0,b.stunned-1); b.flash = Math.max(0,b.flash-1);
    for(const id of Object.keys(b.hazardCooldowns))b.hazardCooldowns[id]=Math.max(0,b.hazardCooldowns[id]-1);
    if (b.burn > 0) { b.burn--; if (b.burn % 12 === 0) b.hp-=.18*(b.burnStacks||1);if(!b.burn)b.burnStacks=0; }
    if(b.wallCrash?.frames>0)b.wallCrash.frames--;
    const rival=s.balls.find(other=>other!==b);
    const behaviorContext={sim:s,rival,event:{dt},random:s.rng,showImpact:impact,emitParticles,audioTone,audioHit};
    runBehaviorHook(b,'tick',behaviorContext);
    if (b.frozen || b.stunned) continue;
    runBehaviorHook(b,'beforeMove',behaviorContext);
    b.angle=(b.angle+b.angularVelocity*dt)%(Math.PI*2);
    b.x += b.vx*dt; b.y += b.vy*dt;
    let hitWall=false;
    if (b.x-b.radius < ARENA_BOUNDS.left || b.x+b.radius > ARENA_BOUNDS.right) { b.x = Math.max(ARENA_BOUNDS.left+b.radius,Math.min(ARENA_BOUNDS.right-b.radius,b.x)); b.vx *= -1;hitWall=true;runBehaviorHook(b,'wallHit',behaviorContext); }
    if (b.y-b.radius < ARENA_BOUNDS.top || b.y+b.radius > ARENA_BOUNDS.bottom) { b.y = Math.max(ARENA_BOUNDS.top+b.radius,Math.min(ARENA_BOUNDS.bottom-b.radius,b.y)); b.vy *= -1;hitWall=true;runBehaviorHook(b,'wallHit',behaviorContext); }
    if(hitWall&&b.wallCrash?.frames>0){b.hp-=b.wallCrash.damage;b.flash=8;b.wallCrash=null;impact('WALL SLAM!',b);audioHit(.9);}
    collideHazard(b, s);
    const weaponContact=collectWeaponWorldContact(b,ARENA_BOUNDS,s.hazards);
    if(weaponContact){impact('CLANG!',weaponContact);emitParticles(weaponContact,{count:7,color:'#f3efdf',speed:250,gravity:250});audioTone(310,.06,'square',.05);}
    const shot=fireRangedWeapon(b,s);
    if(shot){impact(shot.label,shot);emitParticles(shot,{count:b.f.weapon.projectiles??1,color:b.f.accent,speed:180,gravity:0});audioTone(b.f.weapon.type==='sniper'?95:135,.1,'square',.11);}
  }
  resolveProjectileHits(stepProjectiles(s,dt,ARENA_BOUNDS,s.hazards),s);
  resolveWeaponHits(s.balls.map((ball,index)=>collectWeaponHit(ball,s.balls[1-index],dt)).filter(Boolean),s);
  collideBalls(s);
  if (s.ticks > 60*24 && !s.finished) { const [a,b]=s.balls; a.hp -= 0.18; b.hp -= 0.18; }
  const outcome=resolveOutcome(s.balls[0],s.balls[1],{lastExchange:s.lastExchange,tick:s.ticks});
  if(outcome)finishFight(outcome.winner,outcome);
}

function resolveWeaponHits(hits,s){
  if(!hits.length)return;
  const before={left:s.balls[0].hp,right:s.balls[1].hp};
  const prepared=hits.map(hit=>{
    const {attacker,victim}=hit;attacker.hits++;victim.incoming++;
    const event={force:hit.force,damage:hit.damage,weapon:true};
    const context={sim:s,rival:victim,event,random:s.rng,showImpact:impact,emitParticles,audioTone,audioHit};
    runBehaviorHook(attacker,'modifyOutgoing',context);
    runBehaviorHook(victim,'modifyIncoming',{...context,rival:attacker});
    return {...hit,event,context};
  });
  for(const hit of prepared)hit.victim.hp-=hit.event.damage;
  for(const hit of prepared){
    const {attacker,victim,event,context}=hit;
    const invVictim=1/(victim.mass??victim.f.mass),invAttacker=1/(attacker.mass??attacker.f.mass);
    victim.vx+=hit.impulseX*invVictim;victim.vy+=hit.impulseY*invVictim;
    attacker.vx-=hit.impulseX*invAttacker*.18;attacker.vy-=hit.impulseY*invAttacker*.18;
    victim.flash=7;s.hitStop=Math.max(s.hitStop,Math.round(2+event.force*.25));
    runBehaviorHook(attacker,'dealHit',context);
    runBehaviorHook(victim,'takeHit',{...context,rival:attacker});
    for(let i=0;i<8;i++)s.particles.push({x:victim.x,y:victim.y,vx:(s.visualRng()-.5)*420,vy:(s.visualRng()-.5)*420,life:14+Math.floor(s.visualRng()*10),color:attacker.f.color});
    impact(hit.label,victim);audioHit(event.force/16);
  }
  const [left,right]=s.balls;
  s.lastExchange={tick:s.ticks,source:'weapon exchange',before,after:{left:left.hp,right:right.hp},damageTaken:{left:before.left-left.hp,right:before.right-right.hp}};
}

function resolveProjectileHits(hits,s){
  if(!hits.length)return;
  const before={left:s.balls[0].hp,right:s.balls[1].hp};
  const prepared=hits.map(hit=>{
    const attacker=hit.projectile.shooter,victim=hit.target;attacker.hits++;victim.incoming++;
    const event={force:hit.projectile.force,damage:hit.projectile.damage,weapon:true,projectile:true};
    const context={sim:s,rival:victim,event,random:s.rng,showImpact:impact,emitParticles,audioTone,audioHit};
    runBehaviorHook(attacker,'modifyOutgoing',context);runBehaviorHook(victim,'modifyIncoming',{...context,rival:attacker});
    return{...hit,attacker,victim,event,context};
  });
  for(const hit of prepared)hit.victim.hp-=hit.event.damage;
  for(const hit of prepared){
    hit.victim.flash=8;runBehaviorHook(hit.attacker,'dealHit',hit.context);runBehaviorHook(hit.victim,'takeHit',{...hit.context,rival:hit.attacker});
    impact(hit.projectile.type==='sniper'?'HEADSHOT!':'PELLET!',{x:hit.x,y:hit.y});
    emitParticles({x:hit.x,y:hit.y},{count:hit.projectile.type==='sniper'?14:5,color:hit.projectile.color,speed:320,gravity:180});audioHit(hit.event.force/20);
  }
  const [left,right]=s.balls;s.lastExchange={tick:s.ticks,source:'projectile volley',before,after:{left:left.hp,right:right.hp},damageTaken:{left:before.left-left.hp,right:before.right-right.hp}};
}

function collideHazard(b,s) {
  for (const h of s.hazards) {
    const dx=b.x-h.x,dy=b.y-h.y,d=Math.hypot(dx,dy),min=b.radius+h.r;
    if (d<min && d>0) {
      const nx=dx/d,ny=dy/d; b.x=h.x+nx*min; b.y=h.y+ny*min; const dot=b.vx*nx+b.vy*ny;
      b.vx-=2*dot*nx; b.vy-=2*dot*ny;
      const ready=!b.hazardCooldowns[h.id];
      if(h.type==='pinball') {
        // A bumper is an absolute radial launch, not a mild elastic rebound. It
        // never slows an already-fast fighter and is strong enough to read at a glance.
        const incomingSpeed=Math.hypot(b.vx,b.vy);
        const launchSpeed=Math.max(incomingSpeed,BUMPER_REFERENCE_SPEED*h.value);
        b.vx=nx*launchSpeed;b.vy=ny*launchSpeed;
        if(ready){
          impact(`${h.value.toFixed(1)}× BOOST!`,{x:h.x+nx*h.r,y:h.y+ny*h.r});audioTone(190,.12,'square',.13);s.hitStop=3;b.flash=7;b.hazardCooldowns[h.id]=12;
          for(let i=0;i<12;i++){const a=i*Math.PI/6;s.particles.push({x:h.x+Math.cos(a)*h.r,y:h.y+Math.sin(a)*h.r,vx:Math.cos(a)*420,vy:Math.sin(a)*420,life:18,color:'#f6b817'});}
        }
      }
      else if(h.type==='spikes' && ready) { b.hp=Math.max(0,b.hp-h.value);b.flash=8;b.hazardCooldowns[h.id]=45;impact(`−${h.value} HP`,{x:h.x+nx*h.r,y:h.y+ny*h.r});audioHit(.7); }
      else if(h.type==='medbay' && ready) { const before=b.hp;b.hp=Math.min(100,b.hp+h.value);b.hazardCooldowns[h.id]=75;if(b.hp>before){impact(`+${h.value} HP`,b);audioTone(520,.12,'sine',.07);} }
      else if(ready){audioHit(.3);b.hazardCooldowns[h.id]=8;}
    }
  }
}

function collideBalls(s) {
  const [a,b]=s.balls;
  const collision=resolveElasticCollision(a,b);
  if(!collision)return;
  const rel=collision.relativeNormalSpeed;
  if (!a.cooldown && !b.cooldown) {
    const before={left:a.hp,right:b.hp};
    const force=contactForce(rel);
    a.hits++; b.incoming++; b.hits++; a.incoming++;
    const eventA={force,damage:force*a.f.power*a.powerScale*(a.f.bodyDamageScale??1)};
    const eventB={force,damage:force*b.f.power*b.powerScale*(b.f.bodyDamageScale??1)};
    const contextA={sim:s,rival:b,event:eventA,random:s.rng,showImpact:impact,emitParticles,audioTone,audioHit};
    const contextB={sim:s,rival:a,event:eventB,random:s.rng,showImpact:impact,emitParticles,audioTone,audioHit};
    s.hitStop=Math.round(2+force*.32);
    // Calculate both sides before applying either result: damage is simultaneous.
    runBehaviorHook(a,'modifyOutgoing',contextA);
    runBehaviorHook(b,'modifyIncoming',{...contextA,rival:a});
    runBehaviorHook(b,'modifyOutgoing',contextB);
    runBehaviorHook(a,'modifyIncoming',{...contextB,rival:b});
    a.hp-=eventB.damage; b.hp-=eventA.damage;
    a.stunned=b.stunned=Math.round(3+force*.45); a.flash=b.flash=7; a.cooldown=b.cooldown=9;
    runBehaviorHook(a,'dealHit',contextA);
    runBehaviorHook(b,'takeHit',{...contextA,rival:a});
    runBehaviorHook(b,'dealHit',contextB);
    runBehaviorHook(a,'takeHit',{...contextB,rival:b});
    s.lastExchange={tick:s.ticks,source:'body collision',before,after:{left:a.hp,right:b.hp},damageTaken:{left:before.left-a.hp,right:before.right-b.hp}};
    for(let i=0;i<12;i++) s.particles.push({x:(a.x+b.x)/2,y:(a.y+b.y)/2,vx:(s.visualRng()-.5)*360,vy:(s.visualRng()-.5)*360,life:16+Math.floor(s.visualRng()*12),color:i%2?a.f.color:b.f.color});
    impact(force>11?'CRACK!':force>7?'WHAM!':'BOP!',{x:(a.x+b.x)/2,y:(a.y+b.y)/2}); audioHit(force/16);
  }
}

function setDossier(side,f){
  const specs=f.specs.map(item=>`<div class="dossier-spec">${specIcon(item.icon)}<span><small>${item.label}</small><b>${item.value}</b></span></div>`).join('');
  $(side+'-dossier').innerHTML=`<strong>${f.ability}</strong><p>${f.desc}</p><div class="dossier-specs">${specs}</div><small class="core-stats">SPD ${Math.round(f.speed*100)} · PWR ${Math.round(f.power*100)} · MASS ${Math.round(f.mass*100)} · FORM ±10%</small>`;
  $(side+'-info').setAttribute('aria-label',`${f.name}: ${f.ability}. ${f.desc}`);
}

function finishFight(winner,resolution={mutualKo:false}) {
  const s=state.sim; s.finished=true; state.running=false; state.result=winner;
  $('bet-title').hidden=true;$('fight-instruction').hidden=true;
  const bout=state.bouts[state.index],name=winner==='left'?bout.left.name:winner==='right'?bout.right.name:'DRAW';
  $('arena-stamp').textContent=winner==='draw'?'DEAD HEAT':`${name} WINS`; $('arena-stamp').classList.remove('hidden');
  renderCloseCall(resolution,bout);
  if(state.mode==='versus'){
    $('versus-controls').hidden=true;$('result-card').hidden=false;$('result-card').classList.remove('loss');$('result-title').textContent=resolution.mutualKo?'THAT WAS CLOSE':winner==='draw'?'DEAD HEAT':`${name} WINS`;
    if(!resolution.mutualKo)$('result-copy').textContent=`Seed ${state.seed}. Run it again or change either fighter.`;$('next-bout').textContent='RUN AGAIN →';return;
  }
  const correct=winner===state.selected;correct?state.wins++:state.losses++;
  $('pick-list').hidden=true; $('result-card').hidden=false; $('result-card').classList.toggle('loss',!correct); $('result-title').textContent=resolution.mutualKo?'THAT WAS CLOSE':correct?'YOU CALLED IT':'PICK BUSTED';
  if(!resolution.mutualKo)$('result-copy').textContent=`${name} takes bout ${state.index+1}. ${correct?'The perfect card is still alive.':'No perfect card today—but the streak continues.'}`;
  $('next-bout').textContent=state.index===4?'SEE FINAL CARD →':'NEXT BOUT →'; $('record').textContent=`${state.wins}—${state.losses}`; updatePips();
  audioTone(correct?520:100,.22,correct?'sine':'sawtooth',.15);
}

function renderCloseCall(result,bout){
  const box=$('result-breakdown');box.hidden=!result.mutualKo;$('result-card').classList.toggle('close-call',result.mutualKo);
  if(!result.mutualKo)return;
  const hp=n=>`${n<0?'−':''}${Math.abs(n).toFixed(1)} HP`;
  $('result-copy').textContent='Both fighters dropped below zero HP.';
  $('result-final-hp').textContent=`${bout.left.name} ${hp(result.leftHp)} / ${bout.right.name} ${hp(result.rightHp)}`;
  $('result-margin').textContent=result.decidedBy==='overkillHp'?`${result.hpMargin.toFixed(1)} HP`:'DEAD-EVEN HP';
  $('result-ruling').textContent=result.decidedBy.replace(/([A-Z])/g,' $1').toUpperCase();
}

function draw() {
  const s=state.sim; ctx.clearRect(0,0,W,H); ctx.fillStyle='#d9d4c2'; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#777468'; ctx.globalAlpha=.27; ctx.lineWidth=1;
  for(let x=0;x<W;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();} for(let y=0;y<H;y+=48){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();} ctx.globalAlpha=1;
  ctx.strokeStyle='#151515';ctx.lineWidth=8;ctx.strokeRect(24,76,W-48,H-100);
  drawHazards(s.hazards);
  drawProjectiles(s.projectiles);
  for(const p of s.particles)drawEffectParticle(p);ctx.globalAlpha=1;
  for(const b of s.balls) drawBall(b);
  drawImpactPopups(s);
  if(state.paused){ctx.fillStyle='rgba(21,21,21,.68)';ctx.fillRect(0,0,W,H);ctx.fillStyle='#e6ff34';ctx.font='48px Archivo Black';ctx.textAlign='center';ctx.fillText('FIGHT PAUSED',W/2,H/2);}
}

function drawProjectiles(projectiles){
  for(const p of projectiles){ctx.save();ctx.strokeStyle=p.color;ctx.fillStyle=p.type==='sniper'?'#f3efdf':p.color;ctx.lineWidth=p.type==='sniper'?5:3;ctx.beginPath();ctx.moveTo(p.previousX,p.previousY);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,Math.PI*2);ctx.fill();ctx.restore();}
}

function drawEffectParticle(p){
  ctx.save();ctx.globalAlpha=Math.min(1,p.life/8);ctx.translate(p.x,p.y);ctx.rotate(p.rotation??0);ctx.fillStyle=p.color;ctx.strokeStyle=p.stroke??'#151515';ctx.lineWidth=1.5;
  const size=p.size??6;
  if(p.kind==='ice'){ctx.beginPath();ctx.moveTo(0,-size);ctx.lineTo(size*.55,size);ctx.lineTo(-size*.55,size*.45);ctx.closePath();ctx.fill();ctx.stroke();}
  else{ctx.fillRect(-size/2,-size/2,size,size);if(p.stroke)ctx.strokeRect(-size/2,-size/2,size,size);}
  ctx.restore();
}

function drawHazards(hazards){
  for(const h of hazards){
    const type=h.type;
    ctx.save();ctx.translate(h.x,h.y);ctx.strokeStyle='#151515';ctx.lineWidth=6;
    if(type==='spikes'){
      ctx.fillStyle='#ff3d2e';ctx.beginPath();
      for(let i=0;i<24;i++){const a=i*Math.PI/12,r=i%2?h.r:h.r+17;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle='#151515';ctx.font=`${Math.max(13,h.r*.48)}px Archivo Black`;ctx.textAlign='center';ctx.fillText(`−${h.value}`,0,6);
    } else {
      ctx.fillStyle=type==='medbay'?'#20c997':type==='pinball'?'#f6b817':'#e6ff34';ctx.beginPath();ctx.arc(0,0,h.r,0,Math.PI*2);ctx.fill();ctx.stroke();
      if(type==='medbay'){const arm=h.r*.55,bar=Math.max(6,h.r*.24);ctx.fillStyle='#f3efdf';ctx.fillRect(-bar/2,-arm,bar,arm*2);ctx.fillRect(-arm,-bar/2,arm*2,bar);ctx.strokeRect(-bar/2,-arm,bar,arm*2);ctx.strokeRect(-arm,-bar/2,arm*2,bar);ctx.fillStyle='#151515';ctx.font='10px Archivo Black';ctx.textAlign='center';ctx.fillText(`+${h.value}`,0,h.r+15);}
      else if(type==='pinball'){
        ctx.beginPath();ctx.arc(0,0,h.r*.63,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#151515';ctx.textAlign='center';
        ctx.font=`${Math.max(10,h.r*.42)}px Archivo Black`;ctx.fillText(`${h.value.toFixed(1)}×`,0,1);
        ctx.font=`${Math.max(7,h.r*.25)}px Archivo Black`;ctx.fillText('BOOST',0,h.r*.36);
      }
      else {ctx.beginPath();ctx.moveTo(-h.r*.55,0);ctx.lineTo(h.r*.55,0);ctx.moveTo(0,-h.r*.55);ctx.lineTo(0,h.r*.55);ctx.stroke();}
    }
    ctx.restore();
  }
}

function drawBall(b) {
  ctx.save();
  if(state.highlightedSide && state.highlightedSide!==b.side){ctx.filter='grayscale(1)';ctx.globalAlpha=.3;}
  runBehaviorHook(b,'drawBack',{sim:state.sim,ctx});
  ctx.save();ctx.translate(b.x,b.y);ctx.fillStyle='rgba(0,0,0,.22)';ctx.beginPath();ctx.ellipse(7,b.radius*.82,b.radius*.9,b.radius*.28,0,0,Math.PI*2);ctx.fill();ctx.restore();
  drawWeapon(ctx,b);
  ctx.save();ctx.translate(b.x,b.y);if(b.flash)ctx.globalAlpha=b.flash%2?.35:1;
  ctx.fillStyle=b.f.color;ctx.strokeStyle='#151515';ctx.lineWidth=7;ctx.beginPath();ctx.arc(0,0,b.radius,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle=b.f.accent;ctx.beginPath();ctx.arc(-b.radius*.28,-b.radius*.3,b.radius*.22,0,Math.PI*2);ctx.fill();
  if(b.frozen || b.stunned>15){ctx.strokeStyle=b.stunned>15?'#d8f7ff':'#e6ff34';ctx.lineWidth=5;ctx.setLineDash([8,6]);ctx.beginPath();ctx.arc(0,0,b.radius+9,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
  drawFighterIcon(ctx,b.f.id,b.x,b.y,b.radius*.82);
  if(b.burn>0){ctx.save();ctx.fillStyle='#ff6b1a';for(let i=0;i<5;i++){const a=(state.sim.ticks*.08+i*1.25),r=b.radius+10+(i%2)*7;ctx.beginPath();ctx.arc(b.x+Math.cos(a)*r,b.y+Math.sin(a)*r,4+i%2*2,0,Math.PI*2);ctx.fill();}ctx.restore();}
  runBehaviorHook(b,'draw',{sim:state.sim,ctx});
  ctx.restore();
}

function drawImpactPopups(s){
  const now=performance.now();
  s.impactPopups=s.impactPopups.filter(popup=>now-popup.born<650);
  for(const popup of s.impactPopups){
    const progress=(now-popup.born)/650;
    const entrance=Math.min(1,progress/.16),scale=.55+entrance*.55;
    ctx.save();ctx.translate(popup.x,popup.y-18-progress*34);ctx.rotate(popup.rotation);ctx.scale(scale,scale);
    const exitFade=progress<.78?1:(1-progress)/.22;
    ctx.globalAlpha=Math.min(1,entrance*2)*Math.max(0,exitFade);
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
    ctx.font=`${popup.size}px Archivo Black`;ctx.lineWidth=5;ctx.strokeStyle='#151515';ctx.strokeText(popup.word,0,0);
    ctx.fillStyle=popup.color;ctx.fillText(popup.word,0,0);ctx.restore();
  }
}

function updateHud(){ if(!state.sim)return; const [a,b]=state.sim.balls; const hpA=Math.max(0,Math.min(100,a.hp)),hpB=Math.max(0,Math.min(100,b.hp)); $('left-hp').style.width=`${hpA}%`; $('right-hp').style.width=`${hpB}%`; $('left-hp-text').textContent=Math.ceil(hpA); $('right-hp-text').textContent=Math.ceil(hpB); }
function updatePips(){ document.querySelectorAll('#score-pips li').forEach((el,i)=>{el.className='';if(i<state.index)el.classList.add(state.bouts[i].outcome);else if(i===state.index)el.classList.add('active');}); }
function impact(word,origin){
  const s=state.sim;if(!s)return;
  const x=Math.max(70,Math.min(W-70,origin?.x??W/2)),y=Math.max(115,Math.min(H-45,origin?.y??H/2));
  const index=s.impactPopups.length;
  s.impactPopups.push({word,x,y,born:performance.now(),size:word.length>12?24:word.length>8?29:36,rotation:(index%2?1:-1)*(.045+(index%3)*.025),color:word.includes('+')?'#ffffff':word.includes('−')?'#ff8c82':'#edff24'});
}

function emitParticles(origin,{count=10,color='#fff',speed=300,gravity=500,kind='spark',size=6}={}){
  const s=state.sim;if(!s||!origin)return;
  for(let i=0;i<count;i++){const angle=s.visualRng()*Math.PI*2,magnitude=speed*(.45+s.visualRng()*.75);s.particles.push({x:origin.x,y:origin.y,vx:Math.cos(angle)*magnitude,vy:Math.sin(angle)*magnitude,gravity,life:20+Math.floor(s.visualRng()*18),color,kind,size:size*(.65+s.visualRng()*.7),rotation:s.visualRng()*Math.PI*2,spin:(s.visualRng()-.5)*12,stroke:kind==='ice'?'#5caac0':null});}
}

let audioCtx;
function audioTone(freq,duration,type='sine',volume=.1){if(!state.sound)return;audioCtx??=new AudioContext();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);o.connect(g).connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration);}
function audioHit(power){if(!state.sound)return;audioTone(70+power*100,.07,'square',.03+power*.08);}

document.querySelectorAll('.pick-card').forEach(btn=>btn.addEventListener('click',()=>{if(state.running)return;state.selected=btn.dataset.pick;document.querySelectorAll('.pick-card').forEach(x=>x.classList.toggle('selected',x===btn));$('lock-pick').disabled=false;audioTone(260,.05,'square',.05);}));
document.querySelectorAll('.pick-card').forEach(card=>{
  card.addEventListener('pointerenter',()=>state.highlightedSide=card.dataset.pick);
  card.addEventListener('pointerleave',()=>state.highlightedSide=null);
  card.addEventListener('focus',()=>state.highlightedSide=card.dataset.pick);
  card.addEventListener('blur',()=>state.highlightedSide=null);
});
['left','right'].forEach(side=>{
  const trigger=$(side+'-info');
  trigger.addEventListener('pointerenter',()=>state.highlightedSide=side);
  trigger.addEventListener('pointerleave',()=>state.highlightedSide=null);
  trigger.addEventListener('focus',()=>state.highlightedSide=side);
  trigger.addEventListener('blur',()=>state.highlightedSide=null);
});
$('lock-pick').addEventListener('click',startFight);
$('global-pause').addEventListener('click',()=>{if(!state.running)return;state.paused=!state.paused;$('global-pause').classList.toggle('active',state.paused);$('global-pause').textContent=state.paused?'▶ RESUME FIGHT':'Ⅱ PAUSE FIGHT';});
$('sound-toggle').addEventListener('click',()=>{state.sound=!state.sound;$('sound-toggle').textContent=`SOUND ${state.sound?'ON':'OFF'}`;if(state.sound)audioTone(420,.06,'sine',.05);});
$('next-bout').addEventListener('click',()=>{
  if(state.mode==='versus'){setupBout();startFight();return;}
  if(state.cardComplete){resetCard();return;}
  const correct=state.result===state.selected;state.bouts[state.index].outcome=correct?'win':'loss';
  if(state.index<4){state.index++;setupBout();}else{state.cardComplete=true;showFinal();}
});

document.querySelectorAll('[data-route]').forEach(link=>link.addEventListener('click',event=>{
  event.preventDefault();setMode(link.dataset.route);
}));

async function copyText(text,button){
  try{await navigator.clipboard.writeText(text);const previous=button.textContent;button.textContent='COPIED';setTimeout(()=>button.textContent=previous,1100);}
  catch{const input=$('seed-input');input.select();document.execCommand('copy');}
}
$('copy-seed').addEventListener('click',()=>copyText(state.seed,$('copy-seed')));
$('load-seed').addEventListener('click',()=>setMode(state.mode==='versus'?'versus':'endless',$('seed-input').value,{push:false,left:$('versus-left').value,right:$('versus-right').value}));
$('random-seed').addEventListener('click',()=>setMode(state.mode==='versus'?'versus':'endless',randomSeed(),{push:false,left:$('versus-left').value,right:$('versus-right').value}));
$('share-seed').addEventListener('click',()=>copyText(location.href,$('share-seed')));
$('seed-input').addEventListener('keydown',event=>{if(event.key==='Enter'&&state.mode!=='daily')setMode(state.mode,$('seed-input').value,{push:false,left:$('versus-left').value,right:$('versus-right').value});});
addEventListener('popstate',()=>{
  const params=new URLSearchParams(location.search),mode=location.pathname.startsWith('/versus')?'versus':location.pathname.startsWith('/endless')?'endless':'daily';
  setMode(mode,params.get('seed'),{push:false,left:params.get('left'),right:params.get('right')});
});

function showFinal(){const perfect=state.wins===5;$('result-title').textContent=perfect?'PERFECT 5 / 5':'CARD COMPLETE';$('result-copy').textContent=perfect?'Untouched. Unbeaten. Run the same seed again or start a new card.':`Final record: ${state.wins}—${state.losses}. ${state.mode==='daily'?'Come back tomorrow for five new fights.':'Try a new seed or replay this card.'}`;$('next-bout').textContent='REPLAY CARD →';}

function loop(t){if(!state.lastTime)state.lastTime=t;state.accumulator+=Math.min(.1,(t-state.lastTime)/1000)*state.simulationSpeed;state.lastTime=t;while(state.accumulator>=STEP){update(STEP);state.accumulator-=STEP;}updateHud();draw();requestAnimationFrame(loop);}

for(const select of [$('versus-left'),$('versus-right')])select.innerHTML=fighters.map(f=>`<option value="${f.id}">${f.name} — ${f.ability}</option>`).join('');
for(const select of [$('versus-left'),$('versus-right')])select.addEventListener('change',()=>{
  if(state.mode!=='versus')return;
  setMode('versus',$('seed-input').value,{push:false,left:$('versus-left').value,right:$('versus-right').value});
});
$('start-versus').addEventListener('click',()=>{setMode('versus',$('seed-input').value,{push:false,left:$('versus-left').value,right:$('versus-right').value});startFight();});
$('simulation-speed').addEventListener('change',event=>{state.simulationSpeed=Number(event.target.value)||1;state.accumulator=0;});
const initialParams=new URLSearchParams(location.search),initialMode=location.pathname.startsWith('/versus')?'versus':location.pathname.startsWith('/endless')?'endless':'daily';
setMode(initialMode,initialParams.get('seed'),{push:false,left:initialParams.get('left'),right:initialParams.get('right')});requestAnimationFrame(loop);
