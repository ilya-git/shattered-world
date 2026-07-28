// Regenerates every asset of the "pix" skin (run with tsx; no image deps):
//
//   drawn here  →  public/pix/tex/*.png
//     57x67 hex tiles drawn procedurally in the HoMM2/3 spirit: flat
//     muted base colors with light mottling and one sparse motif each
//     (peak, trees, waves, steps …) so the terrain reads at a glance and
//     stays quieter than the unit sprites. Summoning portals and mana
//     sources are the deliberate exceptions — brighter, glowing, meant
//     to stand out. A soft gradient border is baked along the hex edge;
//     everything is upscaled x4 nearest-neighbor.
//
//   drawn here  →  public/pix/units/<unit>-<faction>.png
//     24x24 full-figure sprites in the Warlords / HoMM2 spirit, auto
//     black outline, upscaled x4. Faction elements (tabards, shields,
//     plumes, sashes) use placeholder colors swapped per faction; the
//     'b' (Crimson) variant is also mirrored so armies face each other.
//
//   drawn here  →  public/pix/ui/panel.png (parchment tile)

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ================= minimal PNG encoder (RGBA8) ================= */

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return ~c;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  out.set([...type].map((ch) => ch.charCodeAt(0)), 4);
  out.set(data, 8);
  dv.setInt32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
function pngEncode(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width); dv.setUint32(4, height);
  ihdr[8] = 8; ihdr[9] = 6;
  const raw = new Uint8Array(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (1 + width * 4) + 1);
  }
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, chunk('IHDR', ihdr), chunk('IDAT', new Uint8Array(deflateSync(raw))), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
function upscale(rgba: Uint8Array, w: number, h: number, k: number): Uint8Array {
  const out = new Uint8Array(w * k * h * k * 4);
  for (let y = 0; y < h * k; y++) {
    for (let x = 0; x < w * k; x++) {
      const si = (((y / k) | 0) * w + ((x / k) | 0)) * 4;
      out.set(rgba.subarray(si, si + 4), (y * w * k + x) * 4);
    }
  }
  return out;
}

/* ================= terrain tiles (drawn, HoMM2/3-inspired) ================= */

const TW = 57, TH = 67;

/** distance (px, approx) from a point to the edge of the pointy-top hex inscribed in w x h */
function hexEdgeDist(px: number, py: number, w: number, h: number): number {
  const x = Math.abs(px - (w - 1) / 2);
  const y = Math.abs(py - (h - 1) / 2);
  const A = w / 2;
  const dRight = A - x;
  // slanted edge from (A, h/4) to (0, h/2):  (h/4)x + A y - A h/2 = 0
  const dSlant = (A * h / 2 - (h / 4) * x - A * y) / Math.hypot(h / 4, A);
  return Math.min(dRight, dSlant);
}

type RGB = [number, number, number];

/** hex-masked painter with a deterministic RNG per tile */
class TilePainter {
  buf: Float64Array;
  private seed: number;
  constructor(base: RGB, seed: number) {
    this.seed = seed;
    this.buf = new Float64Array(TW * TH * 3);
    for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) this.force(x, y, base);
  }
  rnd(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }
  inside(x: number, y: number): boolean { return hexEdgeDist(x, y, TW, TH) >= 0; }
  private force(x: number, y: number, c: RGB): void {
    const i = (y * TW + x) * 3;
    this.buf[i] = c[0]; this.buf[i + 1] = c[1]; this.buf[i + 2] = c[2];
  }
  set(x: number, y: number, c: RGB): void {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && x < TW && y >= 0 && y < TH && this.inside(x, y)) this.force(x, y, c);
  }
  blob(cx: number, cy: number, r: number, c: RGB): void {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.set(x, y, c);
  }
  /** sparse soft mottling: n blobs of radius 2-4 in the given shades */
  mottle(n: number, shades: RGB[]): void {
    for (let i = 0; i < n; i++) {
      this.blob(3 + this.rnd() * (TW - 6), 3 + this.rnd() * (TH - 6), 2 + this.rnd() * 2, shades[i % shades.length]);
    }
  }
  hseg(x: number, y: number, len: number, c: RGB): void {
    for (let i = 0; i < len; i++) this.set(x + i, y, c);
  }
  /** blend every pixel within r of (cx,cy) toward c, fading with distance */
  glow(cx: number, cy: number, r: number, c: RGB, strength: number): void {
    for (let y = 0; y < TH; y++) {
      for (let x = 0; x < TW; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > r || !this.inside(x, y)) continue;
        const t = strength * (1 - d / r);
        const i = (y * TW + x) * 3;
        this.buf[i] += (c[0] - this.buf[i]) * t;
        this.buf[i + 1] += (c[1] - this.buf[i + 1]) * t;
        this.buf[i + 2] += (c[2] - this.buf[i + 2]) * t;
      }
    }
  }
  /** filled triangle (for peaks) */
  tri(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, c: RGB): void {
    const minX = Math.floor(Math.min(ax, bx, cx)), maxX = Math.ceil(Math.max(ax, bx, cx));
    const minY = Math.floor(Math.min(ay, by, cy)), maxY = Math.ceil(Math.max(ay, by, cy));
    const sign = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) =>
      (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const d1 = sign(x, y, ax, ay, bx, by), d2 = sign(x, y, bx, by, cx, cy), d3 = sign(x, y, cx, cy, ax, ay);
        if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) this.set(x, y, c);
      }
    }
  }
}

/* muted terrain shades — deliberately dimmer than the unit sprites */
const T = {
  grass: { base: [113, 148, 90] as RGB, lo: [101, 134, 80] as RGB, hi: [124, 159, 100] as RGB, tuft: [88, 119, 70] as RGB },
  water: { base: [88, 118, 148] as RGB, lo: [74, 102, 132] as RGB, hi: [110, 140, 168] as RGB },
  sand: { base: [204, 181, 132] as RGB, lo: [189, 166, 117] as RGB, hi: [215, 193, 146] as RGB },
  wood: { mid: [148, 111, 68] as RGB, lo: [110, 78, 44] as RGB, hi: [170, 133, 88] as RGB },
  rock: { base: [143, 135, 123] as RGB, lo: [113, 105, 94] as RGB, hi: [166, 158, 146] as RGB, snow: [220, 220, 216] as RGB },
  des: { base: [193, 157, 110] as RGB, lo: [163, 125, 82] as RGB, hi: [209, 176, 130] as RGB, shadow: [140, 104, 66] as RGB },
};

/** plank band across the tile along the unit direction (ux,uy) */
function bridgeArt(ux: number, uy: number): TilePainter {
  const p = TILE_PAINTERS.water();
  const cx = (TW - 1) / 2, cy = (TH - 1) / 2;
  for (let y = 0; y < TH; y++) {
    for (let x = 0; x < TW; x++) {
      const rx = x - cx, ry = y - cy;
      const along = rx * ux + ry * uy;
      const across = Math.abs(rx * -uy + ry * ux);
      if (across > 9) continue;
      if (across > 7.6) { p.set(x, y, T.wood.lo); continue; }
      const plank = Math.floor((along + 100) / 7) % 2 === 0;
      p.set(x, y, Math.abs((along + 100) % 7) < 1 ? T.wood.lo : plank ? T.wood.mid : T.wood.hi);
    }
  }
  return p;
}

/**
 * A stair channel cut through rock, ascending toward the -u end: steps get
 * brighter as they climb and end on a light summit landing, so the change
 * of elevation reads directly from the tile.
 */
function rampArt(ux: number, uy: number, seed: number): TilePainter {
  const p = new TilePainter(T.rock.base, seed);
  p.mottle(12, [T.rock.hi, T.rock.lo]);
  const cx = (TW - 1) / 2, cy = (TH - 1) / 2;
  const lerp = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const lo: RGB = [126, 116, 100], hi: RGB = [196, 189, 176];
  for (let y = 0; y < TH; y++) {
    for (let x = 0; x < TW; x++) {
      const rx = x - cx, ry = y - cy;
      const along = rx * ux + ry * uy;             // negative = uphill
      const across = Math.abs(rx * -uy + ry * ux);
      if (across > 11) continue;
      if (across > 9) { p.set(x, y, [98, 90, 78]); continue; }   // channel walls
      if (along < -21) { p.set(x, y, T.rock.snow); continue; }   // summit landing
      const t = Math.max(0, Math.min(1, (24 - along) / 48));
      const sep = ((along + 96) % 7) < 1.2;
      p.set(x, y, sep ? lerp([92, 84, 72], [150, 142, 128], t) : lerp(lo, hi, t));
    }
  }
  return p;
}

const TILE_PAINTERS: Record<string, () => TilePainter> = {
  grass: () => {
    const p = new TilePainter(T.grass.base, 11);
    p.mottle(26, [T.grass.hi, T.grass.lo]);
    for (let i = 0; i < 9; i++) {
      const x = 6 + p.rnd() * (TW - 12), y = 8 + p.rnd() * (TH - 16);
      p.set(x, y, T.grass.tuft); p.set(x - 1, y + 1, T.grass.tuft); p.set(x + 1, y + 1, T.grass.tuft);
    }
    return p;
  },
  water: () => {
    const p = new TilePainter(T.water.base, 22);
    p.mottle(10, [T.water.lo]);
    for (let i = 0; i < 9; i++) {
      const y = 6 + Math.floor(p.rnd() * (TH - 12));
      p.hseg(5 + p.rnd() * 30, y, 6 + p.rnd() * 9, i % 3 === 2 ? T.water.lo : T.water.hi);
    }
    return p;
  },
  sand: () => {
    const p = new TilePainter(T.sand.base, 33);
    p.mottle(20, [T.sand.hi, T.sand.lo]);
    for (let i = 0; i < 5; i++) p.hseg(8 + p.rnd() * 28, 10 + p.rnd() * 46, 5 + p.rnd() * 6, T.sand.lo);
    return p;
  },
  rainforest: () => {
    const p = new TilePainter([104, 138, 84], 44);
    p.mottle(14, [T.grass.lo]);
    const canopy: RGB = [64, 100, 58], canopyHi: RGB = [82, 122, 70], trunk: RGB = [102, 72, 44];
    const spots: Array<[number, number, number]> = [[20, 20, 6], [37, 27, 5], [24, 41, 6], [38, 48, 5], [15, 55, 4]];
    for (const [cx, cy, r] of spots) {
      p.set(cx, cy + r + 1, trunk); p.set(cx, cy + r + 2, trunk);
      p.blob(cx, cy, r, canopy);
      p.blob(cx - r * 0.35, cy - r * 0.35, r * 0.45, canopyHi);
    }
    return p;
  },
  mountain: () => {
    const p = new TilePainter(T.rock.base, 55);
    p.mottle(14, [T.rock.hi, T.rock.lo]);
    // one big peak: lit west face, shaded east face, small snow cap
    p.tri(28, 12, 10, 50, 28, 50, T.rock.hi);
    p.tri(28, 12, 28, 50, 46, 50, T.rock.lo);
    p.tri(28, 12, 24, 21, 32, 21, T.rock.snow);
    // foothill
    p.tri(42, 34, 34, 52, 50, 52, T.rock.lo);
    return p;
  },
  desert: () => {
    const p = new TilePainter(T.des.base, 66);
    p.mottle(16, [T.des.hi, T.des.lo]);
    // mesa: stacked slabs with a shaded side
    p.tri(28, 16, 12, 48, 28, 48, T.des.hi);
    p.tri(28, 16, 28, 48, 44, 48, T.des.lo);
    p.tri(28, 34, 22, 48, 34, 48, T.des.shadow);
    return p;
  },
  ramp: () => rampArt(0.55, 0.835, 77),   // staircase ascending toward NW
  'ramp-ew': () => rampArt(1, 0, 78),     // … toward W
  bridge: () => bridgeArt(0.55, 0.835),   // planks along the NW-SE crossing
  'bridge-ew': () => bridgeArt(1, 0),     // … along the E-W crossing
  portal: () => {
    // dark arcane stone — deliberately moodier than every terrain around it
    const p = new TilePainter([84, 76, 96], 88);
    p.mottle(12, [[74, 66, 86], [95, 87, 108]]);
    const cx = 28, cy = 33;
    p.glow(cx, cy, 24, [140, 110, 190], 0.35);
    // the summoning ring itself: bright violet, gently lit inner void
    for (let a = 0; a < 360; a += 2) {
      const x = cx + 15 * Math.cos((a * Math.PI) / 180);
      const y = cy + 13 * Math.sin((a * Math.PI) / 180);
      p.set(x, y, [206, 168, 255]);
      p.set(x + 0.7, y, [178, 138, 232]);
    }
    p.glow(cx, cy, 11, [60, 48, 80], 0.55);
    // rune sparks on the ring
    for (const a of [15, 75, 135, 195, 255, 315]) {
      const x = cx + 15 * Math.cos((a * Math.PI) / 180);
      const y = cy + 13 * Math.sin((a * Math.PI) / 180);
      p.set(x, y, [240, 224, 255]);
    }
    return p;
  },
  source: () => {
    // lavender ground with a bright mana crystal cluster
    const p = new TilePainter([124, 114, 138], 99);
    p.mottle(12, [[112, 102, 126], [136, 126, 150]]);
    const cx = 28, cy = 34;
    p.glow(cx, cy, 22, [150, 190, 230], 0.4);
    const crystal = (x: number, ytop: number, hw: number, hh: number, main: RGB, edge: RGB) => {
      p.tri(x, ytop, x - hw, ytop + hh, x, ytop + hh * 1.6, main);
      p.tri(x, ytop, x + hw, ytop + hh, x, ytop + hh * 1.6, edge);
      p.set(x, ytop + 1, [244, 252, 255]);
    };
    crystal(28, 16, 5, 12, [168, 226, 240], [104, 170, 200]);
    crystal(19, 26, 4, 8, [160, 130, 224], [112, 84, 176]);
    crystal(37, 28, 4, 7, [150, 208, 232], [96, 150, 190]);
    return p;
  },
};

function makeTiles(): void {
  const outDir = join(ROOT, 'public/pix/tex');
  mkdirSync(outDir, { recursive: true });
  for (const [name, paint] of Object.entries(TILE_PAINTERS)) {
    const p = paint();
    const rgba = new Uint8Array(TW * TH * 4);
    for (let y = 0; y < TH; y++) {
      for (let x = 0; x < TW; x++) {
        const i = (y * TW + x) * 3;
        let [r, g, b] = [p.buf[i], p.buf[i + 1], p.buf[i + 2]];
        // gradient border: 3px fade at the hex edge — soft but visible
        const d = hexEdgeDist(x, y, TW, TH);
        if (d >= 0 && d < 3) {
          const t = (3 - d) / 3;
          const f = 1 - 0.30 * Math.pow(t, 1.5);
          r *= f; g *= f; b *= f;
        }
        const o = (y * TW + x) * 4;
        rgba[o] = Math.max(0, Math.min(255, r));
        rgba[o + 1] = Math.max(0, Math.min(255, g));
        rgba[o + 2] = Math.max(0, Math.min(255, b));
        rgba[o + 3] = 255;
      }
    }
    writeFileSync(join(outDir, name + '.png'), pngEncode(TW * 4, TH * 4, upscale(rgba, TW, TH, 4)));
    console.log(`tex/${name}.png`);
  }
}

/* ================= unit sprites ================= */

const N = 24;

type RGBA = [number, number, number, number];
const BASE_PAL: Record<string, RGBA> = {
  k: [22, 17, 12, 255],     // outline
  S: [178, 188, 198, 255],  // steel
  W: [236, 242, 246, 255],  // steel highlight
  s: [110, 120, 130, 255],  // steel shadow
  G: [219, 168, 66, 255],   // gold
  g: [146, 102, 34, 255],   // gold shadow
  B: [140, 94, 50, 255],    // wood / leather
  b: [88, 56, 26, 255],     // wood shadow / hair
  E: [226, 178, 138, 255],  // skin
  e: [178, 130, 94, 255],   // skin shadow
  L: [219, 211, 192, 255],  // linen
  l: [176, 166, 144, 255],  // linen shadow
  D: [72, 70, 84, 255],     // dark cloth / iron
  C: [122, 204, 220, 255],  // arcane cyan
  P: [140, 92, 194, 255],   // arcane purple
  p: [78, 46, 116, 255],    // purple shadow
};
const FACTION_PAL: Record<'a' | 'b', Record<'F' | 'f' | 'H', RGBA>> = {
  a: { F: [64, 112, 176, 255], f: [36, 64, 110, 255], H: [128, 168, 216, 255] },
  b: { F: [178, 52, 40, 255], f: [110, 26, 18, 255], H: [226, 116, 92, 255] },
};

class Sheet {
  g: string[][] = Array.from({ length: N }, () => Array(N).fill('.'));
  px(x: number, y: number, c: string): void {
    if (x >= 0 && x < N && y >= 0 && y < N) this.g[Math.round(y)][Math.round(x)] = c;
  }
  rect(x: number, y: number, w: number, h: number, c: string): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c);
  }
  vline(x: number, y: number, len: number, c: string): void { this.rect(x, y, 1, len, c); }
  hline(x: number, y: number, len: number, c: string): void { this.rect(x, y, len, 1, c); }
  line(x0: number, y0: number, x1: number, y1: number, c: string, thick = 1): void {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps;
      const y = y0 + ((y1 - y0) * i) / steps;
      for (let t = 0; t < thick; t++) this.px(x + t, y, c);
    }
  }
  disc(cx: number, cy: number, r: number, c: string): void {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.px(x, y, c);
  }
  /** black outline around the whole silhouette */
  outline(): void {
    const src = this.g.map((r) => [...r]);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (src[y][x] !== '.') continue;
        const near = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => {
          const v = src[y + dy]?.[x + dx];
          return v != null && v !== '.' && v !== 'k';
        });
        if (near) this.g[y][x] = 'k';
      }
    }
  }
}

/* --- the nine figures, all facing right, filling the 24x24 canvas --- */

function swordsman(d: Sheet): void {
  d.rect(19, 0, 2, 11, 'S'); d.vline(19, 0, 11, 'W');       // blade
  d.hline(17, 11, 6, 'G');                                  // crossguard
  d.rect(19, 12, 2, 2, 'B');                                // grip
  d.rect(8, 1, 7, 5, 'S'); d.hline(8, 4, 7, 's');           // helm + visor
  d.rect(8, 0, 3, 1, 'F');                                  // plume
  d.rect(9, 6, 5, 3, 'E');                                  // face
  d.rect(7, 9, 9, 8, 'F'); d.vline(10, 9, 8, 'H'); d.vline(11, 9, 8, 'H'); // tabard
  d.hline(7, 16, 9, 'G');                                   // belt
  d.rect(16, 10, 3, 2, 'F'); d.px(19, 11, 'E'); d.px(20, 11, 'E'); // sword arm + hand
  d.rect(1, 9, 5, 9, 'S'); d.rect(2, 10, 3, 7, 'F'); d.px(3, 13, 'G'); d.px(2, 13, 'G'); // shield
  d.rect(8, 17, 3, 4, 'f'); d.rect(12, 17, 3, 4, 'f');      // legs
  d.rect(7, 21, 4, 2, 'b'); d.rect(12, 21, 4, 2, 'b');      // boots
}

function archer(d: Sheet): void {
  d.rect(8, 1, 7, 6, 'F'); d.rect(9, 4, 5, 3, 'E');         // hood + face
  d.rect(3, 6, 3, 6, 'b'); d.px(3, 5, 'G'); d.px(4, 5, 'L'); d.px(5, 5, 'G'); // quiver
  d.rect(7, 10, 9, 8, 'B'); d.hline(7, 17, 9, 'G');         // tunic + belt
  // big outward bow arc + string
  d.line(19, 1, 23, 7, 'B', 1); d.line(23, 7, 23, 15, 'B', 1); d.line(23, 15, 19, 21, 'B', 1);
  d.vline(19, 1, 21, 'l');
  d.hline(9, 11, 12, 'b'); d.px(21, 11, 'S'); d.px(22, 11, 'S'); // arrow
  d.rect(14, 10, 4, 2, 'E');                                // drawing arm
  d.rect(8, 18, 3, 4, 'b'); d.rect(12, 18, 3, 4, 'b');
  d.rect(7, 21, 4, 2, 'f'); d.rect(12, 21, 4, 2, 'f');      // faction boots
}

function barbarian(d: Sheet): void {
  d.vline(20, 0, 16, 'B');                                  // haft
  d.rect(16, 0, 4, 6, 'S'); d.rect(21, 0, 3, 6, 'S');       // twin blades
  d.vline(16, 0, 6, 'W'); d.vline(23, 0, 6, 'W');
  d.rect(7, 1, 7, 4, 'b'); d.px(6, 3, 'b'); d.px(14, 3, 'b'); // wild hair
  d.rect(8, 5, 5, 4, 'E');                                  // face
  d.rect(7, 9, 9, 7, 'E'); d.vline(7, 9, 7, 'e');           // bare torso
  d.line(8, 10, 13, 14, 'F', 2);                            // warpaint
  d.rect(15, 10, 5, 2, 'E'); d.px(19, 12, 'E');             // arm to haft
  d.rect(7, 16, 9, 3, 'B'); d.px(9, 17, 'b'); d.px(12, 16, 'b'); d.px(14, 18, 'b'); // fur kilt
  d.rect(8, 19, 3, 3, 'E'); d.rect(12, 19, 3, 3, 'E');
  d.rect(7, 22, 4, 2, 'b'); d.rect(12, 22, 4, 2, 'b');
}

function mountedarcher(d: Sheet): void {
  d.rect(3, 12, 17, 6, 'B'); d.hline(3, 17, 17, 'b');       // horse body
  d.vline(4, 18, 5, 'B'); d.vline(8, 18, 5, 'B'); d.vline(14, 18, 5, 'B'); d.vline(18, 18, 5, 'B');
  d.px(4, 22, 'b'); d.px(8, 22, 'b'); d.px(14, 22, 'b'); d.px(18, 22, 'b'); // hooves
  d.rect(17, 7, 4, 6, 'B'); d.rect(19, 4, 5, 4, 'B');       // neck + head
  d.px(23, 6, 'b'); d.px(20, 3, 'b'); d.vline(17, 5, 7, 'b'); // muzzle, ear, mane
  d.vline(2, 12, 4, 'b'); d.px(1, 16, 'b');                 // tail
  d.rect(7, 11, 7, 2, 'F');                                 // saddle blanket
  d.rect(8, 4, 5, 7, 'F'); d.hline(8, 10, 5, 'f');          // rider tunic
  d.rect(9, 0, 4, 4, 'E'); d.hline(9, 0, 4, 'S');           // head + cap
  d.line(14, 2, 16, 4, 'b', 1); d.line(16, 4, 16, 8, 'b', 1); d.line(16, 8, 14, 10, 'b', 1); // bow
  d.rect(12, 5, 3, 2, 'E');                                 // arm
}

function catapult(d: Sheet): void {
  d.line(4, 17, 20, 3, 'B', 2);                             // throwing arm
  d.rect(19, 0, 4, 5, 'b'); d.disc(20.5, 2, 1.6, 's');      // bucket + boulder
  d.rect(2, 16, 20, 3, 'B'); d.hline(2, 18, 20, 'b');       // frame
  d.line(6, 16, 11, 8, 'b', 1); d.line(16, 16, 11, 8, 'b', 1); // a-frame
  d.vline(11, 2, 7, 'b'); d.rect(12, 2, 4, 2, 'F');         // pennant
  d.disc(6, 20.5, 2.6, 'b'); d.disc(17, 20.5, 2.6, 'b');    // wheels
  d.px(6, 20, 's'); d.px(17, 20, 's');
}

function defender(d: Sheet): void {
  d.rect(9, 0, 6, 4, 'S'); d.rect(10, 0, 2, 1, 'F');        // helm + plume
  d.px(10, 3, 'e'); d.px(13, 3, 'e');                       // eye slits
  d.vline(20, 0, 5, 'S'); d.vline(20, 5, 17, 'B');          // spear
  d.rect(6, 4, 12, 17, 'S'); d.vline(6, 4, 17, 'W');        // tower shield
  d.rect(7, 5, 10, 15, 'F');
  d.vline(11, 7, 11, 'G'); d.vline(12, 7, 11, 'G'); d.hline(8, 11, 8, 'G'); // gold cross
  d.rect(7, 21, 3, 2, 'b'); d.rect(14, 21, 3, 2, 'b');      // boots
}

function healer(d: Sheet): void {
  d.rect(8, 1, 7, 5, 'L'); d.rect(9, 3, 5, 3, 'E');         // hood + face
  d.rect(7, 7, 9, 9, 'L'); d.vline(7, 7, 9, 'l');           // robe
  d.rect(6, 16, 11, 6, 'L'); d.vline(6, 16, 6, 'l');        // skirt
  d.hline(6, 21, 11, 'F');                                  // hem trim
  d.line(8, 7, 13, 15, 'F', 2);                             // sash
  d.vline(20, 3, 19, 'B');                                  // staff
  d.vline(20, 0, 3, 'G'); d.hline(19, 1, 3, 'G'); d.px(20, 1, 'W'); // cross
  d.rect(16, 10, 4, 2, 'L'); d.px(19, 11, 'E');             // arm to staff
}

function planeswalker(d: Sheet): void {
  d.rect(3, 7, 4, 13, 'F');                                 // cloak behind
  d.rect(8, 1, 7, 5, 'P'); d.rect(9, 3, 5, 3, 'p');         // hood, shadowed face
  d.px(10, 4, 'C'); d.px(13, 4, 'C');                       // glowing eyes
  d.rect(7, 7, 9, 9, 'P'); d.vline(7, 7, 9, 'p');           // robe
  d.rect(6, 16, 11, 6, 'P'); d.vline(6, 16, 6, 'p');
  d.hline(6, 21, 11, 'H');                                  // faction hem
  d.vline(20, 5, 17, 'b');                                  // staff
  d.disc(20, 2.5, 2.3, 'C'); d.px(20, 2, 'W');              // orb
  d.rect(16, 10, 4, 2, 'P'); d.px(19, 11, 'E');
}

function translocator(d: Sheet): void {
  d.rect(8, 1, 7, 5, 'D'); d.rect(9, 3, 5, 3, 'E');         // hood + face
  d.rect(7, 7, 9, 9, 'D');                                  // robe
  d.rect(6, 16, 11, 6, 'D');
  d.hline(6, 21, 11, 'F'); d.vline(11, 7, 9, 'F');          // faction trim
  d.rect(2, 9, 5, 2, 'D'); d.rect(17, 9, 5, 2, 'D');        // arms out
  d.px(2, 10, 'E'); d.px(21, 10, 'E');
  d.disc(2, 5.5, 2.2, 'C'); d.px(2, 5, 'W');                // swap orbs
  d.disc(21, 5.5, 2.2, 'P'); d.px(21, 5, 'W');
}

const FIGURES: Record<string, (d: Sheet) => void> = {
  swordsman, archer, barbarian, mountedarcher, catapult, defender, healer, planeswalker, translocator,
};

function makeSprites(): void {
  const outDir = join(ROOT, 'public/pix/units');
  mkdirSync(outDir, { recursive: true });
  for (const [name, draw] of Object.entries(FIGURES)) {
    const d = new Sheet();
    draw(d);
    d.outline();
    for (const fac of ['a', 'b'] as const) {
      const pal = { ...BASE_PAL, ...FACTION_PAL[fac] };
      const rows = fac === 'b' ? d.g.map((r) => [...r].reverse()) : d.g; // Crimson faces left
      const rgba = new Uint8Array(N * N * 4);
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const c = pal[rows[y][x] as keyof typeof pal];
          if (!c && rows[y][x] !== '.') throw new Error(`${name}: unknown color '${rows[y][x]}'`);
          if (c) rgba.set(c, (y * N + x) * 4);
        }
      }
      writeFileSync(join(outDir, `${name}-${fac}.png`), pngEncode(N * 4, N * 4, upscale(rgba, N, N, 4)));
    }
    console.log(`units/${name}-a.png + ${name}-b.png`);
  }
}

/* ================= parchment panel tile ================= */

function makePanel(): void {
  const S = 48;
  const rgba = new Uint8Array(S * S * 4);
  let seed = 1337;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n = rnd();
      let r = 214, g = 197, b = 158;
      if (n > 0.86) { r -= 18; g -= 18; b -= 16; }
      else if (n < 0.08) { r += 12; g += 12; b += 10; }
      const wave = Math.floor(4 * Math.sin((y * 1.1 + x * 0.3) / 5));
      rgba.set([r + wave, g + wave, b + wave, 255], (y * S + x) * 4);
    }
  }
  const dir = join(ROOT, 'public/pix/ui');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'panel.png'), pngEncode(S, S, rgba));
  console.log('ui/panel.png');
}

makeTiles();
makeSprites();
makePanel();
console.log('pix assets regenerated');
