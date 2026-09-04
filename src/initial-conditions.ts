import type { Ball, Fighter, RandomSource, Side } from './types';

const W=720,H=720;

// Shared by the browser and headless balance runner. Directions are seeded but
// constrained to an inward-facing 130° cone so bouts still engage quickly.
export function createInitialBall(fighter:Fighter,side:Side,random:RandomSource):Ball{
  const verticalOffset=(random()-.5)*70;
  const speed=(570+random()*160)*fighter.speed;
  const directionOffset=(random()-.5)*(Math.PI*13/18);
  const direction=(side==='left'?0:Math.PI)+directionOffset;
  const naturalSpin=(.8+random()*1.4)*(random()<.5?-1:1);
  return {
    f:fighter,side,x:side==='left'?165:W-165,y:H/2+verticalOffset,
    vx:Math.cos(direction)*speed,vy:Math.sin(direction)*speed,
    radius:64*(fighter.radiusScale??fighter.mass),angle:side==='left'?0:Math.PI,
    angularVelocity:fighter.weapon?.angularSpeed??naturalSpin,
    hp:100,cooldown:0,hazardCooldowns:{},weaponCooldown:0,weaponWorldCooldown:0,fireCooldown:fighter.weapon?.projectile?Math.floor(random()*fighter.weapon.fireInterval):0,stunned:0,
    // Fighter power is a fixed roster stat. The seed varies the opening motion,
    // facing, spin, and ability timing, but never silently rerolls damage.
    frozen:false,flash:0,powerScale:1,hits:0,incoming:0,burn:0,burnStacks:0,poisonStacks:0,poisonTick:0,wallBoost:1,wallCrash:null,visualStates:{},
  };
}
