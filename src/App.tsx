// Top-level flow: Title → Host/Join → War Room → Battle → Outcome, with the
// PeerJS lockstep underneath. Both peers run the identical engine on the same
// seed, so only GameActions ever travel over the wire.

import { useEffect, useRef, useState } from 'react';
import { Net, type NetMessage } from './net';
import {
  applyAction, createGame, RuleError,
  type GameAction, type GameMode, type GameState,
} from './game/engine';
import type { MapId } from './game/maps';
import type { Faction } from './game/data';
import { clearSave, loadSave, saveGame, type SavedGame } from './save';
import { BattleScreen } from './ui/battle';
import { HostScreen, JoinScreen, OutcomeScreen, ResumeScreen, RulesScreen, TitleScreen, WarRoom } from './ui/screens';

type Route =
  | { s: 'title' }
  | { s: 'rules' }
  | { s: 'resume' }
  | { s: 'host' }
  | { s: 'join' }
  | { s: 'warroom' }
  | { s: 'battle' };

const startManaFor = (mode: GameMode): number => (mode === 'battle' ? 200 : 30);

export default function App() {
  const [route, setRoute] = useState<Route>({ s: 'title' });
  const [hotseat, setHotseat] = useState(false);
  const [isHost, setIsHost] = useState(true);
  const [code, setCode] = useState<string | null>(null);
  const [netError, setNetError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [mode, setMode] = useState<GameMode>('control');
  const [mapId, setMapId] = useState<MapId>('isle');
  const [game, setGame] = useState<GameState | null>(null);
  const [rematchAsked, setRematchAsked] = useState(false);
  /** the saved battle the host chose to continue, until it is dealt out */
  const [resume, setResume] = useState<GameState | null>(null);
  const [saved, setSaved] = useState<SavedGame | null>(null);

  const netRef = useRef<Net | null>(null);
  const gameRef = useRef<GameState | null>(null);
  gameRef.current = game;
  const isHostRef = useRef(isHost);
  isHostRef.current = isHost;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const mapRef = useRef(mapId);
  mapRef.current = mapId;

  const startLocal = (seed: number, m: GameMode, mp: MapId) => {
    setGame(createGame(seed, m, startManaFor(m), 'a', mp));
    setRematchAsked(false);
    setRoute({ s: 'battle' });
  };

  // mirror every state change into the save slot; a finished battle clears it
  useEffect(() => {
    if (!game) return;
    if (game.winner || game.draw) clearSave();
    else saveGame(game, hotseat);
  }, [game, hotseat]);

  const handleMessage = (msg: NetMessage) => {
    if (msg.type === 'lobby') {
      // host's war-room choices, mirrored read-only on the guest
      setMode(msg.mode);
      setMapId(msg.mapId);
    } else if (msg.type === 'start') {
      setMode(msg.mode);
      setMapId(msg.mapId);
      // a resuming host ships the whole state; otherwise deal from the seed
      setGame(msg.state ?? createGame(msg.seed, msg.mode, msg.startMana, 'a', msg.mapId));
      setRematchAsked(false);
      setRoute({ s: 'battle' });
    } else if (msg.type === 'action') {
      const g = gameRef.current;
      if (!g) return;
      try {
        setGame(applyAction(g, msg.action));
      } catch (e) {
        // states diverged or a stray message — surface it rather than desync
        console.error('remote action rejected', msg.action, e);
      }
    } else if (msg.type === 'rematch') {
      if (isHostRef.current) {
        // guest asked for a rematch — host deals the next battle
        const m = modeRef.current;
        const mp = mapRef.current;
        const seed = (Math.random() * 0x7fffffff) | 0;
        netRef.current?.send({ type: 'start', seed, mode: m, startMana: startManaFor(m), mapId: mp });
        startLocal(seed, m, mp);
      } else {
        setRematchAsked(true);
      }
    }
  };

  const makeNet = () => {
    const net = new Net({
      onOpen: () => {
        setConnecting(false);
        setNetError(null);
        setRoute({ s: 'warroom' });
        // the host announces its current table setup the moment the guest sits down
        if (isHostRef.current) {
          net.send({ type: 'lobby', mode: modeRef.current, mapId: mapRef.current });
        }
      },
      onClose: () => {
        setNetError('Connection lost.');
        setRoute((r) => (r.s === 'battle' || r.s === 'warroom' ? { s: 'title' } : r));
      },
      onMessage: handleMessage,
      onError: (message) => {
        setNetError(message);
        setConnecting(false);
      },
    });
    netRef.current = net;
    return net;
  };

  useEffect(() => () => netRef.current?.close?.(), []);

  /** open a room; `carry` is the saved battle to resume, or null for a fresh one */
  const beginHost = async (carry: GameState | null) => {
    setHotseat(false);
    setIsHost(true);
    setNetError(null);
    setResume(carry);
    if (carry) {
      setMode(carry.mode);
      setMapId(carry.mapId);
      modeRef.current = carry.mode;
      mapRef.current = carry.mapId;
    }
    setRoute({ s: 'host' });
    const net = makeNet();
    try {
      const c = await net.host();
      setCode(c);
    } catch {
      /* error already surfaced via onError */
    }
  };

  /* ---------- local dispatch: validate, apply, relay ---------- */

  const dispatch = (a: GameAction): boolean => {
    const g = gameRef.current;
    if (!g) return false;
    try {
      const next = applyAction(g, a);
      setGame(next);
      if (!hotseat) netRef.current?.send({ type: 'action', action: a });
      return true;
    } catch (e) {
      if (e instanceof RuleError) return false;
      throw e;
    }
  };

  const toTitle = () => {
    netRef.current = null;
    setGame(null);
    setCode(null);
    setNetError(null);
    setConnecting(false);
    setResume(null);
    setSaved(null);
    setRoute({ s: 'title' });
  };

  /* ---------- routes ---------- */

  if (route.s === 'rules') return <RulesScreen onBack={toTitle} />;

  if (route.s === 'resume' && saved) {
    return (
      <ResumeScreen
        saved={saved}
        onContinue={() => void beginHost(saved.state)}
        onNew={() => void beginHost(null)}
        onBack={toTitle}
      />
    );
  }

  if (route.s === 'host') {
    return <HostScreen code={code} error={netError} onBack={toTitle} />;
  }

  if (route.s === 'join') {
    return (
      <JoinScreen
        connecting={connecting}
        error={netError}
        onBack={toTitle}
        onConnect={(c) => {
          setConnecting(true);
          setNetError(null);
          netRef.current?.join(c.trim().toLowerCase());
        }}
      />
    );
  }

  if (route.s === 'warroom') {
    return (
      <WarRoom
        isHost={isHost}
        code={code ?? ''}
        mode={mode}
        onMode={(m) => {
          setMode(m);
          if (!hotseat) netRef.current?.send({ type: 'lobby', mode: m, mapId });
        }}
        mapId={mapId}
        onMap={(m) => {
          setMapId(m);
          if (!hotseat) netRef.current?.send({ type: 'lobby', mode, mapId: m });
        }}
        onBack={toTitle}
        resume={resume ? { turnNum: resume.turnNum } : null}
        onStart={() => {
          if (resume) {
            // hand the guest the exact state so both sides resume in lockstep
            netRef.current?.send({
              type: 'start', seed: resume.rng, mode: resume.mode,
              startMana: resume.startMana, mapId: resume.mapId, state: resume,
            });
            setGame(resume);
            setResume(null);
            setRematchAsked(false);
            setRoute({ s: 'battle' });
            return;
          }
          const seed = (Math.random() * 0x7fffffff) | 0;
          netRef.current?.send({ type: 'start', seed, mode, startMana: startManaFor(mode), mapId });
          startLocal(seed, mode, mapId);
        }}
      />
    );
  }

  if (route.s === 'battle' && game) {
    const me: Faction = hotseat ? game.turn : isHost ? 'a' : 'b';
    if (game.winner || game.draw) {
      return (
        <OutcomeScreen
          g={game}
          me={hotseat ? (game.winner ?? 'a') : me}
          names={{ a: 'Azure Vanguard', b: 'Crimson Horde' }}
          rematchWaiting={rematchAsked && !isHost}
          onMenu={toTitle}
          onRematch={() => {
            if (hotseat) {
              startLocal((Math.random() * 0x7fffffff) | 0, mode, mapId);
            } else if (isHost) {
              const seed = (Math.random() * 0x7fffffff) | 0;
              netRef.current?.send({ type: 'start', seed, mode, startMana: startManaFor(mode), mapId });
              startLocal(seed, mode, mapId);
            } else {
              netRef.current?.send({ type: 'rematch' });
              setRematchAsked(true);
            }
          }}
        />
      );
    }
    return (
      <BattleScreen
        g={game}
        me={me}
        hotseat={hotseat}
        dispatch={dispatch}
        onResign={() => dispatch({ kind: 'resign', faction: me })}
      />
    );
  }

  return (
    <TitleScreen
      onRules={() => setRoute({ s: 'rules' })}
      onHotseat={() => {
        setHotseat(true);
        setIsHost(true);
        setMode('control');
        setRoute({ s: 'warroom' });
        netRef.current = null;
        setCode('hotseat · one table');
      }}
      onHost={() => {
        // a battle left unfinished gets the choice of picking it back up
        const s = loadSave();
        if (s) {
          setSaved(s);
          setRoute({ s: 'resume' });
          return;
        }
        void beginHost(null);
      }}
      onJoin={() => {
        setHotseat(false);
        setIsHost(false);
        setNetError(null);
        makeNet();
        setRoute({ s: 'join' });
      }}
    />
  );
}
