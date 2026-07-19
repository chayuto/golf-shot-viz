/**
 * Playback timing reconstruction.
 *
 * Launch monitor trajectories carry no per-point timestamps, but two
 * measured anchors exist: ball speed at launch and total hang time.
 * Model the speed along the path as v(t) = v0 * e^(-kt) and solve k so
 * the distance integral over the hang time equals the path length.
 * Fast off the face, slowing into the descent.
 */

export interface Timeline {
  /** Flight duration in seconds. */
  duration: number
  /** Arc-length fraction [0,1] of the path covered at time t. */
  progressAt(t: number): number
}

/**
 * Solve k in (v0/k)(1 - e^(-kT)) = L by bisection.
 * Returns null when no decaying profile fits (v0*T <= L).
 */
export function solveDecayRate(v0: number, T: number, L: number): number | null {
  if (!(v0 > 0) || !(T > 0) || !(L > 0)) return null
  if (v0 * T <= L * 1.001) return null
  const dist = (k: number) => (v0 / k) * (1 - Math.exp(-k * T))
  let lo = 1e-6
  let hi = 1
  while (dist(hi) > L) {
    hi *= 2
    if (hi > 1e4) return null
  }
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (dist(mid) > L) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Rough hang time for shots missing the measurement. */
export function estimateHangTime(pathLength: number): number {
  return Math.min(7, Math.max(2, 1.5 + pathLength / 40))
}

/** Fallback profile: constant speed with a mild deceleration. */
const EASE_DECEL = 0.35

export function buildTimeline(
  pathLength: number,
  meta?: { ballSpeed?: number; hangTime?: number },
): Timeline {
  const T = meta?.hangTime && meta.hangTime > 0 ? meta.hangTime : estimateHangTime(pathLength)
  const v0 = meta?.ballSpeed
  const k = v0 !== undefined ? solveDecayRate(v0, T, pathLength) : null

  const profile =
    k !== null && v0 !== undefined
      ? (t: number) => clamp01(((v0 / k) * (1 - Math.exp(-k * t))) / pathLength)
      : (t: number) => {
          const x = clamp01(t / T)
          return clamp01(x * (1 + EASE_DECEL * (1 - x)))
        }

  return {
    duration: T,
    progressAt: (t) => (t <= 0 ? 0 : t >= T ? 1 : profile(t)),
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}
