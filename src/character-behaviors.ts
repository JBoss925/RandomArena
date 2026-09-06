import type {Behavior,BehaviorContext} from './types.js';

const pulse=(ball:BehaviorContext['ball'],name:string,frames:number):void=>{ball.visualStates[name]=Math.max(ball.visualStates[name]??0,frames);};
export const characterTuning={palmDamage:35,clinchDamage:18};

export function characterBehaviors():Record<string,Behavior>{
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
  };
}
