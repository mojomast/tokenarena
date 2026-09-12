// Shared, three.js-free rules for next-gen structure geometry so the level
// generator (collision) and the renderer (smooth geometry) agree on where a
// cavern's entrances are and how tall its shell is.

export const CAVERN_SEGMENTS = 16;

// Two opposite entrances: the first two of every eight wall segments are open.
export const cavernOpening = i => i % 8 < 2;

// Angular arcs for the solid wall ring between the entrances, in radians.
export function cavernArcs(segments = CAVERN_SEGMENTS) {
  const span = (Math.PI * 2) / segments;
  const arcs = [];
  let start = null;
  for (let i = 0; i <= segments; i++) {
    const include = i < segments && !cavernOpening(i);
    if (include && start === null) start = i;
    if (!include && start !== null) { arcs.push({ thetaStart: (start - .5) * span, thetaLength: (i - start) * span }); start = null; }
  }
  return arcs;
}

// Convert the collision-space arc ranges into three.js CylinderGeometry theta
// ranges. Collision places a wall segment at (cos a, sin a), while a cylinder
// vertex at theta sits at (sin theta, cos theta), so theta = PI/2 - a. Without
// this conversion the visible openings land on solid collision segments.
export function cavernRenderArcs(segments = CAVERN_SEGMENTS) {
  return cavernArcs(segments).map(({ thetaStart, thetaLength }) => ({
    thetaStart: Math.PI / 2 - (thetaStart + thetaLength),
    thetaLength,
  }));
}

// A cavern is a low stone drum with a domed roof, open at two opposite points.
export function cavernShell(radius = 12, height = 8, segments = CAVERN_SEGMENTS) {
  const r = Math.max(1, Number(radius) || 12), h = Math.max(1, Number(height) || 8);
  return { radius: r, wallHeight: h * .52, domeHeight: h * .66, arcs: cavernArcs(segments), renderArcs: cavernRenderArcs(segments) };
}
