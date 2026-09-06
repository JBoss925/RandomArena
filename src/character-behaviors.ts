import {applyDamage} from './damage.js';
import type {Ball,Behavior,BehaviorContext,CombatEvent,Point} from './types.js';

const pulse=(ball:BehaviorContext['ball'],name:string,frames:number):void=>{ball.visualStates[name]=Math.max(ball.visualStates[name]??0,frames);};
type Dispatch=(ball:Ball,hook:'modifyIncoming'|'takeHit',context:Partial<BehaviorContext>)=>void;
export const characterTuning={palmDamage:35,clinchDamage:18,laserDamage:10,phaseCutDamage:30,retaliationDamage:8};

function rayLength(origin:Point,angle:number,width:number,height:number):number{
  const dx=Math.cos(angle),dy=Math.sin(angle),distances:number[]=[];
  if(dx>0)distances.push((width-28-origin.x)/dx);else if(dx<0)distances.push((28-origin.x)/dx);
  if(dy>0)distances.push((height-28-origin.y)/dy);else if(dy<0)distances.push((80-origin.y)/dy);
  return Math.min(...distances.filter(distance=>distance>0));
}

function abilityStrike(c:BehaviorContext,dispatch:Dispatch,damage:number,label:string,point:Point,type:CombatEvent['damageType']='physical',eventExtras:Partial<CombatEvent>={}):void{
  const {ball,rival,sim}=c,before={left:sim.balls[0].hp,right:sim.balls[1].hp};
  const event:CombatEvent={force:damage,damage:damage*ball.f.power,ability:true,damageType:type,...eventExtras};
  ball.hits++;rival.incoming++;dispatch(rival,'modifyIncoming',{...c,rival:ball,event});applyDamage(rival,event.damage,event.damageType);dispatch(rival,'takeHit',{...c,rival:ball,event});
  sim.lastExchange={tick:sim.ticks,source:label,before,after:{left:sim.balls[0].hp,right:sim.balls[1].hp},damageTaken:{left:before.left-sim.balls[0].hp,right:before.right-sim.balls[1].hp}};
  rival.flash=9;c.showImpact(label,point);
}

export function characterBehaviors(dispatch:Dispatch):Record<string,Behavior>{
  return{
    stillMind:{
      tick(c){
        const {ball,rival,random}=c;
        if(ball.palmRelease){
          rival.vx=0;rival.vy=0;rival.stunned=Math.max(rival.stunned,2);
          if(--ball.palmRelease.frames<=0){
            const {dx,dy}=ball.palmRelease;rival.vx=dx*1050;rival.vy=dy*1050;rival.stunned=0;ball.palmRelease=undefined;
          }
          return;
        }
        if((ball.meditationFrames??0)>0){
          ball.meditationFrames!--;ball.vx=0;ball.vy=0;pulse(ball,'meditating',3);
          if(ball.meditationFrames===0){
            const vx=ball.meditationVx??0,vy=ball.meditationVy??0,speed=Math.hypot(vx,vy);
            ball.vx=speed>1?vx:Math.cos(ball.angle)*620;ball.vy=speed>1?vy:Math.sin(ball.angle)*620;
            ball.palmReady=true;ball.stillpointCooldown=0;pulse(ball,'palmReady',90);c.showImpact('CENTERED!',ball);c.emitParticles(ball,{count:20,color:ball.f.accent,speed:180,gravity:0,kind:'ring',size:8});c.playSound('meditate',{rate:1.35});
          }
          return;
        }
        if(ball.palmReady||ball.stillpointSpent)return;
        ball.stillpointCooldown??=55+Math.floor(random()*45);
        ball.stillpointCooldown=Math.max(0,ball.stillpointCooldown-1);
        if(!ball.stillpointCooldown){
          ball.meditationFrames=180;ball.meditationSetbacks=0;ball.serenityWard=true;ball.meditationVx=ball.vx;ball.meditationVy=ball.vy;ball.vx=0;ball.vy=0;
          pulse(ball,'meditating',180);c.showImpact('MEDITATE!',ball);c.emitParticles(ball,{count:18,color:ball.f.accent,speed:100,gravity:-40,kind:'ring',size:8});c.playSound('meditate');
        }
      },
      modifyIncoming({ball,event}){
        if((ball.meditationFrames??0)<=0||event.damage<=0)return;
        if(ball.serenityWard&&event.force>0){ball.serenityWard=false;event.damage=0;event.serenityReflect=true;return;}
        event.damage*=.75;if((ball.meditationSetbacks??0)<2)event.meditationBreak=true;
      },
      takeHit(c){
        const {ball,rival,event,random}=c;
        if(event.serenityReflect){rival.vx*=-1.15;rival.vy*=-1.15;rival.stunned=Math.max(rival.stunned,7);pulse(ball,'serenityBreak',28);c.showImpact('SERENITY WARD!',ball);c.emitParticles(ball,{count:26,color:ball.f.accent,speed:330,gravity:-40,kind:'ring',size:10});c.playSound('serenityWard');return;}
        if(!event.meditationBreak)return;
        ball.meditationSetbacks=(ball.meditationSetbacks??0)+1;ball.meditationFrames=Math.min(240,(ball.meditationFrames??0)+30);pulse(ball,'meditationBreak',24);
        c.showImpact('DISTURBED!',ball);c.emitParticles(ball,{count:16,color:ball.f.color,speed:260,gravity:180,kind:'glass',size:8});c.playSound('meditationBreak');
      },
      modifyOutgoing({ball,event}){
        if(!ball.palmReady||event.weapon||event.projectile||event.ability)return;
        event.damage+=characterTuning.palmDamage;event.shieldPenetration=.5;event.parryPenetration=.5;event.ability=true;event.palmStrike=true;
      },
      dealHit(c){
        const {ball,rival,event,random}=c;if(!event.palmStrike)return;
        const dx=rival.x-ball.x,dy=rival.y-ball.y,d=Math.hypot(dx,dy)||1;
        ball.palmReady=false;ball.stillpointSpent=true;ball.palmRelease={frames:5,dx:dx/d,dy:dy/d};
        rival.vx=0;rival.vy=0;rival.stunned=Math.max(rival.stunned,6);ball.vx*=.45;ball.vy*=.45;
        pulse(ball,'palmStrike',26);pulse(rival,'palmStruck',20);c.showImpact('PALM STRIKE!',rival);c.emitParticles(rival,{count:26,color:ball.f.accent,speed:420,gravity:80,kind:'ring',size:10});c.playSound('palmStrike');
      },
      drawBack({ball,ctx,sim}){
        if(!(ball.meditationFrames||ball.palmReady))return;
        const ready=Boolean(ball.palmReady),pulseSize=1+Math.sin(sim.ticks*.08)*.05,progress=(ball.meditationFrames??0)/180;
        ctx.save();ctx.globalAlpha=ready?.82:.48;ctx.strokeStyle=ball.f.accent;ctx.lineWidth=ready?6:3;ctx.setLineDash(ready?[]:[5,8]);
        for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(ball.x,ball.y,(ball.radius+12+i*11)*pulseSize,0,Math.PI*2);ctx.stroke();}ctx.restore();
        if(!ready){ctx.save();ctx.translate(ball.x,ball.y);ctx.rotate(sim.ticks*.012);ctx.strokeStyle=ball.f.accent;ctx.globalAlpha=.22+.35*(1-progress);ctx.lineWidth=3;for(let i=0;i<8;i++){ctx.rotate(Math.PI/4);ctx.beginPath();ctx.moveTo(ball.radius+18,0);ctx.lineTo(ball.radius+34+12*(1-progress),0);ctx.stroke();}ctx.restore();}
      },
      drawFront({ball,ctx}){
        if(!ball.serenityWard||(ball.meditationFrames??0)<=0)return;
        ctx.save();ctx.fillStyle='rgba(255,240,168,.12)';ctx.strokeStyle='#fff0a8';ctx.lineWidth=5;ctx.beginPath();ctx.arc(ball.x,ball.y,ball.radius+12,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
      },
    },
    secondDawn:{
      tick(c){
        const {ball,sim}=c;if((ball.ascensionFrames??0)<=0)return;
        const frames=(ball.ascensionFrames??0)-1;ball.ascensionFrames=frames;ball.hp=35;ball.vx=0;ball.vy=0;ball.stunned=2;pulse(ball,'ascended',3);
        if(frames%6===0)c.emitParticles(ball,{count:10,color:frames%12?'#d8b7ff':'#fff7cf',speed:260,gravity:0,kind:'star',size:7,pattern:'spiral',spawnRadius:ball.radius+22});
        if(frames===0){ball.invulnerable=false;ball.vx=ball.ascensionLaunchVx??0;ball.vy=ball.ascensionLaunchVy??0;ball.stunned=0;c.showImpact('ASCENDED!',ball);c.emitParticles(ball,{count:28,color:'#fff7cf',speed:520,gravity:0,kind:'ray',size:16});c.playSound('ascend',{rate:1.3,volume:.72});}
      },
      beforeOutcome(c){
        const {ball}=c;if(ball.hp>0||ball.ascended)return;
        ball.ascended=true;ball.ascendantBaseRadius=ball.radius;ball.hp=35;ball.radius*=.62;ball.mass=ball.f.mass*.68;ball.powerScale*=2;ball.formColor='#f1eaff';
        const speed=Math.hypot(ball.vx,ball.vy),next=Math.max(560,speed)*1.45,angle=speed>1?Math.atan2(ball.vy,ball.vx):ball.angle;
        ball.ascensionLaunchVx=Math.cos(angle)*next;ball.ascensionLaunchVy=Math.sin(angle)*next;ball.ascensionFrames=72;ball.invulnerable=true;ball.vx=0;ball.vy=0;ball.burn=0;ball.burnStacks=0;ball.poisonStacks=0;ball.poisonTick=0;ball.frozen=false;ball.frostFrozenUntil=0;ball.stunned=2;
        if(c.sim)c.sim.hitStop=Math.max(c.sim.hitStop,16);pulse(ball,'ascended',90);c.showImpact('ASCEND!',ball);
        c.emitParticles(ball,{count:36,color:'#665f67',speed:470,gravity:420,kind:'stone',size:13});
        c.emitParticles(ball,{count:28,color:'#fff7cf',speed:760,gravity:0,kind:'ray',size:20});
        c.emitParticles(ball,{count:48,color:ball.f.accent,speed:390,gravity:0,kind:'star',size:10,pattern:'spiral',spawnRadius:ball.radius+18});
        c.playSound('shellBreak',{rate:.68,volume:1});c.playSound('ascend');
      },
      modifyIncoming({ball,event}){
        if((ball.ascensionFrames??0)>0){event.damage=0;event.ascensionReject=true;}
        else if(!ball.ascended&&!event.ability&&!event.weapon&&!event.projectile)event.damage*=.8;
      },
      modifyOutgoing({ball,event}){if((ball.ascensionFrames??0)>0)event.damage=0;},
      takeHit(c){
        const {ball,rival,event}=c;if(!event.ascensionReject)return;ball.vx=0;ball.vy=0;
        if(!event.projectile){const dx=rival.x-ball.x,dy=rival.y-ball.y,d=Math.hypot(dx,dy)||1;rival.vx=dx/d*920;rival.vy=dy/d*920;rival.stunned=Math.max(rival.stunned,7);}
        pulse(rival,'cosmicReject',24);c.showImpact('REJECTED!',rival);c.emitParticles(rival,{count:24,color:'#fff7cf',speed:480,gravity:0,kind:'ray',size:13});c.playSound('ascend',{rate:1.55,volume:.48});
      },
      drawBack({ball,ctx,sim}){
        if(!ball.ascended)return;const wave=.55+.22*Math.sin(sim.ticks*.18),transition=(ball.ascensionFrames??0)/72,burst=Math.max(transition,Math.min(1,(ball.visualStates.ascended??0)/90));
        ctx.save();ctx.globalAlpha=wave;ctx.strokeStyle=ball.f.accent;ctx.lineWidth=5;ctx.setLineDash([8,7]);ctx.beginPath();ctx.arc(ball.x,ball.y,ball.radius+15,0,Math.PI*2);ctx.stroke();
        for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(ball.x+side*ball.radius*.5,ball.y);ctx.quadraticCurveTo(ball.x+side*(ball.radius+30),ball.y-28,ball.x+side*(ball.radius+16),ball.y+20);ctx.stroke();}ctx.restore();
        if(burst>0){ctx.save();ctx.translate(ball.x,ball.y);ctx.rotate(sim.ticks*.025);ctx.strokeStyle='#fff7cf';ctx.lineWidth=5;ctx.globalAlpha=burst*.65;for(let i=0;i<12;i++){ctx.rotate(Math.PI/6);ctx.beginPath();ctx.moveTo(ball.radius+20,0);ctx.lineTo(ball.radius+35+burst*55,0);ctx.stroke();}ctx.restore();}
        if(transition>0){ctx.save();ctx.translate(ball.x,ball.y);ctx.rotate(-sim.ticks*.018);ctx.strokeStyle=ball.f.accent;ctx.lineWidth=3;ctx.globalAlpha=.72;for(let arm=0;arm<3;arm++){ctx.rotate(Math.PI*2/3);ctx.beginPath();for(let i=0;i<28;i++){const a=i*.24,r=ball.radius+12+i*3.2,x=Math.cos(a)*r,y=Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();}for(let ring=0;ring<4;ring++){ctx.rotate(Math.PI/4);const r=ball.radius+28+ring*19;ctx.strokeRect(-r*.7,-r*.7,r*1.4,r*1.4);}ctx.restore();}
      },
    },
    ringShowman:{
      tick(c){
        const {ball,rival,sim}=c;ball.luchaCooldown=Math.max(0,(ball.luchaCooldown??0)-1);const state=ball.luchaState;if(!state)return;
        state.frames--;state.angle+=state.direction*.2;
        const extent=(ball.radius+rival.radius+8)/2,largest=Math.max(ball.radius,rival.radius),margin=extent+largest+5;
        state.cx=Math.max(28+margin,Math.min(sim.width-28-margin,state.cx));state.cy=Math.max(80+margin,Math.min(sim.height-28-margin,state.cy));
        const dx=Math.cos(state.angle)*extent,dy=Math.sin(state.angle)*extent;
        ball.x=state.cx+dx;ball.y=state.cy+dy;rival.x=state.cx-dx;rival.y=state.cy-dy;ball.vx=ball.vy=rival.vx=rival.vy=0;ball.stunned=rival.stunned=2;ball.cooldown=rival.cooldown=12;
        pulse(ball,'clinch',3);pulse(rival,'clinch',3);
        if(state.frames>0)return;
        const tx=-Math.sin(state.angle)*state.direction,ty=Math.cos(state.angle)*state.direction;
        rival.vx=tx*800;rival.vy=ty*800;ball.vx=-tx*680;ball.vy=-ty*680;ball.stunned=rival.stunned=0;rival.luchaCaptured=false;ball.luchaState=undefined;ball.luchaCooldown=120;
        pulse(ball,'ringToss',28);pulse(rival,'ringToss',28);c.showImpact('RING TOSS!',rival);c.emitParticles(rival,{count:28,color:ball.f.accent,speed:460,gravity:260,kind:'star',size:10});c.playSound('ringToss');
      },
      modifyOutgoing({ball,event}){
        if((ball.luchaCooldown??0)>0||ball.luchaState||ball.luchaCaptured||event.weapon||event.projectile||event.ability)return;
        event.damage+=characterTuning.clinchDamage*ball.f.power;event.shieldPenetration=.25;event.parryPenetration=0;event.ability=true;event.luchaClinch=true;
      },
      dealHit(c){
        const {ball,rival,event}=c;if(!event.luchaClinch||ball.luchaState||ball.luchaCaptured||rival.luchaCaptured)return;
        const cx=(ball.x+rival.x)/2,cy=(ball.y+rival.y)/2,angle=Math.atan2(ball.y-cy,ball.x-cx),direction:1|-1=ball.angularVelocity>=0?1:-1;
        ball.luchaState={frames:24,cx,cy,angle,direction};rival.luchaCaptured=true;ball.vx=ball.vy=rival.vx=rival.vy=0;ball.stunned=rival.stunned=2;ball.cooldown=rival.cooldown=12;
        pulse(ball,'clinch',24);pulse(rival,'clinch',24);c.showImpact('CLINCH!',{x:cx,y:cy});c.emitParticles({x:cx,y:cy},{count:18,color:ball.f.accent,speed:240,gravity:220,kind:'star',size:8});c.playSound('clinch');
      },
      drawBack({ball,ctx}){
        const state=ball.luchaState;if(!state)return;
        ctx.save();ctx.globalAlpha=.62;ctx.strokeStyle=ball.f.accent;ctx.lineWidth=6;ctx.setLineDash([12,7]);ctx.beginPath();ctx.arc(state.cx,state.cy,(ball.radius*1.35),0,Math.PI*2);ctx.stroke();ctx.restore();
      },
    },
    spotlightSweep:{
      tick(c){
        const {ball,rival,random}=c,state=ball.neonState;
        if(!state){
          if(ball.frozen||ball.stunned)return;
          ball.neonCooldown??=75+Math.floor(random()*61);
          if(--ball.neonCooldown>0)return;
          ball.neonStoredVx=ball.vx;ball.neonStoredVy=ball.vy;ball.vx=ball.vy=0;ball.neonState={phase:'charge',frames:60,angle:Math.atan2(rival.y-ball.y,rival.x-ball.x),direction:random()<.5?-1:1,hit:false};
          pulse(ball,'spotlight',60);c.showImpact('SPOTLIGHT!',ball);c.emitParticles(ball,{count:18,color:ball.f.accent,speed:140,gravity:-40,kind:'star',size:8});c.playSound('spotlight');return;
        }
        ball.vx=ball.vy=0;ball.stunned=2;state.frames--;
        if(state.phase==='charge'){
          state.angle=Math.atan2(rival.y-ball.y,rival.x-ball.x);
          if(state.frames<=0){state.phase='sweep';state.frames=54;state.angle-=state.direction*1.2;pulse(ball,'laserSweep',54);c.showImpact('LIGHT SHOW!',ball);c.playSound('laserSweep');}
          return;
        }
        state.angle+=state.direction*(2.4/54);
        const dx=rival.x-ball.x,dy=rival.y-ball.y,ux=Math.cos(state.angle),uy=Math.sin(state.angle),along=dx*ux+dy*uy,across=Math.abs(dx*uy-dy*ux);
        if(!state.hit&&along>0&&across<rival.radius+8){state.hit=true;const point={x:ball.x+ux*along,y:ball.y+uy*along};abilityStrike(c,dispatch,characterTuning.laserDamage,'ENCORE!',point,'electric',{shieldPenetration:.2});pulse(rival,'laserHit',24);c.emitParticles(point,{count:28,color:ball.f.accent,speed:430,gravity:0,kind:'ray',size:11});c.playSound('laserHit');}
        if(state.frames>0)return;
        ball.neonState=undefined;ball.neonCooldown=180;ball.stunned=0;const vx=ball.neonStoredVx??0,vy=ball.neonStoredVy??0,speed=Math.hypot(vx,vy)||620,angle=Math.atan2(vy,vx);ball.vx=Math.cos(angle)*speed;ball.vy=Math.sin(angle)*speed;
      },
      modifyOutgoing({ball,event}){if(ball.neonState)event.damage=0;},
      drawBack({ball,ctx,sim}){
        const state=ball.neonState;if(!state)return;const length=rayLength(ball,state.angle,sim.width,sim.height),endX=ball.x+Math.cos(state.angle)*length,endY=ball.y+Math.sin(state.angle)*length;
        ctx.save();ctx.strokeStyle=state.phase==='charge'?'#ffea62':ball.f.accent;ctx.globalAlpha=state.phase==='charge'?.28:.86;ctx.lineWidth=state.phase==='charge'?3:13;ctx.setLineDash(state.phase==='charge'?[10,10]:[]);ctx.shadowColor=ball.f.accent;ctx.shadowBlur=state.phase==='charge'?8:22;ctx.beginPath();ctx.moveTo(ball.x,ball.y);ctx.lineTo(endX,endY);ctx.stroke();ctx.restore();
        ctx.save();ctx.translate(ball.x,ball.y);ctx.rotate(-sim.ticks*.025);ctx.strokeStyle='#ffea62';ctx.globalAlpha=.65;ctx.lineWidth=4;for(let i=0;i<8;i++){ctx.rotate(Math.PI/4);ctx.beginPath();ctx.moveTo(ball.radius+12,0);ctx.lineTo(ball.radius+25+(state.phase==='charge'?(60-state.frames)*.35:22),0);ctx.stroke();}ctx.restore();
      },
      drawFront({ball,ctx,sim}){if(!ball.neonState)return;ctx.save();ctx.fillStyle='rgba(255,234,98,.22)';ctx.strokeStyle='#ffea62';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(ball.x,ball.y-ball.radius-20,ball.radius*1.45,10+Math.sin(sim.ticks*.2)*2,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();},
    },
    dataBlade:{
      tick(c){
        const {ball,rival,sim,random}=c;
        if((ball.phaseCutFrames??0)>0){ball.phaseCutFrames!--;pulse(ball,'phaseCut',3);if(!ball.phaseCutFrames){ball.phaseCutReady=false;ball.dataBladeCooldown=165;}return;}
        const blade=ball.dataBlade;
        if(!blade){
          if(ball.frozen||ball.stunned)return;
          ball.dataBladeCooldown??=90+Math.floor(random()*61);if(--ball.dataBladeCooldown>0)return;
          const angle=Math.atan2(rival.y-ball.y,rival.x-ball.x);ball.dataBlade={x:ball.x,y:ball.y,vx:Math.cos(angle)*820,vy:Math.sin(angle)*820,phase:'flying',frames:0,nx:0,ny:0,rotation:angle};
          c.showImpact('DATA BLADE!',ball);c.emitParticles(ball,{count:12,color:ball.f.accent,speed:190,gravity:0,kind:'pixel',size:7});c.playSound('dataBlade');return;
        }
        if(blade.phase==='flying'){
          blade.x+=blade.vx/60;blade.y+=blade.vy/60;blade.rotation+=.18;
          if(blade.x<=28||blade.x>=sim.width-28||blade.y<=80||blade.y>=sim.height-28){
            if(blade.x<=28){blade.x=28;blade.nx=1;}else if(blade.x>=sim.width-28){blade.x=sim.width-28;blade.nx=-1;}if(blade.y<=80){blade.y=80;blade.ny=1;}else if(blade.y>=sim.height-28){blade.y=sim.height-28;blade.ny=-1;}blade.phase='anchored';blade.frames=36;c.showImpact('ANCHOR SET!',blade);c.emitParticles(blade,{count:16,color:ball.f.accent,speed:230,gravity:0,kind:'pixel',size:7});c.playSound('bladeAnchor');
          }
          return;
        }
        if(--blade.frames>0)return;
        const old={x:ball.x,y:ball.y};ball.x=blade.x+blade.nx*(ball.radius+5);ball.y=blade.y+blade.ny*(ball.radius+5);const angle=Math.atan2(rival.y-ball.y,rival.x-ball.x);ball.vx=Math.cos(angle)*1100;ball.vy=Math.sin(angle)*1100;ball.phaseCutFrames=30;ball.phaseCutReady=true;ball.dataBlade=undefined;ball.cooldown=0;
        c.showImpact('BLINK!',ball);c.emitParticles(old,{count:20,color:ball.f.accent,speed:260,gravity:0,kind:'pixel',size:8});c.emitParticles(ball,{count:26,color:ball.f.accent,speed:360,gravity:0,kind:'slash',size:9});c.playSound('phaseBlink');
      },
      modifyOutgoing({ball,event}){if(!ball.phaseCutReady||event.weapon||event.projectile||event.ability)return;event.damage+=characterTuning.phaseCutDamage*ball.f.power;event.shieldPenetration=.35;event.parryPenetration=.5;event.ability=true;event.phaseCut=true;},
      dealHit(c){if(!c.event.phaseCut)return;c.ball.phaseCutReady=false;c.ball.phaseCutFrames=0;c.ball.dataBladeCooldown=165;pulse(c.rival,'phaseCutHit',24);c.showImpact('PHASE CUT!',c.rival);c.emitParticles(c.rival,{count:30,color:c.ball.f.accent,speed:520,gravity:0,kind:'slash',size:11});c.playSound('phaseCut');},
      drawBack({ball,ctx}){
        const blade=ball.dataBlade;if(!blade)return;ctx.save();if(blade.phase==='anchored'){ctx.strokeStyle=ball.f.accent;ctx.globalAlpha=.35;ctx.lineWidth=3;ctx.setLineDash([8,9]);ctx.beginPath();ctx.moveTo(blade.x,blade.y);ctx.lineTo(ball.x,ball.y);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(blade.x,blade.y,16+Math.sin(blade.frames*.35)*4,0,Math.PI*2);ctx.stroke();}ctx.translate(blade.x,blade.y);ctx.rotate(blade.rotation);ctx.fillStyle=ball.f.accent;ctx.strokeStyle='#151515';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,-14);ctx.lineTo(7,0);ctx.lineTo(0,14);ctx.lineTo(-7,0);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
      },
      drawFront({ball,ctx}){if(!(ball.phaseCutFrames&&ball.phaseCutFrames>0))return;const speed=Math.hypot(ball.vx,ball.vy)||1,ux=ball.vx/speed,uy=ball.vy/speed;ctx.save();ctx.strokeStyle=ball.f.accent;ctx.globalAlpha=.7;ctx.lineWidth=9;ctx.lineCap='round';for(let i=1;i<=3;i++){ctx.beginPath();ctx.moveTo(ball.x-ux*(ball.radius+i*15)-uy*i*5,ball.y-uy*(ball.radius+i*15)+ux*i*5);ctx.lineTo(ball.x-ux*(ball.radius+i*28)+uy*i*5,ball.y-uy*(ball.radius+i*28)-ux*i*5);ctx.stroke();}ctx.restore();},
    },
    loyalEnforcer:{
      tick(c){const {ball}=c;ball.enforcerAngle=(ball.enforcerAngle??0)+.065;if((ball.enforcerCooldown??0)>0){ball.enforcerCooldown!--;if(!ball.enforcerCooldown){pulse(ball,'enforcerReturn',30);c.emitParticles(ball,{count:18,color:ball.f.accent,speed:180,gravity:0,kind:'ring',size:8});c.playSound('enforcerReturn');}}},
      modifyIncoming({ball,event}){if((ball.enforcerCooldown??0)>0||event.damage<=0)return;ball.enforcerCooldown=240;event.blockedDamage=Math.min(6,event.damage);event.damage=Math.max(0,event.damage-6);event.capoIntercept=true;},
      takeHit(c){
        if(!c.event.capoIntercept)return;const {ball,rival}=c,dx=rival.x-ball.x,dy=rival.y-ball.y,d=Math.hypot(dx,dy)||1;ball.enforcerAngle=Math.atan2(dy,dx);rival.vx=dx/d*760;rival.vy=dy/d*760;rival.stunned=Math.max(rival.stunned,8);pulse(ball,'intercept',24);pulse(rival,'retaliation',20);c.showImpact('INTERCEPT!',ball);c.emitParticles(ball,{count:20,color:ball.f.accent,speed:320,gravity:180,kind:'star',size:9});c.playSound('intercept');abilityStrike(c,dispatch,characterTuning.retaliationDamage,'RETALIATION!',rival,'physical',{shieldPenetration:.25});c.playSound('retaliation');
      },
      drawBack({ball,ctx}){const angle=ball.enforcerAngle??0,r=ball.radius+31;ctx.save();ctx.strokeStyle=ball.f.accent;ctx.globalAlpha=(ball.enforcerCooldown??0)>0?.18:.48;ctx.lineWidth=3;ctx.setLineDash([5,7]);ctx.beginPath();ctx.arc(ball.x,ball.y,r,0,Math.PI*2);ctx.stroke();ctx.restore();},
      drawFront({ball,ctx}){
        if((ball.enforcerCooldown??0)>0)return;const angle=ball.enforcerAngle??0,r=ball.radius+31,x=ball.x+Math.cos(angle)*r,y=ball.y+Math.sin(angle)*r;ctx.save();ctx.translate(x,y);ctx.fillStyle='#242128';ctx.strokeStyle='#151515';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,14,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=ball.f.accent;ctx.fillRect(-7,-2,14,4);ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(0,2);ctx.lineTo(-4,10);ctx.lineTo(4,10);ctx.closePath();ctx.fill();ctx.restore();
      },
    },
  };
}
