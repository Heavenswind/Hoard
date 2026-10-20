// Immutable edits the UI applies through the store. Each returns a new project.

import { newTable, uid } from './project';
import { GOLD, type Encounter, type Entry, type Goal, type Item, type LootTable, type Project, type Range, type Scenario } from './types';

function mapById<T extends { id: string }>(list: T[], id: string, fn: (x: T) => T): T[] {
  return list.map((x) => (x.id === id ? fn(x) : x));
}

/** "New item", then "New item 2", "New item 3"… */
export function uniqueName(base: string, taken: string[]): string {
  const names = new Set(taken);
  if (!names.has(base)) return base;
  let n = 2;
  while (names.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

export function addItem(p: Project): Project {
  const item: Item = { id: uid(), name: uniqueName('New item', p.items.map((i) => i.name)), value: 1, autoSell: false };
  return { ...p, items: [...p.items, item] };
}

export function updateItem(p: Project, id: string, patch: Partial<Omit<Item, 'id'>>): Project {
  return { ...p, items: mapById(p.items, id, (i) => ({ ...i, ...patch })) };
}

/** Gold can't be removed: upkeep and prices are paid in it. */
export function removeItem(p: Project, id: string): Project {
  return id === GOLD ? p : { ...p, items: p.items.filter((i) => i.id !== id) };
}

/** Where an item is used, for explaining why it can't be deleted. */
export function itemUsages(p: Project, itemId: string): string[] {
  const out = p.tables
    .filter((t) => t.entries.some((e) => e.outcome.kind === 'item' && e.outcome.itemId === itemId))
    .map((t) => t.name);
  if (p.scenario.goals.some((g) => g.itemId === itemId)) out.push('shop goals');
  return out;
}

export function addTable(p: Project): { project: Project; id: string } {
  const table = newTable(uniqueName('New table', p.tables.map((t) => t.name)));
  return { project: { ...p, tables: [...p.tables, table] }, id: table.id };
}

export function updateTable(p: Project, id: string, fn: (t: LootTable) => LootTable): Project {
  return { ...p, tables: mapById(p.tables, id, fn) };
}

export function removeTable(p: Project, id: string): Project {
  return { ...p, tables: p.tables.filter((t) => t.id !== id) };
}

/** Other tables that drop this one, and the scenario if the player meets it. */
export function tableUsages(p: Project, tableId: string): string[] {
  const out = p.tables
    .filter((t) => t.id !== tableId && t.entries.some((e) => e.outcome.kind === 'table' && e.outcome.tableId === tableId))
    .map((t) => t.name);
  if (p.scenario.encounters.some((e) => e.tableId === tableId)) out.push('encounters');
  return out;
}

/** A new entry drops 1 gold: 10 weight in a weighted table, a 50% chance in an 'each' table. */
export function addEntry(p: Project, tableId: string): Project {
  return updateTable(p, tableId, (t) => {
    const entry: Entry = {
      id: uid(),
      weight: t.mode === 'each' ? 50 : 10,
      outcome: { kind: 'item', itemId: GOLD, qty: { min: 1, max: 1 } },
    };
    return { ...t, entries: [...t.entries, entry] };
  });
}

export function updateEntry(p: Project, tableId: string, entryId: string, patch: Partial<Omit<Entry, 'id'>>): Project {
  return updateTable(p, tableId, (t) => ({ ...t, entries: mapById(t.entries, entryId, (e) => ({ ...e, ...patch })) }));
}

/** Changes the quantity of an item entry; other entries are left alone. */
export function updateQty(p: Project, tableId: string, entryId: string, patch: Partial<Range>): Project {
  return updateTable(p, tableId, (t) => ({
    ...t,
    entries: mapById(t.entries, entryId, (e) =>
      e.outcome.kind === 'item' ? { ...e, outcome: { ...e.outcome, qty: { ...e.outcome.qty, ...patch } } } : e,
    ),
  }));
}

export function removeEntry(p: Project, tableId: string, entryId: string): Project {
  return updateTable(p, tableId, (t) => ({ ...t, entries: t.entries.filter((e) => e.id !== entryId) }));
}

export function moveEntry(p: Project, tableId: string, entryId: string, by: -1 | 1): Project {
  return updateTable(p, tableId, (t) => {
    const from = t.entries.findIndex((e) => e.id === entryId);
    const to = from + by;
    if (from < 0 || to < 0 || to >= t.entries.length) return t;
    const entries = [...t.entries];
    [entries[from], entries[to]] = [entries[to], entries[from]];
    return { ...t, entries };
  });
}

export function updateScenario(p: Project, patch: Partial<Scenario>): Project {
  return { ...p, scenario: { ...p.scenario, ...patch } };
}

export function addEncounter(p: Project): Project {
  const tableId = p.tables[0]?.id;
  if (!tableId) return p;
  const encounter: Encounter = { id: uid(), tableId, count: 1 };
  return updateScenario(p, { encounters: [...p.scenario.encounters, encounter] });
}

export function updateEncounter(p: Project, id: string, patch: Partial<Omit<Encounter, 'id'>>): Project {
  return updateScenario(p, { encounters: mapById(p.scenario.encounters, id, (e) => ({ ...e, ...patch })) });
}

export function removeEncounter(p: Project, id: string): Project {
  return updateScenario(p, { encounters: p.scenario.encounters.filter((e) => e.id !== id) });
}

export function addGoal(p: Project): Project {
  const item = p.items.find((i) => i.id !== GOLD) ?? p.items[0];
  const goal: Goal = { id: uid(), itemId: item.id, price: 100 };
  return updateScenario(p, { goals: [...p.scenario.goals, goal] });
}

export function updateGoal(p: Project, id: string, patch: Partial<Omit<Goal, 'id'>>): Project {
  return updateScenario(p, { goals: mapById(p.scenario.goals, id, (g) => ({ ...g, ...patch })) });
}

export function removeGoal(p: Project, id: string): Project {
  return updateScenario(p, { goals: p.scenario.goals.filter((g) => g.id !== id) });
}

export function moveGoal(p: Project, id: string, by: -1 | 1): Project {
  const goals = [...p.scenario.goals];
  const from = goals.findIndex((g) => g.id === id);
  const to = from + by;
  if (from < 0 || to < 0 || to >= goals.length) return p;
  [goals[from], goals[to]] = [goals[to], goals[from]];
  return updateScenario(p, { goals });
}
