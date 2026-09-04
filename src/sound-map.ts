import type {SoundCue} from './types';

export type SynthSound='rustle'|'whoosh'|'drain'|'rumble';
export type SoundDefinition={
  /** Put a file in public/audio and reference it here as /audio/your-file.ext. */
  file?:string;
  /** Per-effect loudness before the player's master-volume setting (0–1). */
  volume:number;
  /** Base playback speed/pitch. Keep at 1 to preserve the original recording. */
  rate:number;
  /** Small randomized playback-rate range that adds variation without changing physics. */
  variance?:number;
  /** Prevents the same cue firing every frame; this never cuts off a sound already playing. */
  cooldownMs?:number;
  synth?:SynthSound;
};

// This is the only mapping you need to edit when replacing or rebalancing sounds.
// Missing/unloadable files automatically fall back to a short game-like beep.
export const soundCues:Record<SoundCue,SoundDefinition>={
  // Foundation transients guarantee that ordinary contacts are always audible.
  // The material cues below are layered on top as quieter character accents.
  bodyContact:{file:'/audio/body-contact.mp3',volume:.72,rate:1,variance:.1,cooldownMs:34},
  wallContact:{file:'/audio/arena-tap.mp3',volume:.58,rate:.9,variance:.08,cooldownMs:34},
  impactLight:{file:'/audio/metal-tap.ogg',volume:.16,rate:1.25,variance:.15,cooldownMs:70},
  impactHeavy:{file:'/audio/mechanical-clank.mp3',volume:.22,rate:.9,variance:.08,cooldownMs:90},
  materialPlastic:{file:'/audio/plastic-clack.mp3',volume:.24,rate:.82,variance:.12,cooldownMs:38},
  materialWall:{file:'/audio/arena-tap.mp3',volume:.3,rate:.9,variance:.1,cooldownMs:38},
  materialRubber:{file:'/audio/rubber-pop.ogg',volume:.2,rate:1,variance:.1,cooldownMs:65},
  materialWood:{file:'/audio/wood-knock.ogg',volume:.3,rate:1.08,variance:.1,cooldownMs:48},
  materialStone:{file:'/audio/stone-knock.ogg',volume:.34,rate:.95,variance:.08,cooldownMs:55},
  materialGlass:{file:'/audio/glass-tick.ogg',volume:.27,rate:1.18,variance:.1,cooldownMs:48},
  materialSoft:{file:'/audio/soft-hit.ogg',volume:.56,rate:1.08,variance:.1,cooldownMs:48},
  materialMetal:{file:'/audio/metal-tap.ogg',volume:.3,rate:1.02,variance:.1,cooldownMs:48},
  materialEnergy:{file:'/audio/laser-fire.mp3',volume:.22,rate:1.65,variance:.12,cooldownMs:55},
  armorBlock:{file:'/audio/metal-impact.mp3',volume:.34,rate:.72,variance:.04,cooldownMs:100},
  armorBreak:{file:'/audio/mechanical-clank.mp3',volume:.38,rate:.62,cooldownMs:180},
  bubblePop:{file:'/audio/bubble-pop.mp3',volume:.55,rate:1,variance:.08,cooldownMs:120},
  freeze:{file:'/audio/freeze-crackle.ogg',volume:.3,rate:1.05,variance:.04,cooldownMs:220},
  iceShatter:{file:'/audio/ice-shatter.mp3',volume:.48,rate:1.15,variance:.08,cooldownMs:180},
  fire:{file:'/audio/fire-ignition.mp3',volume:.24,rate:1.55,variance:.1,cooldownMs:180},
  teleport:{file:'/audio/teleport.mp3',volume:.32,rate:1.45,variance:.05,cooldownMs:180},
  heal:{file:'/audio/healing.mp3',volume:.22,rate:1.1,variance:.04,cooldownMs:260},
  coin:{file:'/audio/goldie-coin.mp3',volume:.75,rate:1,variance:.05,cooldownMs:70},
  jackpot:{file:'/audio/goldie-jackpot.mp3',volume:.8,rate:1.05,variance:.02,cooldownMs:500},
  electric:{file:'/audio/laser-fire.mp3',volume:.27,rate:1.75,variance:.12,cooldownMs:90},
  shotgun:{file:'/audio/shotgun-fire.mp3',volume:.95,rate:1,variance:.025,cooldownMs:140},
  sniper:{file:'/audio/laser-fire.mp3',volume:.58,rate:.58,variance:.02,cooldownMs:250},
  sword:{file:'/audio/metal-tap.ogg',volume:.28,rate:1.05,variance:.1,cooldownMs:80},
  bat:{file:'/audio/wood-knock.ogg',volume:.36,rate:.88,variance:.07,cooldownMs:75},
  lanceCharge:{file:'/audio/lance-whoosh.mp3',volume:.42,rate:.9,variance:.04,cooldownMs:180},
  lanceHit:{file:'/audio/lance-hit.mp3',volume:.58,rate:.78,variance:.05,cooldownMs:100},
  grow:{file:'/audio/rubber-pop.ogg',volume:.3,rate:.68,variance:.08,cooldownMs:85},
  flail:{file:'/audio/flail-rattle.mp3',volume:.38,rate:1.18,variance:.06,cooldownMs:150},
  magnetPull:{file:'/audio/laser-fire.mp3',volume:.22,rate:1.9,variance:.04,cooldownMs:120},
  magnetPush:{file:'/audio/laser-fire.mp3',volume:.38,rate:.72,variance:.04,cooldownMs:120},
  droneLaunch:{file:'/audio/laser-fire.mp3',volume:.28,rate:1.28,variance:.06,cooldownMs:120},
  droneHit:{file:'/audio/mechanical-clank.mp3',volume:.32,rate:1.22,variance:.06,cooldownMs:90},
  webShot:{file:'/audio/lance-whoosh.mp3',volume:.34,rate:1.45,variance:.08,cooldownMs:90},
  webSwing:{volume:.13,rate:1,synth:'whoosh',cooldownMs:120},
  webImpact:{file:'/audio/soft-hit.ogg',volume:.62,rate:.82,variance:.08,cooldownMs:90},
  webPerch:{file:'/audio/arena-tap.mp3',volume:.38,rate:1.12,variance:.06,cooldownMs:100},
  mineDeploy:{file:'/audio/mechanical-clank.mp3',volume:.3,rate:1.28,variance:.06,cooldownMs:120},
  explosion:{file:'/audio/shotgun-fire.mp3',volume:.78,rate:.74,variance:.05,cooldownMs:110},
  grenade:{file:'/audio/lance-whoosh.mp3',volume:.36,rate:1.12,variance:.05,cooldownMs:120},
  shrapnel:{file:'/audio/metal-tap.ogg',volume:.22,rate:1.32,variance:.13,cooldownMs:45},
  root:{volume:.2,rate:1,synth:'rustle',cooldownMs:160},
  echo:{file:'/audio/teleport.mp3',volume:.15,rate:1.9,variance:.08,cooldownMs:90},
  siphon:{volume:.16,rate:1,synth:'drain',cooldownMs:100},
  whoosh:{volume:.13,rate:1,synth:'whoosh',cooldownMs:80},
  rumble:{volume:.15,rate:1,synth:'rumble',cooldownMs:100},
  pinball:{file:'/audio/pinball-bumper.mp3',volume:.38,rate:1.08,variance:.06,cooldownMs:100},
  success:{file:'/audio/completion.mp3',volume:.34,rate:1,cooldownMs:400},
  failure:{file:'/audio/mechanical-clank.mp3',volume:.3,rate:.52,cooldownMs:400},
};
