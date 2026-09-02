import { fighters } from '../src/fighters.js';
import { simulateMatch } from '../src/headless-simulation.js';
import type {Fighter,Side} from '../src/types.js';
import type {MatchResult} from '../src/headless-simulation.js';

type RecordRow={wins:number;draws:number;games:number};
type Evaluation=RecordRow&{id:string;name:string;power:number;score:number};

const sweeps=Math.max(1,Number.parseInt(process.env.SWEEPS??'5',10));
const runs=Math.max(2,Number.parseInt(process.env.RUNS??'4',10));
const roster=structuredClone(fighters);
let bestRoster=structuredClone(roster),bestError=Infinity;
const localStep=Number.parseFloat(process.env.LOCAL_STEP??'0');

for(let sweep=0;sweep<sweeps;sweep++){
  for(const fighter of roster){
    let best={power:fighter.power,error:Infinity};
    if(localStep>0){
      const center=fighter.power;
      for(let offset=-4;offset<=4;offset++){
        fighter.power=center+offset*localStep;
        const error=Math.abs(evaluateOne(fighter,roster,runs)-.5);
        if(error<best.error)best={power:fighter.power,error};
      }
    }else{
      let low=.08,high=3.5;
      for(let step=0;step<9;step++){
        fighter.power=(low+high)/2;
        const score=evaluateOne(fighter,roster,runs),error=Math.abs(score-.5);
        if(error<best.error)best={power:fighter.power,error};
        if(score>.5)high=fighter.power;else low=fighter.power;
      }
    }
    fighter.power=best.power;
  }
  const results=evaluateAll(roster,runs);
  const meanError=results.reduce((n,r)=>n+Math.abs(r.score-.5),0)/results.length;
  if(meanError<bestError){bestError=meanError;bestRoster=structuredClone(roster);}
  const weakest=results.at(-1);
  const strongest=results[0];
  if(!weakest||!strongest)throw new Error('Cannot optimize an empty roster.');
  console.log(`Sweep ${sweep+1}: ${pct(weakest.score)}–${pct(strongest.score)}, mean error ${pct(meanError)}${meanError===bestError?'  BEST':''}`);
}

const final=evaluateAll(bestRoster,runs);
console.table(final.map(row=>({fighter:row.name,score:pct(row.score),power:Number(row.power.toFixed(4)),original:fighters.find(f=>f.id===row.id)?.power})));
console.log('\nPaste-ready power values:');
console.log(Object.fromEntries(final.map(row=>[row.id,Number(row.power.toFixed(4))])));

function evaluateOne(fighter:Fighter,list:Fighter[],samples:number):number{
  let wins=0,draws=0,games=0;
  for(const opponent of list){if(opponent===fighter)continue;for(let run=0;run<samples;run++){
    const fighterIndex=list.indexOf(fighter),opponentIndex=list.indexOf(opponent),seed=fighterIndex<opponentIndex?`${fighter.id}:${opponent.id}:${run}`:`${opponent.id}:${fighter.id}:${run}`;
    const arrangements:Array<[Fighter,Fighter,Side]>=[[fighter,opponent,'left'],[opponent,fighter,'right']];
    for(const [left,right,ownSide] of arrangements){const result=simulateMatch(left,right,seed);games++;if(result.winner==='draw')draws++;else if(result.winner===ownSide)wins++;}
  }}
  return (wins+draws*.5)/games;
}
function evaluateAll(list:Fighter[],samples:number):Evaluation[]{
  const records:Record<string,RecordRow>=Object.fromEntries(list.map(f=>[f.id,{wins:0,draws:0,games:0}]));
  for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++)for(let run=0;run<samples;run++){
    const seed=`${list[i].id}:${list[j].id}:${run}`;
    count(records,list[i],list[j],simulateMatch(list[i],list[j],seed));
    count(records,list[j],list[i],simulateMatch(list[j],list[i],seed));
  }
  return list.map(f=>({id:f.id,name:f.name,power:f.power,...records[f.id],score:(records[f.id].wins+records[f.id].draws*.5)/records[f.id].games})).sort((a,b)=>b.score-a.score);
}
function count(records:Record<string,RecordRow>,left:Fighter,right:Fighter,result:MatchResult){
  const leftRecord=records[left.id];
  const rightRecord=records[right.id];
  if(!leftRecord||!rightRecord)throw new Error('Missing fighter balance record.');
  leftRecord.games++;rightRecord.games++;
  if(result.winner==='draw'){leftRecord.draws++;rightRecord.draws++;}
  else (result.winner==='left'?leftRecord:rightRecord).wins++;
}
function pct(value:number):string{return `${(value*100).toFixed(1)}%`;}
