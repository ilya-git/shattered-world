// Menu, lobby, rules and outcome screens — ported from sw-menu.jsx /
// sw-outcomes.jsx, wired to the real networking flow and the real rules.

import { useState, type ReactNode } from 'react';
import { Board, type DisplayUnit } from './board';
import { Screen, Die } from './panels';
import { Icon } from './icons';
import type { Faction, UnitType } from '../game/data';
import { mapOf, type FactionStats, type GameMode, type GameState } from '../game/engine';
import { MAPS, MAP_LIST, type MapId } from '../game/maps';

/* ---------- hero board: a staged mid-game scene as title art ---------- */

const HERO_UNITS: DisplayUnit[] = [
  { id: 1, q: -1, r: 0, type: 'swordsman', faction: 'a', hp: 10, maxHp: 10 },
  { id: 2, q: -1, r: 2, type: 'archer', faction: 'a', hp: 7, maxHp: 7 },
  { id: 3, q: -3, r: 2, type: 'healer', faction: 'a', hp: 6, maxHp: 6 },
  { id: 4, q: -2, r: -1, type: 'defender', faction: 'a', hp: 5, maxHp: 5 },
  { id: 5, q: 1, r: 0, type: 'barbarian', faction: 'b', hp: 9, maxHp: 12 },
  { id: 6, q: 2, r: -2, type: 'mountedarcher', faction: 'b', hp: 8, maxHp: 8 },
  { id: 7, q: 2, r: -4, type: 'catapult', faction: 'b', hp: 4, maxHp: 4 },
  { id: 8, q: 3, r: -1, type: 'planeswalker', faction: 'b', hp: 8, maxHp: 8 },
];

const HERO_SOURCES = MAPS.isle.sources.map((s, i) => ({
  ...s,
  owner: (i % 3 === 0 ? 'a' : i % 3 === 1 ? 'b' : null) as Faction | null,
}));

export function HeroMap({ mapId = 'isle' as MapId }: { mapId?: MapId }) {
  const isIsle = mapId === 'isle';
  return (
    <div className="hero-stage">
      <Board
        map={MAPS[mapId]}
        units={isIsle ? HERO_UNITS : []}
        sources={isIsle ? HERO_SOURCES : MAPS[mapId].sources.map((s) => ({ ...s, owner: null }))}
      />
    </div>
  );
}

/* ---------- title ---------- */

function MenuBtn({ icon, title, desc, primary, onClick }: { icon: UnitType; title: string; desc: string; primary?: boolean; onClick?: () => void }) {
  return (
    <button className={'menu-btn' + (primary ? ' primary' : '')} onClick={onClick}>
      <span className="mb-ic"><Icon type={icon} /></span>
      <span className="mb-txt">
        <span className="mb-t">{title}</span>
        <span className="mb-d">{desc}</span>
      </span>
      <span className="mb-arrow">→</span>
    </button>
  );
}

export function TitleScreen({ onHost, onJoin, onHotseat, onRules }: { onHost: () => void; onJoin: () => void; onHotseat: () => void; onRules: () => void }) {
  return (
    <Screen className="title-a" label="Title">
      <HeroMap />
      <div className="title-scrim"></div>
      <div className="title-a-inner">
        <div className="title-kicker">a game of dice &amp; dominion</div>
        <h1 className="title-word">Shattered World</h1>
        <div className="title-rule"></div>
        <div className="menu-btns">
          <MenuBtn icon="defender" title="Host Game" desc="Create a battle & invite a friend" primary onClick={onHost} />
          <MenuBtn icon="mountedarcher" title="Join Game" desc="Enter a shared code to connect" onClick={onJoin} />
          <MenuBtn icon="translocator" title="Hotseat" desc="Two players, one screen" onClick={onHotseat} />
          <MenuBtn icon="healer" title="How to Play" desc="Learn the rules of the realm" onClick={onRules} />
        </div>
      </div>
      <div className="title-foot">
        <span>v1.0 · the parchment update</span>
        <span>control all nine Sources for three turns to win</span>
      </div>
    </Screen>
  );
}

/* ---------- lobby chrome ---------- */

function LobbyHead({ title, sub, onBack }: { title: string; sub: string; onBack?: () => void }) {
  return (
    <div className="lobby-head">
      <button className="lobby-back" onClick={onBack}>←</button>
      <div className="lobby-head-t"><b>{title}</b><i>{sub}</i></div>
      <div className="wc-wordmark lobby-mark">Shattered World</div>
    </div>
  );
}

/* ---------- host ---------- */

export function HostScreen({ code, error, onBack }: { code: string | null; error: string | null; onBack: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Screen className="lobby-screen" label="Host">
      <LobbyHead title="Host Game" sub="share the code · your friend joins" onBack={onBack} />
      <div className="lobby-body">
        <div className="wc-panel host-card">
          <div className="host-l">share this code with your opponent</div>
          <div className="code-box">
            <span className="code">{code ?? 'creating room…'}</span>
            <button
              className="copy-btn"
              disabled={!code}
              onClick={() => {
                if (code) void navigator.clipboard?.writeText(code);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? '✓ Copied' : '⧉ Copy'}
            </button>
          </div>
          <div className="host-hint">they paste it in <i>Join Game</i> to connect to your table.</div>
          {error && <div className="err-note">{error}</div>}
        </div>
        <div className="wait-row">
          <span className="spinner"></span>
          <span className="wait-t">
            Waiting for opponent to join<span className="dots"><i>.</i><i>.</i><i>.</i></span>
          </span>
        </div>
      </div>
      <div className="lobby-foot">
        <button className="ghost-btn" onClick={onBack}>Cancel</button>
        <span className="foot-note">the war room opens when they connect</span>
      </div>
    </Screen>
  );
}

/* ---------- join ---------- */

export function JoinScreen({ connecting, error, onConnect, onBack }: { connecting: boolean; error: string | null; onConnect: (code: string) => void; onBack: () => void }) {
  const [code, setCode] = useState('');
  return (
    <Screen className="lobby-screen" label="Join">
      <LobbyHead title="Join Game" sub="enter the code your host shared" onBack={onBack} />
      <div className="lobby-body">
        <div className="wc-panel join-card">
          <div className="host-l">opponent's code</div>
          <div className="code-field">
            <input
              value={code}
              placeholder="sw-xxxxx"
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && code.trim()) onConnect(code); }}
              autoFocus
            />
          </div>
          <button className="connect-btn" disabled={!code.trim() || connecting} onClick={() => onConnect(code)}>
            Connect to table
          </button>
          {connecting && (
            <div className="connect-state">
              <span className="spinner"></span>
              <span className="wait-t">Connecting to host<span className="dots"><i>.</i><i>.</i><i>.</i></span></span>
            </div>
          )}
          {error && <div className="err-note">{error}</div>}
        </div>
      </div>
      <div className="lobby-foot">
        <button className="ghost-btn" onClick={onBack}>Cancel</button>
        <span className="foot-note">codes look like sw-k7q2m — case-insensitive</span>
      </div>
    </Screen>
  );
}

/* ---------- war room ---------- */

export const MODES: Array<{ id: GameMode; t: string; s: string }> = [
  { id: 'control', t: 'Control', s: 'hold all 9 Sources for 3 full turns' },
  { id: 'gathering', t: 'The Gathering', s: 'first to double the starting mana' },
  { id: 'battle', t: 'Battle', s: 'no sources — annihilate the enemy' },
];

export function WarRoom({ isHost, code, mode, onMode, mapId, onMap, onStart, onBack }: {
  isHost: boolean;
  code: string;
  mode: GameMode;
  onMode: (m: GameMode) => void;
  mapId: MapId;
  onMap: (m: MapId) => void;
  onStart: () => void;
  onBack: () => void;
}) {
  const startMana = mode === 'battle' ? 200 : 30;
  return (
    <Screen className="lobby-screen" label="War Room">
      <LobbyHead title="War Room" sub={code} onBack={onBack} />
      <div className="lobby-body lobby-room">
        <div className="seat-row">
          <div className="wc-panel seat ready">
            <span className={'seat-disc f' + (isHost ? 'a' : 'b')}></span>
            <div className="seat-info"><b>You</b><i>{isHost ? 'Azure Vanguard · host' : 'Crimson Horde · joined'}</i></div>
            <span className="ready-pill on">ready</span>
          </div>
          <div className="vs-badge">vs</div>
          <div className="wc-panel seat ready">
            <span className={'seat-disc f' + (isHost ? 'b' : 'a')}></span>
            <div className="seat-info"><b>Rival</b><i>{isHost ? 'Crimson Horde · joined' : 'Azure Vanguard · host'}</i></div>
            <span className="ready-pill on">ready</span>
          </div>
        </div>
        <div className="lobby-mid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="map-thumb"><HeroMap mapId={mapId} /></div>
            <div className="mode-pick map-pick">
              {MAP_LIST.map((m) => (
                <button
                  key={m.id}
                  className={'mode' + (mapId === m.id ? ' on' : '')}
                  disabled={!isHost}
                  onClick={() => onMap(m.id)}
                >
                  <span className="mode-t">{m.name}</span>
                  <span className="mode-s">{m.blurb}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="lobby-rules-mini">
            <div className="lrm-h">{isHost ? 'choose the contest' : 'this table'}</div>
            <div className="mode-pick" style={{ flexDirection: 'column' }}>
              {MODES.map((m) => (
                <button
                  key={m.id}
                  className={'mode' + (mode === m.id ? ' on' : '')}
                  disabled={!isHost}
                  onClick={() => onMode(m.id)}
                >
                  <span className="mode-t">{m.t}</span>
                  <span className="mode-s">{m.s}</span>
                </button>
              ))}
            </div>
            <ul style={{ marginTop: 10 }}>
              <li><span>Starting mana</span><b>✦ {startMana}{mode !== 'battle' ? ' · +1 / source' : ''}</b></li>
              <li><span>First move</span><b>Azure Vanguard</b></li>
            </ul>
          </div>
        </div>
      </div>
      <div className="lobby-foot">
        <button className="ghost-btn" onClick={onBack}>Leave</button>
        {isHost ? (
          <button className="start-btn" onClick={onStart}>Start Battle →</button>
        ) : (
          <span className="wait-row"><span className="spinner"></span><span className="wait-t">The host is choosing the battle…</span></span>
        )}
      </div>
    </Screen>
  );
}

/* ---------- how to play (the real rules) ---------- */

const RULES: Array<{ ic: ReactNode; h: string; b: ReactNode }> = [
  {
    ic: <span className="rule-ic"><span className="ri-gem"></span></span>,
    h: 'The Objective — Control',
    b: <>Shift the nine mana <b>Sources</b> to your side. Begin your turn controlling all nine and still hold them at the end of the enemy's turn — do that <b>3 turns in a row</b> and the realm is yours.</>,
  },
  {
    ic: <span className="rule-ic ri-mana">✦</span>,
    h: 'Mana & Turns',
    b: <>Each turn: gain <b>✦1 per Source</b> you control, then summon, then move &amp; attack. Once you move or attack, the summoning portal closes for the turn.</>,
  },
  {
    ic: <span className="rule-ic"><Icon type="archer" /></span>,
    h: 'Summoning',
    b: <>Summon any units you can afford onto <b>free hexes of your portal</b>. There is no other limit — bring as many of one kind as you like.</>,
  },
  {
    ic: <span className="rule-ic"><Die value={5} /></span>,
    h: 'Combat',
    b: <>Attacker rolls <b>1d6 + ATK</b>, defender rolls <b>1d6 + DEF</b>. If the attacker is higher, the defender loses the difference in life. Ties go to the defender.</>,
  },
  {
    ic: <span className="rule-ic"><Icon type="swordsman" /></span>,
    h: 'Move & Attack',
    b: <>Each unit gets <b>one move and one attack</b>, in either order — but after a move-then-attack it may not move again. The Mounted Archer splits its move; the Barbarian strikes twice.</>,
  },
  {
    ic: <span className="rule-ic"><Icon type="defender" /></span>,
    h: 'Terrain & Elevation',
    b: <>Water is impassable; mountains are <b>high</b>, ramps and bridges <b>mid</b>, grass and sand <b>low</b>. You may move or melee only across <b>one grade</b> of elevation — use the ramps.</>,
  },
  {
    ic: <span className="rule-ic"><span className="ri-gem"></span></span>,
    h: 'Shifting Sources',
    b: <>Shifting is <b>attack-equivalent</b> and works only from an <b>adjacent hex</b> — range plays no role. A shifted Source pays you mana from your next turn, unless the enemy shifts it back.</>,
  },
  {
    ic: <span className="rule-ic"><Icon type="healer" /></span>,
    h: 'Specialists',
    b: <>The <b>Healer</b> mends or wounds 1 life per ✦1; the <b>Translocator</b> teleports allies or banishes foes to their portal; the <b>Planeswalker</b> crosses anything for ✦1 a hex. None of them can attack or shift.</>,
  },
];

export function RulesScreen({ onBack }: { onBack: () => void }) {
  return (
    <Screen className="rules-screen" label="How to Play">
      <LobbyHead title="How to Play" sub="the rules of the Shattered World · v1.0" onBack={onBack} />
      <div className="rules-grid">
        {RULES.map((r, i) => (
          <div key={i} className="rule">
            {r.ic}
            <div className="rule-txt">
              <div className="rule-h">{r.h}</div>
              <div className="rule-b">{r.b}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="lobby-foot">
        <button className="ghost-btn" onClick={onBack}>Back</button>
        <button className="start-btn" onClick={onBack}>Got it →</button>
      </div>
    </Screen>
  );
}

/* ---------- outcomes ---------- */

function BigCrest({ faction, broken }: { faction: Faction; broken?: boolean }) {
  return (
    <div className={'big-crest f' + faction}>
      <span className="bc-ring"></span>
      <span className="bc-disc"></span>
      <span className="bc-star">✦</span>
      {broken && <span className="bc-crack"></span>}
    </div>
  );
}

const WIN_TEXT: Record<GameMode, string> = {
  control: 'held all nine mana Sources for three full turns.',
  gathering: 'gathered the mana of a new age first.',
  battle: 'annihilated the enemy host to the last banner.',
};

export function OutcomeScreen({ g, me, names, onRematch, onMenu, rematchWaiting }: {
  g: GameState;
  me: Faction;
  names: Record<Faction, string>;
  onRematch: () => void;
  onMenu: () => void;
  rematchWaiting: boolean;
}) {
  const win = g.winner === me;
  const draw = g.draw;
  const myStats: FactionStats = g.stats[me];
  return (
    <Screen className={'outcome ' + (win || draw ? 'win' : 'lose')} label={win ? 'Victory' : 'Defeat'}>
      <div className="outcome-map"><Board map={mapOf(g)} units={[]} sources={g.sources} battleMode={g.mode === 'battle'} /></div>
      <div className="outcome-scrim"></div>
      <div className="outcome-inner">
        <BigCrest faction={win ? me : g.winner ?? me} broken={!win && !draw} />
        <div className="outcome-kicker">
          {draw ? 'the scales refuse to tip' : win ? 'the realm answers to you' : 'the Source slips from your grasp'}
        </div>
        <h1 className="outcome-title">{draw ? 'Draw' : win ? 'Victory' : 'Defeat'}</h1>
        <div className="outcome-sub">
          {draw ? 'Both sorcerers gathered equal power — the war ends in stalemate.'
            : g.lastEvent === 'resigned'
              ? `${names[g.winner === 'a' ? 'b' : 'a']} lays down arms — ${names[g.winner!]} claims the field.`
              : `${names[g.winner!]} ${WIN_TEXT[g.mode]}`}
        </div>
        <div className="stat-strip">
          <div className="ss-item"><b>{g.turnNum}</b><i>turns</i></div>
          <div className="ss-item"><b>{myStats.felled}</b><i>foes felled</i></div>
          <div className="ss-item"><b>{myStats.lost}</b><i>units lost</i></div>
          <div className="ss-item"><b>✦ {myStats.manaSpent}</b><i>mana spent</i></div>
          {g.mode !== 'battle' && <div className="ss-item"><b>{myStats.shifts}</b><i>sources shifted</i></div>}
        </div>
        <div className="outcome-btns">
          <button className="obtn primary" onClick={onRematch} disabled={rematchWaiting}>
            {rematchWaiting ? 'Awaiting rival…' : 'Rematch'}
          </button>
          <button className="obtn ghost" onClick={onMenu}>Main Menu</button>
        </div>
      </div>
    </Screen>
  );
}
