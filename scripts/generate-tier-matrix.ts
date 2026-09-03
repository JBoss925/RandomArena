import {fighters} from '../src/fighters.js';
import {assembleReport,DEFAULT_SEEDS_PER_SIDE,importExistingReport,requireFighter,runMatchup,writeMatchup} from './balance-core.js';

const args=process.argv.slice(2),mode=args[0]??'--all';
const parsedRuns=Number.parseInt(process.env.RUNS??String(DEFAULT_SEEDS_PER_SIDE),10);
const seedsPerSide=Number.isFinite(parsedRuns)&&parsedRuns>0?parsedRuns:DEFAULT_SEEDS_PER_SIDE;

if(mode==='--import-report'){
  await importExistingReport();
  console.log('Imported the aggregate report into per-matchup shards.');
}else if(mode==='--assemble'){
  // No simulations: rebuild the aggregates from the existing shards.
}else if(mode==='--matchup'){
  const left=requireFighter(args[1]??''),right=requireFighter(args[2]??'');
  const shard=runMatchup(left,right,seedsPerSide);await writeMatchup(shard);
  console.log(`${left.name} / ${right.name}: ${(shard.results[left.id].score*100).toFixed(1)}% / ${(shard.results[right.id].score*100).toFixed(1)}% (${shard.simulations.toLocaleString()} fights)`);
}else if(mode==='--fighter'){
  const fighter=requireFighter(args[1]??'');
  for(const opponent of fighters.filter(item=>item.id!==fighter.id)){
    const shard=runMatchup(fighter,opponent,seedsPerSide);await writeMatchup(shard);
    console.log(`${fighter.name} / ${opponent.name}: ${(shard.results[fighter.id].score*100).toFixed(1)}% / ${(shard.results[opponent.id].score*100).toFixed(1)}%`);
  }
}else if(mode==='--fighters'){
  const selected=new Set(args.slice(1).map(id=>requireFighter(id).id));
  if(!selected.size)throw new Error('--fighters requires at least one fighter id.');
  const pairs:Array<[typeof fighters[number],typeof fighters[number]]>=[];
  for(let i=0;i<fighters.length;i++)for(let j=i+1;j<fighters.length;j++)if(selected.has(fighters[i].id)||selected.has(fighters[j].id))pairs.push([fighters[i],fighters[j]]);
  for(const [index,[left,right]] of pairs.entries()){
    const shard=runMatchup(left,right,seedsPerSide);await writeMatchup(shard);
    console.log(`[${index+1}/${pairs.length}] ${left.name} / ${right.name}: ${(shard.results[left.id].score*100).toFixed(1)}% / ${(shard.results[right.id].score*100).toFixed(1)}%`);
  }
}else if(mode==='--all'){
  let completed=0;const total=fighters.length*(fighters.length-1)/2;
  for(let i=0;i<fighters.length;i++)for(let j=i+1;j<fighters.length;j++){
    const shard=runMatchup(fighters[i],fighters[j],seedsPerSide);await writeMatchup(shard);completed++;
    console.log(`[${completed}/${total}] ${fighters[i].name} / ${fighters[j].name}: ${(shard.results[fighters[i].id].score*100).toFixed(1)}%`);
  }
}else throw new Error('Usage: --all | --matchup FIGHTER FIGHTER | --fighter FIGHTER | --fighters FIGHTER... | --assemble | --import-report');

const report=await assembleReport();
console.log(`Assembled ${report.method.totalSimulations.toLocaleString()} fights across ${report.method.totalPairings} matchup shards.`);
console.table(report.rankings.map(({name,tier,score,wins,losses,draws})=>({fighter:name,tier,score:`${(score*100).toFixed(1)}%`,wins,losses,draws})));
