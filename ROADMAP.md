# Roadmap

Work I plan to do, roughly in order. Effort estimates are rough.

## Loot tables (≈7 h)

- [x] Bad-luck protection: guarantee an entry after N misses (pity timers), in both the exact maths and the simulation
- [ ] "Always drops" entries alongside the weighted pick (e.g. gold on every kill plus one weighted item)
- [ ] Luck / magic-find multiplier that scales chosen entries, to test gear that boosts rare drops
- [ ] Duplicate a table, and drag to reorder entries
- [ ] Notes per table and entry, shown in exports

## Economy (≈10 h)

- [ ] Crafting recipes (3 iron ore + 1 coal → iron bar), crafted automatically in the simulation when a goal needs them
- [ ] More currencies than gold (gems, tokens), with prices in any of them
- [ ] Scenario phases: different encounters for fights 1–10, 11–25 and so on
- [ ] XP and levels: XP per encounter, a level curve, and a "level by step N" chart
- [ ] Upkeep that grows with the step or with the gear the player owns

## Analysis (≈7 h)

- [ ] Compare two versions of a project side by side (before / after a balance change)
- [ ] Sweep one number (a weight, a price) and chart how the goal timing moves
- [ ] Luck histogram for any item's total, and a view of the unluckiest 1% of runs
- [ ] Run big simulations in a Web Worker, with progress and cancel
- [ ] Export results as CSV

## Game integration (≈7 h)

- [ ] Import items from a Forge GDD
- [ ] Unity package: C# loader and roller for the project JSON, following the same rules as `src/model/simulate.ts`
- [ ] Shared test fixtures so the TypeScript and C# rollers must agree
- [ ] JSON Schema for the file format
- [ ] CSV import / export of tables, for round trips through a spreadsheet

## Quality (≈4 h)

- [ ] Component tests for the table editor and the charts
- [ ] File format migrations when the version number changes
- [x] GitHub Actions: typecheck, test and build on every push
- [ ] Deploy the app to GitHub Pages
- [ ] Narrow-screen layout and a light theme
