// Fighter kits are small, composable hook scripts. The engine owns universal
// movement and damage; a roster entry opts into any combination of these kits.
export const behaviors={
  wallCharge:{
    wallHit({ball}){ball.voltCharge=Math.min(5,(ball.voltCharge??0)+1);const previous=ball.wallBoost;ball.wallBoost=Math.min(1.42,ball.wallBoost*1.025);const gain=ball.wallBoost/previous;ball.vx*=gain;ball.vy*=gain;},
    modifyOutgoing({ball,event}){const charge=ball.voltCharge??0;if(charge){event.damage+=charge*.8;event.voltRelease=charge;}},
    dealHit({ball,rival,event,showImpact}){if(!event.voltRelease)return;rival.stunned+=event.voltRelease*3;ball.voltCharge=0;showImpact('DISCHARGE!',rival);},
    draw({ball,ctx}){const charge=ball.voltCharge??0;if(!charge)return;ctx.save();ctx.strokeStyle='#e5ff00';ctx.lineWidth=3;for(let i=0;i<charge;i++){const a=i*Math.PI*2/charge+ball.angle,r=ball.radius+10;ctx.beginPath();ctx.moveTo(ball.x+Math.cos(a)*r,ball.y+Math.sin(a)*r);ctx.lineTo(ball.x+Math.cos(a+.17)*(r+10),ball.y+Math.sin(a+.17)*(r+10));ctx.stroke();}ctx.restore();},
  },
  armor:{
    tick({ball}){ball.armorPlates??=3;if(ball.armorPlates===0&&ball.armorRepair>0&&!--ball.armorRepair)ball.armorPlates=3;},
    modifyIncoming({ball,event}){ball.armorPlates??=3;if(ball.armorPlates>0)event.damage*=.74;},
    takeHit({ball,event,showImpact}){if(event.damage<=0||ball.armorPlates<=0)return;if(!--ball.armorPlates){ball.armorRepair=180;showImpact('ARMOR BREAK!',ball);}},
    draw({ball,ctx}){const plates=ball.armorPlates??3;ctx.save();ctx.strokeStyle='#fff';ctx.lineWidth=5;for(let i=0;i<plates;i++){const a=-Math.PI*.82+i*Math.PI*.32;ctx.beginPath();ctx.arc(ball.x,ball.y,ball.radius-7,a,a+.25);ctx.stroke();}ctx.restore();},
  },
  regeneration:{
    tick({ball}){ball.mintRest=(ball.mintRest??0)+1;if(ball.mintRest>120)ball.hp=Math.min(100,ball.hp+.05);},
    takeHit({ball,event}){if(event.damage>0)ball.mintRest=0;},
    draw({ball,ctx}){const ready=(ball.mintRest??0)>120,p=(ball.mintRest??0)%120/120,r=ball.radius+13;ctx.save();ctx.strokeStyle=ready?'#fff':'#20c997';ctx.lineWidth=4;ctx.beginPath();ctx.arc(ball.x,ball.y,r,-Math.PI/2,-Math.PI/2+Math.PI*2*p);ctx.stroke();ctx.restore();},
  },
  compoundPower:{
    modifyOutgoing({ball,event}){const stacks=ball.goldStacks??0;event.damage*=1+stacks*.035;if(stacks>=5){event.damage+=6;event.jackpot=true;}},
    dealHit({ball,event,showImpact}){if(event.jackpot){ball.goldStacks=0;showImpact('JACKPOT!',ball);}else ball.goldStacks=Math.min(5,(ball.goldStacks??0)+1);},
    draw({ball,ctx}){const n=ball.goldStacks??0;ctx.save();ctx.fillStyle='#f6b817';ctx.strokeStyle='#151515';ctx.lineWidth=2;for(let i=0;i<n;i++){const a=-Math.PI/2+i*Math.PI*2/5,x=ball.x+Math.cos(a)*(ball.radius+13),y=ball.y+Math.sin(a)*(ball.radius+13);ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.fill();ctx.stroke();}ctx.restore();},
  },
  siphon:{
    dealHit({ball,event,showImpact}){const ratio=ball.hp<50?.3:.16;ball.hp=Math.min(100,ball.hp+event.damage*ratio);if(ratio>.2)showImpact('FEAST!',ball);},
    draw({ball,ctx}){if(ball.hp>=50)return;ctx.save();ctx.strokeStyle='#a4a4a4';ctx.lineWidth=3;ctx.setLineDash([3,7]);ctx.beginPath();ctx.arc(ball.x,ball.y,ball.radius+12,0,Math.PI*2);ctx.stroke();ctx.restore();},
  },
  bubbleShield:{
    tick({ball}){if(ball.bubbleShield===undefined)ball.bubbleShield=true;if(!ball.bubbleShield&&ball.bubbleRecharge>0&&!--ball.bubbleRecharge)ball.bubbleShield=true;},
    modifyIncoming({ball,event}){if(ball.bubbleShield){event.damage=0;event.bubblePop=true;ball.bubbleShield=false;ball.bubbleRecharge=240;}},
    takeHit({ball,rival,event,showImpact}){if(!event.bubblePop)return;rival.vx*=-1.12;rival.vy*=-1.12;showImpact('POP!',ball);},
    draw({ball,ctx}){if(!ball.bubbleShield)return;ctx.save();ctx.fillStyle='rgba(255,255,255,.13)';ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(ball.x,ball.y,ball.radius+10,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();},
  },
  thorns:{
    takeHit({ball,rival,event,showImpact}){if(event.damage<=0)return;rival.hp-=event.damage*.2;ball.sporeMeter=(ball.sporeMeter??0)+event.damage;if(ball.sporeMeter>=22){ball.sporeMeter=0;rival.stunned+=24;showImpact('ROOTED!',rival);}},
    draw({ball,ctx}){const p=Math.min(1,(ball.sporeMeter??0)/22);ctx.save();ctx.strokeStyle='#c2dd9e';ctx.lineWidth=3;for(let i=0;i<8;i++){const a=i*Math.PI/4,x=ball.x+Math.cos(a)*(ball.radius+5),y=ball.y+Math.sin(a)*(ball.radius+5);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(ball.x+Math.cos(a)*(ball.radius+8+9*p),ball.y+Math.sin(a)*(ball.radius+8+9*p));ctx.stroke();}ctx.restore();},
  },
  blink:{
    tick({ball,sim,rival,showImpact}){ball.phaseFrames=Math.max(0,(ball.phaseFrames??0)-1);if(sim.ticks%210)return;const speed=Math.hypot(rival.vx,rival.vy)||1,nx=rival.vx/speed,ny=rival.vy/speed,gap=ball.radius+rival.radius+24;ball.x=Math.max(ball.radius+30,Math.min(sim.width-ball.radius-30,rival.x-nx*gap));ball.y=Math.max(ball.radius+82,Math.min(sim.height-ball.radius-30,rival.y-ny*gap));ball.phaseFrames=60;showImpact('BACKDOOR!',ball);},
    modifyOutgoing({ball,event}){if(ball.phaseFrames>0){event.damage+=5;event.phaseStrike=true;}},
    dealHit({ball,rival,event,showImpact}){if(event.phaseStrike){ball.phaseFrames=0;showImpact('DESYNC!',rival);}},
    draw({ball,ctx}){if(!ball.phaseFrames)return;ctx.save();ctx.globalAlpha=.35;ctx.strokeStyle=ball.f.color;ctx.lineWidth=4;for(let i=1;i<=3;i++)ctx.strokeRect(ball.x-ball.radius+i*5,ball.y-ball.radius-i*4,ball.radius*2,ball.radius*2);ctx.restore();},
  },
  coldSnap:{
    modifyOutgoing({sim,rival,event}){if((rival.frostFrozenUntil??0)>sim.ticks){event.damage+=8;event.iceShatter=true;}},
    dealHit({sim,rival,event,showImpact}){if(event.iceShatter){rival.frostFrozenUntil=0;rival.stunned=0;showImpact('ICE SHATTER!',rival);}else if(event.force>8){rival.stunned+=90;rival.frostFrozenUntil=sim.ticks+rival.stunned;showImpact('FROZEN!',rival);}},
  },
  afterburn:{
    modifyOutgoing({rival,event}){if((rival.burnStacks??0)>=2){event.damage+=5;event.ignite=true;}},
    dealHit({rival,event,showImpact}){if(event.ignite){rival.burnStacks=0;rival.burn=0;showImpact('IGNITE!',rival);}else{rival.burnStacks=Math.min(2,(rival.burnStacks??0)+1);rival.burn=120;}},
  },
  echo:{dealHit({sim,rival,event,showImpact}){if(event.damage<=0)return;sim.echoes.push({victim:rival,frames:14,damage:event.damage*.22},{victim:rival,frames:32,damage:event.damage*.18});showImpact('REVERB!',rival);}},
  thirdHitBlock:{
    modifyIncoming({ball,event}){if(ball.incoming%3===0){event.damage=0;event.rookBlock=true;}},
    takeHit({ball,rival,event,showImpact}){if(!event.rookBlock)return;rival.vx*=-1.08;rival.vy*=-1.08;rival.stunned+=10;showImpact('PARRY!',ball);},
    draw({ball,ctx}){const remaining=3-(ball.incoming%3);ctx.save();for(let i=0;i<3;i++){const a=-Math.PI*.78+i*Math.PI*.28,x=ball.x+Math.cos(a)*(ball.radius+17),y=ball.y+Math.sin(a)*(ball.radius+17);ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.fillStyle=i<remaining?'#fff':'#6f6c64';ctx.fill();ctx.strokeStyle='#151515';ctx.lineWidth=2;ctx.stroke();}ctx.restore();},
  },
  continuousAcceleration:{
    beforeMove({ball}){ball.vx*=1.001;ball.vy*=1.001;},
    modifyOutgoing({ball,event}){event.damage+=Math.max(0,Math.min(5,(Math.hypot(ball.vx,ball.vy)-850)/130));},
    dealHit({ball}){ball.vx*=.86;ball.vy*=.86;},
    drawBack({ball,ctx}){const speed=Math.hypot(ball.vx,ball.vy)||1,nx=ball.vx/speed,ny=ball.vy/speed;ctx.save();ctx.strokeStyle=ball.f.color;ctx.lineWidth=ball.radius*.65;ctx.globalAlpha=.3;ctx.beginPath();ctx.moveTo(ball.x-nx*ball.radius*.6,ball.y-ny*ball.radius*.6);ctx.lineTo(ball.x-nx*Math.min(115,speed*.25),ball.y-ny*Math.min(115,speed*.25));ctx.stroke();ctx.restore();},
  },
  fourthStrike:{
    modifyOutgoing({ball,event,sim}){if(ball.hits%4===0){event.damage+=6;event.staticBurst=true;sim.hitStop+=5;}},
    dealHit({rival,event,showImpact}){if(event.staticBurst){rival.stunned+=18;showImpact('OVERLOAD!',rival);}},
    draw({ball,ctx}){const charge=ball.hits%4;ctx.save();for(let i=0;i<4;i++){const a=i*Math.PI/2-Math.PI/2,x=ball.x+Math.cos(a)*(ball.radius+14),y=ball.y+Math.sin(a)*(ball.radius+14);ctx.fillStyle=i<charge?'#e5ff00':'#57554d';ctx.fillRect(x-4,y-4,8,8);ctx.strokeStyle='#151515';ctx.lineWidth=1.5;ctx.strokeRect(x-4,y-4,8,8);}ctx.restore();},
  },
  woundedPower:{
    tick({ball}){ball.mass=ball.f.mass*(1+(100-Math.max(0,ball.hp))/125);},
    modifyOutgoing({ball,event}){event.damage*=1+(100-ball.hp)/150;},
    draw({ball,ctx}){const p=Math.max(0,(100-ball.hp)/100);if(!p)return;ctx.save();ctx.strokeStyle='#b9c8d2';ctx.lineWidth=3+p*5;ctx.beginPath();ctx.arc(ball.x,ball.y,ball.radius+9,0,Math.PI*2);ctx.stroke();ctx.restore();},
  },
  orbitalSatellites:{
    tick({ball,sim,rival,showImpact}){ball.orbitCooldown=Math.max(0,(ball.orbitCooldown??0)-1);const radius=ball.radius+31;for(let i=0;i<2;i++){const a=sim.ticks*.065+i*Math.PI,sx=ball.x+Math.cos(a)*radius,sy=ball.y+Math.sin(a)*radius,dx=rival.x-sx,dy=rival.y-sy,d=Math.hypot(dx,dy);if(d<rival.radius+12&&!ball.orbitCooldown){rival.hp-=3.2;rival.vx+=dx/(d||1)*65;rival.vy+=dy/(d||1)*65;rival.flash=6;ball.orbitCooldown=24;showImpact('SATELLITE!',{x:sx,y:sy});break;}}},
    drawBack({ball,ctx,sim}){const r=ball.radius+31;ctx.save();ctx.strokeStyle='#151515';ctx.lineWidth=2;ctx.globalAlpha=.45;ctx.beginPath();ctx.arc(ball.x,ball.y,r,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;for(let i=0;i<2;i++){const a=sim.ticks*.065+i*Math.PI,sx=ball.x+Math.cos(a)*r,sy=ball.y+Math.sin(a)*r;ctx.fillStyle=i?'#c9bdff':'#e6ff34';ctx.beginPath();ctx.arc(sx,sy,12,0,Math.PI*2);ctx.fill();ctx.stroke();}ctx.restore();},
  },
  bladeTempo:{dealHit({ball,event,showImpact}){if(!event.weapon)return;ball.angularVelocity=Math.sign(ball.angularVelocity||1)*Math.min(4.5,Math.abs(ball.angularVelocity)*1.09);showImpact('TEMPO!',ball);}},
  slugger:{dealHit({rival,event,showImpact}){if(!event.weapon)return;rival.wallCrash={frames:90,damage:6};showImpact('DEEP!',rival);}},
  randomSteering:{beforeMove({ball,random}){ball.vx+=(random()-.5)*20;ball.vy+=(random()-.5)*20;}},
  combatPull:{beforeMove({ball,rival,event}){const dx=rival.x-ball.x,dy=rival.y-ball.y,d=Math.hypot(dx,dy)||1;ball.vx+=dx/d*90*event.dt;ball.vy+=dy/d*90*event.dt;}},
  speedLimit:{beforeMove({ball}){const max=255*ball.f.speed*ball.wallBoost,speed=Math.hypot(ball.vx,ball.vy);if(speed>max){ball.vx*=max/speed;ball.vy*=max/speed;}}},
};

export function runBehaviorHook(ball,hook,context){for(const name of ball.f.behaviors??[])behaviors[name]?.[hook]?.({...context,ball});}
