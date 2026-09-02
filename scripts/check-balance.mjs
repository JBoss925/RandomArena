import {readFile} from 'node:fs/promises';

const report=JSON.parse(await readFile(new URL('../reports/tier-matrix.json',import.meta.url),'utf8'));
const overallFailures=report.rankings.filter(row=>row.score<.4||row.score>.6);
const matchupFailures=[];
let worst={edge:0,a:'',b:'',score:0};
for(const [a,row] of Object.entries(report.matrix))for(const [b,match] of Object.entries(row)){
  if(!match||a>=b)continue;
  const edge=Math.max(match.score,1-match.score);
  if(edge>worst.edge)worst={edge,a,b,score:match.score};
  if(match.score<.2||match.score>.8)matchupFailures.push({a,b,score:match.score});
}
console.log(`Overall range: ${(report.rankings.at(-1).score*100).toFixed(1)}%–${(report.rankings[0].score*100).toFixed(1)}%`);
console.log(`Worst matchup: ${worst.a} / ${worst.b} — ${(worst.score*100).toFixed(1)}% / ${((1-worst.score)*100).toFixed(1)}%`);
if(overallFailures.length||matchupFailures.length){
  console.error(`${overallFailures.length} overall and ${matchupFailures.length} matchup constraints failed.`);
  process.exitCode=1;
}else console.log('Balance constraints passed: every fighter is 40–60% overall and every matchup is 20–80%.');
