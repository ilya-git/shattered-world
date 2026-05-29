// Pure, deterministic game rules. Both peers run identical logic on identical
// state, so we only need to send the move that was made — never the whole
// board. Keep this module free of rendering and networking concerns.

export const GRID_W = 9;
export const GRID_H = 9;
export const EMPTY = -1;

export type Player = 0 | 1;

export interface GameState {
  grid: Int8Array; // length GRID_W * GRID_H; each cell is EMPTY | 0 | 1
  current: Player;
  over: boolean;
}

export function idx(x: number, y: number): number {
  return y * GRID_W + x;
}

export function createInitialState(): GameState {
  const grid = new Int8Array(GRID_W * GRID_H).fill(EMPTY);
  grid[idx(0, 0)] = 0; // host (player 0) starts top-left
  grid[idx(GRID_W - 1, GRID_H - 1)] = 1; // guest (player 1) starts bottom-right
  return { grid, current: 0, over: false };
}

const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function ownsAdjacent(state: GameState, x: number, y: number, player: Player): boolean {
  for (const [dx, dy] of NEIGHBORS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue;
    if (state.grid[idx(nx, ny)] === player) return true;
  }
  return false;
}

export function isValidMove(state: GameState, x: number, y: number, player: Player): boolean {
  if (state.over) return false;
  if (player !== state.current) return false;
  if (state.grid[idx(x, y)] !== EMPTY) return false;
  return ownsAdjacent(state, x, y, player);
}

function hasAnyMove(state: GameState, player: Player): boolean {
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      if (state.grid[idx(x, y)] === EMPTY && ownsAdjacent(state, x, y, player)) return true;
    }
  }
  return false;
}

// Apply a move and advance the turn, skipping a player who has no legal move.
// Returns true if the move was applied. Mutates `state` in place.
export function applyMove(state: GameState, x: number, y: number, player: Player): boolean {
  if (!isValidMove(state, x, y, player)) return false;
  state.grid[idx(x, y)] = player;

  const other: Player = player === 0 ? 1 : 0;
  if (hasAnyMove(state, other)) {
    state.current = other;
  } else if (hasAnyMove(state, player)) {
    state.current = player; // opponent is stuck, same player moves again
  } else {
    state.over = true; // neither side can move
  }
  return true;
}

export function score(state: GameState): [number, number] {
  let a = 0;
  let b = 0;
  for (let i = 0; i < state.grid.length; i++) {
    if (state.grid[i] === 0) a++;
    else if (state.grid[i] === 1) b++;
  }
  return [a, b];
}
