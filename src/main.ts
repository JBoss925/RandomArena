import './style.css';
import { runBehaviorHook } from './behaviors.js';
import { resolveElasticCollision } from './physics.js';
import { applyWeaponMotion, collectWeaponHit, collectWeaponWorldContact, drawWeapon } from './weapons.js';
import { fireRangedWeapon, stepProjectiles } from './projectiles.js';
import { drawFighterIcon } from './icons.js';
import { fighters, getFighter } from './fighters.js';
import { createInitialBall } from './initial-conditions.js';
import { contactForce } from './combat-config.js';
import { specIcon } from './spec-icons.js';
import { resolveOutcome } from './outcome.js';
import { SOUND_OUTPUT_GAIN, playSound as playLibrarySound, preloadSounds } from './sounds.js';
import { contactFeedback, hazardMaterial, type ContactFeedback } from './materials.js';
import {contrastForeground} from './color-contrast.js';
import type { BalanceMatch, BalanceRanking, BalanceReport, Ball, Bout, Fighter, Hazard, HazardType, Material, Outcome, Particle, ParticleOptions, Point, Projectile, ProjectileHit, Side, Simulation, SoundCue, SoundCueOptions, WeaponHit, Winner } from './types';

type AppElement=HTMLElement&{value:string;readOnly:boolean;disabled:boolean;select():void};
function $(id:'arena'):HTMLCanvasElement;
function $(id:string):AppElement;
function $(id:string):AppElement|HTMLCanvasElement{const element=document.getElementById(id);if(!element)throw new Error(`Missing #${id}`);return element as AppElement|HTMLCanvasElement;}
const canvas = $('arena');
const canvasContext = canvas.getContext('2d');
if(!canvasContext)throw new Error('Canvas 2D context unavailable');
const ctx:CanvasRenderingContext2D=canvasContext;
const W = canvas.width, H = canvas.height;
const STEP = 1 / 60;
const ARENA_BOUNDS={left:28,right:W-28,top:80,bottom:H-28};
const BUMPER_REFERENCE_SPEED=650;
type GameMode='daily'|'endless'|'versus';
type AppState={date:string;mode:GameMode;seed:string;versusLeft:string;versusRight:string;bouts:Bout[];index:number;selected:Side|null;highlightedSide:Side|null;running:boolean;paused:boolean;replaying:boolean;simulationSpeed:number;result:Winner|null;wins:number;losses:number;cardComplete:boolean;soundVolume:number;lastAudibleVolume:number;sim:Simulation|null;accumulator:number;lastTime:number};
const initialSoundVolume=readStoredSoundVolume();
const state:AppState = { date: localDateKey(), mode: 'daily', seed: '', versusLeft:'volt', versusRight:'brick', bouts: [], index: 0, selected: null, highlightedSide: null, running: false, paused: false, replaying:false, simulationSpeed:1, result: null, wins: 0, losses: 0, cardComplete: false, soundVolume:initialSoundVolume, lastAudibleVolume:initialSoundVolume||.5, sim: null, accumulator: 0, lastTime: 0 };

function readStoredSoundVolume():number{
  try{const stored=localStorage.getItem('random-arena-volume');if(stored!==null){const value=Number(stored);if(Number.isFinite(value))return Math.max(0,Math.min(1,value));}}catch{}
  return .5;
}

function localDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function randomSeed(){
  const words=new Uint32Array(2);crypto.getRandomValues(words);
  return `${words[0].toString(16).padStart(8,'0')}-${words[1].toString(16).padStart(8,'0')}`.toUpperCase();
}
function cleanSeed(value:string){return value.trim().slice(0,64)||randomSeed();}
function hashString(str:string):number { let h = 2166136261 >>> 0; for (let i=0;i<str.length;i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(seed:number):()=>number { return () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function requireFighter(id:string):Fighter{const fighter=getFighter(id);if(!fighter)throw new Error(`Unknown fighter: ${id}`);return fighter;}
function generateCard(seed:string):Bout[] {
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

function generateHazards(random:()=>number):Hazard[]{
  const types:HazardType[]=['pillar','spikes','medbay','pinball'];
  for(let i=types.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[types[i],types[j]]=[types[j],types[i]];}
  const count=1+Math.floor(random()*3),hazards:Hazard[]=[];
  const ranges:Record<HazardType,[number,number]>={pillar:[30,46],spikes:[27,39],medbay:[30,42],pinball:[23,31]};
  for(let i=0;i<count;i++){
    const type=types[i],[minR,maxR]=ranges[type],r=Math.round(minR+random()*(maxR-minR));
    let x=0,y=0,attempt=0;
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

function createSim(bout:Bout):Simulation {
  const r = mulberry32(bout.seed);
  return { balls: [createInitialBall(bout.left,'left',r),createInitialBall(bout.right,'right',r)], projectiles:[], rng:r, visualRng:mulberry32(bout.seed^0x9e3779b9), ticks:0, hitStop:0, particles:[], impactPopups:[], echoes:[], hazards:bout.hazards, lastExchange:null, width:W, height:H, finished:false,events:{} };
}

function setupBout() {
  const b = state.bouts[state.index];
  state.selected = null; state.running = false; state.paused = false; state.replaying=false; state.result = null; state.sim = createSim(b); state.accumulator = 0;
  setFighterPreview(null);setExpandedPickInfo(null);
  const num = String(state.index + 1).padStart(2,'0');
  $('left-name').textContent = $('left-pick-name').textContent = b.left.name;
  $('right-name').textContent = $('right-pick-name').textContent = b.right.name;
  document.querySelector<HTMLElement>('.pick-select[data-pick="left"]')?.setAttribute('aria-label',`Pick ${b.left.name}`);
  document.querySelector<HTMLElement>('.pick-select[data-pick="right"]')?.setAttribute('aria-label',`Pick ${b.right.name}`);
  document.querySelector<HTMLElement>('.pick-info[data-pick="left"]')?.setAttribute('aria-label',`Toggle ${b.left.name} fighter information`);
  document.querySelector<HTMLElement>('.pick-info[data-pick="right"]')?.setAttribute('aria-label',`Toggle ${b.right.name} fighter information`);
  setDossier('left', b.left); setDossier('right', b.right);
  $('left-number').textContent = String(fighters.indexOf(b.left)+1).padStart(2,'0'); $('right-number').textContent = String(fighters.indexOf(b.right)+1).padStart(2,'0');
  const hazardNames=b.hazards.length?b.hazards.map(h=>h.type.toUpperCase()).join(' + '):'OPEN';
  $('round-label').textContent = state.mode==='versus'?'1V1 LAB':`BOUT ${num} / 05`; $('seed-label').textContent = `SEED ${b.seed.toString(16).toUpperCase().padStart(8,'0')} / ${hazardNames}`;
  document.documentElement.style.setProperty('--red', b.left.color); document.documentElement.style.setProperty('--blue', b.right.color);
  document.documentElement.style.setProperty('--red-ink',contrastForeground(b.left.color)==='light'?'#fff':'#151515');
  document.querySelectorAll('.pick-card').forEach(el => el.classList.remove('selected'));
  $('lock-pick').disabled = true; $('lock-pick').hidden = state.mode==='versus'; $('pick-list').hidden = state.mode==='versus'; $('versus-controls').hidden=state.mode!=='versus'; $('result-card').hidden = true; $('result-card').classList.remove('loss','close-call');clearResultCardPalette();$('result-breakdown').hidden=true;
  $('arena-stamp').textContent = state.mode==='versus'?'READY':'TAKE YOUR PICK'; $('arena-stamp').classList.remove('hidden');
  $('bet-title').hidden=false;$('fight-instruction').hidden=false;
  $('global-pause').textContent = 'Ⅱ PAUSE FIGHT'; $('global-pause').setAttribute('aria-label','Pause fight'); $('global-pause').classList.remove('active');
  renderHazardTooltips(b.hazards);
  updatePips(); updateHud(); draw();
}

function resetCard(){
  state.index=0;state.wins=0;state.losses=0;state.cardComplete=false;
  state.bouts=state.mode==='versus'?[{left:requireFighter(state.versusLeft),right:requireFighter(state.versusRight),hazards:[],seed:hashString(`versus:${state.seed}`)}]:generateCard(state.seed);
  $('record').textContent='0—0';setupBout();
}

function setMode(mode:GameMode,seed?:string|null,{push=true,left=state.versusLeft,right=state.versusRight}:{push?:boolean;left?:string|null;right?:string|null}={}){
  state.mode=mode==='versus'?'versus':mode==='endless'?'endless':'daily';
  state.versusLeft=getFighter(left??'')?.id??'volt';state.versusRight=getFighter(right??'')?.id??'brick';
  state.seed=state.mode==='daily'?`DAILY-${state.date}`:cleanSeed(seed||randomSeed());
  document.querySelectorAll<HTMLElement>('[data-route]').forEach(link=>link.classList.toggle('active',link.dataset.route===state.mode));
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

let balanceReportPromise:Promise<BalanceReport>|undefined;
function loadBalanceStats(){
  balanceReportPromise??=fetch('/data/tier-matrix.json').then(async response=>{if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw Error('Balance report unavailable');return await response.json() as BalanceReport;});
  balanceReportPromise.then(report=>renderBalanceStats(report,$('versus-left').value,$('versus-right').value)).catch(()=>$('stats-content').innerHTML='<p>Balance data unavailable. Run <code>"npm run balance"</code> to generate it.</p>');
}
function renderBalanceStats(report:BalanceReport,leftId:string,rightId:string){
  const leftRank=report.rankings.find(row=>row.id===leftId),rightRank=report.rankings.find(row=>row.id===rightId),leftF=getFighter(leftId),rightF=getFighter(rightId);
  if(!leftRank||!rightRank||!leftF||!rightF)return;
  const leftMatch=report.matrix[leftId][rightId],rightMatch=report.matrix[rightId][leftId],pct=(value:number)=>`${(value*100).toFixed(1)}%`,num=(value:number)=>Number(value).toFixed(1);
  $('stats-sample').textContent=`${report.method.totalSimulations.toLocaleString()} FIGHTS / ${report.method.seedsPerSide} SEEDS PER SIDE`;
  if(!leftMatch||!rightMatch){$('stats-content').innerHTML=`<div class="stat-fighter"><h3>${leftF.name} MIRROR MATCH</h3><p>The balance suite measures unique fighter pairings, so same-fighter mirrors are intentionally excluded. This 1v1 can still be run and shared.</p></div>`;return;}
  const card=(fighter:Fighter,rank:BalanceRanking,match:BalanceMatch,currentSide:'LEFT'|'RIGHT')=>`<article class="stat-fighter"><h3>${fighter.name}<span>${rank.tier} / #${report.rankings.indexOf(rank)+1}</span></h3><div class="stat-grid"><div><small>OVERALL SCORE</small><strong>${pct(rank.score)}</strong></div><div><small>HEAD-TO-HEAD</small><strong>${pct(match.score)}</strong></div><div><small>WINNING FROM LEFT</small><strong>${pct(match.asLeft.winRate)}</strong></div><div><small>WINNING FROM RIGHT</small><strong>${pct(match.asRight.winRate)}</strong></div><div><small>CURRENT SIDE (${currentSide})</small><strong>${pct(match[currentSide==='LEFT'?'asLeft':'asRight'].score)}</strong></div><div><small>AVG. REMAINING HP</small><strong>${num(match.averageRemainingHp)}</strong></div></div></article>`;
  const currentLeft=leftMatch.asLeft,currentRight=rightMatch.asRight,sideBias=leftMatch.asLeft.score-leftMatch.asRight.score;
  const matchupRows=report.rankings.filter(row=>row.id!==leftId).map(opponent=>{const m=report.matrix[leftId][opponent.id]!;return`<tr><td>${opponent.name}</td><td>${pct(m.score)}</td><td>${pct(m.asLeft.winRate)}</td><td>${pct(m.asRight.winRate)}</td><td>${m.wins}–${m.losses}–${m.draws}</td><td>${num(m.averageSeconds)}s</td><td>${num(m.averageRemainingHp)}</td></tr>`;}).join('');
  const rosterRows=report.rankings.map((rank,index)=>`<tr><td>#${index+1} ${rank.name}</td><td>${rank.tier}</td><td>${pct(rank.score)}</td><td>${pct(rank.asLeft.score)}</td><td>${pct(rank.asRight.score)}</td><td>${rank.wins}–${rank.losses}–${rank.draws}</td></tr>`).join('');
  $('stats-content').innerHTML=`<div class="stat-comparison">${card(leftF,leftRank,leftMatch,'LEFT')}${card(rightF,rightRank,rightMatch,'RIGHT')}</div><div class="insight-strip"><div><small>CURRENT-SIDE FORECAST</small><strong>${leftF.name} ${pct(currentLeft.score)} / ${rightF.name} ${pct(currentRight.score)}</strong></div><div><small>LEFT-FIGHTER SIDE BIAS</small><strong>${sideBias>=0?'+':''}${pct(sideBias)}</strong></div><div><small>AVERAGE DURATION</small><strong>${num(leftMatch.averageSeconds)} SECONDS</strong></div><div><small>SAMPLE RECORD</small><strong>${leftMatch.wins}–${leftMatch.losses}–${leftMatch.draws}</strong></div></div><div class="stats-table-wrap"><table class="stats-table"><caption>${leftF.name} MATCHUP SPREAD</caption><thead><tr><th>Opponent</th><th>Score</th><th>Wins left</th><th>Wins right</th><th>W–L–D</th><th>Duration</th><th>End HP</th></tr></thead><tbody>${matchupRows}</tbody></table></div><div class="stats-table-wrap" style="margin-top:14px"><table class="stats-table"><caption>FULL ROSTER STANDING</caption><thead><tr><th>Fighter</th><th>Tier</th><th>Overall</th><th>As left</th><th>As right</th><th>W–L–D</th></tr></thead><tbody>${rosterRows}</tbody></table></div>`;
}

function startFight() {
  if ((!state.selected&&state.mode!=='versus') || state.running) return;
  state.running = true; $('lock-pick').hidden = true; if(state.mode==='versus')$('versus-controls').hidden=true; $('arena-stamp').classList.add('hidden');$('hazard-tooltips').hidden=true;
  audioTone(110, .08, 'sawtooth', .12); setTimeout(() => audioTone(180, .09, 'square', .1), 80);
}

function setReplayControl():void{
  $('global-pause').textContent='↻ REPLAY FIGHT';
  $('global-pause').classList.remove('active');
  $('global-pause').setAttribute('aria-label','Replay this fight from the same seed');
}

function replayFight():void{
  if(!state.sim?.finished||state.running)return;
  state.sim=createSim(state.bouts[state.index]);
  state.running=true;state.paused=false;state.replaying=true;state.accumulator=0;
  $('global-pause').textContent='Ⅱ PAUSE FIGHT';
  $('global-pause').setAttribute('aria-label','Pause fight');
  $('global-pause').classList.remove('active');
  $('arena-stamp').classList.add('hidden');
  $('hazard-tooltips').hidden=true;
  updateHud();draw();
}

function renderHazardTooltips(hazards:Hazard[]):void{
  const layer=$('hazard-tooltips');
  const detail:Record<HazardType,{icon:string;label:string;value:string|((hazard:Hazard)=>string)}>={
    pillar:{icon:'shield',label:'SOLID OBSTACLE',value:'Elastic bounce'},
    spikes:{icon:'damage',label:'SPIKE DAMAGE',value:(h:Hazard)=>`Deals ${h.value} HP`},
    medbay:{icon:'plus',label:'HEALING',value:(h:Hazard)=>`Heals ${h.value} HP`},
    pinball:{icon:'launch',label:'BUMPER FORCE',value:(h:Hazard)=>`${h.value.toFixed(1)}× min speed`},
  };
  layer.innerHTML=hazards.map(h=>{
    const info=detail[h.type],side=h.y<220?'below':h.y>500?'above':h.x<W/2?'right':'left';
    const value=typeof info.value==='function'?info.value(h):info.value;
    const hitRadius=h.type==='spikes'?h.r+17:h.r;
    return `<button type="button" class="hazard-hover-target ${side}" aria-label="${info.label}: ${value}" style="left:${(h.x-hitRadius)/W*100}%;top:${(h.y-hitRadius)/H*100}%;width:${hitRadius*2/W*100}%;height:${hitRadius*2/H*100}%"><span class="hazard-tooltip">${specIcon(info.icon)}<span><small>${info.label}</small><b>${value}</b></span></span></button>`;
  }).join('');
  layer.hidden=!hazards.length;
}

function update(dt:number):void {
  const s = state.sim;
  if(!s||state.paused)return;
  if(!state.running||s.finished){if(s.finished)stepParticles(s,dt);return;}
  if (s.hitStop > 0) { s.hitStop--; return; }
  s.ticks++;
  for (const e of s.echoes) { e.frames--; if(e.frames===0){const event={damage:e.damage,force:e.damage,echo:true};e.victim.hp-=event.damage;runBehaviorHook(e.victim,'takeHit',{sim:s,rival:e.attacker,event,random:s.rng,showImpact:impact,emitParticles,audioTone,audioHit,playSound});e.victim.flash=6;e.victim.visualStates.echo=16;impact('ECHO!',e.victim);emitParticles(e.victim,{count:8,color:'#9ce3df',speed:170,gravity:0,kind:'ring',size:7});playSound('echo');} }
  s.echoes=s.echoes.filter(e=>e.frames>0);
  stepParticles(s,dt);
  for (const b of s.balls) {
    b.cooldown = Math.max(0,b.cooldown-1); b.weaponCooldown=Math.max(0,b.weaponCooldown-1);b.weaponWorldCooldown=Math.max(0,b.weaponWorldCooldown-1);b.fireCooldown=Math.max(0,b.fireCooldown-1); b.stunned = Math.max(0,b.stunned-1); b.flash = Math.max(0,b.flash-1);
    for(const name of Object.keys(b.visualStates)){b.visualStates[name]--;if(b.visualStates[name]<=0)delete b.visualStates[name];}
    for(const id of Object.keys(b.hazardCooldowns))b.hazardCooldowns[id]=Math.max(0,b.hazardCooldowns[id]-1);
    if (b.burn > 0) { b.burn--; if (b.burn % 12 === 0) b.hp-=.18*(b.burnStacks||1);if(!b.burn)b.burnStacks=0; }
    if(b.wallCrash&&b.wallCrash.frames>0)b.wallCrash.frames--;
    const rival=s.balls.find(other=>other!==b)!;
    const behaviorContext={sim:s,rival,event:{dt,force:0,damage:0},random:s.rng,showImpact:impact,emitParticles,audioTone,audioHit,playSound};
    runBehaviorHook(b,'tick',behaviorContext);
    if (b.frozen || b.stunned) continue;
    runBehaviorHook(b,'beforeMove',behaviorContext);
    b.angle=(b.angle+b.angularVelocity*dt)%(Math.PI*2);
    b.x += b.vx*dt; b.y += b.vy*dt;
    let hitWall=false,wallContact:Point|null=null;
    if (b.x-b.radius < ARENA_BOUNDS.left || b.x+b.radius > ARENA_BOUNDS.right) { const left=b.x-b.radius<ARENA_BOUNDS.left;b.x = Math.max(ARENA_BOUNDS.left+b.radius,Math.min(ARENA_BOUNDS.right-b.radius,b.x));wallContact={x:left?ARENA_BOUNDS.left:ARENA_BOUNDS.right,y:b.y}; b.vx *= -1;hitWall=true;runBehaviorHook(b,'wallHit',behaviorContext); }
    if (b.y-b.radius < ARENA_BOUNDS.top || b.y+b.radius > ARENA_BOUNDS.bottom) { const top=b.y-b.radius<ARENA_BOUNDS.top;b.y = Math.max(ARENA_BOUNDS.top+b.radius,Math.min(ARENA_BOUNDS.bottom-b.radius,b.y));wallContact={x:wallContact?.x??b.x,y:top?ARENA_BOUNDS.top:ARENA_BOUNDS.bottom}; b.vy *= -1;hitWall=true;runBehaviorHook(b,'wallHit',behaviorContext); }
    if(hitWall&&b.wallCrash&&b.wallCrash.frames>0){b.hp-=b.wallCrash.damage;b.flash=8;b.visualStates.wallSlam=20;b.wallCrash=null;impact('WALL SLAM!',wallContact??b);materialContact(wallContact??b,b.f.material,'plastic',14,{wall:true,balls:[b],volume:1.15});emitParticles(wallContact??b,{count:12,color:'#f1c590',speed:430,gravity:430,kind:'debris',size:9});}
    else if(hitWall)materialContact(wallContact??b,b.f.material,'plastic',Math.min(10,Math.hypot(b.vx,b.vy)/70),{wall:true,balls:[b],volume:.72,foundation:'wall'});
    collideHazard(b, s);
    const weaponContact=collectWeaponWorldContact(b,ARENA_BOUNDS,s.hazards);
    if(weaponContact){const weaponMaterial=b.f.weapon?.material??'metal';impact(weaponMaterial==='wood'?'KNOCK!':'CLANG!',weaponContact);materialContact(weaponContact,weaponMaterial,weaponContact.kind==='wall'?'plastic':hazardMaterial('pillar'),8,{primary:true,balls:[b],volume:.8});}
    const shot=fireRangedWeapon(b,s),weapon=b.f.weapon;
    if(shot&&weapon?.projectile){impact(shot.label,shot);b.visualStates.recoil=12;emitParticles(shot,{count:weapon.type==='sniper'?16:10,color:weapon.type==='sniper'?'#fff2a8':b.f.accent,speed:weapon.type==='sniper'?460:280,gravity:0,kind:weapon.type==='sniper'?'muzzle':'smoke',size:weapon.type==='sniper'?9:7});playSound(weapon.type==='sniper'?'sniper':'shotgun');}
  }
  resolveProjectileHits(stepProjectiles(s,dt,ARENA_BOUNDS,s.hazards),s);
  resolveWeaponHits(s.balls.map((ball,index)=>collectWeaponHit(ball,s.balls[1-index],dt)).filter((hit):hit is WeaponHit=>hit!==null),s);
  collideBalls(s);
  if (s.ticks > 60*24 && !s.finished) { const [a,b]=s.balls; a.hp -= 0.18; b.hp -= 0.18; }
  const outcome=resolveOutcome(s.balls[0],s.balls[1],{lastExchange:s.lastExchange,tick:s.ticks});
  if(outcome)finishFight(outcome.winner,outcome);
}

function stepParticles(s:Simulation,dt:number):void{
  for(const p of s.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=(p.gravity??500)*dt;p.rotation=(p.rotation??0)+(p.spin??0)*dt;p.life--;}
  s.particles=s.particles.filter(p=>p.life>0);
}

function resolveWeaponHits(hits:WeaponHit[],s:Simulation):void{
  if(!hits.length)return;
  const before={left:s.balls[0].hp,right:s.balls[1].hp};
  const prepared=hits.map(hit=>{
    const {attacker,victim}=hit;attacker.hits++;victim.incoming++;
    const event={force:hit.force,damage:hit.damage,weapon:true};
    const context={sim:s,rival:victim,event,random:s.rng,showImpact:impact,emitParticles,audioTone,audioHit,playSound};
    runBehaviorHook(attacker,'modifyOutgoing',context);
    runBehaviorHook(victim,'modifyIncoming',{...context,rival:attacker});
    return {...hit,event,context};
  });
  for(const hit of prepared)hit.victim.hp-=hit.event.damage;
  for(const hit of prepared){
    const {attacker,victim,event,context}=hit;
    applyWeaponMotion(hit);
    victim.flash=7;s.hitStop=Math.max(s.hitStop,Math.round(2+event.force*.25));
    runBehaviorHook(attacker,'dealHit',context);
    runBehaviorHook(victim,'takeHit',{...context,rival:attacker});
    const weaponMaterial=attacker.f.weapon?.material??'metal';
    materialContact(victim,weaponMaterial,victim.f.material,event.force,{primary:weaponMaterial==='wood',balls:[attacker,victim],volume:1});
    impact(hit.label,victim);
  }
  const [left,right]=s.balls;
  s.lastExchange={tick:s.ticks,source:'weapon exchange',before,after:{left:left.hp,right:right.hp},damageTaken:{left:before.left-left.hp,right:before.right-right.hp}};
}

function resolveProjectileHits(hits:ProjectileHit[],s:Simulation):void{
  if(!hits.length)return;
  const before={left:s.balls[0].hp,right:s.balls[1].hp};
  const prepared=hits.map(hit=>{
    const attacker=hit.projectile.shooter,victim=hit.target;attacker.hits++;victim.incoming++;
    const event={force:hit.projectile.force,damage:hit.projectile.damage,weapon:true,projectile:true};
    const context={sim:s,rival:victim,event,random:s.rng,showImpact:impact,emitParticles,audioTone,audioHit,playSound};
    runBehaviorHook(attacker,'modifyOutgoing',context);runBehaviorHook(victim,'modifyIncoming',{...context,rival:attacker});
    return{...hit,attacker,victim,event,context};
  });
  for(const hit of prepared)hit.victim.hp-=hit.event.damage;
  for(const hit of prepared){
    hit.victim.flash=8;runBehaviorHook(hit.attacker,'dealHit',hit.context);runBehaviorHook(hit.victim,'takeHit',{...hit.context,rival:hit.attacker});
    impact(hit.projectile.type==='sniper'?'HEADSHOT!':'PELLET!',{x:hit.x,y:hit.y});
    materialContact({x:hit.x,y:hit.y},'metal',hit.victim.f.material,hit.event.force,{balls:[hit.victim],volume:hit.projectile.type==='sniper'?1.25:.8});
    emitParticles({x:hit.x,y:hit.y},{count:hit.projectile.type==='sniper'?12:4,color:hit.projectile.color,speed:hit.projectile.type==='sniper'?470:330,gravity:180,kind:hit.projectile.type==='sniper'?'star':'spark',size:hit.projectile.type==='sniper'?9:6});
  }
  const [left,right]=s.balls;s.lastExchange={tick:s.ticks,source:'projectile volley',before,after:{left:left.hp,right:right.hp},damageTaken:{left:before.left-left.hp,right:before.right-right.hp}};
}

function collideHazard(b:Ball,s:Simulation):void {
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
          impact(`${h.value.toFixed(1)}× BOOST!`,{x:h.x+nx*h.r,y:h.y+ny*h.r});playSound('pinball');s.hitStop=3;b.flash=7;b.visualStates.launched=18;b.hazardCooldowns[h.id]=12;
          for(let i=0;i<12;i++){const a=i*Math.PI/6;s.particles.push({x:h.x+Math.cos(a)*h.r,y:h.y+Math.sin(a)*h.r,vx:Math.cos(a)*420,vy:Math.sin(a)*420,life:18,color:'#f6b817'});}
        }
      }
      else if(h.type==='spikes' && ready) { const point={x:h.x+nx*h.r,y:h.y+ny*h.r};b.hp=Math.max(0,b.hp-h.value);b.flash=8;b.visualStates.spiked=18;b.hazardCooldowns[h.id]=45;impact(`−${h.value} HP`,point);materialContact(point,'metal',b.f.material,10,{balls:[b],volume:1});emitParticles(point,{count:10,color:'#ff3d2e',speed:300,gravity:320,kind:'slash',size:7}); }
      else if(h.type==='medbay' && ready) { const before=b.hp;b.hp=Math.min(100,b.hp+h.value);b.hazardCooldowns[h.id]=75;if(b.hp>before){b.visualStates.healing=32;impact(`+${h.value} HP`,b);emitParticles(b,{count:12,color:'#abf1dd',speed:150,gravity:-90,kind:'heal',size:8});playSound('heal');} }
      else if(ready){materialContact({x:h.x+nx*h.r,y:h.y+ny*h.r},b.f.material,hazardMaterial(h.type),5,{balls:[b],volume:.65});b.hazardCooldowns[h.id]=8;}
    }
  }
}

function collideBalls(s:Simulation):void {
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
    const contextA={sim:s,rival:b,event:eventA,random:s.rng,showImpact:impact,emitParticles,audioTone,audioHit,playSound};
    const contextB={sim:s,rival:a,event:eventB,random:s.rng,showImpact:impact,emitParticles,audioTone,audioHit,playSound};
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
    const point={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    materialContact(point,a.f.material,b.f.material,force,{balls:[a,b],volume:.7+force/18,foundation:'body'});
    emitParticles(point,{count:Math.round(3+force/3),color:a.f.color,speed:150+force*12,gravity:240,kind:'spark',size:3+force*.12});
  }
}

function setDossier(side:Side,f:Fighter):void{
  const specs=f.specs.map(item=>`<div class="dossier-spec">${specIcon(item.icon)}<span><small>${item.label}</small><b>${item.value}</b></span></div>`).join('');
  $(side+'-dossier').innerHTML=`<strong>${f.ability}</strong><p>${f.desc}</p><div class="dossier-specs">${specs}</div><small class="core-stats">SPD ${Math.round(f.speed*100)} · PWR ${Math.round(f.power*100)} · MASS ${Math.round(f.mass*100)} · FORM ±10%</small>`;
  $(side+'-info').setAttribute('aria-label',`${f.name}: ${f.ability}. ${f.desc}`);
}

function finishFight(winner:Winner,resolution:Partial<Outcome>={mutualKo:false}):void {
  const s=state.sim;if(!s)return;s.finished=true; state.running=false;
  if(!state.replaying)state.result=winner;
  const bout=state.bouts[state.index],name=winner==='left'?bout.left.name:winner==='right'?bout.right.name:'DRAW';
  const victor=winner==='draw'?{x:W/2,y:H/2}:s.balls.find(ball=>ball.side===winner)??{x:W/2,y:H/2};
  emitParticles(victor,{count:34,color:'#e6ff34',speed:430,gravity:360,kind:'star',size:9});playSound('rumble',{volume:.7});
  $('arena-stamp').textContent=winner==='draw'?'DEAD HEAT':`${name} WINS`; $('arena-stamp').classList.remove('hidden');
  setReplayControl();
  if(state.replaying){state.replaying=false;return;}
  $('bet-title').hidden=true;$('fight-instruction').hidden=true;
  renderCloseCall(resolution,bout);
  if(state.mode==='versus'){
    $('versus-controls').hidden=true;$('result-card').hidden=false;$('result-card').classList.remove('loss');$('result-title').textContent=resolution.mutualKo?'THAT WAS CLOSE':winner==='draw'?'DEAD HEAT':`${name} WINS`;
    if(!resolution.mutualKo)$('result-copy').textContent=`Seed ${state.seed}. Run it again or change either fighter.`;$('next-bout').textContent='RUN AGAIN →';return;
  }
  const correct=winner===state.selected;correct?state.wins++:state.losses++;
  $('pick-list').hidden=true; $('result-card').hidden=false; $('result-card').classList.toggle('loss',!correct); $('result-title').textContent=resolution.mutualKo?'THAT WAS CLOSE':correct?'YOU CALLED IT':'PICK BUSTED';
  updateResultCardPalette();
  if(!resolution.mutualKo)$('result-copy').textContent=`${name} takes bout ${state.index+1}. ${correct?'The perfect card is still alive.':'No perfect card today—but the streak continues.'}`;
  $('next-bout').textContent=state.index===4?'SEE FINAL CARD →':'NEXT BOUT →'; $('record').textContent=`${state.wins}—${state.losses}`; updatePips();
  playSound(correct?'success':'failure');
}

function renderCloseCall(result:Partial<Outcome>,bout:Bout):void{
  const box=$('result-breakdown');box.hidden=!result.mutualKo;$('result-card').classList.toggle('close-call',result.mutualKo);
  if(!result.mutualKo)return;
  const hp=(n:number)=>`${n<0?'−':''}${Math.abs(n).toFixed(1)} HP`;
  $('result-copy').textContent='Both fighters dropped below zero HP.';
  $('result-final-hp').textContent=`${bout.left.name} ${hp(result.leftHp??0)} / ${bout.right.name} ${hp(result.rightHp??0)}`;
  $('result-margin').textContent=result.decidedBy==='overkillHp'?`${(result.hpMargin??0).toFixed(1)} HP`:'DEAD-EVEN HP';
  $('result-ruling').textContent=(result.decidedBy??'deadHeat').replace(/([A-Z])/g,' $1').toUpperCase();
}

function clearResultCardPalette():void{
  const card=$('result-card');card.style.removeProperty('--result-loss-bg');delete card.dataset.foreground;
}

function updateResultCardPalette():void{
  const card=$('result-card');
  if(!card.classList.contains('loss')||card.classList.contains('close-call')){clearResultCardPalette();return;}
  const bout=state.bouts[state.index],picked=state.selected==='right'?bout.right:bout.left;
  const background=document.documentElement.dataset.theme==='dark'?'#f3efdf':picked.color;
  applyAdaptiveCardPalette(card,background,'--result-loss-bg');
}

function applyAdaptiveCardPalette(card:HTMLElement,background:string,backgroundProperty:string):void{
  card.style.setProperty(backgroundProperty,background);
  card.dataset.foreground=contrastForeground(background);
}

function draw():void {
  const s=state.sim;if(!s)return;ctx.clearRect(0,0,W,H); ctx.fillStyle='#d9d4c2'; ctx.fillRect(0,0,W,H);
  if(arenaPointer)updateArenaBallPreview();
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

function drawProjectiles(projectiles:Projectile[]):void{
  for(const p of projectiles){ctx.save();ctx.strokeStyle=p.color;ctx.fillStyle=p.type==='sniper'?'#f3efdf':p.color;ctx.lineWidth=p.type==='sniper'?5:3;ctx.beginPath();ctx.moveTo(p.previousX,p.previousY);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,Math.PI*2);ctx.fill();ctx.restore();}
}

function drawEffectParticle(p:Particle):void{
  ctx.save();ctx.globalAlpha=Math.min(1,p.life/8);ctx.translate(p.x,p.y);ctx.rotate(p.rotation??0);ctx.fillStyle=p.color;ctx.strokeStyle=p.stroke??'#151515';ctx.lineWidth=1.5;
  const size=p.size??6;
  if(p.kind==='ice'||p.kind==='slash'||p.kind==='glass'){ctx.beginPath();ctx.moveTo(0,-size);ctx.lineTo(size*.55,size);ctx.lineTo(-size*.55,size*.45);ctx.closePath();ctx.fill();ctx.stroke();}
  else if(p.kind==='bubble'||p.kind==='ring'){ctx.globalAlpha*=.75;ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,size,0,Math.PI*2);ctx.strokeStyle=p.color;ctx.stroke();}
  else if(p.kind==='leaf'){ctx.scale(1,.55);ctx.beginPath();ctx.arc(0,0,size,0,Math.PI*2);ctx.fill();ctx.stroke();}
  else if(p.kind==='coin'){ctx.scale(1,.45);ctx.beginPath();ctx.arc(0,0,size,0,Math.PI*2);ctx.fill();ctx.stroke();}
  else if(p.kind==='heal'){ctx.fillRect(-size*.22,-size,size*.44,size*2);ctx.fillRect(-size,-size*.22,size*2,size*.44);}
  else if(p.kind==='bolt'){ctx.lineWidth=Math.max(2,size*.35);ctx.strokeStyle=p.color;ctx.beginPath();ctx.moveTo(-size,0);ctx.lineTo(-size*.2,-size*.5);ctx.lineTo(size*.1,size*.4);ctx.lineTo(size,-size*.2);ctx.stroke();}
  else if(p.kind==='star'||p.kind==='muzzle'){ctx.beginPath();for(let i=0;i<8;i++){const radius=i%2?size*.35:size,angle=i*Math.PI/4;i?ctx.lineTo(Math.cos(angle)*radius,Math.sin(angle)*radius):ctx.moveTo(Math.cos(angle)*radius,Math.sin(angle)*radius);}ctx.closePath();ctx.fill();ctx.stroke();}
  else if(p.kind==='smoke'||p.kind==='void'){ctx.globalAlpha*=.55;ctx.beginPath();ctx.arc(0,0,size,0,Math.PI*2);ctx.fill();}
  else if(p.kind==='fire'){ctx.beginPath();ctx.moveTo(0,-size);ctx.quadraticCurveTo(size,size*.2,0,size);ctx.quadraticCurveTo(-size,size*.2,0,-size);ctx.fill();}
  else if(p.kind==='metal'||p.kind==='debris'){ctx.fillRect(-size/2,-size*.22,size,size*.44);ctx.strokeRect(-size/2,-size*.22,size,size*.44);}
  else if(p.kind==='splinter'){ctx.fillRect(-size*.85,-size*.16,size*1.7,size*.32);ctx.strokeRect(-size*.85,-size*.16,size*1.7,size*.32);}
  else if(p.kind==='stone'){ctx.beginPath();ctx.moveTo(-size*.7,-size*.3);ctx.lineTo(-size*.15,-size);ctx.lineTo(size*.8,-size*.35);ctx.lineTo(size*.55,size*.65);ctx.lineTo(-size*.45,size*.8);ctx.closePath();ctx.fill();ctx.stroke();}
  else{ctx.fillRect(-size/2,-size/2,size,size);if(p.stroke)ctx.strokeRect(-size/2,-size/2,size,size);}
  ctx.restore();
}

function drawHazards(hazards:Hazard[]):void{
  for(const h of hazards){
    const type=h.type;
    ctx.save();ctx.translate(h.x,h.y);ctx.strokeStyle='#151515';ctx.lineWidth=6;
    if(type==='spikes'){
      ctx.fillStyle='#ff3d2e';ctx.beginPath();
      for(let i=0;i<24;i++){const a=i*Math.PI/12,r=i%2?h.r:h.r+17;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();ctx.stroke();
    } else {
      ctx.fillStyle=type==='medbay'?'#20c997':type==='pinball'?'#f6b817':'#e6ff34';ctx.beginPath();ctx.arc(0,0,h.r,0,Math.PI*2);ctx.fill();ctx.stroke();
      if(type==='medbay'){const arm=h.r*.55,bar=Math.max(7,h.r*.28);ctx.fillStyle='#f3efdf';ctx.fillRect(-bar/2,-arm,bar,arm*2);ctx.fillRect(-arm,-bar/2,arm*2,bar);}
      else if(type==='pinball'){
        ctx.beginPath();ctx.arc(0,0,h.r*.63,0,Math.PI*2);ctx.stroke();
      }
    }
    ctx.restore();
  }
}

function drawBall(b:Ball):void {
  ctx.save();
  if(state.highlightedSide && state.highlightedSide!==b.side){ctx.filter='grayscale(1)';ctx.globalAlpha=.3;}
  runBehaviorHook(b,'drawBack',{sim:state.sim??undefined,ctx});
  ctx.save();ctx.translate(b.x,b.y);ctx.fillStyle='rgba(0,0,0,.22)';ctx.beginPath();ctx.ellipse(7,b.radius*.82,b.radius*.9,b.radius*.28,0,0,Math.PI*2);ctx.fill();ctx.restore();
  ctx.save();ctx.translate(b.x,b.y);if((b.visualStates.squash??0)>0){const wobble=Math.sin((b.visualStates.squash??0)*1.7)*.055;ctx.scale(1+wobble,1-wobble);}if(b.flash)ctx.globalAlpha=b.flash%2?.35:1;
  ctx.fillStyle=b.f.color;ctx.strokeStyle='#151515';ctx.lineWidth=7;ctx.beginPath();ctx.arc(0,0,b.radius,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle=b.f.accent;ctx.beginPath();ctx.arc(-b.radius*.28,-b.radius*.3,b.radius*.22,0,Math.PI*2);ctx.fill();
  drawBallStateTexture(b);
  ctx.restore();
  drawWeapon(ctx,b);
  runBehaviorHook(b,'drawFront',{sim:state.sim??undefined,ctx});
  drawFighterIcon(ctx,b.f.id,b.x,b.y,b.radius*.82);
  if(b.burn>0){ctx.save();ctx.fillStyle='#ff6b1a';for(let i=0;i<5;i++){const a=((state.sim?.ticks??0)*.08+i*1.25),r=b.radius+10+(i%2)*7;ctx.beginPath();ctx.arc(b.x+Math.cos(a)*r,b.y+Math.sin(a)*r,4+i%2*2,0,Math.PI*2);ctx.fill();}ctx.restore();}
  runBehaviorHook(b,'draw',{sim:state.sim??undefined,ctx});
  ctx.restore();
}

function drawBallStateTexture(b:Ball):void{
  const ticks=state.sim?.ticks??0,frozen=(b.frostFrozenUntil??0)>ticks,brambled=(b.visualStates.brambled??0)>0;
  ctx.save();ctx.beginPath();ctx.arc(0,0,b.radius-3,0,Math.PI*2);ctx.clip();
  if((b.visualStates.steel??0)>0){ctx.fillStyle='rgba(176,188,198,.78)';ctx.fillRect(-b.radius,-b.radius,b.radius*2,b.radius*2);ctx.strokeStyle='#f5f8fa';ctx.lineWidth=3;for(let y=-b.radius;y<b.radius;y+=13){ctx.beginPath();ctx.moveTo(-b.radius,y);ctx.lineTo(b.radius,y-8);ctx.stroke();}}
  if(frozen){ctx.fillStyle='rgba(165,231,248,.52)';ctx.fillRect(-b.radius,-b.radius,b.radius*2,b.radius*2);ctx.strokeStyle='#ecfdff';ctx.lineWidth=4;for(let i=0;i<7;i++){const a=i*2.19+(b.side==='left'?.4:.9),inner=b.radius*.18,outer=b.radius*.88;ctx.beginPath();ctx.moveTo(Math.cos(a)*inner,Math.sin(a)*inner);ctx.lineTo(Math.cos(a)*outer,Math.sin(a)*outer);ctx.lineTo(Math.cos(a+.32)*outer*.68,Math.sin(a+.32)*outer*.68);ctx.stroke();}}
  if(brambled){ctx.strokeStyle='#344c22';ctx.lineWidth=6;for(let i=0;i<4;i++){const y=-b.radius*.7+i*b.radius*.47;ctx.beginPath();ctx.moveTo(-b.radius,y);ctx.bezierCurveTo(-b.radius*.45,y-18,b.radius*.2,y+22,b.radius,y-4);ctx.stroke();for(let x=-b.radius*.55;x<b.radius*.7;x+=b.radius*.5){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+8,y-12);ctx.stroke();}}}
  if((b.visualStates.electric??0)>0){ctx.strokeStyle='rgba(229,255,0,.9)';ctx.lineWidth=4;for(let i=0;i<5;i++){const y=-b.radius+i*b.radius*.48;ctx.beginPath();ctx.moveTo(-b.radius,y);ctx.lineTo(-b.radius*.25,y+10);ctx.lineTo(0,y-7);ctx.lineTo(b.radius*.35,y+8);ctx.lineTo(b.radius,y-3);ctx.stroke();}}
  if((b.visualStates.phase??0)>0){ctx.fillStyle='rgba(217,188,255,.34)';for(let i=0;i<8;i++)ctx.fillRect(-b.radius+(i%3)*b.radius*.7,-b.radius+i*b.radius*.27,b.radius*.55,7);}
  ctx.restore();
  if((b.visualStates.materialHit??0)>0){
    const colors:Record<Material,string>={plastic:'#f3efdf',metal:'#edf3f6',stone:'#aaa797',wood:'#d89a54',rubber:'#ffc4ef',glass:'#d8f7ff',energy:'#e5ff00',ceramic:'#fff3dc'};
    const material=b.f.material??'plastic',fade=(b.visualStates.materialHit??0)/7;
    ctx.globalAlpha=.35+.5*fade;ctx.strokeStyle=colors[material];ctx.lineWidth=3+fade*3;ctx.beginPath();ctx.arc(0,0,b.radius+3+3*(1-fade),0,Math.PI*2);ctx.stroke();
    if(material==='metal'||material==='glass'){ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-b.radius*.55,-b.radius*.7);ctx.lineTo(-b.radius*.12,-b.radius*.9);ctx.stroke();}
    else if(material==='stone'||material==='ceramic'){ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-5,-b.radius*.9);ctx.lineTo(4,-b.radius*.48);ctx.lineTo(-4,-b.radius*.2);ctx.stroke();}
    else if(material==='wood'){ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,b.radius*.6,-.8,.9);ctx.stroke();}
  }
  if(frozen){ctx.strokeStyle='#d8f7ff';ctx.lineWidth=6;ctx.setLineDash([10,5]);ctx.beginPath();ctx.arc(0,0,b.radius+5,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
  if(brambled){ctx.strokeStyle='#658c3a';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,b.radius+5,0,Math.PI*2);ctx.stroke();}
  if((b.visualStates.healing??0)>0){ctx.strokeStyle='#abf1dd';ctx.lineWidth=4;ctx.globalAlpha=.65+.3*Math.sin(ticks*.3);ctx.beginPath();ctx.arc(0,0,b.radius+8,0,Math.PI*2);ctx.stroke();}
}

function drawImpactPopups(s:Simulation):void{
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

function updateHud():void{ if(!state.sim)return; const [a,b]=state.sim.balls; const hpA=Math.max(0,Math.min(100,a.hp)),hpB=Math.max(0,Math.min(100,b.hp)); $('left-hp').style.width=`${hpA}%`; $('right-hp').style.width=`${hpB}%`; $('left-hp-text').textContent=String(Math.ceil(hpA)); $('right-hp-text').textContent=String(Math.ceil(hpB)); }
function updatePips():void{ document.querySelectorAll<HTMLElement>('#score-pips li').forEach((el,i)=>{el.className='';if(i<state.index)el.classList.add(state.bouts[i].outcome??'');else if(i===state.index)el.classList.add('active');}); }
function impact(word:string,origin:Point|Ball):void{
  const s=state.sim;if(!s)return;
  const x=Math.max(70,Math.min(W-70,origin?.x??W/2)),y=Math.max(115,Math.min(H-45,origin?.y??H/2));
  const index=s.impactPopups.length;
  s.impactPopups.push({word,x,y,born:performance.now(),size:word.length>12?24:word.length>8?29:36,rotation:(index%2?1:-1)*(.045+(index%3)*.025),color:word.includes('+')?'#8ee888':word.includes('−')?'#ff8c82':'#edff24'});
}

function emitParticles(origin:Point|Ball,{count=10,color='#fff',speed=300,gravity=500,kind='spark',size=6}:ParticleOptions={}):void{
  const s=state.sim;if(!s||!origin)return;
  for(let i=0;i<count;i++){const angle=s.visualRng()*Math.PI*2,magnitude=speed*(.45+s.visualRng()*.75);s.particles.push({x:origin.x,y:origin.y,vx:Math.cos(angle)*magnitude,vy:Math.sin(angle)*magnitude,gravity,life:20+Math.floor(s.visualRng()*18),color,kind,size:size*(.65+s.visualRng()*.7),rotation:s.visualRng()*Math.PI*2,spin:(s.visualRng()-.5)*12,stroke:kind==='ice'?'#5caac0':null});}
}

function materialContact(origin:Point|Ball,a:Material|undefined,b:Material|undefined,force:number,{wall=false,primary=false,balls=[],volume=1,foundation}:{wall?:boolean;primary?:boolean;balls?:Ball[];volume?:number;foundation?:'body'|'wall'}={}):ContactFeedback{
  const feedback=contactFeedback(a,b,force,{wall,primary});
  emitParticles(origin,feedback.particles);
  emitParticles(origin,{count:force>8?3:1,color:feedback.ringColor,speed:45+force*5,gravity:0,kind:'ring',size:5+force*.45});
  for(const ball of balls){ball.visualStates.materialHit=7;if(feedback.material==='rubber')ball.visualStates.squash=9;}
  if(foundation)playSound(foundation==='body'?'bodyContact':'wallContact',{volume:.68+Math.min(.32,force/28),rate:Math.max(.82,Math.min(1.18,1.06-force*.01))});
  if(!(foundation==='wall'&&feedback.cue==='materialWall'))playSound(feedback.cue,{volume,rate:Math.max(.72,Math.min(1.25,1.12-force*.018))});
  return feedback;
}

let audioCtx:AudioContext|undefined;
function audioTone(freq:number,duration:number,type:OscillatorType='sine',volume=.1):void{if(state.soundVolume<=0)return;audioCtx??=new AudioContext();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume*state.soundVolume*SOUND_OUTPUT_GAIN,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);o.connect(g).connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration);}
function audioHit(power:number):void{if(state.soundVolume<=0)return;audioTone(70+power*100,.07,'square',.03+power*.08);}
function playSound(cue:SoundCue,options?:SoundCueOptions):void{playLibrarySound(cue,{...options,enabled:state.soundVolume>0,volume:(options?.volume??1)*state.soundVolume,random:state.sim?.visualRng});}

document.querySelectorAll<HTMLElement>('.pick-select').forEach(btn=>btn.addEventListener('click',()=>{if(state.running)return;state.selected=btn.dataset.pick as Side;document.querySelectorAll<HTMLElement>('.pick-card').forEach(card=>card.classList.toggle('selected',card.dataset.pick===state.selected));$('lock-pick').disabled=false;audioTone(260,.05,'square',.05);}));
let dossierPreviewSide:Side|null=null;
function setFighterPreview(side:Side|null):void{
  state.highlightedSide=side;
  if(dossierPreviewSide===side)return;
  dossierPreviewSide=side;
  (['left','right'] as Side[]).forEach(current=>$(current+'-info').classList.toggle('dossier-preview',current===side));
}
function setExpandedPickInfo(side:Side|null):void{
  document.querySelectorAll<HTMLElement>('.pick-info').forEach(button=>button.setAttribute('aria-expanded',String(button.dataset.pick===side)));
}
function dismissExpandedPickInfo():void{
  setExpandedPickInfo(null);
  const focused=document.activeElement;
  if(focused instanceof HTMLElement&&focused.classList.contains('pick-info'))focused.blur();
}
document.querySelectorAll<HTMLElement>('.pick-info').forEach(button=>{
  const side=button.dataset.pick as Side;
  button.addEventListener('click',()=>{
    const next=button.getAttribute('aria-expanded')==='true'?null:side;
    setExpandedPickInfo(next);setFighterPreview(next);
  });
  button.addEventListener('blur',()=>{if(button.getAttribute('aria-expanded')==='true'){setExpandedPickInfo(null);if(dossierPreviewSide===side)setFighterPreview(null);}});
  button.addEventListener('keydown',event=>{if(event.key==='Escape'){setExpandedPickInfo(null);setFighterPreview(null);button.blur();}});
});
(['left','right'] as Side[]).forEach(side=>{
  const trigger=$(side+'-info');
  trigger.addEventListener('pointerenter',()=>state.highlightedSide=side);
  trigger.addEventListener('pointerleave',()=>state.highlightedSide=null);
  trigger.addEventListener('focus',()=>state.highlightedSide=side);
  trigger.addEventListener('blur',()=>state.highlightedSide=null);
});
let arenaPointer:Point|null=null;
function updateArenaBallPreview():void{
  const ball=arenaPointer&&state.sim?.balls.find(candidate=>Math.hypot(candidate.x-arenaPointer!.x,candidate.y-arenaPointer!.y)<=candidate.radius);
  setFighterPreview(ball?.side??null);
  canvas.style.cursor=ball?'help':'default';
}
canvas.addEventListener('pointermove',event=>{
  dismissExpandedPickInfo();
  const bounds=canvas.getBoundingClientRect();
  arenaPointer={x:(event.clientX-bounds.left)*W/bounds.width,y:(event.clientY-bounds.top)*H/bounds.height};
  updateArenaBallPreview();
});
canvas.addEventListener('pointerleave',()=>{arenaPointer=null;setFighterPreview(null);canvas.style.cursor='default';});
$('lock-pick').addEventListener('click',startFight);
$('global-pause').addEventListener('click',()=>{if(state.sim?.finished){replayFight();return;}if(!state.running)return;state.paused=!state.paused;$('global-pause').classList.toggle('active',state.paused);$('global-pause').textContent=state.paused?'▶ RESUME FIGHT':'Ⅱ PAUSE FIGHT';$('global-pause').setAttribute('aria-label',state.paused?'Resume fight':'Pause fight');});
const helpDialog=$('how-to-play') as unknown as HTMLDialogElement;
let helpPausedFight=false;
function openHelp():void{
  helpPausedFight=state.running&&!state.paused;
  if(helpPausedFight)state.paused=true;
  helpDialog.showModal();
}
function closeHelp():void{helpDialog.close();}
$('help-open').addEventListener('click',openHelp);
$('help-close').addEventListener('click',closeHelp);
helpDialog.addEventListener('click',event=>{if(event.target===helpDialog)closeHelp();});
helpDialog.addEventListener('close',()=>{if(helpPausedFight){state.paused=false;helpPausedFight=false;}});
function setSoundVolume(volume:number,{preview=false}:{preview?:boolean}={}):void{
  const next=Math.max(0,Math.min(1,volume));
  state.soundVolume=next;
  if(next>0)state.lastAudibleVolume=next;
  const percent=Math.round(next*100),level=percent===0?'muted':percent<=33?'low':percent<=66?'medium':'high';
  const slider=$('sound-volume');slider.value=String(percent);slider.style.setProperty('--volume-fill',`${percent}%`);
  $('volume-control').dataset.level=level;
  $('volume-value').textContent=String(percent);
  $('volume-mute').setAttribute('aria-label',percent===0?'Restore sound':`Mute sound. Current volume ${percent}%`);
  $('volume-mute').setAttribute('title',percent===0?'Restore sound':'Mute sound');
  try{localStorage.setItem('random-arena-volume',String(next));}catch{}
  if(preview&&next>0)audioTone(420,.055,'sine',.045);
}
setSoundVolume(initialSoundVolume);
$('sound-volume').addEventListener('input',event=>setSoundVolume(Number((event.target as HTMLInputElement).value)/100));
$('sound-volume').addEventListener('change',()=>{if(state.soundVolume>0)audioTone(420,.055,'sine',.045);});
$('volume-mute').addEventListener('click',()=>setSoundVolume(state.soundVolume>0?0:state.lastAudibleVolume,{preview:state.soundVolume===0}));
function setTheme(theme:'light'|'dark',{persist=true}:{persist?:boolean}={}):void{
  const dark=theme==='dark';
  document.documentElement.dataset.theme=dark?'dark':'light';
  $('theme-toggle').textContent=dark?'LIGHT MODE':'DARK MODE';
  $('theme-toggle').setAttribute('aria-pressed',String(dark));
  (document.querySelector('meta[name="theme-color"]') as HTMLMetaElement).content=dark?'#151515':'#f3efdf';
  updateResultCardPalette();
  if(persist)try{localStorage.setItem('random-arena-theme',dark?'dark':'light');}catch{}
}
let savedTheme:'light'|'dark'='light';
try{savedTheme=localStorage.getItem('random-arena-theme')==='dark'?'dark':'light';}catch{}
setTheme(savedTheme,{persist:false});
$('theme-toggle').addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
$('next-bout').addEventListener('click',()=>{
  if(state.mode==='versus'){setupBout();startFight();return;}
  if(state.cardComplete){resetCard();return;}
  const correct=state.result===state.selected;state.bouts[state.index].outcome=correct?'win':'loss';
  if(state.index<4){state.index++;setupBout();}else{state.cardComplete=true;showFinal();}
});

document.querySelectorAll<HTMLElement>('[data-route]').forEach(link=>link.addEventListener('click',event=>{
  event.preventDefault();setMode(link.dataset.route as GameMode);
}));

async function copyText(text:string,button:HTMLElement):Promise<void>{
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

function showFinal(){
  const perfect=state.wins===5,card=$('result-card');
  card.classList.remove('loss','close-call');clearResultCardPalette();$('result-breakdown').hidden=true;
  $('result-final-hp').textContent='';$('result-margin').textContent='';$('result-ruling').textContent='';
  $('result-title').textContent=perfect?'PERFECT 5 / 5':'CARD COMPLETE';
  $('result-copy').textContent=perfect?'Untouched. Unbeaten. Run the same seed again or start a new card.':`Final record: ${state.wins}—${state.losses}. ${state.mode==='daily'?'Come back tomorrow for five new fights.':'Try a new seed or replay this card.'}`;
  $('next-bout').textContent='REPLAY CARD →';
}

function loop(t:number):void{if(!state.lastTime)state.lastTime=t;state.accumulator+=Math.min(.1,(t-state.lastTime)/1000)*state.simulationSpeed;state.lastTime=t;while(state.accumulator>=STEP){update(STEP);state.accumulator-=STEP;}updateHud();draw();requestAnimationFrame(loop);}

for(const select of [$('versus-left'),$('versus-right')])select.innerHTML=fighters.map(f=>`<option value="${f.id}">${f.name} — ${f.ability}</option>`).join('');
const localHostnames=new Set(['localhost','127.0.0.1','[::1]','0.0.0.0']);
$('versus-nav').hidden=!(localHostnames.has(location.hostname)||location.hostname.endsWith('.localhost'));
if(localHostnames.has(location.hostname)||location.hostname.endsWith('.localhost')){
  // Localhost is shared by unrelated projects. Retire any service worker and
  // caches left behind by a previous app so they cannot intercept arena media.
  if('serviceWorker' in navigator)void navigator.serviceWorker.getRegistrations().then(registrations=>Promise.all(registrations.map(registration=>registration.unregister()))).catch(()=>{});
  if('caches' in globalThis)void caches.keys().then(keys=>Promise.all(keys.map(key=>caches.delete(key)))).catch(()=>{});
}
for(const select of [$('versus-left'),$('versus-right')])select.addEventListener('change',()=>{
  if(state.mode!=='versus')return;
  setMode('versus',$('seed-input').value,{push:false,left:$('versus-left').value,right:$('versus-right').value});
});
$('start-versus').addEventListener('click',()=>{setMode('versus',$('seed-input').value,{push:false,left:$('versus-left').value,right:$('versus-right').value});startFight();});
$('simulation-speed').addEventListener('change',event=>{state.simulationSpeed=Number((event.target as HTMLSelectElement).value)||1;state.accumulator=0;});
const initialParams=new URLSearchParams(location.search),initialMode=location.pathname.startsWith('/versus')?'versus':location.pathname.startsWith('/endless')?'endless':'daily';
preloadSounds();setMode(initialMode,initialParams.get('seed'),{push:false,left:initialParams.get('left'),right:initialParams.get('right')});requestAnimationFrame(loop);
