import {readFile} from 'node:fs/promises';
import type {BalanceReport} from '../src/types.js';

const report=JSON.parse(await readFile(new URL('../reports/tier-matrix.json',import.meta.url),'utf8')) as BalanceReport;
const sampleFailure=report.method.seedsPerSide<500;
if(sampleFailure)console.error(`Balance report uses only ${report.method.seedsPerSide} seeds per side; at least 500 are required.`);
const overallFailures=report.rankings.filter(row=>row.score<.4||row.score>.6);
const matchupFailures:{a:string;b:string;score:number}[]=[];
let worst={edge:0,a:'',b:'',score:0};
for(const [a,row] of Object.entries(report.matrix))for(const [b,match] of Object.entries(row)){
  if(!match||a>=b)continue;
  const edge=Math.max(match.score,1-match.score);
  if(edge>worst.edge)worst={edge,a,b,score:match.score};
  if(match.score<.2||match.score>.8)matchupFailures.push({a,b,score:match.score});
}
const weakest=report.rankings.at(-1);
const strongest=report.rankings[0];
if(!weakest||!strongest)throw new Error('Balance report contains no fighter rankings.');
console.log(`Overall range: ${(weakest.score*100).toFixed(1)}%–${(strongest.score*100).toFixed(1)}%`);
console.log(`Worst matchup: ${worst.a} / ${worst.b} — ${(worst.score*100).toFixed(1)}% / ${((1-worst.score)*100).toFixed(1)}%`);
if(sampleFailure||overallFailures.length||matchupFailures.length){
  console.error(`${overallFailures.length} overall and ${matchupFailures.length} matchup constraints failed.`);
  process.exitCode=1;
}else console.log('Balance constraints passed: every fighter is 40–60% overall and every matchup is 20–80%.');
