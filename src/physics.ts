// Deterministic, fixed-step 2D collision primitives.
// Base motion has no acceleration, drag, friction, gravity, or steering.
export function resolveElasticCollision(a: Ball, b: Ball): { relativeNormalSpeed: number } | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy);
  const minimum = a.radius + b.radius;
  if (distance >= minimum || distance === 0) return null;

  const nx = dx / distance;
  const ny = dy / distance;
  const massA = a.mass ?? a.f.mass;
  const massB = b.mass ?? b.f.mass;
  const invA = 1 / massA;
  const invB = 1 / massB;
  const invSum = invA + invB;

  // Remove overlap without favoring the heavier body.
  const correction = (minimum - distance) / invSum;
  a.x -= nx * correction * invA;
  a.y -= ny * correction * invA;
  b.x += nx * correction * invB;
  b.y += ny * correction * invB;

  const relativeNormalSpeed = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (relativeNormalSpeed >= 0) return null;

  // Restitution 1.0 conserves linear momentum and kinetic energy.
  const impulse = (-2 * relativeNormalSpeed) / invSum;
  a.vx -= impulse * nx * invA;
  a.vy -= impulse * ny * invA;
  b.vx += impulse * nx * invB;
  b.vy += impulse * ny * invB;
  return { relativeNormalSpeed };
}
import type { Ball } from './types';
