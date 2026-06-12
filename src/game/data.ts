// Unit roster and terrain glossary, straight from Rules.docx (Appendix 1 & 2).

export type Faction = 'a' | 'b';
export const other = (f: Faction): Faction => (f === 'a' ? 'b' : 'a');

export type UnitType =
  | 'archer'
  | 'swordsman'
  | 'planeswalker'
  | 'catapult'
  | 'defender'
  | 'barbarian'
  | 'mountedarcher'
  | 'healer'
  | 'translocator';

export interface UnitStats {
  name: string;
  cost: number;
  move: number;
  life: number;
  /** null = "n/a": cannot attack and cannot shift mana sources. */
  atk: number | null;
  def: number;
  rng: number;
  /** Catapult only: cannot attack closer than this. */
  minRng?: number;
  /** Catapult only: automatic damage to units adjacent to the target hex. */
  splash?: number;
  /** Barbarian attacks twice. */
  attacksPerTurn?: number;
  /** Mounted archer can split its movement around an attack ("shot on the run"). */
  moveActsPerTurn?: number;
  special: string;
  spLabel: string;
}

export const STATS: Record<UnitType, UnitStats> = {
  healer: {
    name: 'Healer', cost: 4, move: 8, life: 6, atk: null, def: 1, rng: 3,
    special: 'mend or wound — 1 life per ✦1, as many as you can pay (attack-equivalent)',
    spLabel: 'mend · wound',
  },
  translocator: {
    name: 'Translocator', cost: 4, move: 4, life: 6, atk: null, def: 1, rng: 2,
    special: 'translocate an adjacent ally within range, or banish a foe to its portal — ✦ half the unit’s cost',
    spLabel: 'translocate · banish',
  },
  archer: {
    name: 'Archer', cost: 8, move: 6, life: 7, atk: 5, def: 1, rng: 5,
    special: '+1 range per ✦1 spent on the shot',
    spLabel: 'long shot',
  },
  swordsman: {
    name: 'Swordsman', cost: 8, move: 6, life: 10, atk: 5, def: 2, rng: 1,
    special: '+1 move per ✦1 spent on the march',
    spLabel: 'forced march',
  },
  planeswalker: {
    name: 'Planeswalker', cost: 8, move: 12, life: 8, atk: 2, def: 0, rng: 1,
    special: 'planeswalk — ✦1 per hex, freely over water and any elevation',
    spLabel: 'planeswalk',
  },
  defender: {
    name: 'Defender', cost: 10, move: 6, life: 5, atk: 0, def: 2, rng: 1,
    special: '+2 DEF to friendly units in adjacent hexes (bonuses don’t stack)',
    spLabel: 'guard',
  },
  barbarian: {
    name: 'Barbarian', cost: 12, move: 8, life: 12, atk: 5, def: 0, rng: 1,
    attacksPerTurn: 2,
    special: 'attacks twice each turn',
    spLabel: 'frenzy',
  },
  mountedarcher: {
    name: 'Mounted Archer', cost: 12, move: 10, life: 8, atk: 6, def: 0, rng: 4,
    moveActsPerTurn: 2,
    special: 'shot on the run — may split its move around an attack',
    spLabel: 'shot on the run',
  },
  catapult: {
    name: 'Catapult', cost: 12, move: 3, life: 4, atk: 7, def: 2, rng: 10,
    minRng: 5, splash: 1,
    special: 'min range 5 · splash 1 auto-damage to every unit beside the target hex',
    spLabel: 'siege · splash',
  },
};

export const UNIT_ORDER: UnitType[] = [
  'healer', 'translocator', 'archer', 'swordsman', 'planeswalker',
  'defender', 'barbarian', 'mountedarcher', 'catapult',
];

export const halfCost = (t: UnitType): number => Math.ceil(STATS[t].cost / 2);

/* ---- terrain (Appendix 2) ---- */

export type Terrain =
  | 'grass' | 'water' | 'sand' | 'forest'
  | 'source' | 'portal' | 'bridge' | 'ramp'
  | 'mountain';

/** Elevation grade: 1 low, 2 mid, 3 high. Move/melee allowed across ≤1 grade. */
export const GRADE: Record<Terrain, 1 | 2 | 3> = {
  grass: 1, water: 1, sand: 1, forest: 1,
  source: 2, portal: 2, bridge: 2, ramp: 2,
  mountain: 3,
};

/** Can a unit stand on / move through this terrain? */
export const PASSABLE: Record<Terrain, boolean> = {
  grass: true, water: false, sand: true, forest: true,
  source: false, portal: true, bridge: true, ramp: true,
  mountain: true,
};

/** Stacking order for the painted tiles (water sits lowest). */
export const ZLAYER: Record<Terrain, number> = {
  water: 0, grass: 1, sand: 1, forest: 1,
  source: 2, portal: 2, bridge: 2, ramp: 2,
  mountain: 3,
};
