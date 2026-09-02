import type { Material, ParticleOptions, SoundCue } from './types.js';

export type ContactFeedback={
  material:Material;
  cue:SoundCue;
  particles:ParticleOptions;
  ringColor:string;
  word:string;
};

const visual:Record<Material,{cue:SoundCue;kind:string;color:string;gravity:number;size:number}>={
  plastic:{cue:'materialPlastic',kind:'chip',color:'#f3efdf',gravity:260,size:4},
  metal:{cue:'materialMetal',kind:'metal',color:'#edf3f6',gravity:300,size:6},
  stone:{cue:'materialStone',kind:'stone',color:'#aaa797',gravity:380,size:7},
  wood:{cue:'materialWood',kind:'splinter',color:'#d89a54',gravity:340,size:7},
  rubber:{cue:'materialRubber',kind:'ring',color:'#ffc4ef',gravity:0,size:7},
  glass:{cue:'materialGlass',kind:'glass',color:'#d8f7ff',gravity:280,size:7},
  energy:{cue:'materialEnergy',kind:'bolt',color:'#e5ff00',gravity:0,size:7},
  ceramic:{cue:'materialStone',kind:'chip',color:'#f3efdf',gravity:330,size:6},
};
const words:Record<Material,[string,string]>={plastic:['CLACK!','KLAK!'],metal:['CLINK!','CLANG!'],stone:['TOK!','KRAK!'],wood:['KNOCK!','THWACK!'],rubber:['BOP!','BOING!'],glass:['TINK!','CRACK!'],energy:['ZZT!','ZAP!'],ceramic:['TAP!','KRAK!']};

// Contacts are symmetric, but the softer surface should usually define the
// sound: metal striking rubber is a damp bump, not a ringing anvil strike.
function pairMaterial(a:Material,b:Material):Material{
  if(a===b)return a;
  if(a==='rubber'||b==='rubber')return 'rubber';
  if(a==='energy'||b==='energy')return 'energy';
  if(a==='glass'||b==='glass')return 'glass';
  if(a==='wood'||b==='wood')return 'wood';
  if(a==='stone'||b==='stone'||a==='ceramic'||b==='ceramic')return 'stone';
  if(a==='metal'||b==='metal')return 'metal';
  return 'plastic';
}

export function contactFeedback(a:Material='plastic',b:Material='plastic',force=5,{wall=false,primary=false}:{wall?:boolean;primary?:boolean}={}):ContactFeedback{
  const material=primary?a:pairMaterial(a,b),base=visual[material];
  const strength=Math.max(.45,Math.min(1.8,force/7));
  const dampedRubber=!primary&&material==='rubber'&&a!==b&&a!=='plastic'&&b!=='plastic';
  return{
    material,
    cue:dampedRubber?'materialSoft':wall&&material==='plastic'?'materialWall':base.cue,
    particles:{count:Math.round(4+strength*5),color:base.color,speed:120+strength*150,gravity:base.gravity,kind:base.kind,size:base.size*strength},
    ringColor:base.color,
    word:words[material][force>8?1:0],
  };
}

export function hazardMaterial(type:'pillar'|'spikes'|'medbay'|'pinball'):Material{
  return type==='spikes'?'metal':type==='medbay'?'energy':type==='pinball'?'rubber':'plastic';
}
