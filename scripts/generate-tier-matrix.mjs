import { mkdir, writeFile } from 'node:fs/promises';
import { fighters } from '../src/fighters.js';
import { simulateMatch } from '../src/headless-simulation.js';

const seedsPerSide=Math.max(1,Number.parseInt(process.env.RUNS??'24',10));
const blank=()=>({wins:0,losses:0,draws:0,games:0,totalTicks:0,totalRemainingHp:0,totalOpponentHp:0});
const cells=Object.fromEntries(fighters.map(a=>[a.id,Object.fromEntries(fighters.map(b=>[b.id,{...blank(),asLeft:blank(),asRight:blank()}]))]));

for(let i=0;i<fighters.length;i++)for(let j=i+1;j<fighters.length;j++){
  const a=fighters[i],b=fighters[j];
  for(let run=0;run<seedsPerSide;run++){
    record(a,b,simulateMatch(a,b,`${a.id}:${b.id}:${run}`));
    record(b,a,simulateMatch(b,a,`${a.id}:${b.id}:${run}`));
  }
}

function record(left,right,result){
  const leftCell=cells[left.id][right.id],rightCell=cells[right.id][left.id];
  add(leftCell,leftCell.asLeft,result,result.winner==='left'?'win':result.winner==='right'?'loss':'draw',result.hp.left,result.hp.right);
  add(rightCell,rightCell.asRight,result,result.winner==='right'?'win':result.winner==='left'?'loss':'draw',result.hp.right,result.hp.left);
}
function add(cell,side,result,outcome,ownHp,opponentHp){const outcomeKey=outcome==='loss'?'losses':`${outcome}s`;for(const record of [cell,side]){record.games++;record[outcomeKey]++;record.totalTicks+=result.ticks;record.totalRemainingHp+=ownHp;record.totalOpponentHp+=opponentHp;}}
function summarize(r){return{wins:r.wins,losses:r.losses,draws:r.draws,games:r.games,score:r.games?(r.wins+r.draws*.5)/r.games:0,winRate:r.games?r.wins/r.games:0,drawRate:r.games?r.draws/r.games:0,averageSeconds:r.games?r.totalTicks/r.games/60:0,averageRemainingHp:r.games?r.totalRemainingHp/r.games:0,averageOpponentHp:r.games?r.totalOpponentHp/r.games:0};}

const rankings=fighters.map(f=>{
  const records=Object.values(cells[f.id]),wins=records.reduce((n,r)=>n+r.wins,0),losses=records.reduce((n,r)=>n+r.losses,0),draws=records.reduce((n,r)=>n+r.draws,0),games=wins+losses+draws;
  const left=records.reduce((a,r)=>{for(const key of Object.keys(a))a[key]+=r.asLeft[key]??0;return a;},blank()),right=records.reduce((a,r)=>{for(const key of Object.keys(a))a[key]+=r.asRight[key]??0;return a;},blank());
  return{id:f.id,name:f.name,wins,losses,draws,games,score:(wins+draws*.5)/games,asLeft:summarize(left),asRight:summarize(right)};
}).sort((a,b)=>b.score-a.score);
rankings.forEach((row,index)=>row.tier=index<3?'S':index<7?'A':index<12?'B':index<16?'C':'D');

const report={generatedAt:new Date().toISOString(),method:{version:2,seedsPerSide,totalPairings:fighters.length*(fighters.length-1)/2,totalSimulations:fighters.length*(fighters.length-1)*seedsPerSide,arena:'open',mirroredStarts:true,maxSeconds:40},rankings,matrix:Object.fromEntries(fighters.map(a=>[a.id,Object.fromEntries(fighters.map(b=>{if(a===b)return[b.id,null];const r=cells[a.id][b.id];return[b.id,{...summarize(r),asLeft:summarize(r.asLeft),asRight:summarize(r.asRight)}];}))]))};
await mkdir('reports',{recursive:true});
await mkdir('public/data',{recursive:true});
await writeFile('reports/tier-matrix.json',JSON.stringify(report,null,2)+'\n');
await writeFile('public/data/tier-matrix.json',JSON.stringify(report)+'\n');
const pct=n=>`${(n*100).toFixed(0)}%`,header=`| Fighter | Tier | Overall | ${fighters.map(f=>f.name).join(' | ')} |`,divider=`|---|:---:|---:|${fighters.map(()=>':---:').join('|')}|`;
const rows=rankings.map(rank=>`| ${rank.name} | ${rank.tier} | ${pct(rank.score)} | ${fighters.map(opponent=>opponent.id===rank.id?'—':pct(report.matrix[rank.id][opponent.id].score)).join(' | ')} |`);
const markdown=`# Random Arena balance matrix\n\nGenerated from ${report.method.totalSimulations.toLocaleString()} deterministic open-arena simulations (${seedsPerSide} seeds per side for every pairing). Cells show the row fighter's score against the column fighter; draws count as half a win.\n\n${header}\n${divider}\n${rows.join('\n')}\n\n## Method\n\n- Every unique pairing is run from both left and right positions.\n- The runner uses the production fighter definitions, behaviors, weapon hitboxes, fixed 60 Hz step, and elastic collision solver.\n- No hazards are used, isolating fighter balance.\n- Set \`RUNS\` to increase or decrease seeds per side.\n`;
await writeFile('reports/tier-matrix.md',markdown);
console.log(`Generated ${report.method.totalSimulations} fights across ${report.method.totalPairings} pairings.`);
console.table(rankings.map(({name,tier,score,wins,losses,draws})=>({fighter:name,tier,score:pct(score),wins,losses,draws})));
