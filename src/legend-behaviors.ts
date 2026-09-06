import {applyDamage,applyHealing} from './damage.js';
import type {AlchemyFlask,AlchemyPool,Ball,Behavior,BehaviorContext,CombatEvent,DamageType,Point} from './types.js';

type Dispatch=(ball:Ball,hook:'modifyIncoming'|'takeHit',context:Partial<BehaviorContext>)=>void;

function capVelocity(ball:Ball,maximum:number):void{
  const speed=Math.hypot(ball.vx,ball.vy);
  if(speed<=maximum)return;
  const scale=maximum/speed;ball.vx*=scale;ball.vy*=scale;
}

export function legendBehaviors(dispatch:Dispatch):Record<string,Behavior>{
  function hit(c:BehaviorContext,target:Ball,damage:number,label:string,point:Point,type:DamageType='physical',countHit=true):void{
    const {ball,sim}=c,before={left:sim.balls[0].hp,right:sim.balls[1].hp};
    const event:CombatEvent={force:damage,damage:damage*ball.f.power*ball.powerScale,ability:true,damageType:type};
    if(countHit){ball.hits++;target.incoming++;}
    const context={...c,rival:ball,event};
    if(countHit)dispatch(target,'modifyIncoming',context);
    applyDamage(target,event.damage,event.damageType);
    if(countHit)dispatch(target,'takeHit',context);
    target.flash=7;
    sim.lastExchange={tick:sim.ticks,source:label,before,after:{left:sim.balls[0].hp,right:sim.balls[1].hp},damageTaken:{left:before.left-sim.balls[0].hp,right:before.right-sim.balls[1].hp}};
    if(label)c.showImpact(label,point);
  }

  function spawnEcho(c:BehaviorContext):void{
    const {ball}=c,path=(ball.phantomHistory??[]).map(point=>({...point}));
    if(path.length<30)return;
    ball.phantomEcho={...path[0],path,progress:0,hit:false};
    ball.phantomCooldown=120;
    c.showImpact('AFTERIMAGE!',ball.phantomEcho);
    c.emitParticles(ball.phantomEcho,{count:18,color:ball.f.accent,speed:180,gravity:0,kind:'ghost',size:8});
    c.playSound('phantomSpawn');
  }

  function throwFlask(c:BehaviorContext):void{
    const {ball,rival,random}=c,kinds=['acid','tonic','catalyst'] as const;
    ball.alchemyIndex??=Math.floor(random()*kinds.length);
    const kind=kinds[ball.alchemyIndex%kinds.length],angle=Math.atan2(rival.y-ball.y,rival.x-ball.x),speed=620;
    ball.alchemyFlasks??=[];
    ball.alchemyFlasks.push({x:ball.x+Math.cos(angle)*(ball.radius+12),y:ball.y+Math.sin(angle)*(ball.radius+12),vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,kind,rotation:angle,dead:false});
    ball.alchemyIndex=(ball.alchemyIndex+1)%kinds.length;
    ball.alchemyCooldown=75;
    c.showImpact(`${kind.toUpperCase()} FLASK!`,ball);
    c.emitParticles(ball,{count:8,color:flaskColor(kind),speed:120,gravity:80,kind:'bubble',size:6});
    c.playSound('flaskThrow');
  }

  function flaskColor(kind:AlchemyFlask['kind']):string{
    return kind==='acid'?'#b6ec52':kind==='tonic'?'#65e7ee':'#ff67c8';
  }

  function drawAlchemyPool(ctx:CanvasRenderingContext2D,pool:AlchemyPool,pulse:number):void{
    const points=14,phase=(pool.x*.071+pool.y*.113)%Math.PI;
    ctx.beginPath();
    const edge=Array.from({length:points},(_,index)=>{
      const angle=phase+(index/points)*Math.PI*2;
      const wobble=.78+.16*Math.sin(index*2.37+pool.x*.041)+.09*Math.sin(index*4.11+pool.y*.033);
      return{x:pool.x+Math.cos(angle)*pool.radius*wobble*pulse,y:pool.y+Math.sin(angle)*pool.radius*wobble*pulse};
    });
    edge.forEach((point,index)=>{
      const next=edge[(index+1)%points],mid={x:(point.x+next.x)/2,y:(point.y+next.y)/2};
      if(index===0)ctx.moveTo(mid.x,mid.y);
      ctx.quadraticCurveTo(next.x,next.y,(next.x+edge[(index+2)%points].x)/2,(next.y+edge[(index+2)%points].y)/2);
    });
    ctx.closePath();ctx.fill();ctx.stroke();
    for(let index=0;index<3;index++){
      const angle=phase+index*2.31+.4,distance=pool.radius*(.82+index*.13),radius=pool.radius*(.075+index*.018);
      ctx.beginPath();ctx.arc(pool.x+Math.cos(angle)*distance,pool.y+Math.sin(angle)*distance,radius*pulse,0,Math.PI*2);ctx.fill();ctx.stroke();
    }
  }

  function flaskCollision(c:BehaviorContext,flask:AlchemyFlask):Point|null{
    const {sim}=c,next={x:flask.x+flask.vx/60,y:flask.y+flask.vy/60};
    if(next.x<34||next.x>sim.width-34||next.y<86||next.y>sim.height-34)return next;
    for(const hazard of sim.hazards)if(Math.hypot(next.x-hazard.x,next.y-hazard.y)<hazard.r+8)return next;
    for(const target of sim.balls){const x=(target.tickStartX??target.x)+target.vx/120,y=(target.tickStartY??target.y)+target.vy/120;if(Math.hypot(next.x-x,next.y-y)<target.radius+8)return next;}
    return null;
  }

  function shatterFlask(c:BehaviorContext,flask:AlchemyFlask,point:Point):void{
    const {ball,sim}=c;
    flask.dead=true;
    c.emitParticles(point,{count:18,color:flaskColor(flask.kind),speed:260,gravity:280,kind:'glass',size:8});
    c.playSound('flaskBreak');
    if(flask.kind!=='catalyst'){
      ball.alchemyPools??=[];
      ball.alchemyPools.push({x:point.x,y:point.y,kind:flask.kind,radius:52,frames:240});
      c.showImpact(flask.kind==='acid'?'ACID POOL!':'TONIC POOL!',point);
      return;
    }
    c.showImpact('CATALYST!',point);
    c.playSound('catalystBurst');
    const reacting=(ball.alchemyPools??[]).filter(pool=>Math.hypot(pool.x-point.x,pool.y-point.y)<175);
    if(!reacting.length){
      for(const target of sim.balls)if(Math.hypot(target.x-point.x,target.y-point.y)<90)hit(c,target,7,'CATALYST BURST!',point,'explosive');
    }
    for(const pool of reacting){
      if(pool.kind==='acid'){
        for(const target of sim.balls)if(target!==ball&&Math.hypot(target.x-pool.x,target.y-pool.y)<115)hit(c,target,16,'ACID REACTION!',pool,'acid');
        c.emitParticles(pool,{count:28,color:'#b6ec52',speed:430,gravity:-60,kind:'poison',size:10});
      }else{
        for(const target of sim.balls)if(Math.hypot(target.x-pool.x,target.y-pool.y)<115){const healed=applyHealing(target,12);if(healed)c.showImpact(`+${healed.toFixed(healed%1?1:0)} HP`,target);}
        c.emitParticles(pool,{count:25,color:'#65e7ee',speed:360,gravity:-80,kind:'heal',size:10});
      }
      pool.frames=0;
    }
  }

  function startFocus(c:BehaviorContext,counter=false):void{
    const {ball,rival,sim}=c,rx=rival.tickStartX??rival.x,ry=rival.tickStartY??rival.y,angle=Math.atan2(ry-ball.y,rx-ball.x),final=(ball.roninResolve??0)>=2;
    ball.ronin={phase:counter?'dash':'focus',frames:counter?20:30,angle,hit:false,counter,final,startedTick:sim.ticks};
    if(counter){
      ball.vx=Math.cos(angle)*1900;ball.vy=Math.sin(angle)*1900;ball.stunned=0;
      c.showImpact('COUNTER!',ball);c.playSound('roninCounter');
    }else{
      ball.vx=0;ball.vy=0;c.showImpact(final?'FINAL FOCUS!':'FOCUS!',ball);c.playSound('roninFocus');
    }
  }

  return{
    phantomReplay:{
      tick(c){
        const {ball,rival}=c;
        ball.phantomHistory??=[];
        ball.phantomHistory.push({x:ball.x,y:ball.y});
        if(ball.phantomHistory.length>48)ball.phantomHistory.shift();
        ball.phantomCooldown=Math.max(0,(ball.phantomCooldown??75)-1);
        if(!ball.phantomEcho&&!ball.phantomCooldown)spawnEcho(c);
        const echo=ball.phantomEcho;
        if(!echo)return;
        echo.progress+=.55;
        const index=Math.min(echo.path.length-1,Math.floor(echo.progress)),next=echo.path[index];
        echo.x=next.x;echo.y=next.y;
        const rx=(rival.tickStartX??rival.x)+rival.vx/120,ry=(rival.tickStartY??rival.y)+rival.vy/120;
        if(!echo.hit&&Math.hypot(echo.x-rx,echo.y-ry)<rival.radius+ball.radius*.82){
          echo.hit=true;hit(c,rival,13,'ECHO STRIKE!',echo,'echo');
          c.emitParticles(echo,{count:22,color:ball.f.accent,speed:320,gravity:0,kind:'ghost',size:9});c.playSound('phantomStrike');
          ball.phantomEcho=undefined;
        }else if(index===echo.path.length-1)ball.phantomEcho=undefined;
      },
      modifyIncoming({ball,rival,event}){if(ball.phantomEcho&&event.damage>0){const charge=(rival.joustFrames??0)>0||rival.rocket?.phase==='dash';event.damage*=charge?.2:.4;event.phantomMisdirect=true;}},
      takeHit(c){
        const {ball,event}=c,echo=ball.phantomEcho;
        if(!echo||!event.phantomMisdirect)return;
        const old={x:ball.x,y:ball.y};ball.x=echo.x;ball.y=echo.y;echo.x=old.x;echo.y=old.y;
        ball.phantomEcho=undefined;ball.phantomCooldown=120;
        c.showImpact('MISDIRECT!',ball);c.emitParticles(ball,{count:24,color:ball.f.accent,speed:250,gravity:0,kind:'ghost',size:8});c.playSound('phantomSpawn',{rate:1.25});
      },
      drawBack({ball,ctx}){
        const echo=ball.phantomEcho;if(!echo)return;
        ctx.save();ctx.globalAlpha=.28;ctx.fillStyle=ball.f.color;ctx.strokeStyle=ball.f.accent;ctx.lineWidth=4;ctx.setLineDash([6,7]);ctx.beginPath();ctx.arc(echo.x,echo.y,ball.radius*.82,0,Math.PI*2);ctx.fill();ctx.stroke();
        const tail=echo.path.slice(Math.max(0,Math.floor(echo.progress)-10),Math.floor(echo.progress)+1);ctx.beginPath();tail.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.restore();
      },
    },
    fieldAlchemy:{
      tick(c){
        const {ball,sim,rival}=c;
        ball.alchemyCooldown=Math.max(0,(ball.alchemyCooldown??35)-1);
        if(!ball.alchemyCooldown)throwFlask(c);
        for(const flask of ball.alchemyFlasks??[]){
          flask.rotation+=.18;const collision=flaskCollision(c,flask);
          if(collision)shatterFlask(c,flask,collision);else{flask.x+=flask.vx/60;flask.y+=flask.vy/60;}
        }
        ball.alchemyFlasks=(ball.alchemyFlasks??[]).filter(flask=>!flask.dead);
        for(const pool of ball.alchemyPools??[]){
          pool.frames--;
          if(sim.ticks%6)continue;
          if(pool.kind==='acid'&&Math.hypot(rival.x-pool.x,rival.y-pool.y)<rival.radius+pool.radius){hit(c,rival,.22,'',rival,'acid',false);rival.visualStates.acid=12;if(sim.ticks%30===0){c.showImpact('ACID!',rival);c.playSound('acidSizzle',{volume:.45});}}
          if(pool.kind==='tonic')for(const target of sim.balls)if(Math.hypot(target.x-pool.x,target.y-pool.y)<target.radius+pool.radius){const healed=applyHealing(target,.3);if(healed)target.visualStates.healing=12;}
        }
        ball.alchemyPools=(ball.alchemyPools??[]).filter(pool=>pool.frames>0);
      },
      drawFloor({ball,ctx,sim}){
        for(const pool of ball.alchemyPools??[]){const pulse=1+Math.sin(sim.ticks*.1+pool.x)*.035;ctx.save();ctx.globalAlpha=.32;ctx.fillStyle=flaskColor(pool.kind);ctx.strokeStyle='#151515';ctx.lineWidth=3;drawAlchemyPool(ctx,pool,pulse);ctx.restore();}
      },
      drawBack({ball,ctx}){
        for(const flask of ball.alchemyFlasks??[]){ctx.save();ctx.translate(flask.x,flask.y);ctx.rotate(flask.rotation);ctx.fillStyle=flaskColor(flask.kind);ctx.strokeStyle='#151515';ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(-7,-10,14,18,5);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(-4,-10);ctx.lineTo(-4,-15);ctx.lineTo(4,-15);ctx.lineTo(4,-10);ctx.stroke();ctx.restore();}
      },
    },
    drawBlade:{
      tick(c){
        const {ball,rival}=c;
        ball.roninCooldown=Math.max(0,(ball.roninCooldown??70)-1);
        if(!ball.ronin&&!ball.roninCooldown)startFocus(c);
        const state=ball.ronin;if(!state)return;
        if(state.phase==='focus'){
          state.angle=Math.atan2((rival.tickStartY??rival.y)-ball.y,(rival.tickStartX??rival.x)-ball.x);ball.angle=state.angle;
          if(--state.frames<=0){state.phase='dash';state.frames=20;ball.vx=Math.cos(state.angle)*1480;ball.vy=Math.sin(state.angle)*1480;c.showImpact(state.final?'FINAL CUT!':'DRAW CUT!',ball);c.playSound('roninCut');}
        }else if(state.phase==='dash'&&--state.frames<=0){state.phase='recovery';state.frames=36;ball.vx*=.35;ball.vy*=.35;}
        else if(state.phase==='recovery'&&--state.frames<=0){ball.ronin=undefined;ball.roninCooldown=105;}
      },
      modifyIncoming(c){
        const {ball,rival,event}=c;if(event.damage<=0)return;
        const committedCharge=(rival.joustFrames??0)>0;
        if(event.projectile&&rival.f.behaviors.includes('droneCarrier'))event.damage*=1.15;
        if(rival.f.behaviors.includes('continuousAcceleration'))event.damage*=.65;
        if(committedCharge)event.damage*=.55;
        if(ball.ronin?.phase!=='focus'||committedCharge)return;
        if(event.weapon||event.projectile||event.ability){event.damage*=1.35;return;}
        event.damage*=.2;event.roninCounter=true;startFocus(c,true);
      },
      takeHit({ball,rival,event}){if(event.roninCounter&&ball.ronin?.counter){ball.stunned=0;rival.stunned=Math.max(rival.stunned,12);ball.vx=Math.cos(ball.ronin.angle)*1900;ball.vy=Math.sin(ball.ronin.angle)*1900;}},
      modifyOutgoing({ball,rival,event,sim}){
        const state=ball.ronin;if(state?.phase!=='dash'||state.hit||state.startedTick===sim.ticks)return;
        const counterSpeedBonus=state.counter?Math.max(0,Math.min(45,(Math.hypot(rival.vx,rival.vy)-700)/18)):0;
        event.damage+=(state.final?42:state.counter?30+counterSpeedBonus:24)*ball.f.power;event.ability=true;event.roninCut=true;
        if(rival.f.mass>=1.3)event.damage+=2*ball.f.power;
        if(state.final)event.shieldPenetration=.5;
      },
      dealHit(c){
        const {ball,rival,event}=c,state=ball.ronin;if(!state||!event.roninCut||state.hit)return;
        state.hit=true;state.phase='recovery';state.frames=36;ball.vx*=.42;ball.vy*=.42;
        // A cut should read as a clean deflection, not inject dash velocity into
        // the opponent for the remainder of the bout.
        capVelocity(rival,820);
        ball.roninResolve=state.final?0:(ball.roninResolve??0)+1;
        c.showImpact(state.final?'FINAL CUT!':state.counter?'COUNTER CUT!':'DRAW CUT!',rival);c.emitParticles(rival,{count:state.final?32:22,color:ball.f.accent,speed:state.final?520:390,gravity:180,kind:'slash',size:10});c.playSound('roninCut',{rate:state.final?.72:1});
      },
      wallHit({ball}){if(ball.ronin?.phase==='dash'){ball.ronin.phase='recovery';ball.ronin.frames=36;ball.ronin.hit=true;}},
      drawBack({ball,ctx,sim}){
        const state=ball.ronin;if(state?.phase!=='focus')return;
        const length=900,wave=.45+.25*Math.sin(sim.ticks*.4);ctx.save();ctx.globalAlpha=wave;ctx.strokeStyle=state.final?'#ff4c75':ball.f.accent;ctx.lineWidth=state.final?6:3;ctx.setLineDash([14,10]);ctx.beginPath();ctx.moveTo(ball.x-Math.cos(state.angle)*length,ball.y-Math.sin(state.angle)*length);ctx.lineTo(ball.x+Math.cos(state.angle)*length,ball.y+Math.sin(state.angle)*length);ctx.stroke();ctx.restore();
      },
      drawFront({ball,ctx}){
        const state=ball.ronin,a=state?.angle??ball.angle,drawn=state?.phase==='dash'?58:18;ctx.save();ctx.translate(ball.x,ball.y);ctx.rotate(a);ctx.strokeStyle='#151515';ctx.fillStyle='#edf2f4';ctx.lineWidth=5;ctx.beginPath();ctx.roundRect(ball.radius-4,-7,drawn,14,5);ctx.fill();ctx.stroke();ctx.fillStyle=ball.f.accent;ctx.fillRect(ball.radius-7,-14,8,28);ctx.strokeRect(ball.radius-7,-14,8,28);ctx.restore();
      },
    },
  };
}
