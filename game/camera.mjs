// Camera collision for the cinematic/demo director. Given the followed actor's
// head, the camera position and the distance at which scenery first blocks the
// line back from the head, return a camera position pulled in front of that
// obstruction (and re-aimed at the head). Null means no adjustment is needed.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function clearCameraPosition(head, camera, blockDistance, options = {}) {
  if (!head || !camera) return null;
  const margin = Number.isFinite(options.margin) ? options.margin : .4;
  const min = Number.isFinite(options.min) ? options.min : 1.3;
  const dx = Number(head.x || 0) - Number(camera.x || 0);
  const dy = Number(head.y || 0) - Number(camera.y || 0);
  const dz = Number(head.z || 0) - Number(camera.z || 0);
  const dist = Math.hypot(dx, dy, dz);
  if (!(dist > min)) return null;
  const block = Number(blockDistance);
  if (!Number.isFinite(block) || block >= dist - .35) return null;
  const want = Math.max(min, block - margin);
  const ux = dx / dist, uy = dy / dist, uz = dz / dist;
  return {
    x: (head.x || 0) - ux * want,
    y: (head.y || 0) - uy * want,
    z: (head.z || 0) - uz * want,
    yaw: Math.atan2(-dx, -dz),
    pitch: clamp(Math.asin(clamp(uy, -1, 1)), -1.45, 1.45),
    distance: want,
  };
}
