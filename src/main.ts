// Glue: wires the connection UI, the network peer, the game rules, and the
// board renderer together.

import './style.css';
import { Board } from './board';
import { Peer, type NetMessage } from './net';
import { applyMove, createInitialState, score, type GameState, type Player } from './game';

let state: GameState = createInitialState();
let myPlayer: Player | null = null;
let peer: Peer | null = null;
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
    peer!.send({ type: 'move', x, y });
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

function makePeer(): Peer {
  return new Peer({
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
  });
}

function wireUi(): void {
  $('btn-host').onclick = async () => {
    peer = makePeer();
    myPlayer = 0;
    setPhase('host');
    const offer = await peer.createOffer();
    $<HTMLTextAreaElement>('host-offer').value = offer;
  };

  $('btn-join').onclick = () => {
    peer = makePeer();
    myPlayer = 1;
    setPhase('guest');
  };

  $('btn-guest-answer').onclick = async () => {
    const offer = $<HTMLTextAreaElement>('guest-offer').value;
    if (!offer.trim() || !peer) return;
    const answer = await peer.createAnswer(offer);
    $<HTMLTextAreaElement>('guest-answer').value = answer;
  };

  $('btn-host-connect').onclick = async () => {
    const answer = $<HTMLTextAreaElement>('host-answer').value;
    if (!answer.trim() || !peer) return;
    await peer.acceptAnswer(answer);
  };

  $('btn-reset').onclick = () => {
    state = createInitialState();
    peer?.send({ type: 'reset' });
    redraw();
  };

  $('btn-copy-offer').onclick = () => copy($<HTMLTextAreaElement>('host-offer').value);
  $('btn-copy-answer').onclick = () => copy($<HTMLTextAreaElement>('guest-answer').value);
}

function copy(text: string): void {
  void navigator.clipboard?.writeText(text);
}

void main();
