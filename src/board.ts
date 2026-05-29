// PixiJS rendering of the board. Owns the canvas and the per-cell graphics;
// reports clicks back to the caller via a callback. Knows nothing about the
// network — it just draws whatever GameState it is handed.

import { Application, Container, Graphics } from 'pixi.js';
import { GRID_H, GRID_W, idx, isValidMove, type GameState, type Player } from './game';

const CELL = 52;
const GAP = 4;

const COLORS = {
  background: 0x0d1117,
  empty: 0x1f2733,
  p0: 0x4f9dff,
  p1: 0xff6b6b,
  hint: 0x2ecc71,
} as const;

export class Board {
  readonly app: Application;
  private cells: Graphics[] = [];
  private onCellClick: (x: number, y: number) => void;

  constructor(onCellClick: (x: number, y: number) => void) {
    this.app = new Application();
    this.onCellClick = onCellClick;
  }

  async init(parent: HTMLElement): Promise<void> {
    const w = GRID_W * (CELL + GAP) + GAP;
    const h = GRID_H * (CELL + GAP) + GAP;
    await this.app.init({ width: w, height: h, background: COLORS.background, antialias: true });
    parent.appendChild(this.app.canvas);

    const layer = new Container();
    this.app.stage.addChild(layer);

    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const g = new Graphics();
        g.x = GAP + x * (CELL + GAP);
        g.y = GAP + y * (CELL + GAP);
        g.eventMode = 'static';
        g.cursor = 'pointer';
        g.on('pointertap', () => this.onCellClick(x, y));
        layer.addChild(g);
        this.cells[idx(x, y)] = g;
      }
    }
  }

  // Redraw every cell. `myPlayer` is null until connected; when set and it is
  // that player's turn, legal moves get a green outline.
  render(state: GameState, myPlayer: Player | null): void {
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const g = this.cells[idx(x, y)];
        const owner = state.grid[idx(x, y)];
        g.clear();

        let fill: number = COLORS.empty;
        if (owner === 0) fill = COLORS.p0;
        else if (owner === 1) fill = COLORS.p1;
        g.roundRect(0, 0, CELL, CELL, 8).fill(fill);

        if (myPlayer !== null && isValidMove(state, x, y, myPlayer)) {
          g.roundRect(3, 3, CELL - 6, CELL - 6, 6).stroke({ width: 3, color: COLORS.hint });
        }
      }
    }
  }
}
