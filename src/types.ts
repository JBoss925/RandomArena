export type Side = 'left' | 'right';
export type Winner = Side | 'draw';
export type RandomSource = () => number;
export type Material = 'plastic'|'metal'|'stone'|'wood'|'rubber'|'glass'|'energy'|'ceramic';
export type SoundCue = 'bodyContact'|'wallContact'|'impactLight'|'impactHeavy'|'materialPlastic'|'materialWall'|'materialRubber'|'materialWood'|'materialStone'|'materialGlass'|'materialSoft'|'materialMetal'|'materialEnergy'|'armorBlock'|'armorBreak'|'bubblePop'|'freeze'|'iceShatter'|'fire'|'teleport'|'heal'|'coin'|'jackpot'|'electric'|'shotgun'|'sniper'|'sword'|'bat'|'root'|'echo'|'siphon'|'whoosh'|'rumble'|'pinball'|'success'|'failure';
export type SoundCueOptions = {volume?:number;rate?:number};
export type Point = { x: number; y: number };
export type Bounds = { left: number; right: number; top: number; bottom: number };

export type FighterSpec = { icon: string; label: string; value: string };

type WeaponBase = {
  type: 'sword' | 'bat' | 'shotgun' | 'sniper';
  length: number;
  width: number;
  angularSpeed: number;
  material?: Material;
};

export type MeleeWeapon = WeaponBase & {
  type: 'sword' | 'bat';
  projectile?: false;
  damage: number;
  cooldown: number;
  knockback: number;
  reversesOnContact?: boolean;
  minimumLaunchSpeed?: number;
  speedMultiplier?: number;
};

export type RangedWeapon = WeaponBase & {
  type: 'shotgun' | 'sniper';
  projectile: true;
  fireInterval: number;
  projectiles: number;
  spread: number;
  projectileSpeed: number;
  projectileDamage: number;
  projectileForce: number;
  projectileRadius: number;
  projectileLife: number;
  fireLabel: string;
};

export type Weapon = MeleeWeapon | RangedWeapon;

export type Fighter = {
  id: string;
  name: string;
  color: string;
  accent: string;
  material?: Material;
  speed: number;
  power: number;
  mass: number;
  behaviors: string[];
  ability: string;
  desc: string;
  specs: FighterSpec[];
  bodyDamageScale?: number;
  weapon?: Weapon;
};

export type HazardType = 'pillar' | 'spikes' | 'medbay' | 'pinball';
export type Hazard = Point & { id: string; type: HazardType; r: number; value: number };

export type WallCrash = { frames: number; damage: number };

export type Ball = Point & {
  f: Fighter;
  side: Side;
  vx: number;
  vy: number;
  radius: number;
  angle: number;
  angularVelocity: number;
  hp: number;
  mass?: number;
  cooldown: number;
  hazardCooldowns: Record<string, number>;
  weaponCooldown: number;
  weaponWorldCooldown: number;
  fireCooldown: number;
  stunned: number;
  frozen: boolean;
  flash: number;
  powerScale: number;
  hits: number;
  incoming: number;
  burn: number;
  burnStacks: number;
  wallBoost: number;
  wallCrash: WallCrash | null;
  visualStates: Record<string,number>;
  voltCharge?: number;
  armorPlates?: number;
  armorRepair?: number;
  mintRest?: number;
  goldStacks?: number;
  bubbleShield?: boolean;
  bubbleRecharge?: number;
  sporeMeter?: number;
  phaseFrames?: number;
  frostFrozenUntil?: number;
  orbitCooldown?: number;
};

export type CombatEvent = {
  force: number;
  damage: number;
  dt?: number;
  weapon?: boolean;
  projectile?: boolean;
  echo?: boolean;
  ability?: boolean;
  unblockable?: boolean;
  voltRelease?: number;
  bubblePop?: boolean;
  jackpot?: boolean;
  phaseStrike?: boolean;
  iceShatter?: boolean;
  ignite?: boolean;
  blockedDamage?: number;
  rookBlock?: boolean;
  staticBurst?: boolean;
};

export type Echo = { attacker: Ball; victim: Ball; frames: number; damage: number };
export type Projectile = Point & {
  shooter: Ball;
  side: Side;
  previousX: number;
  previousY: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  force: number;
  life: number;
  color: string;
  type: RangedWeapon['type'];
  dead: boolean;
};

export type Particle = Point & {
  vx: number;
  vy: number;
  life: number;
  color: string;
  gravity?: number;
  rotation?: number;
  spin?: number;
  stroke?: string|null;
  kind?: string;
  size?: number;
};

export type Exchange = {
  tick: number;
  source: string;
  before: Record<Side, number>;
  after: Record<Side, number>;
  damageTaken: Record<Side, number>;
};

export type Simulation = {
  balls: Ball[];
  projectiles: Projectile[];
  rng: RandomSource;
  ticks: number;
  hitStop: number;
  echoes: Echo[];
  hazards: Hazard[];
  lastExchange: Exchange | null;
  width: number;
  height: number;
  particles: Particle[];
  impactPopups: ImpactPopup[];
  visualRng: RandomSource;
  finished: boolean;
  events: Record<string, number>;
};

export type ImpactPopup = Point & { word: string; born: number; size: number; rotation: number; color: string };
export type Bout = { left: Fighter; right: Fighter; hazards: Hazard[]; seed: number; outcome?: 'win' | 'loss' };

export type Outcome = {
  winner: Winner;
  mutualKo: boolean;
  decidedBy: 'knockout' | 'overkillHp' | 'finalDamage' | 'kineticEnergy' | 'landedHits' | 'deadHeat';
  exchange?: Exchange | null;
  leftHp?: number;
  rightHp?: number;
  hpMargin?: number;
  leftEnergy?: number;
  rightEnergy?: number;
};

export type WeaponHit = {
  attacker: Ball;
  victim: Ball;
  damage: number;
  force: number;
  impulseX: number;
  impulseY: number;
  redirect: { x: number; y: number; minimumSpeed: number; speedMultiplier: number } | null;
  label: string;
};

export type ProjectileHit = { projectile: Projectile; target: Ball; x: number; y: number };

export type BalanceSummary = {
  wins:number;losses:number;draws:number;games:number;score:number;winRate:number;drawRate:number;
  averageSeconds:number;averageRemainingHp:number;averageOpponentHp:number;
};
export type BalanceMatch = BalanceSummary&{asLeft:BalanceSummary;asRight:BalanceSummary};
export type BalanceRanking = { id:string;name:string;tier:string;wins:number;losses:number;draws:number;games:number;score:number;asLeft:BalanceSummary;asRight:BalanceSummary };
export type BalanceReport = {
  method:{totalSimulations:number;seedsPerSide:number};
  rankings:BalanceRanking[];
  matrix:Record<string,Record<string,BalanceMatch|null>>;
};

export type ParticleOptions = { count?:number;color?:string;speed?:number;gravity?:number;kind?:string;size?:number };
export type BehaviorContext = {
  ball: Ball;
  rival: Ball;
  sim: Simulation;
  event: CombatEvent;
  random: RandomSource;
  showImpact: (word:string,origin:Point|Ball)=>void;
  emitParticles: (origin:Point|Ball,options?:ParticleOptions)=>void;
  audioTone: (frequency:number,duration:number,type?:OscillatorType,volume?:number)=>void;
  audioHit: (power:number)=>void;
  playSound: (cue:SoundCue,options?:SoundCueOptions)=>void;
  ctx: CanvasRenderingContext2D;
};

export type BehaviorHook = 'wallHit'|'modifyOutgoing'|'dealHit'|'draw'|'tick'|'modifyIncoming'|'takeHit'|'beforeMove'|'drawBack';
export type Behavior = Partial<Record<BehaviorHook,(context:BehaviorContext)=>void>>;
