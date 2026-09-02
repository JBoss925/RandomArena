// Resolve knockouts from simulation state only. Mutual knockouts use transparent,
// deterministic performance tiebreakers and never fall back to random chance.
export function resolveOutcome(left: Ball,right: Ball,{lastExchange=null,tick=0}:{lastExchange?:Exchange|null;tick?:number}={}):Outcome|null{
  const leftOut=left.hp<=0,rightOut=right.hp<=0;
  if(!leftOut&&!rightOut)return null;
  if(leftOut!==rightOut)return{winner:leftOut?'right':'left',mutualKo:false,decidedBy:'knockout'};

  const exchange=lastExchange?.tick===tick?lastExchange:null;
  const base={mutualKo:true,exchange,leftHp:left.hp,rightHp:right.hp,hpMargin:Math.abs(left.hp-right.hp)};
  if(left.hp!==right.hp)return{...base,winner:left.hp>right.hp?'left':'right',decidedBy:'overkillHp'};

  if(exchange){
    const leftDealt=exchange.damageTaken.right,rightDealt=exchange.damageTaken.left;
    if(leftDealt!==rightDealt)return{...base,winner:leftDealt>rightDealt?'left':'right',decidedBy:'finalDamage'};
  }

  const leftEnergy=.5*(left.mass??left.f.mass)*(left.vx**2+left.vy**2);
  const rightEnergy=.5*(right.mass??right.f.mass)*(right.vx**2+right.vy**2);
  if(leftEnergy!==rightEnergy)return{...base,winner:leftEnergy>rightEnergy?'left':'right',decidedBy:'kineticEnergy',leftEnergy,rightEnergy};
  if(left.hits!==right.hits)return{...base,winner:left.hits>right.hits?'left':'right',decidedBy:'landedHits'};
  return{...base,winner:'draw',decidedBy:'deadHeat'};
}
import type { Ball, Exchange, Outcome } from './types';
