const RADIANS = Math.PI / 180;
const DEGREES = 180 / Math.PI;
const PHI0 = 29.5 * RADIANS;
const PHI1 = 45.5 * RADIANS;
const N = (Math.sin(PHI0) + Math.sin(PHI1)) / 2;
const C = 1 + Math.sin(PHI0) * (2 * N - Math.sin(PHI0));
const R0 = Math.sqrt(C) / N;

export function projectAlbersUsa(longitude, latitude) {
  if (longitude < -130 || longitude > -60 || latitude < 20 || latitude > 52) return null;
  const point = albersRaw((longitude + 96) * RADIANS, latitude * RADIANS);
  const center = albersRaw(-.6 * RADIANS, 38.7 * RADIANS);
  return [480 + 1070 * (point[0] - center[0]), 250 - 1070 * (point[1] - center[1])];
}

export function invertAlbersUsa(x, y) {
  const center = albersRaw(-.6 * RADIANS, 38.7 * RADIANS);
  const rawX = (x - 480) / 1070 + center[0];
  const rawY = (250 - y) / 1070 + center[1];
  const r0y = R0 - rawY;
  let lambda = Math.atan2(rawX, Math.abs(r0y)) * Math.sign(r0y || 1);
  if (r0y * N < 0) lambda -= Math.PI * Math.sign(rawX) * Math.sign(r0y);
  const latitude = Math.asin((C - (rawX * rawX + r0y * r0y) * N * N) / (2 * N));
  return [lambda / N * DEGREES - 96, latitude * DEGREES];
}

export function projectMercator(longitude, latitude) {
  const phi = Math.max(-89.5, Math.min(89.5, latitude)) * RADIANS;
  return [480 + 150 * longitude * RADIANS, 250 - 150 * Math.log(Math.tan((Math.PI / 2 + phi) / 2))];
}

export function invertMercator(x, y) {
  return [
    (x - 480) / 150 * DEGREES,
    (2 * Math.atan(Math.exp((250 - y) / 150)) - Math.PI / 2) * DEGREES
  ];
}

function albersRaw(lambda, phi) {
  const radius = Math.sqrt(C - 2 * N * Math.sin(phi)) / N;
  return [radius * Math.sin(lambda * N), R0 - radius * Math.cos(lambda * N)];
}

