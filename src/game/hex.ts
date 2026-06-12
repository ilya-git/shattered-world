// Axial hex-grid math. Pointy math is flat-top (matches the design's
// clip-path polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)).

export interface Hex {
  q: number;
  r: number;
}

export const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

export const hexKey = (q: number, r: number): string => q + ',' + r;
export const keyOf = (h: Hex): string => hexKey(h.q, h.r);

export function hexDist(a: Hex, b: Hex): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
}

export function neighbors(h: Hex): Hex[] {
  return DIRS.map(([dq, dr]) => ({ q: h.q + dq, r: h.r + dr }));
}
