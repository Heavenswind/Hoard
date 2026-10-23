// Monte Carlo: play the scenario many times with real dice and summarise what happened.
// Assumes `problems(project)` has no errors (no loops, no missing references).

import { randInt, rng, type Rng } from './random';
import { GOLD, type Entry, type Project } from './types';

export interface Percentiles {
  p10: number[];
  p50: number[];
  p90: number[];
  mean: number[];
}

export interface ItemResult {
  itemId: string;
  /** Total dropped over the whole run (auto-sold copies included): mean and spread across runs. */
  total: { mean: number; p10: number; p50: number; p90: number };
  /** byStep[k]: share of runs that had at least one drop by the end of step k + 1. */
  byStep: number[];
}

export interface GoalResult {
  goalId: string;
  /** byStep[k]: share of runs that had the item (dropped or bought) by the end of step k + 1. */
  byStep: number[];
  /** First step by which half / 90% of runs had it, or null if that never happens within the scenario. */
  step50: number | null;
  step90: number | null;
  /** Share of runs that got it from a drop rather than the shop. */
  viaDrop: number;
}

export interface SimResult {
  runs: number;
  steps: number;
  /** Gold on hand after each step (after upkeep and purchases). Index k is step k + 1. */
  gold: Percentiles;
  items: ItemResult[];
  goals: GoalResult[];
  /** When runs have every goal at once. Empty byStep when there are no goals. */
  allGoals: { byStep: number[]; step50: number | null };
}

const ITEM = 0;
const TABLE = 1;
const NOTHING = 2;

interface CompiledEntry {
  kind: number;
  /** Cumulative weight (weighted tables) or chance 0–1 (each tables). */
  threshold: number;
  item: number;
  qtyMin: number;
  qtyMax: number;
  table: number;
}

interface CompiledTable {
  each: boolean;
  rollMin: number;
  rollMax: number;
  total: number;
  entries: CompiledEntry[];
  /** Weighted tables: entries that drop on every roll, outside the weighted pick. */
  always: CompiledEntry[];
  /** Bad-luck protection: index of the guaranteed entry in `entries`, or -1. */
  pity: number;
  /** Misses before the guarantee kicks in. */
  pityAfter: number;
  /** Rolls since the pity entry last hit; reset at the start of every run. */
  misses: number;
}

function compile(p: Project): CompiledTable[] {
  const itemIndex = new Map(p.items.map((i, n) => [i.id, n]));
  const tableIndex = new Map(p.tables.map((t, n) => [t.id, n]));
  const luck = Math.max(p.scenario.luck ?? 1, 0);
  return p.tables.map((t) => {
    const each = t.mode === 'each';
    const toEntry = (e: Entry, threshold: number): CompiledEntry => {
      const o = e.outcome;
      return {
        kind: o.kind === 'item' ? ITEM : o.kind === 'table' ? TABLE : NOTHING,
        threshold,
        item: o.kind === 'item' ? itemIndex.get(o.itemId)! : -1,
        qtyMin: o.kind === 'item' ? o.qty.min : 0,
        qtyMax: o.kind === 'item' ? o.qty.max : 0,
        table: o.kind === 'table' ? tableIndex.get(o.tableId)! : -1,
      };
    };
    let cumulative = 0;
    const always: CompiledEntry[] = [];
    const entries: CompiledEntry[] = [];
    const pickIds: string[] = [];
    for (const e of t.entries) {
      const weight = Math.max(e.weight, 0) * (e.lucky ? luck : 1);
      if (!each && e.always) {
        always.push(toEntry(e, 0));
        continue;
      }
      cumulative += weight;
      entries.push(toEntry(e, each ? weight / 100 : cumulative));
      pickIds.push(e.id);
    }
    const pity = !each && t.pity ? pickIds.indexOf(t.pity.entryId) : -1;
    return {
      each,
      rollMin: t.rolls.min,
      rollMax: t.rolls.max,
      total: cumulative,
      entries,
      always,
      pity,
      pityAfter: pity >= 0 ? t.pity!.after : 0,
      misses: 0,
    };
  });
}

/** Linear-interpolated quantile of a sorted array. */
function quantile(sorted: ArrayLike<number>, q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, sorted.length - 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Turns "first step it happened" per run (or -1 for never) into the cumulative share by each step. */
function cumulative(firstStep: Int32Array, steps: number): number[] {
  const counts = new Array<number>(steps).fill(0);
  for (const s of firstStep) if (s >= 0) counts[s]++;
  let sum = 0;
  return counts.map((c) => (sum += c) / firstStep.length);
}

function firstStepReaching(byStep: number[], share: number): number | null {
  const k = byStep.findIndex((x) => x >= share - 1e-12);
  return k < 0 ? null : k + 1;
}

export function simulate(p: Project): SimResult {
  const { steps, runs, upkeep } = p.scenario;
  const tables = compile(p);
  const tableIndex = new Map(p.tables.map((t, n) => [t.id, n]));
  const encounters = p.scenario.encounters.map((e) => ({ table: tableIndex.get(e.tableId)!, count: e.count }));
  const nItems = p.items.length;
  const gold = p.items.findIndex((i) => i.id === GOLD);
  const autoSell = p.items.map((i) => i.autoSell && i.id !== GOLD);
  const value = p.items.map((i) => i.value);
  const goals = p.scenario.goals.map((g) => ({ item: p.items.findIndex((i) => i.id === g.itemId), price: g.price }));

  const goldAt = new Float64Array(steps * runs); // [step * runs + run]
  const totals = Array.from({ length: nItems }, () => new Float64Array(runs));
  const firstDrop = Array.from({ length: nItems }, () => new Int32Array(runs).fill(-1));
  const goalStep = goals.map(() => new Int32Array(runs).fill(-1));
  const goalViaDrop = goals.map(() => 0);

  const next: Rng = rng(p.scenario.seed);
  const inventory = new Float64Array(nItems);
  let run = 0;
  let step = 0;

  const give = (item: number, qty: number) => {
    if (qty <= 0) return;
    totals[item][run] += qty;
    if (firstDrop[item][run] < 0) firstDrop[item][run] = step;
    if (autoSell[item]) inventory[gold] += qty * value[item];
    else inventory[item] += qty;
  };

  const apply = (e: CompiledEntry) => {
    if (e.kind === ITEM) give(e.item, randInt(next, e.qtyMin, e.qtyMax));
    else if (e.kind === TABLE) drop(tables[e.table]);
  };

  const drop = (t: CompiledTable) => {
    const rolls = randInt(next, t.rollMin, t.rollMax);
    for (let r = 0; r < rolls; r++) {
      if (t.each) {
        for (const e of t.entries) if (next() < e.threshold) apply(e);
      } else {
        for (const e of t.always) apply(e);
        let e: CompiledEntry | undefined;
        if (t.pity >= 0 && t.misses >= t.pityAfter) e = t.entries[t.pity];
        else if (t.total > 0) {
          const x = next() * t.total;
          e = t.entries.find((e) => x < e.threshold);
        }
        if (t.pity >= 0) t.misses = e === t.entries[t.pity] ? 0 : t.misses + 1;
        if (e) apply(e);
      }
    }
  };

  for (run = 0; run < runs; run++) {
    inventory.fill(0);
    for (const t of tables) t.misses = 0;
    let saving = 0; // the goal the player is currently saving for
    for (step = 0; step < steps; step++) {
      for (const enc of encounters) for (let c = 0; c < enc.count; c++) drop(tables[enc.table]);
      inventory[gold] = Math.max(0, inventory[gold] - upkeep);

      goals.forEach((g, n) => {
        if (goalStep[n][run] < 0 && firstDrop[g.item][run] >= 0) {
          goalStep[n][run] = step;
          goalViaDrop[n]++;
        }
      });
      while (saving < goals.length) {
        const g = goals[saving];
        if (goalStep[saving][run] < 0) {
          if (inventory[gold] < g.price) break;
          inventory[gold] -= g.price;
          inventory[g.item]++;
          goalStep[saving][run] = step;
        }
        saving++;
      }
      goldAt[step * runs + run] = inventory[gold];
    }
  }

  // A run has every goal at the latest of its goal steps, or never if one is missing.
  const allStep = new Int32Array(runs).fill(-1);
  if (goals.length > 0) {
    for (let r = 0; r < runs; r++) {
      let latest = 0;
      for (const reached of goalStep) latest = reached[r] < 0 || latest < 0 ? -1 : Math.max(latest, reached[r]);
      allStep[r] = latest;
    }
  }
  const allByStep = goals.length > 0 ? cumulative(allStep, steps) : [];

  const goldStats: Percentiles = { p10: [], p50: [], p90: [], mean: [] };
  for (let s = 0; s < steps; s++) {
    const column = goldAt.slice(s * runs, (s + 1) * runs).sort();
    goldStats.p10.push(quantile(column, 0.1));
    goldStats.p50.push(quantile(column, 0.5));
    goldStats.p90.push(quantile(column, 0.9));
    goldStats.mean.push(column.reduce((a, b) => a + b, 0) / runs);
  }

  return {
    runs,
    steps,
    gold: goldStats,
    items: p.items.map((item, n) => {
      const sorted = totals[n].slice().sort();
      return {
        itemId: item.id,
        total: {
          mean: sorted.reduce((a, b) => a + b, 0) / runs,
          p10: quantile(sorted, 0.1),
          p50: quantile(sorted, 0.5),
          p90: quantile(sorted, 0.9),
        },
        byStep: cumulative(firstDrop[n], steps),
      };
    }),
    goals: p.scenario.goals.map((g, n) => {
      const byStep = cumulative(goalStep[n], steps);
      return {
        goalId: g.id,
        byStep,
        step50: firstStepReaching(byStep, 0.5),
        step90: firstStepReaching(byStep, 0.9),
        viaDrop: goalViaDrop[n] / runs,
      };
    }),
    allGoals: { byStep: allByStep, step50: firstStepReaching(allByStep, 0.5) },
  };
}
