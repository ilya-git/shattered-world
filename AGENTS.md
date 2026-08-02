# Agent guide — Shattered World

## The prime rule: Rules.docx is the law

**`Rules.docx` (repo root) is the authoritative specification for all game
mechanics.** Any change that touches gameplay — unit stats, turn structure,
combat, movement, terrain, victory conditions, mana, summoning, unit
specials — must match what that document says, exactly. When code and
Rules.docx disagree, the code is wrong.

Before changing anything in `src/game/`:

1. Read the relevant section of Rules.docx. It is a Word file; extract the
   text with e.g.:
   ```bash
   python3 -c "
   import zipfile
   from xml.etree import ElementTree as ET
   ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
   doc = ET.fromstring(zipfile.ZipFile('Rules.docx').read('word/document.xml'))
   for p in doc.iter(ns + 'p'):
       t = ''.join(x.text or '' for x in p.iter(ns + 't'))
       if t.strip(): print(t)
   "
   ```
2. If a behaviour isn't covered by the rules, prefer the most conservative
   reading and leave a comment citing the rule you interpreted.
3. Do not "balance", simplify, or extend the rules on your own initiative —
   surface the suggestion to the user instead.

Key rule anchors to check against (Rules.docx v1.0):

- **Turn**: gain ✦1 per controlled source → summon (only until the first
  move/attack) → move & attack in any order.
- **Per unit**: one move action + one attack per turn; move-then-attack
  forbids further movement. Exceptions: Mounted Archer splits its move,
  Barbarian attacks twice.
- **Combat**: 1d6 + ATK vs 1d6 + DEF; ties favour the defender; damage =
  difference. Catapult: min range 5, splash 1 auto-damage around the target
  (not the target), no dice for splash.
- **Unit table**: Appendix 1 — costs/move/life/atk/def/range and specials
  live in `src/game/data.ts` and must mirror it digit for digit.
- **Terrain/elevation**: Appendix 2 — low/mid/high grades; movement and
  melee only across ≤1 grade; water and sources impassable.
- **Shifting**: attack-equivalent, adjacent hex only, range irrelevant;
  units with "n/a" attack can neither attack nor shift.
- **Victory**: Control = hold all 9 sources for 3 continuous turns (counted
  begin-of-your-turn → end of enemy's turn); The Gathering = double the
  starting mana with the second player's catch-up turn; Battle = annihilation.

## Architecture constraints

- `src/game/` is a **pure, deterministic** rules engine. No rendering, no
  networking, no `Date.now`/`Math.random` — dice come from the seeded RNG
  inside `GameState`. Both peers replay the same actions on the same seed;
  any non-determinism desyncs multiplayer.
- Every gameplay change goes through `applyAction` (the single reducer) so
  it stays replayable over the wire. New mechanics = new `GameAction`
  variants, never direct state mutation from the UI.
- `src/ui/` renders the parchment ink-&-watercolor design from the Claude
  Design handoff; visual changes should stay in that language (IM Fell
  English / Caveat, the PARCH palette, tile art in `public/tex/`).
- Maps live in `src/game/maps.ts`. "World of Amphis" is a faithful
  extraction of the sample map in Rules.docx — don't re-shape its terrain
  casually.

## Verifying changes

Always run, in this order:

```bash
npx tsc                            # typecheck (strict)
npx tsx scripts/engine-smoke.ts    # scripted rules checks — must end "all good"
npm run build                      # production build
```

When you change a rule's implementation, **add a check for it** to
`scripts/engine-smoke.ts`, citing the rule. For UI changes, verify in the
browser (`npm run dev`, use the Hotseat mode to drive both factions from
one screen).

## Deploying

Pushes to `main` deploy to GitHub Pages via `.github/workflows/deploy.yml`.
Don't commit `dist/` (it's gitignored) or Office lock files (`~$*`).

## Version

Version that is shown on the home screen should be updated with each commit (minor) (v1.0 -> v1.1, etc.)
