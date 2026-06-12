# CLAUDE.md

@AGENTS.md

The one rule that outranks everything: **`Rules.docx` is the authoritative
game specification.** Any code change affecting gameplay must be checked
against it — unit stats, turn order, combat dice, terrain/elevation,
shifting, and victory conditions. If the rules and the code disagree, fix
the code; never adjust a mechanic away from the document without the user
asking for it.

After gameplay changes, run `npx tsx scripts/engine-smoke.ts` and keep it
ending in "all good".
