export const combatConfig={
  baseContactDamage:2.5,
  relativeSpeedDivisor:72,
  maximumContactDamage:18,
};

export function contactForce(relativeNormalSpeed:number):number{
  return Math.min(combatConfig.maximumContactDamage,combatConfig.baseContactDamage+Math.abs(relativeNormalSpeed)/combatConfig.relativeSpeedDivisor);
}

// Equal-speed impacts preserve base damage. A speed advantage changes damage
// within a bounded range using deterministic fight state, never a hidden roll.
export function impactSpeedScale(attackerSpeed:number,targetSpeed:number):number{
  const total=attackerSpeed+targetSpeed;
  if(total<=0)return 1;
  return Math.max(.85,Math.min(1.15,2*attackerSpeed/total));
}
