# Shattered World

A serverless, peer-to-peer, turn-based strategy game that runs entirely in the
browser. Two players connect directly over WebRTC — no backend, no accounts.

This is a **starter scaffold**: the multiplayer plumbing and a placeholder
"claim the tiles" game are fully working, ready for you to swap in your real
strategy rules and artwork.

## Stack

- **TypeScript + Vite** — dev server and static build
- **PixiJS v8** — board / sprite rendering on a WebGL canvas
- **PeerJS** — WebRTC DataChannel with automatic signaling via a free public broker
- Static hosting (GitHub Pages, Netlify, or just opening the built files)

## Run it

```bash
npm install
npm run dev
```

Open the printed URL. To play with a friend, both of you open the deployed site
(or use two browser windows to test locally).

## How connecting works

You share **one** code, host → guest:

1. **Host** clicks *Host a game* → copies the room code → sends it to the friend.
2. **Guest** clicks *Join a game* → pastes the code → clicks *Join game*.

PeerJS's free public **broker** performs the WebRTC offer/answer exchange
automatically, so you don't paste a reply back. The broker only introduces the
two browsers — once connected, all game messages flow **directly** between them.

Google's public **STUN** server is used only to discover each peer's public
address so the connection can cross typical home routers. It never sees your
game data. On restrictive (symmetric) NATs a direct connection may fail — that
case needs a **TURN** relay, which would be an actual server.

> **Note on the free broker:** the default `0.peerjs.com` broker is shared and
> can be slow or briefly unavailable. For something more reliable you can run
> your own [PeerServer](https://github.com/peers/peerjs-server) (a tiny
> signaling-only service — no game data passes through it) and point the client
> at it via the `host`/`port` options in [`src/net.ts`](src/net.ts).

## The placeholder game

9×9 grid. You start with one tile (host top-left, guest bottom-right). On your
turn, click an empty tile orthogonally adjacent to one you own to claim it.
Legal moves are outlined in green. When neither player can move, the most tiles
wins.

## Build & deploy

```bash
npm run build      # outputs to dist/
npm run preview    # serve the build locally
```

`dist/` is a static site — drop it on any static host. `vite.config.ts` uses a
relative `base` so it works from a sub-path (e.g. a GitHub Pages project URL).

## Where to take it next

- **Game rules** live in [`src/game.ts`](src/game.ts) — pure, deterministic
  functions. Both peers run identical logic and only exchange the move that was
  made, so keep new rules deterministic and route every state change through a
  `NetMessage`.
- **Rendering** is in [`src/board.ts`](src/board.ts) — swap the colored
  `Graphics` cells for `Sprite`s to use generated art.
- **Networking** is in [`src/net.ts`](src/net.ts) — the message protocol is the
  `NetMessage` union; add new message types there. Swap the broker or STUN/TURN
  config in the same file.
