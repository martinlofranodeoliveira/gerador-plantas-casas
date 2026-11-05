/** Bounded raster size and conservative sphere-in-frustum camera framing. */
export function pngSize(width, depth) {
  const ratio = (width + 4) / (depth + 5.4);
  let w = ratio >= 1 ? 2200 : 2200 * ratio, h = ratio >= 1 ? 2200 / ratio : 2200;
  const factor = Math.min(1, Math.sqrt(4_000_000 / (w * h)));
  // Both dimensions round down, so the continuous pixel budget cannot grow.
  w = Math.max(1, Math.floor(w * factor)); h = Math.max(1, Math.floor(h * factor));
  return { width: w, height: h };
}
export function frameDimensions(width, depth, height, aspect, verticalFov = 42) {
  const halfV = verticalFov * Math.PI / 360, halfH = Math.atan(Math.tan(halfV) * aspect);
  const radius = Math.hypot(width + .3, depth + 1.6, height + .2) / 2;
  const distance = radius / Math.sin(Math.min(halfV, halfH)) * 1.12;
  return { distance, radius, maxDistance: distance * 3, far: Math.max(500, distance * 5) };
}
