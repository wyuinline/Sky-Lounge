/**
 * Dock magnification.
 *
 * The maths behind the row of tiles that swells around the cursor. Kept
 * separate from the DOM so the curve can be tested: the component around it is
 * a pointer listener and a requestAnimationFrame, and neither of those is where
 * the behaviour lives.
 */

/** Peak scale increase directly under the cursor. */
export const MAX_SCALE = 0.18;
/** How far the bulge reaches, in multiples of a tile's width. */
export const REACH = 1.35;
/** Peak lift under the cursor, in pixels. */
export const MAX_LIFT = 10;
/** Steepness of the gaussian shoulder. */
const SHARPNESS = 2.2;

/**
 * How strongly a tile responds, from 1 directly under the cursor to ~0 far
 * away.
 *
 * Gaussian rather than linear or conical: a straight falloff makes tiles
 * visibly change direction as the cursor crosses between them, and the whole
 * point of the effect is that the row moves like one surface.
 */
export function dockFalloff(distance: number, reach: number): number {
  if (!(reach > 0)) return 0;
  return Math.exp(-((distance / reach) ** 2) * SHARPNESS);
}

export type DockTransform = { scale: number; lift: number; raised: boolean };

/** The transform for one tile, given its distance from the cursor. */
export function dockTransform(distance: number, tileWidth: number): DockTransform {
  const falloff = dockFalloff(distance, tileWidth * REACH);
  return {
    scale: 1 + MAX_SCALE * falloff,
    lift: MAX_LIFT * falloff,
    // Only tiles genuinely under the bulge come forward, so the row does not
    // churn its stacking order as the cursor moves.
    raised: falloff > 0.5,
  };
}

/** The resting transform, used when the cursor leaves the row. */
export const DOCK_REST: DockTransform = { scale: 1, lift: 0, raised: false };
