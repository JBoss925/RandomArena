import './style.css';
import { runBehaviorHook } from './behaviors.js';
import { resolveElasticCollision } from './physics.js';
import { collectWeaponHit, drawWeapon } from './weapons.js';
import { drawFighterIcon } from './icons.js';

const $ = (id) => document.getElementById(id);
const canvas = $('arena');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const STEP = 1 / 60;
const ARENA_BOUNDS={left:28,right:W-28,top:80,bottom:H-28};
const fighters = [
  { id:'volt', name:'VOLT', color:'#ff3d2e', accent:'#ffb3a9', speed:1.08, power:.92, mass:.95, behaviors:['wallCharge'], ability:'LIVE WIRE', desc:'Every wall impact adds 3.5% speed. Volt starts modest and becomes dangerous if the fight runs long.' },
  { id:'brick', name:'BRICK', color:'#3759ff', accent:'#aebaff', speed:.83, power:1.17, mass:1.18, behaviors:['armor'], ability:'LOAD BEARING', desc:'Dense armor reduces all incoming damage by 22%. Slow, heavy and brutally consistent.' },
  { id:'mint', name:'MINT', color:'#20c997', accent:'#abf1dd', speed:1.12, power:.86, mass:.9, behaviors:['regeneration'], ability:'SECOND WIND', desc:'Regains 1.5 health every two seconds. Winning quickly is the cleanest way to stop the comeback.' },
  { id:'goldie', name:'GOLDIE', color:'#f6b817', accent:'#ffe49b', speed:.96, power:1.04, mass:1.05, behaviors:['compoundPower'], ability:'COMPOUND INTEREST', desc:'Each clean hit permanently raises attack power by 4% for the rest of the bout.' },
  { id:'void', name:'VOID', color:'#191919', accent:'#a4a4a4', speed:1.02, power:1.02, mass:1, behaviors:['siphon'], ability:'SIPHON', desc:'Converts 22% of damage dealt into health. Void rewards sustained contact.' },
  { id:'bubble', name:'BUBBLE', color:'#ef6dca', accent:'#ffc4ef', speed:1.16, power:.82, mass:.86, behaviors:['dodge'], ability:'SLIP SKIN', desc:'Has a deterministic 18% chance to completely evade the damage from a collision.' },
  { id:'moss', name:'MOSS', color:'#658c3a', accent:'#c2dd9e', speed:.88, power:1.12, mass:1.12, behaviors:['thorns'], ability:'THORNS', desc:'Returns 20% of contact damage to the attacker. Every reckless hit has a price.' },
  { id:'glitch', name:'GLITCH', color:'#9c52ff', accent:'#d9bcff', speed:1.05, power:.98, mass:.96, behaviors:['blink'], ability:'PACKET LOSS', desc:'Blinks to a seeded position every four seconds, breaking pressure and changing the angle.' },
  { id:'frost', name:'FROST', color:'#7bdff2', accent:'#d8f7ff', speed:.91, power:1.02, mass:1.04, behaviors:['coldSnap'], ability:'COLD SNAP', desc:'Heavy hits freeze the opponent for 0.75 seconds. Freeze is engine-controlled—never player-controlled.' },
  { id:'ember', name:'EMBER', color:'#ff6b1a', accent:'#ffc49c', speed:1.01, power:.93, mass:.97, behaviors:['afterburn'], ability:'AFTERBURN', desc:'Clean hits ignite the opponent, dealing a small amount of fixed damage over two seconds.' },
  { id:'echo', name:'ECHO', color:'#00a6a6', accent:'#9ce3df', speed:1.04, power:.9, mass:.94, behaviors:['echo'], ability:'DOUBLE TAP', desc:'Every hit repeats for 35% damage after a short delay—even if Echo has already bounced away.' },
  { id:'rook', name:'ROOK', color:'#c9c3b9', accent:'#ffffff', speed:.82, power:1.08, mass:1.2, behaviors:['thirdHitBlock'], ability:'CASTLE WALL', desc:'Every third incoming hit is blocked completely. The count is visible in its orbiting pips.' },
  { id:'comet', name:'COMET', color:'#ff477e', accent:'#ffc2d4', speed:1.2, power:.78, mass:.82, behaviors:['continuousAcceleration'], ability:'TAILWIND', desc:'Accelerates continuously while moving. Contact resets part of the buildup, so open space is its friend.' },
  { id:'static', name:'STATIC', color:'#e5ff00', accent:'#ffffff', speed:1, power:.94, mass:.95, behaviors:['fourthStrike'], ability:'FOURTH STRIKE', desc:'Every fourth clean hit discharges bonus damage and a longer impact freeze.' },
  { id:'anchor', name:'ANCHOR', color:'#536878', accent:'#b9c8d2', speed:.72, power:1.12, mass:1.34, behaviors:['woundedPower'], ability:'DEAD WEIGHT', desc:'Nearly impossible to knock around. Its attack power rises as its health falls.' },
  { id:'orbit', name:'ORBIT', color:'#6c4cff', accent:'#c9bdff', speed:.96, power:.9, mass:.98, behaviors:['orbitalPulse'], ability:'PERIAPSIS', desc:'A satellite pulse strikes the opponent every three seconds. Survive long enough and space wins.' },
  { id:'saber', name:'SABER', color:'#d93636', accent:'#ffb0a8', speed:.92, power:1.02, mass:1.02, behaviors:[], weapon:{type:'sword',length:88,width:14,angularSpeed:2.7,damage:8,cooldown:22,knockback:35}, ability:'CLOCKHAND', desc:'A long sword rotates continuously around Saber. Blade contact deals damage before the bodies collide.' },
  { id:'slugger', name:'SLUGGER', color:'#c47b38', accent:'#f1c590', speed:.88, power:.94, mass:1.08, behaviors:[], weapon:{type:'bat',length:80,width:20,angularSpeed:-3.35,damage:5,cooldown:25,knockback:245}, ability:'DEEP CENTER', desc:'A rotating bat deals light damage but launches opponents away with tremendous knockback.' },
];

const state = { date: localDateKey(), mode: 'daily', seed: '', bouts: [], index: 0, selected: null, highlightedSide: null, running: false, paused: false, result: null, wins: 0, losses: 0, cardComplete: false, sound: true, sim: null, accumulator: 0, lastTime: 0 };

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
    const value=type==='spikes'?Math.round(3+random()*6):type==='medbay'?Math.round(4+random()*7):type==='pinball'?Math.round(340+random()*150):0;
    hazards.push({id:`${type}-${i}`,type,x,y,r,value});
  }
  return hazards;
}

function createSim(bout) {
  const r = mulberry32(bout.seed);
  const make = (f, side) => ({ f, side, x: side === 'left' ? 165 : W-165, y: H/2 + (r()-.5)*70, vx: (side === 'left'?1:-1)*(570+r()*160)*f.speed, vy: (r()-.5)*310, radius: 64*f.mass, angle:side==='left'?0:Math.PI, angularVelocity:f.weapon?.angularSpeed??((side==='left'?1:-1)*(.8+r()*1.4)), hp: 100, cooldown: 0, hazardCooldowns:{}, weaponCooldown:0, stunned: 0, frozen: false, flash: 0, powerScale:1, hits:0, incoming:0, burn:0, wallBoost:1 });
  return { balls: [make(bout.left,'left'), make(bout.right,'right')], rng: r, ticks: 0, hitStop: 0, particles: [], echoes:[], hazards:bout.hazards, width:W, height:H, finished: false };
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
  $('bout-number').textContent = num; $('round-label').textContent = `BOUT ${num} / 05`; $('seed-label').textContent = `SEED ${b.seed.toString(16).toUpperCase().padStart(8,'0')} / ${hazardNames}`;
  document.documentElement.style.setProperty('--red', b.left.color); document.documentElement.style.setProperty('--blue', b.right.color);
  document.querySelectorAll('.pick-card').forEach(el => el.classList.remove('selected'));
  $('lock-pick').disabled = true; $('lock-pick').hidden = false; $('pick-list').hidden = false; $('result-card').hidden = true; $('result-card').classList.remove('loss');
  $('arena-stamp').textContent = 'MAKE YOUR PICK'; $('arena-stamp').classList.remove('hidden');
  $('global-pause').textContent = 'Ⅱ PAUSE FIGHT'; $('global-pause').classList.remove('active');
  updatePips(); updateHud(); draw();
}

function resetCard(){
  state.index=0;state.wins=0;state.losses=0;state.cardComplete=false;
  state.bouts=generateCard(state.seed);$('record').textContent='0—0';setupBout();
}

function setMode(mode,seed,{push=true}={}){
  state.mode=mode==='endless'?'endless':'daily';
  state.seed=state.mode==='daily'?`DAILY-${state.date}`:cleanSeed(seed||randomSeed());
  document.querySelectorAll('[data-route]').forEach(link=>link.classList.toggle('active',link.dataset.route===state.mode));
  $('seed-title').textContent=state.mode==='daily'?'DAILY SEED':'ENDLESS SEED';
  $('seed-input').value=state.seed;$('seed-input').readOnly=state.mode==='daily';
  $('load-seed').disabled=state.mode==='daily';
  $('random-seed').disabled=state.mode==='daily';
  $('seed-help').textContent=state.mode==='daily'?"Today's seed is locked, but you can copy it.":'Enter any seed, load it, then share the link with a friend.';
  $('mode-label').textContent=state.mode==='daily'?'Daily fight card':'Endless fight card';
  $('today-label').textContent=state.mode==='daily'?new Date(state.date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'}).toUpperCase():'ENDLESS EXHIBITION';
  const url=state.mode==='daily'?'/daily':`/endless?seed=${encodeURIComponent(state.seed)}`;
  history[push?'pushState':'replaceState']({},'',url);
  resetCard();
}

function startFight() {
  if (!state.selected || state.running) return;
  state.running = true; $('lock-pick').hidden = true; $('arena-stamp').classList.add('hidden');
  audioTone(110, .08, 'sawtooth', .12); setTimeout(() => audioTone(180, .09, 'square', .1), 80);
}

function update(dt) {
  const s = state.sim;
  if (!state.running || state.paused || s.finished) return;
  if (s.hitStop > 0) { s.hitStop--; return; }
  s.ticks++;
  for (const e of s.echoes) { e.frames--; if(e.frames===0){e.victim.hp=Math.max(0,e.victim.hp-e.damage);e.victim.flash=6;impact('ECHO!');audioHit(.45);} }
  s.echoes=s.echoes.filter(e=>e.frames>0);
  for (const p of s.particles) { p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 500*dt; p.life--; }
  s.particles = s.particles.filter(p => p.life > 0);
  for (const b of s.balls) {
    b.cooldown = Math.max(0,b.cooldown-1); b.weaponCooldown=Math.max(0,b.weaponCooldown-1); b.stunned = Math.max(0,b.stunned-1); b.flash = Math.max(0,b.flash-1);
    for(const id of Object.keys(b.hazardCooldowns))b.hazardCooldowns[id]=Math.max(0,b.hazardCooldowns[id]-1);
    if (b.burn > 0) { b.burn--; if (b.burn % 12 === 0) b.hp = Math.max(0,b.hp-.28); }
    const rival=s.balls.find(other=>other!==b);
    const behaviorContext={sim:s,rival,event:{dt},random:s.rng,showImpact:impact,audioTone,audioHit};
    runBehaviorHook(b,'tick',behaviorContext);
    if (b.frozen || b.stunned) continue;
    runBehaviorHook(b,'beforeMove',behaviorContext);
    b.angle=(b.angle+b.angularVelocity*dt)%(Math.PI*2);
    b.x += b.vx*dt; b.y += b.vy*dt;
    if (b.x-b.radius < ARENA_BOUNDS.left || b.x+b.radius > ARENA_BOUNDS.right) { b.x = Math.max(ARENA_BOUNDS.left+b.radius,Math.min(ARENA_BOUNDS.right-b.radius,b.x)); b.vx *= -1; runBehaviorHook(b,'wallHit',behaviorContext); }
    if (b.y-b.radius < ARENA_BOUNDS.top || b.y+b.radius > ARENA_BOUNDS.bottom) { b.y = Math.max(ARENA_BOUNDS.top+b.radius,Math.min(ARENA_BOUNDS.bottom-b.radius,b.y)); b.vy *= -1; runBehaviorHook(b,'wallHit',behaviorContext); }
    collideHazard(b, s);
  }
  resolveWeaponHits(s.balls.map((ball,index)=>collectWeaponHit(ball,s.balls[1-index],dt)).filter(Boolean),s);
  collideBalls(s);
  if (s.ticks > 60*24 && !s.finished) { const [a,b]=s.balls; a.hp -= 0.18; b.hp -= 0.18; }
  const defeated=s.balls.filter(b=>b.hp<=0);
  if(defeated.length===1) finishFight(defeated[0].side==='left'?'right':'left');
  else if(defeated.length===2){
    const [left,right]=s.balls;
    finishFight(left.hp===right.hp?(s.rng()<.5?'left':'right'):(left.hp>right.hp?'left':'right'));
  }
}

function resolveWeaponHits(hits,s){
  const prepared=hits.map(hit=>{
    const {attacker,victim}=hit;attacker.hits++;victim.incoming++;
    const event={force:hit.force,damage:hit.damage,weapon:true};
    const context={sim:s,rival:victim,event,random:s.rng,showImpact:impact,audioTone,audioHit};
    runBehaviorHook(attacker,'modifyOutgoing',context);
    runBehaviorHook(victim,'modifyIncoming',{...context,rival:attacker});
    return {...hit,event,context};
  });
  for(const hit of prepared)hit.victim.hp-=hit.event.damage;
  for(const hit of prepared){
    const {attacker,victim,event,context}=hit;
    const invVictim=1/victim.f.mass,invAttacker=1/attacker.f.mass;
    victim.vx+=hit.impulseX*invVictim;victim.vy+=hit.impulseY*invVictim;
    attacker.vx-=hit.impulseX*invAttacker*.18;attacker.vy-=hit.impulseY*invAttacker*.18;
    victim.flash=7;s.hitStop=Math.max(s.hitStop,Math.round(2+event.force*.25));
    runBehaviorHook(attacker,'dealHit',context);
    runBehaviorHook(victim,'takeHit',{...context,rival:attacker});
    for(let i=0;i<8;i++)s.particles.push({x:victim.x,y:victim.y,vx:(s.rng()-.5)*420,vy:(s.rng()-.5)*420,life:14+Math.floor(s.rng()*10),color:attacker.f.color});
    impact(hit.label);audioHit(event.force/16);
  }
}

function collideHazard(b,s) {
  for (const h of s.hazards) {
    const dx=b.x-h.x,dy=b.y-h.y,d=Math.hypot(dx,dy),min=b.radius+h.r;
    if (d<min && d>0) {
      const nx=dx/d,ny=dy/d; b.x=h.x+nx*min; b.y=h.y+ny*min; const dot=b.vx*nx+b.vy*ny;
      b.vx-=2*dot*nx; b.vy-=2*dot*ny;
      const ready=!b.hazardCooldowns[h.id];
      if(h.type==='pinball') { b.vx=nx*h.value; b.vy=ny*h.value; if(ready){impact('THUNK!');audioTone(145,.09,'square',.1);s.hitStop=2;b.hazardCooldowns[h.id]=12;} }
      else if(h.type==='spikes' && ready) { b.hp=Math.max(0,b.hp-h.value);b.flash=8;b.hazardCooldowns[h.id]=45;impact(`−${h.value} HP`);audioHit(.7); }
      else if(h.type==='medbay' && ready) { const before=b.hp;b.hp=Math.min(100,b.hp+h.value);b.hazardCooldowns[h.id]=75;if(b.hp>before){impact(`+${h.value} HP`);audioTone(520,.12,'sine',.07);} }
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
    const force=Math.min(16,4+Math.abs(rel)/21);
    a.hits++; b.incoming++; b.hits++; a.incoming++;
    const eventA={force,damage:force*a.f.power*a.powerScale};
    const eventB={force,damage:force*b.f.power*b.powerScale};
    const contextA={sim:s,rival:b,event:eventA,random:s.rng,showImpact:impact,audioTone,audioHit};
    const contextB={sim:s,rival:a,event:eventB,random:s.rng,showImpact:impact,audioTone,audioHit};
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
    for(let i=0;i<12;i++) s.particles.push({x:(a.x+b.x)/2,y:(a.y+b.y)/2,vx:(s.rng()-.5)*360,vy:(s.rng()-.5)*360,life:16+Math.floor(s.rng()*12),color:i%2?a.f.color:b.f.color});
    impact(force>11?'CRACK!':force>7?'WHAM!':'BOP!'); audioHit(force/16);
  }
}

function setDossier(side,f){
  $(side+'-dossier').innerHTML=`<strong>${f.ability}</strong><p>${f.desc}</p><small>SPD ${Math.round(f.speed*100)} · PWR ${Math.round(f.power*100)} · MASS ${Math.round(f.mass*100)}</small>`;
  $(side+'-info').setAttribute('aria-label',`${f.name}: ${f.ability}. ${f.desc}`);
}

function finishFight(winner) {
  const s=state.sim; s.finished=true; state.running=false; state.result=winner; const correct=winner===state.selected; correct?state.wins++:state.losses++;
  const name=winner==='left'?state.bouts[state.index].left.name:state.bouts[state.index].right.name;
  $('arena-stamp').textContent=`${name} WINS`; $('arena-stamp').classList.remove('hidden');
  $('pick-list').hidden=true; $('result-card').hidden=false; $('result-card').classList.toggle('loss',!correct); $('result-title').textContent=correct?'YOU CALLED IT':'PICK BUSTED';
  $('result-copy').textContent=`${name} takes bout ${state.index+1}. ${correct?'The perfect card is still alive.':'No perfect card today—but the streak continues.'}`;
  $('next-bout').textContent=state.index===4?'SEE FINAL CARD →':'NEXT BOUT →'; $('record').textContent=`${state.wins}—${state.losses}`; updatePips();
  audioTone(correct?520:100,.22,correct?'sine':'sawtooth',.15);
}

function draw() {
  const s=state.sim; ctx.clearRect(0,0,W,H); ctx.fillStyle='#d9d4c2'; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#777468'; ctx.globalAlpha=.27; ctx.lineWidth=1;
  for(let x=0;x<W;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();} for(let y=0;y<H;y+=48){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();} ctx.globalAlpha=1;
  ctx.strokeStyle='#151515';ctx.lineWidth=8;ctx.strokeRect(24,76,W-48,H-100);
  drawHazards(s.hazards);
  for(const p of s.particles){ctx.globalAlpha=Math.min(1,p.life/8);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,6,6);}ctx.globalAlpha=1;
  for(const b of s.balls) drawBall(b);
  if(state.paused){ctx.fillStyle='rgba(21,21,21,.68)';ctx.fillRect(0,0,W,H);ctx.fillStyle='#e6ff34';ctx.font='48px Archivo Black';ctx.textAlign='center';ctx.fillText('FIGHT PAUSED',W/2,H/2);}
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
      else if(type==='pinball'){ctx.beginPath();ctx.arc(0,0,h.r*.63,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#151515';ctx.font=`${Math.max(9,h.r*.38)}px Archivo Black`;ctx.textAlign='center';ctx.fillText(`${h.value}`,0,4);}
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

function updateHud(){ if(!state.sim)return; const [a,b]=state.sim.balls; const hpA=Math.max(0,Math.min(100,a.hp)),hpB=Math.max(0,Math.min(100,b.hp)); $('left-hp').style.width=`${hpA}%`; $('right-hp').style.width=`${hpB}%`; $('left-hp-text').textContent=Math.ceil(hpA); $('right-hp-text').textContent=Math.ceil(hpB); }
function updatePips(){ document.querySelectorAll('#score-pips li').forEach((el,i)=>{el.className='';if(i<state.index)el.classList.add(state.bouts[i].outcome);else if(i===state.index)el.classList.add('active');}); }
function impact(word){const el=$('impact-word');el.textContent=word;el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop');}

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
$('load-seed').addEventListener('click',()=>setMode('endless',$('seed-input').value,{push:false}));
$('random-seed').addEventListener('click',()=>setMode('endless',randomSeed(),{push:false}));
$('share-seed').addEventListener('click',()=>copyText(location.href,$('share-seed')));
$('seed-input').addEventListener('keydown',event=>{if(event.key==='Enter'&&state.mode==='endless')setMode('endless',$('seed-input').value,{push:false});});
addEventListener('popstate',()=>{
  const mode=location.pathname.startsWith('/endless')?'endless':'daily';
  const seed=new URLSearchParams(location.search).get('seed');setMode(mode,seed,{push:false});
});

function showFinal(){const perfect=state.wins===5;$('result-title').textContent=perfect?'PERFECT 5 / 5':'CARD COMPLETE';$('result-copy').textContent=perfect?'Untouched. Unbeaten. Run the same seed again or start a new card.':`Final record: ${state.wins}—${state.losses}. ${state.mode==='daily'?'Come back tomorrow for five new fights.':'Try a new seed or replay this card.'}`;$('next-bout').textContent='REPLAY CARD →';}

function loop(t){if(!state.lastTime)state.lastTime=t;state.accumulator+=Math.min(.1,(t-state.lastTime)/1000);state.lastTime=t;while(state.accumulator>=STEP){update(STEP);state.accumulator-=STEP;}updateHud();draw();requestAnimationFrame(loop);}

const initialMode=location.pathname.startsWith('/endless')?'endless':'daily';
const initialSeed=new URLSearchParams(location.search).get('seed');
setMode(initialMode,initialSeed,{push:false});requestAnimationFrame(loop);
