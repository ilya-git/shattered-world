# Shattered World

A serverless, peer-to-peer, turn-based hex strategy game that runs entirely in
the browser. Two sorcerers battle for the mana sources of a fractured astral
isle — dice combat, summoned armies, and three ways to win. Two players connect
directly over WebRTC; no backend, no accounts.

The rules implement **Rules.docx v1.0**; the visuals implement the parchment
ink-&-watercolor direction from the Claude Design handoff
(*Shattered World Screens.html*).

## The game

Two battlefields, picked by the host in the war room:

- **Sundered Isle** — a compact symmetric island for quick duels.
- **World of Amphis** — the sample map from the rulebook, extracted hex-by-hex
  from the image embedded in Rules.docx (terrain, the 9 marked sources and
  both 7-hex summoning portals), with pan & zoom on the board.

Victory modes:

- **Control** (default) — shift the nine mana **Sources** to your side and hold
  all of them for **3 continuous turns**.
- **The Gathering** — be the first to double the starting mana (the second
  player gets one catch-up turn if the first-mover hits the goal first).
- **Battle** — no sources, ✦200 to spend, annihilate the enemy.
- **Hotseat** — both factions on one screen, no network needed.

Each turn: gain ✦1 per controlled source → summon at your portal (until your
first move/attack) → move & attack in any order. Combat is 1d6 + ATK vs
1d6 + DEF; ties favor the defender, damage is the difference.

The full nine-unit roster is in: Archer (+1 range/✦1), Swordsman (+1 move/✦1),
Planeswalker (✦1/hex over anything), Catapult (min range 5, splash),
Defender (+2 DEF aura), Barbarian (attacks twice), Mounted Archer (shot on the
run), Healer (mend/wound 1 life/✦1) and Translocator (translocate / banish).
Terrain has three elevation grades — movement and melee only work across one
grade, so mountains need ramps and water needs bridges.

## Stack

- **TypeScript + Vite + React** — UI and static build
- **PeerJS** — WebRTC DataChannel with automatic signaling via a free public broker
- Static hosting (GitHub Pages via the included workflow)

## Run it

```bash
npm install
npm run dev
```

Open the printed URL. To play with a friend, both of you open the deployed site
(or use two browser windows to test locally). One **Hosts** and shares the room
code; the other **Joins** with it. The host picks the mode in the war room and
starts the battle.

## How multiplayer works

Both peers run the **identical, deterministic rules engine**
([`src/game/engine.ts`](src/game/engine.ts)) from the same RNG seed, so only
the actions a player takes ever travel over the wire (`NetMessage` in
[`src/net.ts`](src/net.ts)). Dice are rolled from the shared seed — neither
client can cheat without desyncing.

PeerJS's free public **broker** performs the WebRTC offer/answer exchange; once
connected, all game traffic flows directly between the browsers. STUN
(Google's public server) handles typical home NATs; a free-tier Metered **TURN**
relay covers restrictive networks.

## Project layout

- [`src/game/`](src/game/) — pure rules: hex math, unit data, the map, and the
  action reducer. No rendering or networking; keep changes deterministic.
- [`src/ui/`](src/ui/) — the parchment UI: board, panels, screens, battle.
- [`src/App.tsx`](src/App.tsx) — flow (title → lobby → battle → outcome) and
  the lockstep dispatch.
- [`scripts/engine-smoke.ts`](scripts/engine-smoke.ts) — scripted rules check:
  `npx tsx scripts/engine-smoke.ts`

## Build & deploy

```bash
npm run build      # outputs to dist/
npm run preview    # serve the build locally
```

Pushes to `main` deploy to GitHub Pages via the included workflow.
