// The painted hex board: textured edge-to-edge tiles, washed-disc unit
// tokens, and the overlay system (range highlights, path lines, reticle,
// tooltips) from the design handoff — generalized over a MapDef so it can
// draw both the flat-top Sundered Isle and the rulebook's pointy-top World
// of Amphis, with pan & zoom for boards bigger than the frame.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { hexesOf, type MapDef } from '../game/maps';
import { ZLAYER, type Faction, type UnitType } from '../game/data';
import type { SourceState } from '../game/engine';
import { Icon } from './icons';

export const FRAME_W = 1040;
export const FRAME_H = 700;

// area of the frame the board should fit into (clear of the HUD panels)
const AVAIL = { x0: 140, x1: 770, y0: 92, y1: 604 };

const SQ3 = Math.sqrt(3);

export interface BoardGeom {
  hexW: number;
  hexH: number;
  boardW: number;
  boardH: number;
  px: (q: number, r: number) => { x: number; y: number };
}

export function geomOf(map: MapDef): BoardGeom {
  const s = map.hexSize;
  const raw =
    map.orient === 'flat'
      ? (q: number, r: number) => ({ x: 1.5 * s * q, y: SQ3 * s * (r + q / 2) })
      : (q: number, r: number) => ({ x: SQ3 * s * (q + r / 2), y: 1.5 * s * r });
  const hexW = map.orient === 'flat' ? 2 * s : SQ3 * s;
  const hexH = map.orient === 'flat' ? SQ3 * s : 2 * s;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const h of hexesOf(map)) {
    const { x, y } = raw(h.q, h.r);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const padX = hexW, padY = hexH;
  const ox = padX - minX, oy = padY - minY;
  return {
    hexW, hexH,
    boardW: maxX - minX + padX * 2,
    boardH: maxY - minY + padY * 2,
    px: (q, r) => { const p = raw(q, r); return { x: p.x + ox, y: p.y + oy }; },
  };
}

interface View { z: number; tx: number; ty: number }

function fitView(geom: BoardGeom): View {
  const z = Math.min((AVAIL.x1 - AVAIL.x0) / geom.boardW, (AVAIL.y1 - AVAIL.y0) / geom.boardH, 1);
  return {
    z,
    tx: (AVAIL.x0 + AVAIL.x1) / 2 - (z * geom.boardW) / 2,
    ty: (AVAIL.y0 + AVAIL.y1) / 2 - (z * geom.boardH) / 2,
  };
}

/* ---------- overlays ---------- */

export interface OverlayCell {
  q: number;
  r: number;
  cls?: string;
  label?: ReactNode;
}

export interface Overlay {
  cells?: OverlayCell[];
  line?: Array<{ q: number; r: number }>;
  lineCls?: string;
  arrow?: boolean;
  reticle?: { q: number; r: number } | null;
}

function PathLine({ geom, cells, arrow, cls }: { geom: BoardGeom; cells: Array<{ q: number; r: number }>; arrow?: boolean; cls?: string }) {
  if (!cells || cells.length < 2) return null;
  const pts = cells.map((c) => {
    const p = geom.px(c.q, c.r);
    return p.x + ',' + p.y;
  }).join(' ');
  const last = geom.px(cells[cells.length - 1].q, cells[cells.length - 1].r);
  const prev = geom.px(cells[cells.length - 2].q, cells[cells.length - 2].r);
  const ang = Math.atan2(last.y - prev.y, last.x - prev.x);
  const ah = geom.hexW * 0.22;
  return (
    <svg
      className={'path-svg ' + (cls || '')}
      width={geom.boardW}
      height={geom.boardH}
      viewBox={`0 0 ${geom.boardW} ${geom.boardH}`}
      preserveAspectRatio="none"
    >
      <polyline points={pts} className="path-glow" />
      <polyline points={pts} className="path-core" />
      {arrow && (
        <path
          className="path-arrow"
          d={`M${last.x},${last.y} L${last.x - ah * Math.cos(ang - 0.4)},${last.y - ah * Math.sin(ang - 0.4)} L${last.x - ah * Math.cos(ang + 0.4)},${last.y - ah * Math.sin(ang + 0.4)} Z`}
        />
      )}
    </svg>
  );
}

/* ---------- tokens ---------- */

export interface DisplayUnit {
  id: number;
  q: number;
  r: number;
  type: UnitType;
  faction: Faction;
  hp: number;
  maxHp: number;
  sel?: boolean;
  faded?: boolean;
  spent?: boolean;
}

function Token({ u, geom }: { u: DisplayUnit; geom: BoardGeom }) {
  const { x, y } = geom.px(u.q, u.r);
  const pct = Math.max(0, Math.round((u.hp / u.maxHp) * 100));
  return (
    <div
      className={
        'wc-tok f' + u.faction + (u.sel ? ' selected' : '') + (u.faded ? ' faded' : '') + (u.spent ? ' spent' : '')
      }
      style={{ left: x, top: y }}
    >
      {u.sel && <div className="wc-sel"></div>}
      <div className="wc-tok-body">
        <span className="wc-tok-ic">
          <Icon type={u.type} />
        </span>
      </div>
      {u.spent && <span className="tok-done">✓</span>}
      <div className="wc-hp">
        <div className="wc-hp-fill" style={{ width: pct + '%' }}></div>
      </div>
    </div>
  );
}

/* ---------- tooltip ---------- */

export interface Tip {
  q: number;
  r: number;
  faction: Faction;
  name: string;
  stats: Array<[string, ReactNode]>;
  note?: string;
}

/* ---------- the board ---------- */

// every terrain has its own tile in the tex3 set; only the internal
// 'forest' key differs from the file name
const TEX_FOR: Partial<Record<string, string>> = { forest: 'rainforest' };

interface BoardProps {
  map: MapDef;
  units?: DisplayUnit[];
  sources?: SourceState[];
  battleMode?: boolean;
  overlay?: Overlay | null;
  tip?: Tip | null;
  onCell?: (q: number, r: number) => void;
  onCellEnter?: (q: number, r: number) => void;
  onCellLeave?: (q: number, r: number) => void;
  children?: ReactNode;
}

export function Board({ map, units = [], sources = [], battleMode, overlay, tip, onCell, onCellEnter, onCellLeave, children }: BoardProps) {
  const base = import.meta.env.BASE_URL;
  const geom = useMemo(() => geomOf(map), [map]);
  const hexes = useMemo(() => hexesOf(map), [map]);
  const portalOwner = useMemo(() => {
    const m = new Map<string, Faction>();
    for (const f of ['a', 'b'] as const) for (const p of map.portals[f]) m.set(p.q + ',' + p.r, f);
    return m;
  }, [map]);

  const interactive = !!onCell;
  const [view, setView] = useState<View>(() => fitView(geom));
  useEffect(() => setView(fitView(geom)), [geom]);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef({ on: false, moved: false, x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;

  // wheel zoom (non-passive so we can preventDefault) + drag pan
  useEffect(() => {
    const el = boardRef.current;
    if (!el || !interactive) return undefined;
    const fit = fitView(geom);
    const clamp = (v: View): View => {
      const z = Math.min(2.6, Math.max(fit.z * 0.85, v.z));
      const w = geom.boardW * z, h = geom.boardH * z;
      const tx = Math.min(AVAIL.x1 - w * 0.15, Math.max(AVAIL.x0 - w * 0.85, v.tx));
      const ty = Math.min(AVAIL.y1 - h * 0.1, Math.max(AVAIL.y0 - h * 0.9, v.ty));
      return { z, tx, ty };
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const scale = rect.width / FRAME_W; // outer #frame css scale
      const mx = (e.clientX - rect.left) / scale;
      const my = (e.clientY - rect.top) / scale;
      const v = viewRef.current;
      const z2 = Math.min(2.6, Math.max(fit.z * 0.85, v.z * Math.exp(-e.deltaY * 0.0014)));
      const k = z2 / v.z;
      setView(clamp({ z: z2, tx: mx - k * (mx - v.tx), ty: my - k * (my - v.ty) }));
    };
    const onDown = (e: PointerEvent) => {
      drag.current = { on: true, moved: false, x: e.clientX, y: e.clientY };
    };
    const onMove = (e: PointerEvent) => {
      if (!drag.current.on) return;
      const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
      if (!drag.current.moved && Math.hypot(dx, dy) < 5) return;
      const rect = el.getBoundingClientRect();
      const scale = rect.width / FRAME_W;
      drag.current.moved = true;
      drag.current.x = e.clientX; drag.current.y = e.clientY;
      const v = viewRef.current;
      setView(clamp({ z: v.z, tx: v.tx + dx / scale, ty: v.ty + dy / scale }));
    };
    const onUp = () => { drag.current.on = false; };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [geom, interactive]);

  const handleCell = onCell
    ? (q: number, r: number) => { if (!drag.current.moved) onCell(q, r); }
    : undefined;

  const { hexW, hexH } = geom;
  const tipPos = tip ? geom.px(tip.q, tip.r) : null;

  return (
    <div className={'wc-board' + (interactive ? ' grabby' : '')} ref={boardRef}>
      <div
        className={'board-space ' + map.orient}
        style={{
          width: geom.boardW,
          height: geom.boardH,
          transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.z})`,
          '--hex': hexW + 'px',
        } as React.CSSProperties}
      >
        <div className="isle-shadow" style={{ left: hexW / 2, top: hexH, right: hexW / 2, bottom: hexH / 2 }}></div>
        {hexes.map((h) => {
          const t = h.t === 'source' && battleMode ? 'grass' : h.t;
          const tex = TEX_FOR[t] ?? t;
          const pf = t === 'portal' ? portalOwner.get(h.q + ',' + h.r) : null;
          const { x, y } = geom.px(h.q, h.r);
          return (
            <div
              key={h.q + ',' + h.r}
              className={'thex e' + ZLAYER[t] + ' t-' + t + (pf ? ' p' + pf : '')}
              style={{
                left: x - hexW / 2,
                top: y - hexH / 2,
                width: hexW,
                height: hexH,
                backgroundImage: `url(${base}tex/${tex}.png)`,
              }}
            ></div>
          );
        })}
        {sources.map((s) =>
          s.owner ? (
            (() => {
              const { x, y } = geom.px(s.q, s.r);
              return (
                <div
                  key={'src' + s.q + ',' + s.r}
                  className={'src-mark f' + s.owner}
                  style={{ left: x, top: y }}
                ></div>
              );
            })()
          ) : null,
        )}
        {overlay?.cells?.map((c, i) => {
          const { x, y } = geom.px(c.q, c.r);
          return (
            <div
              key={'h' + i}
              className={'hl ' + (c.cls || '')}
              style={{ left: x - hexW / 2, top: y - hexH / 2, width: hexW, height: hexH }}
            >
              {c.label != null && <span className="hl-num">{c.label}</span>}
            </div>
          );
        })}
        {overlay?.line && <PathLine geom={geom} cells={overlay.line} arrow={overlay.arrow} cls={overlay.lineCls} />}
        {units.map((u) => (
          <Token key={u.id} u={u} geom={geom} />
        ))}
        {overlay?.reticle &&
          (() => {
            const { x, y } = geom.px(overlay.reticle!.q, overlay.reticle!.r);
            return <div className="reticle" style={{ left: x, top: y }}></div>;
          })()}
        {handleCell &&
          hexes.map((h) => {
            const { x, y } = geom.px(h.q, h.r);
            return (
              <div
                key={'hit' + h.q + ',' + h.r}
                className="cell-hit"
                style={{ left: x - hexW / 2, top: y - hexH / 2, width: hexW, height: hexH }}
                onClick={() => handleCell(h.q, h.r)}
                onMouseEnter={onCellEnter ? () => onCellEnter(h.q, h.r) : undefined}
                onMouseLeave={onCellLeave ? () => onCellLeave(h.q, h.r) : undefined}
              ></div>
            );
          })}
      </div>
      {tip && tipPos && (
        <div
          className="unit-tip"
          style={{ left: view.tx + view.z * tipPos.x, top: view.ty + view.z * (tipPos.y - hexH * 0.45) }}
        >
          <div className="unit-tip-h">
            <span className={'wc-dot f' + tip.faction}></span>
            <b>{tip.name}</b>
          </div>
          <div className="unit-tip-stats">
            {tip.stats.map(([k, v]) => (
              <span key={k}>
                <i>{k}</i>
                {v}
              </span>
            ))}
          </div>
          {tip.note && <div className="unit-tip-note">{tip.note}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
