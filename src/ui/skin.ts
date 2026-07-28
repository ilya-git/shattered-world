// Visual skin: 'wash' — the original ink-&-watercolor parchment look;
// 'pix' — retro pixel art (Hex Loom terrain tiles + hand-drawn sprites in a
// Warlords / HoMM2 spirit). Purely cosmetic: nothing here may touch the
// rules engine or the actions that go over the wire.

import { useSyncExternalStore } from 'react';

export type Skin = 'wash' | 'pix';

const KEY = 'sw-skin';

let skin: Skin = 'wash';
try {
  if (localStorage.getItem(KEY) === 'pix') skin = 'pix';
} catch {
  /* storage unavailable (private mode etc.) — default stands */
}

const subs = new Set<() => void>();

export const getSkin = (): Skin => skin;

export function setSkin(s: Skin): void {
  skin = s;
  try {
    localStorage.setItem(KEY, s);
  } catch {
    /* non-fatal */
  }
  subs.forEach((f) => f());
}

export function useSkin(): Skin {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    getSkin,
  );
}
