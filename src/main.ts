// Glue: wires the connection UI, the network peer, the game rules, and the
// board renderer together.

import './style.css';
import { Board } from './board';
import { Net, type NetMessage } from './net';
import { applyMove, createInitialState, score, type GameState, type Player } from './game';

let state: GameState = createInitialState();
let myPlayer: Player | null = null;
let net: Net | null = null;
let connected = false;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const board = new Board(handleLocalClick);

async function main(): Promise<void> {
  await board.init($('board'));
  wireUi();
  redraw();
}

function setPhase(phase: string): void {
  document.querySelectorAll<HTMLElement>('section[data-phase]').forEach((s) => {
    s.hidden = s.dataset.phase !== phase;
  });
}

function redraw(): void {
  board.render(state, connected ? myPlayer : null);

  const [a, b] = score(state);
  $('score').textContent = `🔵 ${a}   🔴 ${b}`;

  let status: string;
  if (!connected) {
    status = 'Not connected';
  } else if (state.over) {
    status = a === b ? 'Game over — draw!' : a > b ? '🔵 wins!' : '🔴 wins!';
  } else if (state.current === myPlayer) {
    status = 'Your turn';
  } else {
    status = "Opponent's turn";
  }
  $('status').textContent = status;
}

function handleLocalClick(x: number, y: number): void {
  if (!connected || myPlayer === null) return;
  if (applyMove(state, x, y, myPlayer)) {
    net!.send({ type: 'move', x, y });
    redraw();
  }
}

function handleMessage(msg: NetMessage): void {
  if (msg.type === 'move') {
    // The sender is, by definition, the other player from our point of view.
    const mover: Player = myPlayer === 0 ? 1 : 0;
    applyMove(state, msg.x, msg.y, mover);
    redraw();
  } else if (msg.type === 'reset') {
    state = createInitialState();
    redraw();
  }
}

function makeNet(): Net {
  return new Net({
    onOpen: () => {
      connected = true;
      setPhase('playing');
      redraw();
    },
    onClose: () => {
      connected = false;
      redraw();
    },
    onMessage: handleMessage,
    onError: (message) => {
      $('status').textContent = message;
    },
  });
}

function wireUi(): void {
  $('btn-host').onclick = async () => {
    net = makeNet();
    myPlayer = 0;
    setPhase('host');
    const code = await net.host();
    $<HTMLInputElement>('host-code').value = code;
  };

  $('btn-join').onclick = () => {
    net = makeNet();
    myPlayer = 1;
    setPhase('guest');
  };

  $('btn-join-connect').onclick = () => {
    const code = $<HTMLInputElement>('guest-code').value;
    if (!code.trim() || !net) return;
    $('status').textContent = 'Connecting…';
    net.join(code);
  };

  $('btn-reset').onclick = () => {
    state = createInitialState();
    net?.send({ type: 'reset' });
    redraw();
  };

  $('btn-copy-code').onclick = () => copy($<HTMLInputElement>('host-code').value);
}

function copy(text: string): void {
  void navigator.clipboard?.writeText(text);
}

void main();
