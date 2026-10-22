import { describe, expect, it } from 'vitest';
import { assertProject, emptyProject, problems, sampleProject, tableCycles } from './project';
import { randInt, rng } from './random';
import type { Project } from './types';

const messages = (p: Project) => problems(p).map((x) => `${x.level}: ${x.message}`);

describe('project', () => {
  it('ships a sample and an empty project with no errors', () => {
    expect(messages(sampleProject())).toEqual([]);
    expect(problems(emptyProject()).filter((x) => x.level === 'error')).toEqual([]);
  });

  it('round-trips through JSON and passes the file check', () => {
    const data: unknown = JSON.parse(JSON.stringify(sampleProject()));
    expect(() => assertProject(data)).not.toThrow();
  });

  it('rejects files that are not projects, naming the bad field', () => {
    expect(() => assertProject({ format: 'blockout' })).toThrow(/format/);
    const p = JSON.parse(JSON.stringify(sampleProject()));
    p.tables[0].entries[1].outcome = { kind: 'chest' };
    expect(() => assertProject(p)).toThrow('tables[0].entries[1].outcome.kind');
    p.tables[0].entries[1].outcome = { kind: 'item', itemId: 'ear' };
    expect(() => assertProject(p)).toThrow('tables[0].entries[1].outcome.qty');
    p.tables[0].entries[1].outcome = { kind: 'item', itemId: 'ear', qty: { min: 1, max: 1 } };
    p.tables[0].entries[1].always = 'yes';
    expect(() => assertProject(p)).toThrow('tables[0].entries[1].always');
  });

  it('finds loops between nested tables, including a table that drops itself', () => {
    const p = sampleProject();
    p.tables[2].entries.push({ id: 'x', weight: 1, outcome: { kind: 'table', tableId: 'goblin' } });
    expect(tableCycles(p)).toEqual([['goblin', 'rare']]);
    expect(messages(p)).toContain('error: Tables drop each other in a loop: Goblin → Rare finds → Goblin.');

    const self = sampleProject();
    self.tables[1].entries.push({ id: 'y', weight: 5, outcome: { kind: 'table', tableId: 'wolf' } });
    expect(tableCycles(self)).toEqual([['wolf']]);
  });

  it('reports broken references and impossible numbers', () => {
    const p = sampleProject();
    p.items = p.items.filter((i) => i.id !== 'ring' && i.id !== 'gold');
    p.tables[0].rolls = { min: 3, max: 1 };
    p.tables[1].entries[0].weight = 120;
    p.tables[1].entries[1].outcome = { kind: 'item', itemId: 'fang', qty: { min: 1.5, max: 2 } };
    p.scenario.encounters.push({ id: 'z', tableId: 'dragon', count: 1 });
    expect(messages(p)).toEqual([
      'error: The Gold item is missing.',
      'error: Goblin: rolls min is above max.',
      'error: Goblin, entry 1: drops an item that no longer exists.',
      'error: Wolf, entry 1: chance is above 100%.',
      'error: Wolf, entry 2: quantity must be whole numbers.',
      'error: Wolf, entry 3: drops an item that no longer exists.',
      'error: Rare finds, entry 1: drops an item that no longer exists.',
      'error: An encounter uses a table that no longer exists.',
    ]);
  });

  it('validates bad-luck protection', () => {
    const p = sampleProject();
    p.tables[0].pity = { entryId: 'g5', after: 50 };
    p.tables[1].pity = { entryId: 'w1', after: 3 };
    p.tables[2].pity = { entryId: 'gone', after: 0.5 };
    expect(messages(p)).toEqual([
      'error: Wolf: bad-luck protection only works when each roll picks one entry by weight.',
      'error: Rare finds: bad-luck protection guarantees an entry that no longer exists.',
      'error: Rare finds: bad-luck protection needs a whole number of misses, 1 or more.',
    ]);
  });

  it('validates always-drop entries', () => {
    const p = sampleProject();
    p.tables[0].entries[1].always = true;
    p.tables[0].pity = { entryId: 'g2', after: 10 };
    p.tables[1].entries[0].always = true;
    expect(messages(p)).toEqual([
      'error: Goblin: bad-luck protection guarantees an entry that already drops every roll.',
      'error: Wolf, entry 1: "every roll" only works when each roll picks one entry by weight.',
    ]);
  });

  it('refuses simulations too big to keep in memory', () => {
    const p = sampleProject();
    p.scenario.runs = 200_000;
    expect(messages(p)).toEqual(['error: Runs × fights is over 5,000,000; lower one of them.']);
  });

  it('warns about tables that can never drop anything', () => {
    const p = sampleProject();
    p.tables[2].entries.forEach((e) => (e.weight = 0));
    expect(messages(p)).toEqual(['warning: Rare finds: every weight is 0, so it never drops anything.']);
  });
});

describe('random', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = rng(42);
    const b = rng(42);
    const c = rng(43);
    const seqA = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(seqA);
    expect(Array.from({ length: 5 }, c)).not.toEqual(seqA);
  });

  it('draws every integer in the range about equally often', () => {
    const next = rng(7);
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 40000; i++) counts[randInt(next, 2, 5) - 2]++;
    for (const n of counts) expect(n).toBeGreaterThan(9500);
    expect(counts.reduce((a, b) => a + b)).toBe(40000);
  });
});
