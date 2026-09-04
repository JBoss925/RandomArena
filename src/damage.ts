import type {Ball,DamageType} from './types.js';

/**
 * Applies deterministic combat damage and, in visual simulations, records the
 * exact typed HP interval for the HUD. Headless balls omit the receipt array,
 * so balance runs pay no allocation cost for presentation-only animation data.
 */
export function applyDamage(ball:Ball,amount:number,type:DamageType='physical'):number{
  if(!Number.isFinite(amount)||amount<=0)return 0;
  const from=ball.hp;
  ball.hp-=amount;
  if(ball.healthDamageReceipts){
    const sequence=(ball.healthDamageSequence??0)+1;
    ball.healthDamageSequence=sequence;
    ball.healthDamageReceipts.push({sequence,from,to:ball.hp,amount,type});
  }
  return amount;
}

/** Applies healing and records its visual HP interval in browser simulations. */
export function applyHealing(ball:Ball,amount:number):number{
  if(!Number.isFinite(amount)||amount<=0||ball.hp>=100)return 0;
  const from=ball.hp;
  ball.hp=Math.min(100,ball.hp+amount);
  const applied=ball.hp-from;
  if(ball.healthHealingReceipts&&applied>0){
    const sequence=(ball.healthHealingSequence??0)+1;
    ball.healthHealingSequence=sequence;
    ball.healthHealingReceipts.push({sequence,from,to:ball.hp,amount:applied});
  }
  return applied;
}

/** Half-second Poison tick. Every permanent stack contributes identical DPS. */
export function poisonDamagePerTick(stacks:number,damageScale=1):number{
  return stacks>0?.62*stacks*damageScale:0;
}
