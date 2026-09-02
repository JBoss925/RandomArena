import { mkdir, writeFile } from 'node:fs/promises';
import { fighters } from '../src/fighters.js';
import { simulateMatch } from '../src/headless-simulation.js';
import type {MatchResult} from '../src/headless-simulation.js';
import type {BalanceMatch, BalanceRanking, BalanceReport, BalanceSummary, Fighter} from '../src/types.js';

type RawRecord={wins:number;losses:number;draws:number;games:number;totalTicks:number;totalRemainingHp:number;totalOpponentHp:number};
type Cell=RawRecord&{asLeft:RawRecord;asRight:RawRecord};
type RecordedOutcome='win'|'loss'|'draw';

const seedsPerSide=Math.max(1,Number.parseInt(process.env.RUNS??'24',10));
const blank=():RawRecord=>({wins:0,losses:0,draws:0,games:0,totalTicks:0,totalRemainingHp:0,totalOpponentHp:0});
const cells:Record<string,Record<string,Cell>>=Object.fromEntries(fighters.map(a=>[a.id,Object.fromEntries(fighters.map(b=>[b.id,{...blank(),asLeft:blank(),asRight:blank()}]))]));

for(let i=0;i<fighters.length;i++)for(let j=i+1;j<fighters.length;j++){
  const a=fighters[i],b=fighters[j];
  for(let run=0;run<seedsPerSide;run++){
    record(a,b,simulateMatch(a,b,`${a.id}:${b.id}:${run}`));
    record(b,a,simulateMatch(b,a,`${a.id}:${b.id}:${run}`));
  }
}

function record(left:Fighter,right:Fighter,result:MatchResult):void{
  const leftCell=cells[left.id][right.id],rightCell=cells[right.id][left.id];
  add(leftCell,leftCell.asLeft,result,result.winner==='left'?'win':result.winner==='right'?'loss':'draw',result.hp.left,result.hp.right);
  add(rightCell,rightCell.asRight,result,result.winner==='right'?'win':result.winner==='left'?'loss':'draw',result.hp.right,result.hp.left);
}
function add(cell:RawRecord,side:RawRecord,result:MatchResult,outcome:RecordedOutcome,ownHp:number,opponentHp:number):void{for(const record of [cell,side]){record.games++;if(outcome==='win')record.wins++;else if(outcome==='loss')record.losses++;else record.draws++;record.totalTicks+=result.ticks;record.totalRemainingHp+=ownHp;record.totalOpponentHp+=opponentHp;}}
function summarize(r:RawRecord):BalanceSummary{return{wins:r.wins,losses:r.losses,draws:r.draws,games:r.games,score:r.games?(r.wins+r.draws*.5)/r.games:0,winRate:r.games?r.wins/r.games:0,drawRate:r.games?r.draws/r.games:0,averageSeconds:r.games?r.totalTicks/r.games/60:0,averageRemainingHp:r.games?r.totalRemainingHp/r.games:0,averageOpponentHp:r.games?r.totalOpponentHp/r.games:0};}
function combine(records:Cell[],side:'asLeft'|'asRight'):RawRecord{return records.reduce((total,record)=>{const value=record[side];total.wins+=value.wins;total.losses+=value.losses;total.draws+=value.draws;total.games+=value.games;total.totalTicks+=value.totalTicks;total.totalRemainingHp+=value.totalRemainingHp;total.totalOpponentHp+=value.totalOpponentHp;return total;},blank());}

const rankings:BalanceRanking[]=fighters.map(f=>{
  const records=Object.values(cells[f.id]),wins=records.reduce((n,r)=>n+r.wins,0),losses=records.reduce((n,r)=>n+r.losses,0),draws=records.reduce((n,r)=>n+r.draws,0),games=wins+losses+draws;
  const left=combine(records,'asLeft'),right=combine(records,'asRight');
  return{id:f.id,name:f.name,tier:'',wins,losses,draws,games,score:(wins+draws*.5)/games,asLeft:summarize(left),asRight:summarize(right)};
}).sort((a,b)=>b.score-a.score);
rankings.forEach((row,index)=>row.tier=index<3?'S':index<7?'A':index<12?'B':index<16?'C':'D');

const matrix:Record<string,Record<string,BalanceMatch|null>>=Object.fromEntries(fighters.map(a=>[a.id,Object.fromEntries(fighters.map(b=>{if(a===b)return[b.id,null];const r=cells[a.id][b.id];return[b.id,{...summarize(r),asLeft:summarize(r.asLeft),asRight:summarize(r.asRight)}];}))]));
const report:BalanceReport&{generatedAt:string;method:BalanceReport['method']&Record<string,unknown>}={generatedAt:new Date().toISOString(),method:{version:2,seedsPerSide,totalPairings:fighters.length*(fighters.length-1)/2,totalSimulations:fighters.length*(fighters.length-1)*seedsPerSide,arena:'open',mirroredStarts:true,maxSeconds:40},rankings,matrix};
await mkdir('reports',{recursive:true});
await mkdir('public/data',{recursive:true});
await writeFile('reports/tier-matrix.json',JSON.stringify(report,null,2)+'\n');
await writeFile('public/data/tier-matrix.json',JSON.stringify(report)+'\n');
const pct=(n:number)=>`${(n*100).toFixed(0)}%`,header=`| Fighter | Tier | Overall | ${fighters.map(f=>f.name).join(' | ')} |`,divider=`|---|:---:|---:|${fighters.map(()=>':---:').join('|')}|`;
const rows=rankings.map(rank=>`| ${rank.name} | ${rank.tier} | ${pct(rank.score)} | ${fighters.map(opponent=>opponent.id===rank.id?'—':pct(report.matrix[rank.id][opponent.id]!.score)).join(' | ')} |`);
const markdown=`# Random Arena balance matrix\n\nGenerated from ${report.method.totalSimulations.toLocaleString()} deterministic open-arena simulations (${seedsPerSide} seeds per side for every pairing). Cells show the row fighter's score against the column fighter; draws count as half a win.\n\n${header}\n${divider}\n${rows.join('\n')}\n\n## Method\n\n- Every unique pairing is run from both left and right positions.\n- The runner uses the production fighter definitions, behaviors, weapon hitboxes, fixed 60 Hz step, and elastic collision solver.\n- No hazards are used, isolating fighter balance.\n- Set \`RUNS\` to increase or decrease seeds per side.\n`;
await writeFile('reports/tier-matrix.md',markdown);
console.log(`Generated ${report.method.totalSimulations} fights across ${report.method.totalPairings} pairings.`);
console.table(rankings.map(({name,tier,score,wins,losses,draws})=>({fighter:name,tier,score:pct(score),wins,losses,draws})));
