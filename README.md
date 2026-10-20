# Hoard

A loot-table and game-economy simulator. Define items and the loot tables that drop them, describe what the player meets each fight, add the shop upgrades they're saving for, and Hoard shows two things side by side:

- the **exact** drop maths: average quantity, chance of at least one, and "1 in N" odds for every item, through nested tables;
- a **Monte Carlo** run of the whole scenario: gold on hand over time (median and spread), when each upgrade is reached, and how lucky or unlucky drops can be.

I'm building it to balance loot and progression for my own games instead of doing it in spreadsheets. It sits next to [Forge](https://github.com/Heavenswind/Forge), my game design document tool, where the items are designed; importing them from Forge is on the [roadmap](ROADMAP.md).

## Features

- **Items** with a sell value, and an auto-sell switch for vendor trash (it turns into gold as soon as it drops). Gold is built in.
- **Loot tables:**
  - Two modes: each roll *picks one entry by weight*, or each roll *checks every entry's own chance* (so one kill can drop several things or nothing).
  - A range of rolls per drop (e.g. 1–2) and a quantity range per entry.
  - Entries can roll another table ("2% → Rare finds"), nested as deep as you like.
- **Exact rates** for the selected table, and the expected gold per step for the whole scenario (dropped gold plus auto-sold items, minus upkeep).
- **Scenario:** steps (call them fights, runs or days), encounters per step (3 × Goblin, 1 × Wolf), gold upkeep per step, and shop goals bought in order as soon as they're affordable. A goal also counts as reached if the item drops first.
- **Simulation:** thousands of seeded runs (the same seed always gives the same result), re-run automatically a moment after each edit. It shows:
  - gold on hand per step, as the median with the 10th–90th percentile band;
  - the chance of having each goal item by step N, the step by which half and 90% of runs have it, and how often it came from a drop;
  - per-item totals over a run, with their spread.
- **Problems panel:** missing items or tables, tables that drop each other in a loop, impossible ranges, chances over 100%. The simulation waits until errors are fixed.
- **Editing:** undo/redo for everything, including New / Sample / Open; typing into a field counts as one step.
- **Files:** autosaves in the browser; **Save** / **Open** use `.hoard.json` files.

## Built with

React 18 and TypeScript, with Zustand for state, plain SVG for the charts, and Vite and Vitest for building and testing. The model (exact rates, simulation, validation, edits, undo history) is plain TypeScript with no UI dependencies, and the tests check the simulation against the exact maths.

## Running it

Requires Node.js 20 or newer.

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for the model, rates and simulation
npm run build      # production build in dist/
```

Click **Sample** to load a small forest area (goblins, wolves, a nested rare-finds table and three shop upgrades) to see how it fits together.

## How the numbers work

- **Weighted table:** each roll picks one entry with probability weight ÷ total weight. "Nothing" is just an entry with a weight.
- **Each-chance table:** each roll checks every entry against its own percent chance, independently.
- **Rolls per drop:** a whole number picked uniformly in the range, then that many independent rolls.
- **Chance of at least one** accounts for quantities that can roll 0, multiple rolls and nested tables.
- **One step** of the simulation: every encounter drops its table, auto-sold items turn into gold, upkeep is paid (gold never goes below 0), then the player buys the next goal in the list if they can afford it, repeating while they can.

## Keyboard

| Key | Action |
|---|---|
| Ctrl+Z, Ctrl+Y (or Ctrl+Shift+Z) | Undo, redo (outside text fields) |
| ← / → / Home / End on a chart | Move the readout between steps |

## File format

A project is JSON with `items`, `tables` (each with `mode`, `rolls` and `entries`) and a `scenario`; see [`src/model/types.ts`](src/model/types.ts). It's meant to be loaded by a game as-is; a matching Unity roller is on the [roadmap](ROADMAP.md).

## License

[MIT](LICENSE)
