export type HealthBarSegment={offset:number;width:number};
export type HealthBarLayout={fill:number;healing:HealthBarSegment[];damage:HealthBarSegment[]};

/** Packs every active effect against the live HP boundary without gaps. */
export function layoutHealthBar(actualHp:number,healingAmounts:number[],damageAmounts:number[]):HealthBarLayout{
  const hp=Math.max(0,Math.min(100,actualHp));
  const healingTotal=healingAmounts.reduce((sum,amount)=>sum+Math.max(0,amount),0);
  const visibleHealing=Math.min(hp,healingTotal),healingScale=healingTotal>0?visibleHealing/healingTotal:0;
  let cursor=hp-visibleHealing;
  const healing=healingAmounts.map(amount=>{const width=Math.max(0,amount)*healingScale,segment={offset:cursor,width};cursor+=width;return segment;});
  cursor=hp;
  const damage=damageAmounts.map(amount=>{const width=Math.max(0,amount),segment={offset:cursor,width};cursor+=width;return segment;});
  return{fill:hp-visibleHealing,healing,damage};
}
