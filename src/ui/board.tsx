// The painted hex board: textured edge-to-edge tiles (Option A from the
// design exploration), washed-disc unit tokens, and the overlay system
// (range highlights, path lines, reticle, tooltips) from sw-core.jsx —
// scaled up to the full radius-4 battlefield the rules need.

import type { ReactNode } from 'react';
import { ALL_HEXES, portalFaction } from '../game/map';
import { ZLAYER, type Faction, type UnitType } from '../game/data';
import type { SourceState } from '../game/engine';
import { Icon } from './icons';

export const HT = 32; // hex "radius" — design used 44 on a radius-2 board
export const HW = HT * 2;
export const HH = Math.sqrt(3) * HT;
export const HCX = 452;
export const HCY = 352;
export const FRAME_W = 1040;
export const FRAME_H = 700;

export function hpx(q: number, r: number): { x: number; y: number } {
  return { x: HCX + HT * 1.5 * q, y: HCY + HH * (r + q / 2) };
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

function Hl({ q, r, cls, label }: OverlayCell) {
  const { x, y } = hpx(q, r);
  return (
    <div
      className={'hl ' + (cls || '')}
      style={{ left: x - HW / 2, top: y - HH / 2, width: HW, height: HH }}
    >
      {label != null && <span className="hl-num">{label}</span>}
    </div>
  );
}

function PathLine({ cells, arrow, cls }: { cells: Array<{ q: number; r: number }>; arrow?: boolean; cls?: string }) {
  if (!cells || cells.length < 2) return null;
  const pts = cells.map((c) => {
    const p = hpx(c.q, c.r);
    return p.x + ',' + p.y;
  }).join(' ');
  const last = hpx(cells[cells.length - 1].q, cells[cells.length - 1].r);
  const prev = hpx(cells[cells.length - 2].q, cells[cells.length - 2].r);
  const ang = Math.atan2(last.y - prev.y, last.x - prev.x);
  return (
    <svg className={'path-svg ' + (cls || '')} viewBox={`0 0 ${FRAME_W} ${FRAME_H}`} preserveAspectRatio="none">
      <polyline points={pts} className="path-glow" />
      <polyline points={pts} className="path-core" />
      {arrow && (
        <path
          className="path-arrow"
          d={`M${last.x},${last.y} L${last.x - 14 * Math.cos(ang - 0.4)},${last.y - 14 * Math.sin(ang - 0.4)} L${last.x - 14 * Math.cos(ang + 0.4)},${last.y - 14 * Math.sin(ang + 0.4)} Z`}
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

function Token({ u }: { u: DisplayUnit }) {
  const { x, y } = hpx(u.q, u.r);
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

interface BoardProps {
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

export function Board({ units = [], sources = [], battleMode, overlay, tip, onCell, onCellEnter, onCellLeave, children }: BoardProps) {
  const base = import.meta.env.BASE_URL;
  return (
    <div className="wc-board">
      <div className="isle-shadow"></div>
      {ALL_HEXES.map((h) => {
        const t = h.t === 'source' && battleMode ? 'grass' : h.t;
        const tex = t === 'ramp' || t === 'bridge' || t === 'forest'
          ? { ramp: 'sand', bridge: 'water', forest: 'grass' }[t]
          : t;
        const pf = t === 'portal' ? portalFaction(h.q, h.r) : null;
        const { x, y } = hpx(h.q, h.r);
        return (
          <div
            key={h.q + ',' + h.r}
            className={'thex e' + ZLAYER[t] + ' t-' + t + (pf ? ' p' + pf : '')}
            style={{
              left: x - HW / 2,
              top: y - HH / 2,
              width: HW,
              height: HH,
              backgroundImage: `url(${base}tex/${tex}.png)`,
            }}
          >
            {t === 'ramp' && <span className="ramp-mark"></span>}
            {t === 'bridge' && <span className="bridge-mark"></span>}
            {t === 'forest' && <span className="forest-mark"></span>}
          </div>
        );
      })}
      {sources.map((s) =>
        s.owner ? (
          (() => {
            const { x, y } = hpx(s.q, s.r);
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
      {overlay?.cells?.map((c, i) => <Hl key={'h' + i} {...c} />)}
      {overlay?.line && <PathLine cells={overlay.line} arrow={overlay.arrow} cls={overlay.lineCls} />}
      {units.map((u) => (
        <Token key={u.id} u={u} />
      ))}
      {overlay?.reticle &&
        (() => {
          const { x, y } = hpx(overlay.reticle!.q, overlay.reticle!.r);
          return <div className="reticle" style={{ left: x, top: y }}></div>;
        })()}
      {tip &&
        (() => {
          const { x, y } = hpx(tip.q, tip.r);
          return (
            <div className="unit-tip" style={{ left: x, top: y }}>
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
          );
        })()}
      {onCell &&
        ALL_HEXES.map((h) => {
          const { x, y } = hpx(h.q, h.r);
          return (
            <div
              key={'hit' + h.q + ',' + h.r}
              className="cell-hit"
              style={{ left: x - HW / 2, top: y - HH / 2, width: HW, height: HH }}
              onClick={() => onCell(h.q, h.r)}
              onMouseEnter={onCellEnter ? () => onCellEnter(h.q, h.r) : undefined}
              onMouseLeave={onCellLeave ? () => onCellLeave(h.q, h.r) : undefined}
            ></div>
          );
        })}
      {children}
    </div>
  );
}
