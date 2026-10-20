// Exact drop maths, no simulation: expected quantities and the chance of getting at least one of each item.
// Works through nested tables. Broken references and loops count as "nothing" here; `problems` reports them.

import { GOLD, type LootTable, type Outcome, type Project, type Range } from './types';

export interface Rate {
  /** Average quantity. */
  expected: number;
  /** Chance of getting at least one. */
  chance: number;
}

const mean = (r: Range) => (r.min + r.max) / 2;

/** Chance that a uniform quantity roll gives at least 1. */
function chancePositive(r: Range): number {
  if (r.max < 1 || r.max < r.min) return 0;
  return (r.max - Math.max(r.min, 1) + 1) / (r.max - r.min + 1);
}

/** Probability of each entry in a single roll: its share of the total weight, or its own chance. */
export function entryChances(t: LootTable): number[] {
  if (t.mode === 'each') return t.entries.map((e) => Math.min(Math.max(e.weight, 0) / 100, 1));
  const total = t.entries.reduce((sum, e) => sum + Math.max(e.weight, 0), 0);
  return t.entries.map((e) => (total > 0 ? Math.max(e.weight, 0) / total : 0));
}

class Calculator {
  private tables: Map<string, LootTable>;
  private expectedMemo = new Map<string, Map<string, number>>();
  private chanceMemo = new Map<string, number>();
  private visiting = new Set<string>();

  constructor(p: Project) {
    this.tables = new Map(p.tables.map((t) => [t.id, t]));
  }

  /** Expected quantity of every item from one drop of the table. */
  expected(tableId: string): Map<string, number> {
    const memo = this.expectedMemo.get(tableId);
    if (memo) return memo;
    const t = this.tables.get(tableId);
    if (!t || this.visiting.has(tableId)) return new Map();
    this.visiting.add(tableId);

    const out = new Map<string, number>();
    const add = (itemId: string, n: number) => out.set(itemId, (out.get(itemId) ?? 0) + n);
    const rolls = mean(t.rolls);
    entryChances(t).forEach((p, k) => {
      const o = t.entries[k].outcome;
      if (p === 0) return;
      if (o.kind === 'item') add(o.itemId, rolls * p * mean(o.qty));
      else if (o.kind === 'table') for (const [itemId, n] of this.expected(o.tableId)) add(itemId, rolls * p * n);
    });

    this.visiting.delete(tableId);
    this.expectedMemo.set(tableId, out);
    return out;
  }

  /** Chance that one drop of the table gives at least one of the item. */
  chance(tableId: string, itemId: string): number {
    const key = `${tableId}\u0000${itemId}`;
    const memo = this.chanceMemo.get(key);
    if (memo !== undefined) return memo;
    const t = this.tables.get(tableId);
    if (!t || this.visiting.has(key)) return 0;
    this.visiting.add(key);

    const hit = (o: Outcome) =>
      o.kind === 'item' ? (o.itemId === itemId ? chancePositive(o.qty) : 0) : o.kind === 'table' ? this.chance(o.tableId, itemId) : 0;
    const ps = entryChances(t);
    // A weighted roll picks one entry, so the misses add up; an 'each' roll misses only if every entry misses.
    const missOneRoll =
      t.mode === 'weighted'
        ? 1 - ps.reduce((sum, p, k) => sum + p * hit(t.entries[k].outcome), 0)
        : ps.reduce((prod, p, k) => prod * (1 - p * hit(t.entries[k].outcome)), 1);
    // Rolls are independent; average the miss chance over the equally likely roll counts.
    let miss = 0;
    const counts = t.rolls.max - t.rolls.min + 1;
    for (let r = t.rolls.min; r <= t.rolls.max; r++) miss += missOneRoll ** r / counts;
    const result = counts >= 1 ? 1 - miss : 0;

    this.visiting.delete(key);
    this.chanceMemo.set(key, result);
    return result;
  }
}

/** Expected quantity and chance of at least one, for every item a single drop of the table can give. */
export function tableRates(p: Project, tableId: string): Map<string, Rate> {
  const calc = new Calculator(p);
  const out = new Map<string, Rate>();
  for (const [itemId, expected] of calc.expected(tableId)) out.set(itemId, { expected, chance: calc.chance(tableId, itemId) });
  return out;
}

export interface StepRates {
  items: Map<string, Rate>;
  /** Expected gold per step from drops, counting auto-sold items at their value. */
  goldIn: number;
  /** goldIn minus upkeep. */
  net: number;
}

/** The same numbers for one whole step of the scenario: every encounter, every kill. */
export function stepRates(p: Project): StepRates {
  const calc = new Calculator(p);
  const expected = new Map<string, number>();
  const miss = new Map<string, number>();
  for (const e of p.scenario.encounters) {
    if (e.count <= 0) continue;
    for (const [itemId, n] of calc.expected(e.tableId)) {
      expected.set(itemId, (expected.get(itemId) ?? 0) + e.count * n);
      miss.set(itemId, (miss.get(itemId) ?? 1) * (1 - calc.chance(e.tableId, itemId)) ** e.count);
    }
  }
  const items = new Map<string, Rate>();
  for (const [itemId, n] of expected) items.set(itemId, { expected: n, chance: 1 - miss.get(itemId)! });

  let goldIn = expected.get(GOLD) ?? 0;
  for (const item of p.items) if (item.autoSell && item.id !== GOLD) goldIn += (expected.get(item.id) ?? 0) * item.value;
  return { items, goldIn, net: goldIn - p.scenario.upkeep };
}
