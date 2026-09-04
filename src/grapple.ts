import type {Ball,Bounds,Hazard,Point} from './types.js';

export type GrappleHit={type:'fighter'|'geometry';x:number;y:number;distance:number;normalX:number;normalY:number};

function rayCircle(origin:Point,dx:number,dy:number,circle:Point,radius:number):number|null{
  const ox=origin.x-circle.x,oy=origin.y-circle.y,b=ox*dx+oy*dy,c=ox*ox+oy*oy-radius*radius,disc=b*b-c;
  if(disc<0)return null;
  const near=-b-Math.sqrt(disc),far=-b+Math.sqrt(disc);
  return near>1?near:far>1?far:null;
}

export function castGeometryGrapple(ball:Ball,bounds:Bounds,hazards:Hazard[],angle:number):GrappleHit{
  const dx=Math.cos(angle),dy=Math.sin(angle),wallHits:Array<{distance:number;x:number;y:number;normalX:number;normalY:number}>=[];
  if(dx<0)wallHits.push({distance:(bounds.left-ball.x)/dx,x:bounds.left,y:0,normalX:1,normalY:0});
  if(dx>0)wallHits.push({distance:(bounds.right-ball.x)/dx,x:bounds.right,y:0,normalX:-1,normalY:0});
  if(dy<0)wallHits.push({distance:(bounds.top-ball.y)/dy,x:0,y:bounds.top,normalX:0,normalY:1});
  if(dy>0)wallHits.push({distance:(bounds.bottom-ball.y)/dy,x:0,y:bounds.bottom,normalX:0,normalY:-1});
  const wall=wallHits.filter(hit=>hit.distance>0).sort((a,b)=>a.distance-b.distance)[0];
  let geometry:GrappleHit={type:'geometry',distance:wall.distance,x:wall.x||ball.x+dx*wall.distance,y:wall.y||ball.y+dy*wall.distance,normalX:wall.normalX,normalY:wall.normalY};
  for(const hazard of hazards){
    const distance=rayCircle(ball,dx,dy,hazard,hazard.r+(hazard.type==='spikes'?17:0));
    if(distance===null||distance>=geometry.distance)continue;
    const x=ball.x+dx*distance,y=ball.y+dy*distance,nx=(x-hazard.x)/(hazard.r||1),ny=(y-hazard.y)/(hazard.r||1);
    geometry={type:'geometry',x,y,distance,normalX:nx,normalY:ny};
  }
  return geometry;
}

export function castGrapple(ball:Ball,rival:Ball,bounds:Bounds,hazards:Hazard[],angle:number):GrappleHit{
  const dx=Math.cos(angle),dy=Math.sin(angle),geometry=castGeometryGrapple(ball,bounds,hazards,angle),playerDistance=rayCircle(ball,dx,dy,rival,rival.radius);
  if(playerDistance!==null&&playerDistance<geometry.distance)return{type:'fighter',distance:playerDistance,x:ball.x+dx*playerDistance,y:ball.y+dy*playerDistance,normalX:-dx,normalY:-dy};
  return geometry;
}

export function grappleHeadContact(start:Point,end:Point,target:Point,radius:number):Point|null{
  const dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy);if(!length)return null;
  const distance=rayCircle(start,dx/length,dy/length,target,radius);if(distance===null||distance>length)return null;
  return{x:start.x+dx/length*distance,y:start.y+dy/length*distance};
}
