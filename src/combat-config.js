export const combatConfig={
  baseContactDamage:2.5,
  relativeSpeedDivisor:72,
  maximumContactDamage:18,
};

export function contactForce(relativeNormalSpeed){
  return Math.min(combatConfig.maximumContactDamage,combatConfig.baseContactDamage+Math.abs(relativeNormalSpeed)/combatConfig.relativeSpeedDivisor);
}
