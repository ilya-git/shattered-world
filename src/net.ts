// Peer-to-peer transport using PeerJS.
//
// PeerJS runs a free public "broker" (signaling) server that automatically
// performs the WebRTC offer/answer exchange. That means only ONE code travels
// between players — the host's room code. The guest connects to it and the
// broker introduces the two browsers. After the introduction, all game data
// flows DIRECTLY browser-to-browser; the broker is no longer involved.
//
// Google's public STUN server is supplied so the direct connection can cross
// typical home routers. (Restrictive symmetric NATs would still need a TURN
// relay — see the README.)

import Peer, { type DataConnection } from 'peerjs';
import type { GameAction, GameMode } from './game/engine';
import type { MapId } from './game/maps';

export type NetMessage =
  | { type: 'lobby'; mode: GameMode; mapId: MapId }
  | { type: 'start'; seed: number; mode: GameMode; startMana: number; mapId: MapId }
  | { type: 'action'; action: GameAction }
  | { type: 'rematch' };

interface Handlers {
  onOpen: () => void;
  onClose: () => void;
  onMessage: (msg: NetMessage) => void;
  onError?: (message: string) => void;
}

// TURN relay for restrictive NATs (mobile/CGNAT, corporate firewalls) — STUN
// alone can't connect those, and as of mid-2026 no TURN service works without
// an account (PeerJS's bundled eu-0/us-0.turn.peerjs.com relays are gone from
// DNS; the anonymous openrelay endpoints stopped allocating). These static
// credentials come from a free-tier Metered account (20 GB/mo relay traffic,
// manage at https://dashboard.metered.ca). They are necessarily readable in
// the shipped bundle — fine for a quota-capped hobby relay; rotate them from
// the dashboard if needed.
const TURN_URLS: string[] = [
  'turn:global.relay.metered.ca:80',
  'turn:global.relay.metered.ca:80?transport=tcp',
  'turn:global.relay.metered.ca:443',
  'turns:global.relay.metered.ca:443?transport=tcp', // TLS, strictest firewalls
];
const TURN_USERNAME = '08e4671c3fbf74214b0aa2e8';
const TURN_CREDENTIAL = 'hg8084OcLOVt1eNe';

// Fresh options object per Peer — PeerJS may mutate what it's given, so the
// host and guest must not share one reference.
function peerOptions() {
  const iceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
  if (TURN_URLS.length > 0 && TURN_USERNAME && TURN_CREDENTIAL) {
    iceServers.push({ urls: TURN_URLS, username: TURN_USERNAME, credential: TURN_CREDENTIAL });
  }
  return { config: { iceServers } };
}

export class Net {
  private peer?: Peer;
  private conn?: DataConnection;
  private handlers: Handlers;

  constructor(handlers: Handlers) {
    this.handlers = handlers;
  }

  /** Host: register a short room code with the broker and wait for the guest. */
  host(): Promise<string> {
    const code = makeRoomCode();
    this.peer = new Peer(code, peerOptions());
    return new Promise((resolve, reject) => {
      this.peer!.on('open', (id) => resolve(id));
      this.peer!.on('connection', (conn) => this.setupConn(conn));
      this.peer!.on('error', (err) => {
        this.handlers.onError?.(friendlyError(err));
        reject(err);
      });
    });
  }

  /** Guest: connect to the host's room code via the broker. */
  join(code: string): void {
    this.peer = new Peer(peerOptions());
    this.peer.on('open', () => {
      const conn = this.peer!.connect(code.trim(), { reliable: true });
      this.setupConn(conn);
    });
    this.peer.on('error', (err) => this.handlers.onError?.(friendlyError(err)));
  }

  send(msg: NetMessage): void {
    if (this.conn?.open) {
      void this.conn.send(msg);
    }
  }

  /** Tear down the connection and broker registration. */
  close(): void {
    this.conn?.close();
    this.peer?.destroy();
  }

  private setupConn(conn: DataConnection): void {
    this.conn = conn;
    conn.on('open', () => this.handlers.onOpen());
    conn.on('close', () => this.handlers.onClose());
    conn.on('error', (err) => this.handlers.onError?.(friendlyError(err)));
    conn.on('data', (data) => {
      try {
        const msg = (typeof data === 'string' ? JSON.parse(data) : data) as NetMessage;
        this.handlers.onMessage(msg);
      } catch {
        /* ignore malformed messages */
      }
    });
  }
}

// Short, human-shareable code, e.g. "sw-k7q2m". Namespaced with a prefix to
// reduce collisions on the shared public broker.
function makeRoomCode(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789'; // omit easily-confused chars
  let code = 'sw-';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function friendlyError(err: { type?: string; message?: string }): string {
  if (err.type === 'peer-unavailable') return "Couldn't find that room — check the code.";
  if (err.type === 'unavailable-id') return 'Room code already taken — try hosting again.';
  if (err.type === 'network' || err.type === 'server-error') {
    return 'Connection to the matchmaking service failed — try again.';
  }
  return err.message || 'Connection error.';
}
