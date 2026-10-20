import { GOLD, type Item, type LootTable, type Project, type Range, type Scenario } from './types';

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function goldItem(): Item {
  return { id: GOLD, name: 'Gold', value: 1, autoSell: false };
}

export function newTable(name = 'New table'): LootTable {
  return { id: uid(), name, mode: 'weighted', rolls: { min: 1, max: 1 }, entries: [] };
}

export function defaultScenario(): Scenario {
  return { stepName: 'fight', steps: 40, runs: 2000, seed: 1, encounters: [], upkeep: 0, goals: [] };
}

export function emptyProject(): Project {
  return { format: 'hoard', version: 1, name: 'Untitled', items: [goldItem()], tables: [newTable()], scenario: defaultScenario() };
}

/** A small forest area: goblins and wolves, a rare-finds table nested in the goblin's, and three shop upgrades. */
export function sampleProject(): Project {
  const item = (id: string, name: string, value: number, autoSell = false): Item => ({ id, name, value, autoSell });
  const qty = (min: number, max = min): Range => ({ min, max });
  return {
    format: 'hoard',
    version: 1,
    name: 'Forest area',
    items: [
      goldItem(),
      item('ear', 'Goblin ear', 2, true),
      item('dagger', 'Rusty dagger', 9, true),
      item('herb', 'Healing herb', 4),
      item('pelt', 'Wolf pelt', 6, true),
      item('fang', 'Wolf fang', 3, true),
      item('ring', 'Silver ring', 45, true),
      item('moonblade', 'Moonblade', 600),
      item('steel', 'Steel sword', 60),
      item('mail', 'Chainmail', 120),
    ],
    tables: [
      {
        id: 'goblin',
        name: 'Goblin',
        mode: 'weighted',
        rolls: { min: 1, max: 2 },
        entries: [
          { id: 'g1', weight: 50, outcome: { kind: 'item', itemId: GOLD, qty: qty(2, 6) } },
          { id: 'g2', weight: 25, outcome: { kind: 'item', itemId: 'ear', qty: qty(1) } },
          { id: 'g3', weight: 8, outcome: { kind: 'item', itemId: 'dagger', qty: qty(1) } },
          { id: 'g4', weight: 10, outcome: { kind: 'item', itemId: 'herb', qty: qty(1, 2) } },
          { id: 'g5', weight: 2, outcome: { kind: 'table', tableId: 'rare' } },
          { id: 'g6', weight: 15, outcome: { kind: 'nothing' } },
        ],
      },
      {
        id: 'wolf',
        name: 'Wolf',
        mode: 'each',
        rolls: { min: 1, max: 1 },
        entries: [
          { id: 'w1', weight: 70, outcome: { kind: 'item', itemId: 'pelt', qty: qty(1) } },
          { id: 'w2', weight: 35, outcome: { kind: 'item', itemId: 'fang', qty: qty(1, 2) } },
          { id: 'w3', weight: 20, outcome: { kind: 'item', itemId: GOLD, qty: qty(1, 3) } },
        ],
      },
      {
        id: 'rare',
        name: 'Rare finds',
        mode: 'weighted',
        rolls: { min: 1, max: 1 },
        entries: [
          { id: 'r1', weight: 85, outcome: { kind: 'item', itemId: 'ring', qty: qty(1) } },
          { id: 'r2', weight: 15, outcome: { kind: 'item', itemId: 'moonblade', qty: qty(1) } },
        ],
      },
    ],
    scenario: {
      stepName: 'fight',
      steps: 40,
      runs: 2000,
      seed: 1,
      encounters: [
        { id: 'e1', tableId: 'goblin', count: 3 },
        { id: 'e2', tableId: 'wolf', count: 1 },
      ],
      upkeep: 6,
      goals: [
        { id: 'q1', itemId: 'steel', price: 150 },
        { id: 'q2', itemId: 'mail', price: 300 },
        { id: 'q3', itemId: 'moonblade', price: 1500 },
      ],
    },
  };
}

export interface Problem {
  level: 'error' | 'warning';
  message: string;
  /** The table to jump to when the problem is clicked. */
  tableId?: string;
}

/** Groups of tables that drop each other in a loop (A → B → A), which would never stop rolling. */
export function tableCycles(p: Project): string[][] {
  const children = new Map(
    p.tables.map((t) => [t.id, t.entries.flatMap((e) => (e.outcome.kind === 'table' ? [e.outcome.tableId] : []))]),
  );
  const state = new Map<string, 'open' | 'done'>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  const visit = (id: string) => {
    state.set(id, 'open');
    stack.push(id);
    for (const child of children.get(id) ?? []) {
      if (!children.has(child)) continue;
      if (state.get(child) === 'open') cycles.push(stack.slice(stack.indexOf(child)));
      else if (!state.has(child)) visit(child);
    }
    stack.pop();
    state.set(id, 'done');
  };
  for (const id of children.keys()) if (!state.has(id)) visit(id);
  return cycles;
}

function rangeProblem(r: Range): string | null {
  if (!Number.isInteger(r.min) || !Number.isInteger(r.max)) return 'must be whole numbers';
  if (r.min < 0) return 'cannot be negative';
  if (r.min > r.max) return 'min is above max';
  return null;
}

/** Everything that would make the numbers wrong or the simulation impossible. Errors block the simulation. */
export function problems(p: Project): Problem[] {
  const out: Problem[] = [];
  const error = (message: string, tableId?: string) => out.push({ level: 'error', message, tableId });
  const warning = (message: string, tableId?: string) => out.push({ level: 'warning', message, tableId });
  const items = new Set(p.items.map((i) => i.id));
  const tables = new Map(p.tables.map((t) => [t.id, t]));

  if (!items.has(GOLD)) error('The Gold item is missing.');
  for (const i of p.items) if (i.value < 0) error(`${i.name}: value cannot be negative.`);

  for (const t of p.tables) {
    const rolls = rangeProblem(t.rolls);
    if (rolls) error(`${t.name}: rolls ${rolls}.`, t.id);
    if (t.entries.length === 0) warning(`${t.name} has no entries, so it never drops anything.`, t.id);
    else if (t.mode === 'weighted' && t.entries.every((e) => e.weight === 0))
      warning(`${t.name}: every weight is 0, so it never drops anything.`, t.id);

    t.entries.forEach((e, n) => {
      const where = `${t.name}, entry ${n + 1}`;
      if (!(e.weight >= 0)) error(`${where}: ${t.mode === 'each' ? 'chance' : 'weight'} cannot be negative.`, t.id);
      if (t.mode === 'each' && e.weight > 100) error(`${where}: chance is above 100%.`, t.id);
      const o = e.outcome;
      if (o.kind === 'item') {
        if (!items.has(o.itemId)) error(`${where}: drops an item that no longer exists.`, t.id);
        const qty = rangeProblem(o.qty);
        if (qty) error(`${where}: quantity ${qty}.`, t.id);
      } else if (o.kind === 'table') {
        if (!tables.has(o.tableId)) error(`${where}: drops a table that no longer exists.`, t.id);
      } else if (t.mode === 'each') {
        warning(`${where}: "Nothing" has no effect when each entry rolls its own chance.`, t.id);
      }
    });
  }

  for (const cycle of tableCycles(p)) {
    const names = [...cycle, cycle[0]].map((id) => tables.get(id)!.name);
    error(`Tables drop each other in a loop: ${names.join(' → ')}.`, cycle[0]);
  }

  const s = p.scenario;
  if (!Number.isInteger(s.steps) || s.steps < 1) error(`The number of ${s.stepName}s must be a whole number of at least 1.`);
  if (!Number.isInteger(s.runs) || s.runs < 1) error('The number of runs must be a whole number of at least 1.');
  if (!(s.upkeep >= 0)) error('Upkeep cannot be negative.');
  if (s.encounters.length === 0) warning(`Nothing drops in the simulation: add what the player meets each ${s.stepName}.`);
  for (const e of s.encounters) {
    if (!tables.has(e.tableId)) error('An encounter uses a table that no longer exists.');
    if (!Number.isInteger(e.count) || e.count < 0) error('Encounter counts must be whole numbers, 0 or more.');
  }
  for (const g of s.goals) {
    if (!items.has(g.itemId)) error('A goal is for an item that no longer exists.');
    if (!(g.price >= 0)) error('Goal prices cannot be negative.');
  }
  return out;
}

class FileError extends Error {}

function check(ok: boolean, path: string, what: string): asserts ok {
  if (!ok) throw new FileError(`Not a Hoard project: ${path} ${what}.`);
}

function checkRange(r: unknown, path: string) {
  const range = r as Range;
  check(typeof range === 'object' && range !== null, path, 'is missing');
  check(typeof range.min === 'number' && typeof range.max === 'number', path, 'needs numeric min and max');
}

/** Throws a readable error unless `data` has the shape of a project file. Semantic issues are left to `problems`. */
export function assertProject(data: unknown): asserts data is Project {
  const p = data as Project;
  check(typeof p === 'object' && p !== null && p.format === 'hoard', 'format', 'is not "hoard"');
  check(p.version === 1, 'version', `${String(p.version)} is not supported`);
  check(typeof p.name === 'string', 'name', 'is missing');
  check(Array.isArray(p.items), 'items', 'is not a list');
  p.items.forEach((i, n) => {
    check(typeof i?.id === 'string' && typeof i.name === 'string', `items[${n}]`, 'needs an id and a name');
    check(typeof i.value === 'number' && typeof i.autoSell === 'boolean', `items[${n}]`, 'needs value and autoSell');
  });
  check(Array.isArray(p.tables), 'tables', 'is not a list');
  p.tables.forEach((t, n) => {
    const path = `tables[${n}]`;
    check(typeof t?.id === 'string' && typeof t.name === 'string', path, 'needs an id and a name');
    check(t.mode === 'weighted' || t.mode === 'each', `${path}.mode`, 'must be "weighted" or "each"');
    checkRange(t.rolls, `${path}.rolls`);
    check(Array.isArray(t.entries), `${path}.entries`, 'is not a list');
    t.entries.forEach((e, k) => {
      const at = `${path}.entries[${k}]`;
      check(typeof e?.id === 'string' && typeof e.weight === 'number', at, 'needs an id and a weight');
      const o = e.outcome;
      check(typeof o === 'object' && o !== null, `${at}.outcome`, 'is missing');
      if (o.kind === 'item') {
        check(typeof o.itemId === 'string', `${at}.outcome.itemId`, 'is missing');
        checkRange(o.qty, `${at}.outcome.qty`);
      } else if (o.kind === 'table') {
        check(typeof o.tableId === 'string', `${at}.outcome.tableId`, 'is missing');
      } else {
        check(o.kind === 'nothing', `${at}.outcome.kind`, 'is unknown');
      }
    });
  });
  const s = p.scenario;
  check(typeof s === 'object' && s !== null, 'scenario', 'is missing');
  check(typeof s.stepName === 'string', 'scenario.stepName', 'is missing');
  for (const key of ['steps', 'runs', 'seed', 'upkeep'] as const)
    check(typeof s[key] === 'number', `scenario.${key}`, 'is not a number');
  check(Array.isArray(s.encounters), 'scenario.encounters', 'is not a list');
  s.encounters.forEach((e, n) =>
    check(typeof e?.id === 'string' && typeof e.tableId === 'string' && typeof e.count === 'number', `scenario.encounters[${n}]`, 'is malformed'),
  );
  check(Array.isArray(s.goals), 'scenario.goals', 'is not a list');
  s.goals.forEach((g, n) =>
    check(typeof g?.id === 'string' && typeof g.itemId === 'string' && typeof g.price === 'number', `scenario.goals[${n}]`, 'is malformed'),
  );
}
