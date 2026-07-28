// Regenerates every asset of the "pix" skin (run with tsx; no image deps):
//
//   art/hexloom/*.bmp  →  public/pix/tex/*.png
//     57x67 Hex Loom tiles: colors softened (desaturated + lifted) for
//     contrast with the unit sprites, a soft-but-visible gradient border
//     baked along the hex edge, then upscaled x4 nearest-neighbor.
//
//   drawn here         →  public/pix/units/<unit>-<faction>.png
//     24x24 full-figure sprites in the Warlords / HoMM2 spirit, auto
//     black outline, upscaled x4. Faction elements (tabards, shields,
//     plumes, sashes) use placeholder colors swapped per faction; the
//     'b' (Crimson) variant is also mirrored so armies face each other.
//
//   drawn here         →  public/pix/ui/panel.png (parchment tile)

import { deflateSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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

/* ================= terrain tiles ================= */

function decodeBmp24(buf: Buffer): { w: number; h: number; rgba: Uint8Array } {
  const off = buf.readUInt32LE(10);
  const w = buf.readInt32LE(18);
  const h = buf.readInt32LE(22);
  const bpp = buf.readUInt16LE(28);
  if (bpp !== 24 || h <= 0) throw new Error(`unsupported BMP (bpp=${bpp}, h=${h})`);
  const stride = Math.ceil((w * 3) / 4) * 4;
  const rgba = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const src = off + (h - 1 - y) * stride;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      rgba[i] = buf[src + x * 3 + 2];
      rgba[i + 1] = buf[src + x * 3 + 1];
      rgba[i + 2] = buf[src + x * 3];
      rgba[i + 3] = 255;
    }
  }
  return { w, h, rgba };
}

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

const TILES = ['grass', 'water', 'sand', 'rainforest', 'mountain', 'desert', 'ramp', 'bridge', 'portal', 'source'];

function makeTiles(): void {
  const outDir = join(ROOT, 'public/pix/tex');
  mkdirSync(outDir, { recursive: true });
  for (const name of TILES) {
    const { w, h, rgba } = decodeBmp24(readFileSync(join(ROOT, 'art/hexloom', name + '.bmp')));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        let [r, g, b] = [rgba[i], rgba[i + 1], rgba[i + 2]];
        // soften: pull toward luminance and lift — landing between the raw
        // Hex Loom colors and the watercolor pastels, so sprites pop on top
        const L = 0.299 * r + 0.587 * g + 0.114 * b;
        r += (L - r) * 0.45 + 18;
        g += (L - g) * 0.45 + 18;
        b += (L - b) * 0.45 + 15;
        // gradient border: 3px deep fade to ~68% at the very edge —
        // softer than a hard line, but clearly visible between tiles
        const d = hexEdgeDist(x, y, w, h);
        if (d >= 0 && d < 3) {
          const t = (3 - d) / 3;
          const f = 1 - 0.32 * Math.pow(t, 1.5);
          r *= f; g *= f; b *= f;
        }
        rgba[i] = Math.max(0, Math.min(255, r));
        rgba[i + 1] = Math.max(0, Math.min(255, g));
        rgba[i + 2] = Math.max(0, Math.min(255, b));
      }
    }
    writeFileSync(join(outDir, name + '.png'), pngEncode(w * 4, h * 4, upscale(rgba, w, h, 4)));
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
