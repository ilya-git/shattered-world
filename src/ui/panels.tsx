// HUD chrome from sw-core.jsx: parchment screen shell, top bar, unit card,
// combat dice readout, and the summon dock — extended to the full nine-unit
// roster from Rules.docx.

import { useState, type CSSProperties, type ReactNode } from 'react';
import { STATS, UNIT_ORDER, type Faction, type UnitType } from '../game/data';
import { UnitPic } from './icons';
import { setSkin, useSkin } from './skin';

export const PARCH: CSSProperties = {
  '--wc-paper': '#f1ebdd',
  '--wc-paper2': '#e7dcc4',
  '--wc-ink': '#3b3326',
  '--wc-ink-soft': 'rgba(59,51,38,.5)',
  '--c-grass': '#9cb56a',
  '--c-water': '#7fb0c2',
  '--c-mountain': '#b3a48f',
  '--c-sand': '#e3cf95',
  '--c-source': '#bb9bd6',
  '--c-portal': '#d8c8a6',
  '--c-fa': '#436c98',
  '--c-fb': '#b5503e',
  '--wc-accent': '#b5503e',
  '--wc-gem': '#9a76c0',
} as CSSProperties;

export function Screen({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  const skin = useSkin();
  const style = {
    ...PARCH,
    '--pix-panel': `url(${import.meta.env.BASE_URL}pix/ui/panel.png)`,
  } as CSSProperties;
  return (
    <div className={'wc skin-' + skin + ' ' + (className || '')} style={style} data-screen-label={label}>
      <div className="wc-paper"></div>
      <div className="wc-grain"></div>
      {children}
    </div>
  );
}

/** The visuals switch: watercolor wash ⇄ pixel art. Position via className. */
export function SkinToggle({ className }: { className?: string }) {
  const skin = useSkin();
  return (
    <button
      className={'skin-toggle ' + (className || '')}
      title="Switch between the watercolor and pixel-art looks"
      onClick={() => setSkin(skin === 'wash' ? 'pix' : 'wash')}
    >
      {skin === 'wash' ? '▦ visuals: watercolor' : '▦ visuals: pixel'}
    </button>
  );
}

export function Die({ value }: { value: number }) {
  const place: Record<number, number[]> = {
    1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
  };
  const g = Array(9).fill(0);
  (place[value] || [4]).forEach((i) => (g[i] = 1));
  return (
    <div className="wc-die">
      {g.map((on, i) => (
        <span key={i} className={on ? 'wc-pip on' : 'wc-pip'}></span>
      ))}
    </div>
  );
}

export function TopBar({ turn, mana, foe }: {
  turn: { faction: Faction; label: string; sub: string };
  mana: { n: number; sub: string };
  /** the other side's purse — no secrets in this game, and it decides what
   *  they can summon or pay for next */
  foe?: { n: number; sub: string; faction: Faction };
}) {
  return (
    <div className="wc-panel wc-top">
      <div className="wc-turn">
        <span className={'wc-dot f' + turn.faction}></span>
        <span className="wc-turn-t">
          <b>{turn.label}</b>
          <i>{turn.sub}</i>
        </span>
      </div>
      <div className="wc-wordmark">Shattered World</div>
      <div className="wc-mana-pair">
        <div className="wc-mana">
          <span className="wc-gem">✦</span>
          <span className="wc-mana-n">{mana.n}</span>
          <span className="wc-mana-s">{mana.sub}</span>
        </div>
        {foe && (
          <div className="wc-mana foe">
            <span className={'wc-dot f' + foe.faction}></span>
            <span className="wc-mana-n">{foe.n}</span>
            <span className="wc-mana-s">{foe.sub}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export interface CardAction {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export interface CardUnit {
  type: UnitType;
  faction: Faction;
  name: string;
  sub: string;
  stats: Array<[string, ReactNode]>;
  special: ReactNode;
  spLabel?: string;
}

export function UnitCard({ unit, actions }: { unit: CardUnit; actions?: CardAction[] | null }) {
  return (
    <div className="wc-panel wc-card">
      <div className="wc-card-head">
        <div
          className="wc-portrait"
          style={{ '--tok-c': unit.faction === 'b' ? 'var(--c-fb)' : 'var(--c-fa)' } as CSSProperties}
        >
          <span className="wc-portrait-ic">
            <UnitPic type={unit.type} faction={unit.faction} />
          </span>
        </div>
        <div>
          <div className="wc-card-name">{unit.name}</div>
          <div className="wc-card-sub">
            <span className={'wc-dot f' + unit.faction}></span> {unit.sub}
          </div>
        </div>
      </div>
      <div className="wc-stats">
        {unit.stats.map(([k, v]) => (
          <div key={k} className="wc-stat">
            <span className="wc-stat-v">{v}</span>
            <span className="wc-stat-k">{k}</span>
          </div>
        ))}
      </div>
      <div className="wc-special">
        <span className="wc-sp-l">{unit.spLabel || 'special'}</span>
        {unit.special}
      </div>
      {actions && (
        <div className="wc-acts">
          {actions.map((a) => (
            <button
              key={a.label}
              disabled={a.disabled}
              onClick={a.onClick}
              className={'wc-act' + (a.active ? ' primary' : '')}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CombatPanel({ a, b, result }: { a: { name: string; die: number; add: number }; b: { name: string; die: number; add: number }; result: ReactNode }) {
  return (
    <div className="wc-panel wc-combat">
      <div className="wc-combat-h">the dice are cast</div>
      <div className="wc-combat-row">
        <div className="wc-cb a">
          <span className="wc-cb-n">{a.name}</span>
          <Die value={a.die} />
          <span className="wc-cb-add">+{a.add}</span>
          <span className="wc-cb-tot">{a.die + a.add}</span>
        </div>
        <div className="wc-cb-vs">vs</div>
        <div className="wc-cb b">
          <span className="wc-cb-n">{b.name}</span>
          <Die value={b.die} />
          <span className="wc-cb-add">+{b.add}</span>
          <span className="wc-cb-tot">{b.die + b.add}</span>
        </div>
      </div>
      <div className="wc-combat-r">{result}</div>
    </div>
  );
}

export function SummonDock({ mana, onPick, activeType, disabledAll, dim, note, faction }: {
  mana: number;
  onPick?: (t: UnitType) => void;
  activeType?: UnitType | null;
  disabledAll?: boolean;
  dim?: boolean;
  note?: string;
  faction?: Faction;
}) {
  const [peek, setPeek] = useState<UnitType | null>(null);
  const s = peek ? STATS[peek] : null;
  return (
    <div className={'wc-panel wc-dock' + (dim ? ' dim' : '')}>
      <div className="wc-dock-l">
        Summon
        {note && <span className="wc-dock-note">{note}</span>}
      </div>
      <div className="wc-dock-items">
        {UNIT_ORDER.map((t) => (
          // the hover lives on the wrapper: a disabled button (one you can't
          // afford yet) fires no pointer events, and that is exactly when you
          // want to read its stats
          <span
            key={t}
            className="wc-su-slot"
            onMouseEnter={() => setPeek(t)}
            onMouseLeave={() => setPeek((p) => (p === t ? null : p))}
          >
            <button
              className={'wc-summon' + (activeType === t ? ' picked' : '')}
              disabled={STATS[t].cost > mana || disabledAll}
              onClick={onPick ? () => onPick(t) : undefined}
            >
              <span className="wc-su-ic" style={{ '--tok-c': 'var(--c-fa)' } as CSSProperties}>
                <UnitPic type={t} faction={faction} />
              </span>
              <span className="wc-su-n">{STATS[t].name}</span>
              <span className="wc-su-c">✦{STATS[t].cost}</span>
            </button>
          </span>
        ))}
      </div>
      {s && (
        <div className="dock-tip">
          <div className="dock-tip-h">
            <b>{s.name}</b>
            <span className="dock-tip-cost">✦{s.cost}</span>
          </div>
          <div className="dock-tip-stats">
            {([
              ['MOV', s.move], ['LIFE', s.life], ['ATK', s.atk ?? '—'],
              ['DEF', s.def], ['RNG', s.rng],
            ] as Array<[string, ReactNode]>).map(([k, v]) => (
              <span key={k}>
                <i>{k}</i>
                {v}
              </span>
            ))}
          </div>
          <div className="dock-tip-note">
            <span className="dock-tip-l">{s.spLabel || 'special'}</span>
            {s.special}
          </div>
        </div>
      )}
    </div>
  );
}
