// Quick scripted exercise of the rules engine (not shipped; run with tsx).
import {
  applyAction, attackTargets, createGame, planeswalkCells, reachableCells,
  shiftTargets, summonCells, threatCells, type GameAction, type GameState,
} from '../src/game/engine';
import { MAPS } from '../src/game/maps';
import { STATS } from '../src/game/data';

const PORTALS = MAPS.isle.portals;
const SOURCE_HEXES = MAPS.isle.sources;

let failures = 0;
function check(cond: unknown, label: string): void {
  if (!cond) {
    failures++;
    console.error('FAIL:', label);
  } else {
    console.log('ok:', label);
  }
}
function expectThrow(g: GameState, a: GameAction, label: string): void {
  try {
    applyAction(g, a);
    failures++;
    console.error('FAIL (no throw):', label);
  } catch {
    console.log('ok (rejected):', label);
  }
}

let g = createGame(42, 'control', 30, 'a');
check(g.sources.length === 9, '9 neutral sources');
check(g.mana.a === 30 && g.mana.b === 30, 'starting mana 30');

// summoning
const slotA = summonCells(g, 'a');
check(slotA.length === 3, 'three free portal hexes');
g = applyAction(g, { kind: 'summon', ut: 'swordsman', q: slotA[0].q, r: slotA[0].r });
check(g.mana.a === 22, 'swordsman costs 8');
g = applyAction(g, { kind: 'summon', ut: 'archer', q: slotA[1].q, r: slotA[1].r });
g = applyAction(g, { kind: 'summon', ut: 'healer', q: slotA[2].q, r: slotA[2].r });
check(summonCells(g, 'a').length === 0, 'portal now full');
expectThrow(g, { kind: 'summon', ut: 'healer', q: slotA[0].q, r: slotA[0].r }, 'no summon onto occupied portal');

// movement
const sword = g.units[0];
const reach = reachableCells(g, sword);
check(reach.length > 0, 'swordsman has moves');
check(reach.every((c) => c.n <= 6 + g.mana.a), 'reach bounded by move+mana');
check(reach.some((c) => c.manaCost > 0), 'swordsman forced march beyond 6 costs mana');
const sixStep = reach.filter((c) => c.manaCost === 0);
check(sixStep.every((c) => c.n <= 6), 'free reach ≤ 6 move points');
const dest = sixStep.sort((x, y) => y.n - x.n)[0];
g = applyAction(g, { kind: 'move', id: sword.id, q: dest.q, r: dest.r });
check(g.actedThisTurn, 'moving records the first action of the turn');
// house rule (diverges from Rules.docx "you cannot summon … after you have
// made a move or attack"): the portal stays open for the whole turn
{
  const freed = summonCells(g, 'a');
  check(freed.length > 0, 'the moved unit frees its portal hex');
  const manaBefore = g.mana.a;
  g = applyAction(g, { kind: 'summon', ut: 'healer', q: freed[0].q, r: freed[0].r });
  check(g.mana.a === manaBefore - STATS.healer.cost, 'summoning still allowed after moving');
}
check(reachableCells(g, g.units.find((u) => u.id === sword.id)!).length === 0, 'one move action per turn');

g = applyAction(g, { kind: 'endTurn' });
check(g.turn === 'b', 'turn passes to b');
check(g.mana.b === 30, 'no income without sources');

// b summons a planeswalker and walks over water
const slotB = summonCells(g, 'b');
g = applyAction(g, { kind: 'summon', ut: 'planeswalker', q: slotB[0].q, r: slotB[0].r });
const pw = g.units.find((u) => u.type === 'planeswalker')!;
const pwc = planeswalkCells(g, pw);
check(pwc.length > 0 && pwc.every((c) => c.manaCost === c.n), 'planeswalk ✦1/hex');
// walking beats walking between worlds: a hex the planeswalker can simply
// stroll to is still free, even though planeswalk also offers it
const walkKeys = new Set(reachableCells(g, pw).map((c) => c.q + ',' + c.r));
const both = pwc.find((c) => walkKeys.has(c.q + ',' + c.r));
check(!!both, 'some hexes are reachable both on foot and between worlds');
const manaBefore = g.mana.b;
g = applyAction(g, { kind: 'move', id: pw.id, q: both!.q, r: both!.r });
check(g.mana.b === manaBefore, 'ordinary walking stays free for the planeswalker');
g = applyAction(g, { kind: 'endTurn' });

// shifting: drop a swordsman next to a source artificially via many turns is
// slow — instead test target computation directly
const src = SOURCE_HEXES[0];
const sNear = g.units.find((u) => u.id === sword.id)!;
sNear.q = src.q + 1; sNear.r = src.r; // teleport for the test
const st = shiftTargets(g, sNear);
check(st.some((s) => s.q === src.q && s.r === src.r), 'adjacent source is shiftable');
g = applyAction(g, { kind: 'shift', id: sNear.id, q: src.q, r: src.r });
check(g.sources.find((s) => s.q === src.q && s.r === src.r)!.owner === 'a', 'source shifted to a');
g = applyAction(g, { kind: 'endTurn' });
g = applyAction(g, { kind: 'endTurn' });
check(g.mana.a > 0 && g.sources.filter((s) => s.owner === 'a').length === 1, 'income +1 for one source');

// combat: archer range 5 +1/mana
const archer = g.units.find((u) => u.type === 'archer')!;
const foe = g.units.find((u) => u.type === 'planeswalker')!;
archer.q = foe.q - 6; archer.r = foe.r; // distance 6 — needs ✦1
const ts = attackTargets(g, archer);
const t6 = ts.find((c) => c.q === foe.q && c.r === foe.r);
check(!!t6 && t6.manaCost === 1, 'archer pays ✦1 for range 6');
const hpBefore = foe.hp;
const diceBefore = g.stats.a.dice;
g = applyAction(g, { kind: 'attack', id: archer.id, q: foe.q, r: foe.r });
check(g.stats.a.dice === diceBefore + 1, 'dice rolled');
const foeAfter = g.units.find((u) => u.id === foe.id);
check(!foeAfter || foeAfter.hp <= hpBefore, 'damage applied (or deflected)');
check(g.lastCombat !== null, 'combat reported');

// determinism: same seed + same actions = same state
const g1 = createGame(7, 'control', 30, 'a');
const g2 = createGame(7, 'control', 30, 'a');
const acts: GameAction[] = [
  { kind: 'summon', ut: 'barbarian', q: PORTALS.a[0].q, r: PORTALS.a[0].r },
  { kind: 'endTurn' },
  { kind: 'summon', ut: 'barbarian', q: PORTALS.b[0].q, r: PORTALS.b[0].r },
  { kind: 'endTurn' },
];
let s1 = g1; let s2 = g2;
for (const a of acts) { s1 = applyAction(s1, a); s2 = applyAction(s2, a); }
check(JSON.stringify(s1) === JSON.stringify(s2), 'lockstep determinism');

// control victory: own all 9 sources across 3 full cycles
let cg = createGame(1, 'control', 30, 'a');
cg.sources.forEach((s) => (s.owner = 'a'));
cg = applyAction(cg, { kind: 'endTurn' }); // a ends (pending not yet set — set at a's turn start)
cg = applyAction(cg, { kind: 'endTurn' }); // b ends → a starts with all → pending a
for (let i = 0; i < 6 && !cg.winner; i++) cg = applyAction(cg, { kind: 'endTurn' });
check(cg.winner === 'a', 'control victory after 3 held cycles');

// battle mode: no sources, wipe wins
let bg = createGame(3, 'battle', 200, 'a');
check(bg.sources.length === 0, 'battle mode strips sources');
bg = applyAction(bg, { kind: 'summon', ut: 'barbarian', q: PORTALS.a[0].q, r: PORTALS.a[0].r });
bg = applyAction(bg, { kind: 'endTurn' });
bg = applyAction(bg, { kind: 'summon', ut: 'healer', q: PORTALS.b[0].q, r: PORTALS.b[0].r });
bg = applyAction(bg, { kind: 'endTurn' });
// melee kill: put the barbarian next to the healer and batter it
const barb = bg.units.find((u) => u.type === 'barbarian')!;
const heal = bg.units.find((u) => u.type === 'healer')!;
barb.q = heal.q; barb.r = heal.r + 1;
for (let turn = 0; turn < 30 && !bg.winner; turn++) {
  const b2 = bg.units.find((u) => u.type === 'barbarian');
  const h2 = bg.units.find((u) => u.type === 'healer');
  if (!b2 || !h2) break;
  const tgts = attackTargets(bg, b2);
  if (tgts.length) bg = applyAction(bg, { kind: 'attack', id: b2.id, q: h2.q, r: h2.r });
  if (bg.winner) break;
  bg = applyAction(bg, { kind: 'endTurn' });
  bg = applyAction(bg, { kind: 'endTurn' });
}
check(bg.winner === 'a', 'battle mode: wiping the enemy wins');

// gathering goal
let gg = createGame(5, 'gathering', 30, 'a');
check(gg.goalMana === 60, 'gathering goal doubles start');
gg.mana.b = 61;
gg = applyAction(gg, { kind: 'endTurn' }); // a ends
gg = applyAction(gg, { kind: 'endTurn' }); // b ends with 61 → b wins (second player, no extra turn)
check(gg.winner === 'b', 'gathering: second player wins outright');

let gg2 = createGame(5, 'gathering', 30, 'a');
gg2.mana.a = 70;
gg2 = applyAction(gg2, { kind: 'endTurn' }); // a ends with 70 → b gets a catch-up turn
check(gg2.winner === null && gg2.gatherExtra === 'b', 'gathering: first player triggers extra turn');
gg2.mana.b = 75;
gg2 = applyAction(gg2, { kind: 'endTurn' });
check(gg2.winner === 'b', 'gathering: overtaken in the extra turn');

// melee elevation: grass unit cannot strike a mountain unit
const eg = createGame(9, 'control', 30, 'a');
const low = { ...eg.units, };
void low;
const gsword = { id: 99, type: 'swordsman' as const, faction: 'a' as const, q: 0, r: -4, hp: 10, movePts: 6, moveActs: 1, attacks: 1, moved: false, moveLocked: false, abilityLock: null };
const highFoe = { id: 100, type: 'barbarian' as const, faction: 'b' as const, q: 1, r: -4, hp: 12, movePts: 8, moveActs: 1, attacks: 2, moved: false, moveLocked: false, abilityLock: null };
eg.units.push(gsword, highFoe);
check(attackTargets(eg, gsword).length === 0, 'melee blocked across two elevation grades');
check(STATS.catapult.minRng === 5, 'catapult min range 5');
// house rule: Defender life 8 (Appendix 1 prints 5)
check(STATS.defender.life === 8, 'defender life 8 (house rule)');


// ---- World of Amphis (rulebook sample map) sanity ----
{
  const am = MAPS.amphis;
  check(am.sources.length === 9, 'amphis: 9 sources');
  check(am.portals.a.length === 7 && am.portals.b.length === 7, 'amphis: 7-hex portals');
  const ag = createGame(11, 'control', 30, 'a', 'amphis');
  check(ag.sources.length === 9, 'amphis: game starts with 9 neutral sources');
  const cells = summonCells(ag, 'a');
  check(cells.length === 7, 'amphis: 7 free summon hexes');
  let g2 = applyAction(ag, { kind: 'summon', ut: 'planeswalker', q: cells[0].q, r: cells[0].r });
  const pw2 = g2.units[0];
  check(planeswalkCells(g2, pw2).length > 0, 'amphis: planeswalk works');
  // a hex only the between-worlds step can reach: Move pays ✦1/hex itself
  {
    const walk = new Set(reachableCells(g2, pw2).map((c) => c.q + ',' + c.r));
    const only = planeswalkCells(g2, pw2).filter((c) => !walk.has(c.q + ',' + c.r));
    check(only.length > 0, 'amphis: some hexes need the between-worlds step');
    const dest = only.sort((x, y) => y.n - x.n)[0];
    const before = g2.mana.a;
    g2 = applyAction(g2, { kind: 'move', id: pw2.id, q: dest.q, r: dest.r });
    const moved = g2.units.find((u) => u.id === pw2.id)!;
    check(moved.q === dest.q && moved.r === dest.r, 'amphis: planeswalker arrived via Move');
    check(g2.mana.a === before - dest.n, `amphis: Move billed ✦${dest.n} automatically`);
  }
  const r2 = reachableCells(g2, pw2);
  check(r2.length > 0, 'amphis: movement works on the big map');
}


// ---- every map: sources shiftable, portals interconnected ----
{
  const GRADE: Record<string, number> = { grass:1, water:1, sand:1, forest:1, source:2, portal:2, bridge:2, ramp:2, mountain:3, desert:3 };
  const PASSABLE_T = new Set(['grass','sand','forest','portal','bridge','ramp','mountain','desert']);
  const DIRS6 = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
  const key = (q: number, r: number) => q + ',' + r;
  for (const am of Object.values(MAPS)) {
    check(am.sources.length === 9, `${am.id}: 9 sources`);
    const start = am.portals.a[0];
    const seen = new Set([key(start.q, start.r)]);
    const queue = [start];
    while (queue.length) {
      const cur = queue.pop()!;
      const ct = am.terrain.get(key(cur.q, cur.r))!;
      for (const [dq, dr] of DIRS6) {
        const nq = cur.q + dq, nr = cur.r + dr, k = key(nq, nr);
        if (seen.has(k)) continue;
        const t = am.terrain.get(k);
        if (!t || !PASSABLE_T.has(t)) continue;
        if (Math.abs(GRADE[ct] - GRADE[t]) > 1) continue;
        seen.add(k); queue.push({ q: nq, r: nr });
      }
    }
    check(am.portals.b.some((p2) => seen.has(key(p2.q, p2.r))), `${am.id}: portals interconnected`);
    const allShiftable = am.sources.every((src) =>
      DIRS6.some(([dq, dr]) => seen.has(key(src.q + dq, src.r + dr))),
    );
    check(allShiftable, `${am.id}: every source has a reachable shifting spot`);
  }
}

// ---- World of Amphis: exactly 180°-symmetric (rotation p -> S-p, A<->B) ----
{
  const am = MAPS.amphis;
  const S = { q: 18, r: 44 }; // centroid of portal A + centroid of portal B
  let bad = 0;
  for (const [k, t] of am.terrain) {
    const [q, r] = k.split(',').map(Number);
    if (am.terrain.get((S.q - q) + ',' + (S.r - r)) !== t) bad++;
  }
  check(bad === 0, 'amphis: terrain exactly 180°-symmetric');
  check(
    am.sources.every((s) => am.sources.some((o) => o.q === S.q - s.q && o.r === S.r - s.r)),
    'amphis: sources symmetric under rotation',
  );
  check(
    am.portals.a.every((p) => am.portals.b.some((o) => o.q === S.q - p.q && o.r === S.r - p.r)),
    'amphis: portal A rotates onto portal B',
  );
}

// ---- battle log: heal applications merge into one entry ----
{
  let hg = createGame(21, 'control', 30, 'a');
  const hs = summonCells(hg, 'a');
  hg = applyAction(hg, { kind: 'summon', ut: 'healer', q: hs[0].q, r: hs[0].r });
  hg = applyAction(hg, { kind: 'summon', ut: 'swordsman', q: hs[1].q, r: hs[1].r });
  hg.units.find((u) => u.type === 'swordsman')!.hp = 5;
  const healer = hg.units.find((u) => u.type === 'healer')!;
  const swordId = hg.units.find((u) => u.type === 'swordsman')!.id;
  const before = hg.log.length;
  hg = applyAction(hg, { kind: 'heal', id: healer.id, targetId: swordId });
  hg = applyAction(hg, { kind: 'heal', id: healer.id, targetId: swordId });
  check(hg.units.find((u) => u.id === swordId)!.hp === 7, 'log: two mends heal 2');
  check(hg.log.length === before + 1 && hg.log[hg.log.length - 1].text.includes('+2'),
    'log: repeated mends merge into one entry (+2)');
  check(hg.log.some((e) => e.kind === 'summon'), 'log: summons recorded');
}

// ---- threat projection: move-then-attack envelope, never mana-boosted ----
{
  const dist = (a: { q: number; r: number }, b: { q: number; r: number }) =>
    (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
  const spawn = (ut: 'swordsman' | 'archer' | 'catapult' | 'healer') => {
    let tg = createGame(7, 'control', 30, 'a');
    const slot = summonCells(tg, 'a')[0];
    tg = applyAction(tg, { kind: 'summon', ut, q: slot.q, r: slot.r });
    return { g: tg, u: tg.units[0] };
  };

  // "n/a" attack: both of its options cost mana, so it threatens nothing
  const hz = spawn('healer');
  check(threatCells(hz.g, hz.u).length === 0, 'threat: healer threatens nothing');

  // envelope is bounded by move + range, and mana never widens it
  for (const ut of ['swordsman', 'archer'] as const) {
    const { g: tg, u } = spawn(ut);
    const s = STATS[ut];
    const cells = threatCells(tg, u);
    check(cells.length > 0, `threat: ${ut} projects a threat zone`);
    check(cells.every((c) => dist(u, c) <= s.move + s.rng),
      `threat: ${ut} envelope within move+range (${s.move}+${s.rng})`);
    const rich = { ...tg, mana: { a: 99, b: 99 } };
    check(threatCells(rich, u).length === cells.length,
      `threat: ${ut} ignores mana (no forced march / paid reach)`);
  }

  // catapult keeps its blind spot: min range 5 can't be undone by move 3
  const cat = spawn('catapult');
  check(
    threatCells(cat.g, cat.u).every((c) => dist(cat.u, c) > 1),
    'threat: catapult min range 5 still shields its own doorstep',
  );
}

console.log(failures ? `\n${failures} FAILURES` : '\nall good');
process.exit(failures ? 1 : 0);