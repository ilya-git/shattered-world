// The battlefield: a radius-4 hex island, 180°-rotation symmetric so neither
// player gets an advantage (as the rules recommend). 9 mana sources scattered
// evenly, summoning portals by opposite edges, mountains guarded by ramps,
// lakes with bridges. "Before the Start" in Rules.docx.

import { hexKey, type Hex } from './hex';
import type { Terrain } from './data';

export const MAP_RADIUS = 4;

function inBoard(q: number, r: number): boolean {
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= MAP_RADIUS;
}

/** Portal clusters: summoning happens onto a free portal hex. */
export const PORTALS: Record<'a' | 'b', Hex[]> = {
  a: [{ q: -4, r: 1 }, { q: -4, r: 2 }, { q: -4, r: 3 }],
  b: [{ q: 4, r: -1 }, { q: 4, r: -2 }, { q: 4, r: -3 }],
};

/** 9 mana sources, neutral at the start. */
export const SOURCE_HEXES: Hex[] = [
  { q: 0, r: 0 },
  { q: 0, r: -3 }, { q: 0, r: 3 },
  { q: 3, r: -3 }, { q: -3, r: 3 },
  { q: 2, r: -1 }, { q: -2, r: 1 },
  { q: 2, r: 2 }, { q: -2, r: -2 },
];

const PLACED: Array<[number, number, Terrain]> = [
  // mountains (high ground), each cluster reachable only over its ramp
  [1, -4, 'mountain'], [2, -4, 'mountain'], [-1, 4, 'mountain'], [-2, 4, 'mountain'],
  [1, -3, 'ramp'], [-1, 3, 'ramp'],
  // lakes with a bridge across
  [-2, 0, 'water'], [-1, -1, 'water'], [2, 0, 'water'], [1, 1, 'water'],
  [-2, -1, 'bridge'], [2, 1, 'bridge'],
  // dunes by the east / west rims
  [4, 0, 'sand'], [3, 1, 'sand'], [-4, 0, 'sand'], [-3, -1, 'sand'],
  // rainforest near the heart
  [1, -1, 'forest'], [2, -2, 'forest'], [-1, 1, 'forest'], [-2, 2, 'forest'],
];

function buildTerrain(): Map<string, Terrain> {
  const t = new Map<string, Terrain>();
  for (let q = -MAP_RADIUS; q <= MAP_RADIUS; q++) {
    for (let r = -MAP_RADIUS; r <= MAP_RADIUS; r++) {
      if (inBoard(q, r)) t.set(hexKey(q, r), 'grass');
    }
  }
  for (const [q, r, terr] of PLACED) t.set(hexKey(q, r), terr);
  for (const s of SOURCE_HEXES) t.set(hexKey(s.q, s.r), 'source');
  for (const f of ['a', 'b'] as const) {
    for (const p of PORTALS[f]) t.set(hexKey(p.q, p.r), 'portal');
  }
  return t;
}

/** hex key -> terrain for every hex on the board. */
export const TERRAIN_AT: ReadonlyMap<string, Terrain> = buildTerrain();

export const ALL_HEXES: ReadonlyArray<Hex & { t: Terrain }> = [...TERRAIN_AT.entries()].map(
  ([k, t]) => {
    const [q, r] = k.split(',').map(Number);
    return { q, r, t };
  },
);

export const ON_BOARD = (q: number, r: number): boolean => TERRAIN_AT.has(hexKey(q, r));

export const portalFaction = (q: number, r: number): 'a' | 'b' | null => {
  for (const f of ['a', 'b'] as const) {
    if (PORTALS[f].some((p) => p.q === q && p.r === r)) return f;
  }
  return null;
};
