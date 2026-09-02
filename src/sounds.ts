import type {RandomSource,SoundCue,SoundCueOptions} from './types';
import {soundCues,type SynthSound} from './sound-map.js';
import {soundSources} from './sound-sources.js';
export {soundCues} from './sound-map.js';
export {soundSources} from './sound-sources.js';

/** Absolute output ceiling applied after source, cue, event, and player volume. */
export const SOUND_OUTPUT_GAIN=.25;
const lastPlayed=new Map<SoundCue,number>();
const preloaded=new Map<string,HTMLAudioElement>();
const loading=new Map<string,Promise<HTMLAudioElement|undefined>>();
const sourceVolumes=new Map<string,number>(Object.values(soundSources).map(source=>[source.localUrl,source.volume]));
let synthContext:AudioContext|undefined;

export function preloadSounds():void{
  for(const definition of Object.values(soundCues))if(definition.file)void loadSound(definition.file);
}

export function playSound(cue:SoundCue,{enabled=true,volume=1,rate=1,random=Math.random}:SoundCueOptions&{enabled?:boolean;random?:RandomSource}={}):void{
  if(!enabled)return;
  const definition=soundCues[cue],now=performance.now(),last=lastPlayed.get(cue)??-Infinity;
  if(now-last<(definition.cooldownMs??0))return;
  lastPlayed.set(cue,now);
  try{
    if(definition.file){
      const file=definition.file;
      const play=(template:HTMLAudioElement):void=>{
        const audio=template.cloneNode(true) as HTMLAudioElement;
        audio.volume=Math.min(1,definition.volume*sourceVolume(file)*volume*SOUND_OUTPUT_GAIN);
        audio.playbackRate=Math.max(.5,Math.min(2,definition.rate*rate+(random()-.5)*(definition.variance??0)));
        void audio.play().catch(error=>{
          console.warn(`Unable to play sound cue "${cue}" from ${file}.`,error);
          playFallback(cue,definition.volume*sourceVolume(file)*volume*SOUND_OUTPUT_GAIN);
        });
      };
      const template=preloaded.get(file);
      if(template)play(template);
      else void loadSound(file).then(loaded=>loaded?play(loaded):playFallback(cue,definition.volume*sourceVolume(file)*volume*SOUND_OUTPUT_GAIN));
    }else if(definition.synth)playSynth(definition.synth,definition.volume*volume*SOUND_OUTPUT_GAIN,random);
    else playFallback(cue,definition.volume*volume*SOUND_OUTPUT_GAIN);
  }catch{/* Audio support must never influence simulation state. */}
}

function sourceVolume(file:string):number{
  return Math.max(0,Math.min(1,sourceVolumes.get(file)??1));
}

function loadSound(file:string):Promise<HTMLAudioElement|undefined>{
  const ready=preloaded.get(file);
  if(ready)return Promise.resolve(ready);
  const pending=loading.get(file);
  if(pending)return pending;
  // Fetch the complete file ourselves. Native Audio elements commonly request
  // byte ranges (206), which legacy service workers cannot safely cache.
  const request=fetch(file,{cache:'force-cache'})
    .then(response=>{
      if(!response.ok)throw new Error(`Sound request failed: ${response.status}`);
      return response.blob();
    })
    .then(blob=>{
      const audio=new Audio(URL.createObjectURL(blob));
      audio.preload='auto';
      preloaded.set(file,audio);
      return audio;
    })
    .catch(error=>{
      console.warn(`Unable to load sound file ${file}.`,error);
      return undefined;
    })
    .finally(()=>loading.delete(file));
  loading.set(file,request);
  return request;
}

function playSynth(kind:SynthSound,volume:number,random:RandomSource):void{
  synthContext??=new AudioContext();
  const context=synthContext,now=context.currentTime,gain=context.createGain();
  gain.gain.setValueAtTime(Math.min(.16,volume),now);gain.gain.exponentialRampToValueAtTime(.0001,now+.2);gain.connect(context.destination);
  if(kind==='rustle'||kind==='whoosh'){
    const length=Math.floor(context.sampleRate*.2),buffer=context.createBuffer(1,length,context.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<length;i++)data[i]=(random()*2-1)*(kind==='rustle'?(i%89<18?1:.15):1);
    const source=context.createBufferSource(),filter=context.createBiquadFilter();source.buffer=buffer;filter.type=kind==='rustle'?'bandpass':'lowpass';filter.frequency.value=kind==='rustle'?1800:700;source.connect(filter).connect(gain);source.start(now);
  }else{
    const oscillator=context.createOscillator();oscillator.type=kind==='drain'?'sine':'sawtooth';oscillator.frequency.setValueAtTime(kind==='drain'?330:95,now);oscillator.frequency.exponentialRampToValueAtTime(kind==='drain'?90:45,now+.2);oscillator.connect(gain);oscillator.start(now);oscillator.stop(now+.2);
  }
}

function playFallback(cue:SoundCue,volume:number):void{
  synthContext??=new AudioContext();
  const context=synthContext,now=context.currentTime,oscillator=context.createOscillator(),gain=context.createGain();
  const index=[...cue].reduce((sum,char)=>sum+char.charCodeAt(0),0);
  oscillator.type=index%3===0?'square':'sine';
  oscillator.frequency.setValueAtTime(220+(index%7)*55,now);
  oscillator.frequency.exponentialRampToValueAtTime(150+(index%5)*45,now+.075);
  gain.gain.setValueAtTime(Math.min(.08,volume*.22),now);
  gain.gain.exponentialRampToValueAtTime(.0001,now+.08);
  oscillator.connect(gain).connect(context.destination);oscillator.start(now);oscillator.stop(now+.08);
}
