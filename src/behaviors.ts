// Fighter kits are small, composable hook scripts. The engine owns universal
// movement and damage; a roster entry opts into any combination of these kits.
const pulse=(ball:Ball,name:string,frames:number):void=>{ball.visualStates[name]=Math.max(ball.visualStates[name]??0,frames);};
const growBall=(ball:Ball,amount:number):boolean=>{
  ball.growthBaseRadius??=ball.radius;
  const next=Math.min(ball.growthBaseRadius*1.55,ball.radius+amount);
  if(next===ball.radius)return false;
  ball.radius=next;
  ball.mass=ball.f.mass*(1+(ball.radius/ball.growthBaseRadius-1)*.55);
  return true;
};

export const behaviors:Record<string,Behavior>={
  wallCharge:{
    wallHit({ball,emitParticles,playSound}){ball.voltCharge=Math.min(5,(ball.voltCharge??0)+1);const previous=ball.wallBoost;ball.wallBoost=Math.min(1.42,ball.wallBoost*1.025);const gain=ball.wallBoost/previous;ball.vx*=gain;ball.vy*=gain;pulse(ball,'electric',12);emitParticles(ball,{count:4,color:'#e5ff00',speed:160,gravity:0,kind:'bolt',size:7});playSound('electric',{volume:.45,rate:1.2});},
    modifyOutgoing({ball,event}){const charge=ball.voltCharge??0;if(charge){event.damage+=charge*1.3;event.voltRelease=charge;}},
    dealHit({ball,rival,event,showImpact,emitParticles,playSound}){if(!event.voltRelease)return;if(event.bubblePop){showImpact('GROUNDED!',ball);return;}rival.stunned+=event.voltRelease*3;ball.voltCharge=0;pulse(rival,'electric',18);showImpact('DISCHARGE!',rival);emitParticles(rival,{count:8+event.voltRelease*2,color:'#e5ff00',speed:350,gravity:0,kind:'bolt',size:9});playSound('electric',{volume:.8,rate:.82});},
    draw({ball,ctx}){const charge=ball.voltCharge??0;if(!charge)return;ctx.save();ctx.strokeStyle='#e5ff00';ctx.lineWidth=3;for(let i=0;i<charge;i++){const a=i*Math.PI*2/charge+ball.angle,r=ball.radius+10;ctx.beginPath();ctx.moveTo(ball.x+Math.cos(a)*r,ball.y+Math.sin(a)*r);ctx.lineTo(ball.x+Math.cos(a+.17)*(r+10),ball.y+Math.sin(a+.17)*(r+10));ctx.stroke();}ctx.restore();},
  },
  armor:{
    tick({ball,emitParticles,playSound}){ball.armorPlates??=3;if(ball.armorPlates===0&&(ball.armorRepair??0)>0){ball.armorRepair=(ball.armorRepair??0)-1;if(ball.armorRepair===0){ball.armorPlates=3;pulse(ball,'steel',18);emitParticles(ball,{count:10,color:'#d7dde2',speed:190,gravity:240,kind:'metal',size:7});playSound('armorBlock',{volume:.55,rate:1.2});}}},
    modifyIncoming({ball,event}){ball.armorPlates??=3;if(ball.armorPlates>0)event.damage*=.74;},
    takeHit({ball,event,showImpact,emitParticles,playSound}){if(event.damage<=0||(ball.armorPlates??0)<=0)return;pulse(ball,'steel',12);ball.armorPlates=(ball.armorPlates??0)-1;emitParticles(ball,{count:6,color:'#d7dde2',speed:180,gravity:260,kind:'metal',size:6});playSound('armorBlock');if(ball.armorPlates===0){ball.armorRepair=180;pulse(ball,'armorBreak',28);showImpact('ARMOR BREAK!',ball);emitParticles(ball,{count:18,color:'#f3efdf',speed:390,gravity:420,kind:'metal',size:9});playSound('armorBreak');}},
    draw({ball,ctx}){const plates=ball.armorPlates??3;ctx.save();ctx.strokeStyle='#fff';ctx.lineWidth=5;for(let i=0;i<plates;i++){const a=-Math.PI*.82+i*Math.PI*.32;ctx.beginPath();ctx.arc(ball.x,ball.y,ball.radius-7,a,a+.25);ctx.stroke();}ctx.restore();},
  },
  regeneration:{
    tick({ball,emitParticles,playSound}){ball.mintRest=(ball.mintRest??0)+1;if(ball.mintRest===121){pulse(ball,'healing',45);emitParticles(ball,{count:12,color:'#abf1dd',speed:150,gravity:-90,kind:'heal',size:8});playSound('heal');}if(ball.mintRest>120){ball.hp=Math.min(100,ball.hp+.07);if(ball.mintRest%30===0)emitParticles(ball,{count:2,color:'#abf1dd',speed:70,gravity:-60,kind:'heal',size:7});}},
    takeHit({ball,event}){if(event.damage>0)ball.mintRest=0;},
    draw({ball,ctx}){const ready=(ball.mintRest??0)>120,p=(ball.mintRest??0)%120/120,r=ball.radius+13;ctx.save();ctx.strokeStyle=ready?'#fff':'#20c997';ctx.lineWidth=4;ctx.beginPath();ctx.arc(ball.x,ball.y,r,-Math.PI/2,-Math.PI/2+Math.PI*2*p);ctx.stroke();ctx.restore();},
  },
  compoundPower:{
    modifyOutgoing({ball,event}){const stacks=ball.goldStacks??0;event.damage*=1+stacks*.05;if(stacks>=5){event.damage+=12;event.jackpot=true;}},
    dealHit({ball,event,showImpact,emitParticles,playSound}){if(event.jackpot&&event.damage>0){ball.goldStacks=0;pulse(ball,'jackpot',30);showImpact('JACKPOT!',ball);emitParticles(ball,{count:22,color:'#f6b817',speed:360,gravity:480,kind:'coin',size:8});playSound('jackpot');}else if(!event.jackpot){ball.goldStacks=Math.min(5,(ball.goldStacks??0)+1);emitParticles(ball,{count:3,color:'#ffe49b',speed:100,gravity:180,kind:'coin',size:5});playSound('coin',{volume:.55,rate:1+(ball.goldStacks??0)*.06});}},
    draw({ball,ctx}){const n=ball.goldStacks??0;ctx.save();ctx.fillStyle='#f6b817';ctx.strokeStyle='#151515';ctx.lineWidth=2;for(let i=0;i<n;i++){const a=-Math.PI/2+i*Math.PI*2/5,x=ball.x+Math.cos(a)*(ball.radius+13),y=ball.y+Math.sin(a)*(ball.radius+13);ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.fill();ctx.stroke();}ctx.restore();},
  },
  siphon:{
    dealHit({ball,rival,event,showImpact,emitParticles,playSound}){const ratio=ball.hp<50?.36:.18;ball.hp=Math.min(100,ball.hp+event.damage*ratio);pulse(ball,'siphon',16);emitParticles({x:(ball.x+rival.x)/2,y:(ball.y+rival.y)/2},{count:5,color:'#a4a4a4',speed:120,gravity:0,kind:'void',size:7});playSound('siphon',{volume:ratio>.2?1:.55});if(ratio>.2)showImpact('FEAST!',ball);},
    draw({ball,ctx}){if(ball.hp>=50)return;ctx.save();ctx.strokeStyle='#a4a4a4';ctx.lineWidth=3;ctx.setLineDash([3,7]);ctx.beginPath();ctx.arc(ball.x,ball.y,ball.radius+12,0,Math.PI*2);ctx.stroke();ctx.restore();},
  },
  bubbleShield:{
    tick({ball,emitParticles,playSound}){if(ball.bubbleShield===undefined)ball.bubbleShield=true;if(!ball.bubbleShield&&(ball.bubbleRecharge??0)>0){ball.bubbleRecharge=(ball.bubbleRecharge??0)-1;if(ball.bubbleRecharge===0){ball.bubbleShield=true;pulse(ball,'bubbleReform',24);emitParticles(ball,{count:10,color:'#ffc4ef',speed:120,gravity:-30,kind:'bubble',size:8});playSound('heal',{volume:.45,rate:1.5});}}},
    modifyIncoming({ball,event}){if(ball.bubbleShield){event.damage=0;event.bubblePop=true;ball.bubbleShield=false;ball.bubbleRecharge=240;}},
    takeHit({ball,rival,event,showImpact,emitParticles,playSound}){if(!event.bubblePop)return;rival.vx*=-1.35;rival.vy*=-1.35;pulse(ball,'bubblePop',22);showImpact('POP!',ball);emitParticles(ball,{count:24,color:'#ffc4ef',speed:300,gravity:-40,kind:'bubble',size:9});playSound('bubblePop');},
    draw({ball,ctx,sim}){if(!ball.bubbleShield)return;const breathe=1+Math.sin(sim.ticks*.08)*.025;ctx.save();ctx.fillStyle='rgba(255,255,255,.13)';ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(ball.x,ball.y,(ball.radius+10)*breathe,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.globalAlpha=.7;ctx.beginPath();ctx.arc(ball.x-ball.radius*.35,ball.y-ball.radius*.35,8,Math.PI,Math.PI*1.65);ctx.stroke();ctx.restore();},
  },
  thorns:{
    takeHit({ball,rival,event,showImpact,emitParticles,playSound}){if(event.damage<=0)return;rival.hp-=event.damage*.3;ball.sporeMeter=(ball.sporeMeter??0)+event.damage;emitParticles(ball,{count:3,color:'#c2dd9e',speed:110,gravity:130,kind:'leaf',size:6});if(ball.sporeMeter>=18){ball.sporeMeter=0;rival.stunned+=30;pulse(rival,'brambled',38);showImpact('ROOTED!',rival);emitParticles(rival,{count:20,color:'#658c3a',speed:220,gravity:180,kind:'leaf',size:8});playSound('root');}},
    draw({ball,ctx}){const p=Math.min(1,(ball.sporeMeter??0)/18);ctx.save();ctx.strokeStyle='#c2dd9e';ctx.lineWidth=3;for(let i=0;i<8;i++){const a=i*Math.PI/4,x=ball.x+Math.cos(a)*(ball.radius+5),y=ball.y+Math.sin(a)*(ball.radius+5);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(ball.x+Math.cos(a)*(ball.radius+8+9*p),ball.y+Math.sin(a)*(ball.radius+8+9*p));ctx.stroke();}ctx.restore();},
  },
  blink:{
    tick({ball,sim,rival,showImpact,emitParticles,playSound}){ball.phaseFrames=Math.max(0,(ball.phaseFrames??0)-1);if(sim.ticks%210)return;emitParticles(ball,{count:16,color:ball.f.color,speed:210,gravity:0,kind:'pixel',size:8});const speed=Math.hypot(rival.vx,rival.vy)||1,nx=rival.vx/speed,ny=rival.vy/speed,gap=ball.radius+rival.radius+24;ball.x=Math.max(ball.radius+30,Math.min(sim.width-ball.radius-30,rival.x-nx*gap));ball.y=Math.max(ball.radius+82,Math.min(sim.height-ball.radius-30,rival.y-ny*gap));ball.phaseFrames=60;pulse(ball,'phase',30);showImpact('BACKDOOR!',ball);emitParticles(ball,{count:16,color:'#d9bcff',speed:210,gravity:0,kind:'pixel',size:8});playSound('teleport');},
    modifyOutgoing({ball,event}){if((ball.phaseFrames??0)>0){event.damage+=12;event.phaseStrike=true;}},
    dealHit({ball,rival,event,showImpact,emitParticles,playSound}){if(event.phaseStrike){ball.phaseFrames=0;pulse(rival,'phase',20);showImpact('DESYNC!',rival);emitParticles(rival,{count:14,color:'#9c52ff',speed:300,gravity:0,kind:'pixel',size:7});playSound('teleport',{volume:.7,rate:1.4});}},
    draw({ball,ctx}){if(!ball.phaseFrames)return;ctx.save();ctx.globalAlpha=.35;ctx.strokeStyle=ball.f.color;ctx.lineWidth=4;for(let i=1;i<=3;i++)ctx.strokeRect(ball.x-ball.radius+i*5,ball.y-ball.radius-i*4,ball.radius*2,ball.radius*2);ctx.restore();},
  },
  coldSnap:{
    modifyOutgoing({sim,rival,event}){if((rival.frostFrozenUntil??0)>sim.ticks){event.damage+=16;event.iceShatter=true;}},
    dealHit({sim,rival,event,showImpact,emitParticles,playSound}){if(event.iceShatter){rival.frostFrozenUntil=0;rival.stunned=0;pulse(rival,'iceShatter',26);showImpact('ICE SHATTER!',rival);emitParticles(rival,{count:30,color:'#d8f7ff',speed:470,gravity:300,kind:'ice',size:10});playSound('iceShatter');}else if(event.force>8){rival.stunned+=90;rival.frostFrozenUntil=sim.ticks+rival.stunned;pulse(rival,'freezeIn',24);showImpact('FROZEN!',rival);emitParticles(rival,{count:14,color:'#d8f7ff',speed:180,gravity:-30,kind:'ice',size:7});playSound('freeze');}},
  },
  afterburn:{
    modifyOutgoing({rival,event}){if((rival.burnStacks??0)>=2){event.damage+=10;event.ignite=true;}},
    dealHit({rival,event,showImpact,emitParticles,playSound}){if(event.ignite){rival.burnStacks=0;rival.burn=0;pulse(rival,'ignite',28);showImpact('IGNITE!',rival);emitParticles(rival,{count:26,color:'#ff6b1a',speed:390,gravity:-260,kind:'fire',size:10});playSound('fire');}else{rival.burnStacks=Math.min(2,(rival.burnStacks??0)+1);rival.burn=120;emitParticles(rival,{count:7,color:'#ffc49c',speed:150,gravity:-100,kind:'fire',size:6});playSound('fire',{volume:.35,rate:1.4});}},
  },
  echo:{dealHit({ball,sim,rival,event,showImpact,emitParticles,playSound}){if(event.damage<=0||event.echo)return;sim.echoes.push({attacker:ball,victim:rival,frames:14,damage:event.damage*.35},{attacker:ball,victim:rival,frames:32,damage:event.damage*.3});pulse(rival,'echo',34);showImpact('REVERB!',rival);emitParticles(rival,{count:10,color:'#9ce3df',speed:190,gravity:0,kind:'ring',size:8});playSound('echo');}},
  thirdHitBlock:{
    modifyIncoming({ball,event}){if(ball.incoming%3===0&&!event.unblockable){event.blockedDamage=event.damage*(event.ability?.5:1);event.damage*=event.ability?.5:0;event.rookBlock=true;}},
    takeHit({ball,rival,event,showImpact,emitParticles,playSound}){if(!event.rookBlock)return;rival.hp-=(event.blockedDamage??0)*.3;rival.vx*=-1.08;rival.vy*=-1.08;rival.stunned+=10;pulse(ball,'steel',22);showImpact('PARRY!',ball);emitParticles(ball,{count:16,color:'#f3efdf',speed:350,gravity:300,kind:'metal',size:8});playSound('armorBlock',{volume:1.15,rate:.82});},
    draw({ball,ctx}){const remaining=3-(ball.incoming%3);ctx.save();for(let i=0;i<3;i++){const a=-Math.PI*.78+i*Math.PI*.28,x=ball.x+Math.cos(a)*(ball.radius+17),y=ball.y+Math.sin(a)*(ball.radius+17);ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.fillStyle=i<remaining?'#fff':'#6f6c64';ctx.fill();ctx.strokeStyle='#151515';ctx.lineWidth=2;ctx.stroke();}ctx.restore();},
  },
  continuousAcceleration:{
    beforeMove({ball}){ball.vx*=1.001;ball.vy*=1.001;},
    modifyOutgoing({ball,event}){event.damage+=Math.max(0,Math.min(12,(Math.hypot(ball.vx,ball.vy)-780)/65));},
    dealHit({ball,emitParticles,playSound}){ball.vx*=.86;ball.vy*=.86;pulse(ball,'cometImpact',16);emitParticles(ball,{count:10,color:'#ffc2d4',speed:300,gravity:0,kind:'star',size:7});playSound('whoosh');},
    drawBack({ball,ctx}){
      const speed=Math.hypot(ball.vx,ball.vy)||1,nx=ball.vx/speed,ny=ball.vy/speed;
      const length=Math.max(ball.radius*.95,Math.min(225,100+(speed-500)*.5)),baseX=ball.x-nx*ball.radius*.55,baseY=ball.y-ny*ball.radius*.55;
      const px=-ny,py=nx,halfWidth=ball.radius*.38,tipRadius=Math.max(6,ball.radius*.11);
      const capX=ball.x-nx*(length-tipRadius),capY=ball.y-ny*(length-tipRadius),direction=Math.atan2(ny,nx);
      ctx.save();ctx.fillStyle=ball.f.color;ctx.globalAlpha=.3;ctx.beginPath();
      ctx.moveTo(baseX+px*halfWidth,baseY+py*halfWidth);
      ctx.lineTo(capX+px*tipRadius,capY+py*tipRadius);
      ctx.arc(capX,capY,tipRadius,direction+Math.PI/2,direction+Math.PI*1.5);
      ctx.lineTo(baseX-px*halfWidth,baseY-py*halfWidth);
      ctx.closePath();ctx.fill();ctx.restore();
    },
  },
  fourthStrike:{
    modifyOutgoing({ball,event,sim}){if(ball.hits%4===0){event.damage+=13;event.staticBurst=true;sim.hitStop+=5;}},
    dealHit({rival,event,showImpact,emitParticles,playSound}){if(event.staticBurst){rival.stunned+=18;pulse(rival,'electric',24);showImpact('OVERLOAD!',rival);emitParticles(rival,{count:18,color:'#e5ff00',speed:390,gravity:0,kind:'bolt',size:9});playSound('electric',{volume:1.1,rate:.72});}},
    draw({ball,ctx}){const charge=ball.hits%4;ctx.save();for(let i=0;i<4;i++){const a=i*Math.PI/2-Math.PI/2,x=ball.x+Math.cos(a)*(ball.radius+14),y=ball.y+Math.sin(a)*(ball.radius+14);ctx.fillStyle=i<charge?'#e5ff00':'#57554d';ctx.fillRect(x-4,y-4,8,8);ctx.strokeStyle='#151515';ctx.lineWidth=1.5;ctx.strokeRect(x-4,y-4,8,8);}ctx.restore();},
  },
  woundedPower:{
    tick({ball}){ball.mass=ball.f.mass*(1+(100-Math.max(0,ball.hp))/125);if(ball.hp<50)pulse(ball,'heavy',2);},
    modifyOutgoing({ball,event}){event.damage*=1+(100-ball.hp)/90;},
    draw({ball,ctx}){const p=Math.max(0,(100-ball.hp)/100);if(!p)return;ctx.save();ctx.strokeStyle='#b9c8d2';ctx.lineWidth=3+p*5;ctx.beginPath();ctx.arc(ball.x,ball.y,ball.radius+9,0,Math.PI*2);ctx.stroke();ctx.restore();},
  },
  orbitalSatellites:{
    tick({ball,sim,rival,showImpact,random,audioTone,audioHit,emitParticles,playSound}){ball.orbitCooldown=Math.max(0,(ball.orbitCooldown??0)-1);const radius=ball.radius+31;for(let i=0;i<2;i++){const a=sim.ticks*.065+i*Math.PI,sx=ball.x+Math.cos(a)*radius,sy=ball.y+Math.sin(a)*radius,dx=rival.x-sx,dy=rival.y-sy,d=Math.hypot(dx,dy);if(d<rival.radius+12&&!ball.orbitCooldown){rival.incoming++;const event={damage:5,force:5,ability:true};const context={sim,rival:ball,event,random,showImpact,audioTone,audioHit,emitParticles,playSound};runBehaviorHook(rival,'modifyIncoming',context);rival.hp-=event.damage;runBehaviorHook(rival,'takeHit',context);rival.vx+=dx/(d||1)*65;rival.vy+=dy/(d||1)*65;rival.flash=6;ball.orbitCooldown=24;pulse(rival,'satellite',12);showImpact('SATELLITE!',{x:sx,y:sy});emitParticles({x:sx,y:sy},{count:10,color:i?'#c9bdff':'#e6ff34',speed:260,gravity:0,kind:'star',size:7});playSound('electric',{volume:.55,rate:1.4});break;}}},
    drawBack({ball,ctx,sim}){const r=ball.radius+31;ctx.save();ctx.strokeStyle='#151515';ctx.lineWidth=2;ctx.globalAlpha=.45;ctx.beginPath();ctx.arc(ball.x,ball.y,r,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;for(let i=0;i<2;i++){const a=sim.ticks*.065+i*Math.PI,sx=ball.x+Math.cos(a)*r,sy=ball.y+Math.sin(a)*r;ctx.fillStyle=i?'#c9bdff':'#e6ff34';ctx.beginPath();ctx.arc(sx,sy,12,0,Math.PI*2);ctx.fill();ctx.stroke();}ctx.restore();},
  },
  bladeTempo:{dealHit({ball,rival,event,showImpact,emitParticles,playSound}){if(!event.weapon||event.projectile)return;ball.angularVelocity=-Math.sign(ball.angularVelocity||1)*Math.min(4.5,Math.abs(ball.angularVelocity)*1.09);pulse(ball,'blade',12);showImpact('RIPOSTE!',ball);emitParticles(rival,{count:15,color:'#fff',speed:420,gravity:260,kind:'slash',size:9});playSound('sword');}},
  slugger:{dealHit({rival,event,showImpact,emitParticles,playSound}){if(!event.weapon)return;rival.wallCrash={frames:90,damage:12};pulse(rival,'launched',20);showImpact('DEEP!',rival);emitParticles(rival,{count:14,color:'#f1c590',speed:360,gravity:250,kind:'star',size:8});playSound('bat');}},
  joust:{
    tick({ball,rival,sim,showImpact,emitParticles,playSound}){
      ball.joustDamage??=12;ball.joustCooldown??=ball.side==='left'?70:86;
      if((ball.joustFrames??0)>0){ball.joustFrames!--;pulse(ball,'joust',2);return;}
      ball.joustCooldown!--;
      if(ball.joustCooldown>0)return;
      ball.joustFrames=34;ball.joustCooldown=150;
      const distance=Math.hypot(rival.x-ball.x,rival.y-ball.y),leadTime=Math.min(.3,distance/1220*.72);
      const targetAngle=Math.atan2(rival.y+rival.vy*leadTime-ball.y,rival.x+rival.vx*leadTime-ball.x);
      const direction=targetAngle+Math.sin(sim.ticks*.173+(ball.side==='left'?0:2.1))*.24,speed=1220;
      ball.angle=direction;
      ball.vx=Math.cos(direction)*speed;ball.vy=Math.sin(direction)*speed;
      pulse(ball,'joustStart',18);showImpact('CHARGE!',ball);
      emitParticles(ball,{count:18,color:'#feed9a',speed:300,gravity:0,kind:'speed',size:8});
      playSound('lanceCharge');sim.hitStop=Math.max(sim.hitStop,2);
    },
    modifyIncoming({ball,rival,event}){if((ball.joustFrames??0)>0&&!event.ability){event.damage=0;event.unblockable=true;return;}if(!event.weapon&&Math.hypot(rival.vx,rival.vy)>900)event.damage*=.55;},
    modifyOutgoing({ball,event}){if((ball.joustFrames??0)>0&&event.weapon){event.damage+=ball.joustDamage??12;event.unblockable=true;}},
    dealHit({ball,rival,event,showImpact,emitParticles,playSound}){
      if(event.damage<=0)return;
      ball.joustDamage=Math.min(27,(ball.joustDamage??12)+1.5);
      if((ball.joustFrames??0)<=0||!event.weapon)return;
      ball.joustFrames=0;pulse(rival,'joustHit',24);showImpact('TILT!',rival);
      emitParticles(rival,{count:24,color:'#fff1ad',speed:480,gravity:320,kind:'star',size:10});playSound('lanceHit');
    },
    wallHit({ball}){if((ball.joustFrames??0)>0)ball.joustFrames=0;},
    draw({ball,ctx,sim}){
      if((ball.joustFrames??0)<=0)return;
      const wave=4+Math.sin(sim.ticks*.7)*3;
      ctx.save();ctx.strokeStyle='#fff1ad';ctx.lineWidth=5;ctx.globalAlpha=.75;
      ctx.beginPath();ctx.arc(ball.x,ball.y,ball.radius+12+wave,Math.PI*.6,Math.PI*1.4);ctx.stroke();ctx.restore();
    },
  },
  growth:{
    wallHit({ball,showImpact,emitParticles,playSound}){if(!growBall(ball,1.35))return;pulse(ball,'growth',14);emitParticles(ball,{count:5,color:'#b8ff82',speed:90,gravity:-30,kind:'bubble',size:6});playSound('grow',{volume:.42,rate:1.25});if(Math.round(ball.radius)%10===0)showImpact('BIGGER!',ball);},
    dealHit({ball,event,showImpact,emitParticles,playSound}){if(event.weapon||event.projectile||event.damage<=0||!growBall(ball,2.6))return;pulse(ball,'growth',22);showImpact('GROW!',ball);emitParticles(ball,{count:12,color:'#b8ff82',speed:150,gravity:-50,kind:'bubble',size:8});playSound('grow');},
    draw({ball,ctx}){if(!ball.growthBaseRadius||ball.radius<=ball.growthBaseRadius+1)return;ctx.save();ctx.strokeStyle='#b8ff82';ctx.lineWidth=4;ctx.setLineDash([7,6]);ctx.beginPath();ctx.arc(ball.x,ball.y,ball.radius+8,0,Math.PI*2);ctx.stroke();ctx.restore();},
  },
  wildFlail:{
    tick({ball,rival,sim,event,random,showImpact,emitParticles,playSound}){
      ball.flailAngle??=ball.angle;ball.flailSpeed??=(random()<.5?-1:1)*(7.2+random()*2.8);ball.flailDamage??=7;ball.flailRadius??=15;
      ball.flailCooldown=Math.max(0,(ball.flailCooldown??0)-1);
      if(ball.frozen||ball.stunned)return;
      const dt=event.dt??1/60;
      ball.flailAngle+=(ball.flailSpeed+Math.sin(sim.ticks*.071+ball.side.length)*2.4)*dt;
      const reach=ball.radius+70+Math.sin(sim.ticks*.047)*14;ball.flailReach=reach;
      const fx=ball.x+Math.cos(ball.flailAngle)*reach,fy=ball.y+Math.sin(ball.flailAngle)*reach;
      if(ball.flailCooldown||rival.hp<=0||Math.hypot(rival.x-fx,rival.y-fy)>rival.radius+(ball.flailRadius??15))return;
      const before={left:sim.balls[0].hp,right:sim.balls[1].hp};
      ball.hits++;rival.incoming++;
      const hit={damage:(ball.flailDamage??7)*ball.f.power*ball.powerScale,force:8,weapon:true,ability:true};
      const context={sim,rival,event:hit,random,showImpact,emitParticles,audioTone:()=>{},audioHit:()=>{},playSound};
      runBehaviorHook(ball,'modifyOutgoing',context);runBehaviorHook(rival,'modifyIncoming',{...context,rival:ball});rival.hp-=hit.damage;
      const dx=rival.x-fx,dy=rival.y-fy,d=Math.hypot(dx,dy)||1;rival.vx+=dx/d*190;rival.vy+=dy/d*190;rival.flash=7;
      ball.flailCooldown=22;ball.flailDamage=Math.min(22,(ball.flailDamage??7)+.8);ball.flailRadius=Math.min(30,(ball.flailRadius??15)+.7);
      runBehaviorHook(ball,'dealHit',context);runBehaviorHook(rival,'takeHit',{...context,rival:ball});
      pulse(ball,'flailHit',18);showImpact('CRUNCH!',{x:fx,y:fy});emitParticles({x:fx,y:fy},{count:16,color:'#dedede',speed:340,gravity:290,kind:'metal',size:8});playSound('flail');
      const [left,right]=sim.balls;sim.lastExchange={tick:sim.ticks,source:'flail strike',before,after:{left:left.hp,right:right.hp},damageTaken:{left:before.left-left.hp,right:before.right-right.hp}};
    },
    drawFront({ball,ctx}){
      const angle=ball.flailAngle??ball.angle,reach=ball.flailReach??ball.radius+70,fx=ball.x+Math.cos(angle)*reach,fy=ball.y+Math.sin(angle)*reach,r=ball.flailRadius??15;
      ctx.save();ctx.strokeStyle='#151515';ctx.lineWidth=7;ctx.setLineDash([8,5]);ctx.beginPath();ctx.moveTo(ball.x,ball.y);ctx.lineTo(fx,fy);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle='#d8d5cb';ctx.beginPath();ctx.arc(fx,fy,r,0,Math.PI*2);ctx.fill();ctx.stroke();
      for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.moveTo(fx+Math.cos(a)*r*.7,fy+Math.sin(a)*r*.7);ctx.lineTo(fx+Math.cos(a)*(r+7),fy+Math.sin(a)*(r+7));ctx.stroke();}ctx.restore();
    },
  },
  polarityDrive:{
    modifyIncoming({event}){if(event.projectile)event.damage*=1.4;else if(event.ability)event.damage*=1.1;},
    beforeMove({ball,rival,event}){ball.polarity??=1;const dx=rival.x-ball.x,dy=rival.y-ball.y,d=Math.hypot(dx,dy)||1,dt=event.dt??0,acceleration=ball.polarity*255;ball.vx+=dx/d*acceleration*dt;ball.vy+=dy/d*acceleration*dt;},
    dealHit({ball,rival,event,showImpact,emitParticles,playSound}){
      if(event.projectile||event.damage<=0)return;
      ball.polarity=ball.polarity===-1?1:-1;
      const dx=rival.x-ball.x,dy=rival.y-ball.y,d=Math.hypot(dx,dy)||1;
      if(ball.polarity===-1){const speed=Math.max(760,Math.hypot(rival.vx,rival.vy));rival.vx=dx/d*speed;rival.vy=dy/d*speed;showImpact('REPEL!',rival);playSound('magnetPush');}
      else{showImpact('ATTRACT!',ball);playSound('magnetPull');}
      pulse(ball,ball.polarity===1?'magnetPull':'magnetPush',24);emitParticles({x:(ball.x+rival.x)/2,y:(ball.y+rival.y)/2},{count:18,color:ball.polarity===1?'#67e8ff':'#ff6b8a',speed:260,gravity:0,kind:'bolt',size:8});
    },
    drawBack({ball,ctx,sim}){const rival=sim.balls.find(candidate=>candidate!==ball);if(!rival)return;const polarity=ball.polarity??1,dx=rival.x-ball.x,dy=rival.y-ball.y,d=Math.hypot(dx,dy)||1,ux=dx/d,uy=dy/d,gap=Math.max(0,d-ball.radius-rival.radius);ctx.save();ctx.strokeStyle=polarity===1?'#67e8ff':'#ff6b8a';ctx.lineWidth=3;ctx.globalAlpha=.3+.12*Math.sin(sim.ticks*.2);ctx.setLineDash(polarity===1?[7,8]:[3,11]);ctx.beginPath();ctx.moveTo(ball.x+ux*ball.radius,ball.y+uy*ball.radius);ctx.lineTo(ball.x+ux*(ball.radius+gap),ball.y+uy*(ball.radius+gap));ctx.stroke();ctx.restore();},
    draw({ball,ctx,sim}){const pull=(ball.polarity??1)===1;ctx.save();ctx.strokeStyle=pull?'#67e8ff':'#ff6b8a';ctx.lineWidth=4;ctx.globalAlpha=.75;for(let i=0;i<2;i++){ctx.beginPath();ctx.arc(ball.x,ball.y,ball.radius+9+i*8+Math.sin(sim.ticks*.16+i)*3,0,Math.PI*2);ctx.stroke();}ctx.restore();},
  },
  droneCarrier:{
    modifyIncoming({event}){if(event.weapon&&!event.projectile&&!event.ability)event.damage*=.85;},
    tick({ball,rival,sim,random,showImpact,emitParticles,playSound}){
      ball.carrierCooldown??=24+Math.floor(random()*36);
      if(ball.frozen||ball.stunned)return;
      ball.carrierCooldown=Math.max(0,ball.carrierCooldown-1);
      if(ball.carrierCooldown>0||sim.projectiles.filter(projectile=>projectile.shooter===ball&&projectile.type==='heatseeker').length>=4)return;
      ball.carrierCooldown=92;
      const launchAngle=Math.atan2(rival.y-ball.y,rival.x-ball.x)+(random()-.5)*.42;
      const distance=ball.radius+13,x=ball.x+Math.cos(launchAngle)*distance,y=ball.y+Math.sin(launchAngle)*distance;
      sim.projectiles.push({shooter:ball,side:ball.side,x,y,previousX:x,previousY:y,vx:Math.cos(launchAngle)*220,vy:Math.sin(launchAngle)*220,radius:8,damage:8.5*ball.f.power*ball.powerScale,force:7,life:210,color:ball.f.accent,type:'heatseeker',dead:false,homingAcceleration:360,maxSpeed:760,turnRate:2.15,armingFrames:18});
      pulse(ball,'droneLaunch',18);showImpact('SCRAMBLE!',{x,y});emitParticles({x,y},{count:12,color:ball.f.accent,speed:210,gravity:0,kind:'smoke',size:7});playSound('droneLaunch');
    },
    dealHit({rival,event,showImpact,emitParticles,playSound}){if(!event.projectile||!event.bubblePop)return;rival.bubbleRecharge=Math.max(rival.bubbleRecharge??0,360);showImpact('SHIELD JAM!',rival);emitParticles(rival,{count:14,color:'#c8ff65',speed:230,gravity:0,kind:'bolt',size:7});playSound('droneHit',{volume:.65,rate:1.35});},
    draw({ball,ctx,sim}){
      const cooldown=ball.carrierCooldown??0,ready=1-Math.min(1,cooldown/92);
      ctx.save();ctx.translate(ball.x,ball.y);ctx.strokeStyle=ball.f.accent;ctx.fillStyle=ball.f.accent;ctx.lineWidth=3;
      for(let i=0;i<3;i++){const angle=i*Math.PI*2/3+sim.ticks*.018,r=ball.radius+13,x=Math.cos(angle)*r,y=Math.sin(angle)*r;ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha=.25+ready*.7;ctx.beginPath();ctx.moveTo(7,0);ctx.lineTo(-5,-5);ctx.lineTo(-5,5);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}
      ctx.restore();
    },
  },
  randomSteering:{beforeMove({ball,random}){ball.vx+=(random()-.5)*20;ball.vy+=(random()-.5)*20;}},
  combatPull:{beforeMove({ball,rival,event}){const dx=rival.x-ball.x,dy=rival.y-ball.y,d=Math.hypot(dx,dy)||1,dt=event.dt??0;ball.vx+=dx/d*90*dt;ball.vy+=dy/d*90*dt;}},
  speedLimit:{beforeMove({ball}){const max=255*ball.f.speed*ball.wallBoost,speed=Math.hypot(ball.vx,ball.vy);if(speed>max){ball.vx*=max/speed;ball.vy*=max/speed;}}},
};

export function runBehaviorHook(ball:Ball,hook:BehaviorHook,context:Partial<Omit<BehaviorContext,'ball'>>):void{
  const noop=()=>{};
  const safeContext={random:Math.random,showImpact:noop,emitParticles:noop,audioTone:noop,audioHit:noop,playSound:noop,...context,ball} as BehaviorContext;
  for(const name of ball.f.behaviors??[])behaviors[name]?.[hook]?.(safeContext);
}
import type { Ball, Behavior, BehaviorContext, BehaviorHook } from './types';
