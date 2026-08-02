// Local save slot: the battle in progress, mirrored to localStorage after
// every state change so a closed tab or a reload doesn't lose the game.
//
// The whole GameState is stored, not a seed plus a replay: it is plain data
// (the RNG is a single number), and it is exactly what a resuming host has
// to hand the guest for both peers to be in lockstep again.

import type { GameState } from './game/engine';
import { MAPS } from './game/maps';

const KEY = 'sw-save';
const VERSION = 1;

export interface SavedGame {
  v: number;
  savedAt: number;
  /** true if the save came from a two-players-one-screen game */
  hotseat: boolean;
  state: GameState;
}

/** Enough of a shape check that a stale or hand-edited slot can't crash us. */
function looksValid(s: unknown): s is SavedGame {
  const v = s as SavedGame | null;
  return (
    !!v && v.v === VERSION && typeof v.savedAt === 'number' &&
    !!v.state && Array.isArray(v.state.units) && Array.isArray(v.state.log) &&
    typeof v.state.rng === 'number' && typeof v.state.turnNum === 'number' &&
    (v.state.turn === 'a' || v.state.turn === 'b') &&
    !!MAPS[v.state.mapId] &&
    !v.state.winner && !v.state.draw
  );
}

export function loadSave(): SavedGame | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null; // storage unavailable (private mode, blocked cookies)
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!looksValid(parsed)) {
      clearSave();
      return null;
    }
    return parsed;
  } catch {
    clearSave();
    return null;
  }
}

export function saveGame(state: GameState, hotseat: boolean): void {
  try {
    const payload: SavedGame = { v: VERSION, savedAt: Date.now(), hotseat, state };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* quota or unavailable storage — playing on is more important */
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}
