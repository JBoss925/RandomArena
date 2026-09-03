import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {fighters,getFighter} from '../src/fighters.js';
import {simulateMatch} from '../src/headless-simulation.js';
import type {MatchResult} from '../src/headless-simulation.js';
import type {BalanceMatch,BalanceRanking,BalanceReport,BalanceSummary,Fighter} from '../src/types.js';

type RawRecord={wins:number;losses:number;draws:number;games:number;totalTicks:number;totalRemainingHp:number;totalOpponentHp:number};
type RecordedOutcome='win'|'loss'|'draw';
export type MatchupShard={version:1;generatedAt:string;seedsPerSide:number;simulations:number;fighters:[string,string];results:Record<string,BalanceMatch>};

export const DEFAULT_SEEDS_PER_SIDE=500;
export const MATCHUP_DIRECTORY='reports/matchups';
const blankRaw=():RawRecord=>({wins:0,losses:0,draws:0,games:0,totalTicks:0,totalRemainingHp:0,totalOpponentHp:0});
const summarize=(r:RawRecord):BalanceSummary=>({wins:r.wins,losses:r.losses,draws:r.draws,games:r.games,score:r.games?(r.wins+r.draws*.5)/r.games:0,winRate:r.games?r.wins/r.games:0,drawRate:r.games?r.draws/r.games:0,averageSeconds:r.games?r.totalTicks/r.games/60:0,averageRemainingHp:r.games?r.totalRemainingHp/r.games:0,averageOpponentHp:r.games?r.totalOpponentHp/r.games:0});

export function matchupKey(a:string,b:string):string{return[a,b].sort().join('--');}
export function requireFighter(id:string):Fighter{const fighter=getFighter(id.toLowerCase());if(!fighter)throw new Error(`Unknown fighter "${id}". Valid fighters: ${fighters.map(item=>item.id).join(', ')}`);return fighter;}
function add(record:RawRecord,result:MatchResult,outcome:RecordedOutcome,ownHp:number,opponentHp:number):void{record.games++;if(outcome==='win')record.wins++;else if(outcome==='loss')record.losses++;else record.draws++;record.totalTicks+=result.ticks;record.totalRemainingHp+=ownHp;record.totalOpponentHp+=opponentHp;}

export function runMatchup(first:Fighter,second:Fighter,seedsPerSide:number):MatchupShard{
  const [a,b]=[first,second].sort((left,right)=>fighters.findIndex(item=>item.id===left.id)-fighters.findIndex(item=>item.id===right.id));
  if(a.id===b.id)throw new Error('A balance matchup requires two different fighters.');
  const records:Record<string,{all:RawRecord;asLeft:RawRecord;asRight:RawRecord}>={[a.id]:{all:blankRaw(),asLeft:blankRaw(),asRight:blankRaw()},[b.id]:{all:blankRaw(),asLeft:blankRaw(),asRight:blankRaw()}};
  for(let run=0;run<seedsPerSide;run++){
    recordFight(a,b,simulateMatch(a,b,`${a.id}:${b.id}:${run}`));
    recordFight(b,a,simulateMatch(b,a,`${a.id}:${b.id}:${run}`));
  }
  function recordFight(left:Fighter,right:Fighter,result:MatchResult):void{
    const leftOutcome=result.winner==='left'?'win':result.winner==='right'?'loss':'draw',rightOutcome=result.winner==='right'?'win':result.winner==='left'?'loss':'draw';
    add(records[left.id].all,result,leftOutcome,result.hp.left,result.hp.right);add(records[left.id].asLeft,result,leftOutcome,result.hp.left,result.hp.right);
    add(records[right.id].all,result,rightOutcome,result.hp.right,result.hp.left);add(records[right.id].asRight,result,rightOutcome,result.hp.right,result.hp.left);
  }
  return{version:1,generatedAt:new Date().toISOString(),seedsPerSide,simulations:seedsPerSide*2,fighters:[a.id,b.id],results:Object.fromEntries([a,b].map(fighter=>{const row=records[fighter.id];return[fighter.id,{...summarize(row.all),asLeft:summarize(row.asLeft),asRight:summarize(row.asRight)}];}))};
}

export async function writeMatchup(shard:MatchupShard):Promise<void>{await mkdir(MATCHUP_DIRECTORY,{recursive:true});await writeFile(`${MATCHUP_DIRECTORY}/${matchupKey(...shard.fighters)}.json`,JSON.stringify(shard,null,2)+'\n');}
export async function readMatchups():Promise<Map<string,MatchupShard>>{const result=new Map<string,MatchupShard>();let files:string[]=[];try{files=await readdir(MATCHUP_DIRECTORY);}catch{return result;}for(const file of files.filter(name=>name.endsWith('.json')).sort()){const shard=JSON.parse(await readFile(`${MATCHUP_DIRECTORY}/${file}`,'utf8')) as MatchupShard;result.set(matchupKey(...shard.fighters),shard);}return result;}

function combine(summaries:BalanceSummary[]):BalanceSummary{
  const games=summaries.reduce((n,row)=>n+row.games,0),wins=summaries.reduce((n,row)=>n+row.wins,0),losses=summaries.reduce((n,row)=>n+row.losses,0),draws=summaries.reduce((n,row)=>n+row.draws,0),weighted=(field:'averageSeconds'|'averageRemainingHp'|'averageOpponentHp')=>games?summaries.reduce((n,row)=>n+row[field]*row.games,0)/games:0;
  return{wins,losses,draws,games,score:games?(wins+draws*.5)/games:0,winRate:games?wins/games:0,drawRate:games?draws/games:0,averageSeconds:weighted('averageSeconds'),averageRemainingHp:weighted('averageRemainingHp'),averageOpponentHp:weighted('averageOpponentHp')};
}

export async function assembleReport():Promise<BalanceReport&{generatedAt:string;method:BalanceReport['method']&Record<string,unknown>}>{
  const shards=await readMatchups(),missing:string[]=[];
  for(let i=0;i<fighters.length;i++)for(let j=i+1;j<fighters.length;j++){const key=matchupKey(fighters[i].id,fighters[j].id);if(!shards.has(key))missing.push(key);}
  if(missing.length)throw new Error(`Cannot assemble balance report: ${missing.length} matchup shards are missing (${missing.slice(0,8).join(', ')}${missing.length>8?', …':''}). Run npm run balance first or import the existing report.`);
  const seedCounts=new Set([...shards.values()].map(shard=>shard.seedsPerSide));if(seedCounts.size!==1)throw new Error(`Cannot assemble mixed sample sizes: found ${[...seedCounts].sort((a,b)=>a-b).join(', ')} seeds per side.`);
  const seedsPerSide=[...seedCounts][0];
  const matrix:Record<string,Record<string,BalanceMatch|null>>=Object.fromEntries(fighters.map(a=>[a.id,Object.fromEntries(fighters.map(b=>[b.id,a.id===b.id?null:shards.get(matchupKey(a.id,b.id))!.results[a.id]]))]));
  const rankings:BalanceRanking[]=fighters.map(fighter=>{const opponents=fighters.filter(item=>item.id!==fighter.id),overall=combine(opponents.map(item=>matrix[fighter.id][item.id]!)),asLeft=combine(opponents.map(item=>matrix[fighter.id][item.id]!.asLeft)),asRight=combine(opponents.map(item=>matrix[fighter.id][item.id]!.asRight));return{id:fighter.id,name:fighter.name,tier:'',wins:overall.wins,losses:overall.losses,draws:overall.draws,games:overall.games,score:overall.score,asLeft,asRight};}).sort((a,b)=>b.score-a.score);
  rankings.forEach((row,index)=>row.tier=index<3?'S':index<7?'A':index<12?'B':index<16?'C':'D');
  const report={generatedAt:new Date().toISOString(),method:{version:3,seedsPerSide,totalPairings:fighters.length*(fighters.length-1)/2,totalSimulations:fighters.length*(fighters.length-1)*seedsPerSide,arena:'open',mirroredStarts:true,maxSeconds:40,storage:'per-matchup-shards'},rankings,matrix};
  await mkdir('reports',{recursive:true});await mkdir('public/data',{recursive:true});await writeFile('reports/tier-matrix.json',JSON.stringify(report,null,2)+'\n');await writeFile('public/data/tier-matrix.json',JSON.stringify(report)+'\n');
  const pct=(n:number)=>`${(n*100).toFixed(1)}%`,header=`| Fighter | Tier | Overall | ${fighters.map(f=>f.name).join(' | ')} |`,divider=`|---|:---:|---:|${fighters.map(()=>':---:').join('|')}|`,rows=rankings.map(rank=>`| ${rank.name} | ${rank.tier} | ${pct(rank.score)} | ${fighters.map(opponent=>opponent.id===rank.id?'—':pct(matrix[rank.id][opponent.id]!.score)).join(' | ')} |`);
  const markdown=`# Random Arena balance matrix\n\nGenerated from ${report.method.totalSimulations.toLocaleString()} deterministic open-arena simulations (${seedsPerSide} seeds per side for every pairing). Cells show the row fighter's score against the column fighter; draws count as half a win.\n\n${header}\n${divider}\n${rows.join('\n')}\n\n## Method\n\n- Every unique pairing is run from both left and right positions.\n- Each pairing is stored independently in \`${MATCHUP_DIRECTORY}/\` so targeted reruns can update the aggregate without repeating unaffected simulations.\n- The runner uses the production fighter definitions, behaviors, weapon hitboxes, fixed 60 Hz step, and elastic collision solver.\n- No hazards are used, isolating fighter balance.\n- Set \`RUNS\` to override the default ${DEFAULT_SEEDS_PER_SIDE} seeds per side.\n`;
  await writeFile('reports/tier-matrix.md',markdown);return report;
}

export async function importExistingReport():Promise<void>{
  const report=JSON.parse(await readFile('reports/tier-matrix.json','utf8')) as BalanceReport&{generatedAt?:string};const seedsPerSide=report.method.seedsPerSide;
  for(let i=0;i<fighters.length;i++)for(let j=i+1;j<fighters.length;j++){const a=fighters[i],b=fighters[j],left=report.matrix[a.id]?.[b.id],right=report.matrix[b.id]?.[a.id];if(!left||!right)throw new Error(`Existing report is missing ${a.id} / ${b.id}.`);await writeMatchup({version:1,generatedAt:report.generatedAt??new Date().toISOString(),seedsPerSide,simulations:seedsPerSide*2,fighters:[...([a.id,b.id].sort())] as [string,string],results:{[a.id]:left,[b.id]:right}});}
}
