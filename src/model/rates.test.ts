import { describe, expect, it } from 'vitest';
import { emptyProject, goldItem, sampleProject } from './project';
import { entryChances, stepRates, tableRates } from './rates';
import { GOLD, type Entry, type LootTable, type Project } from './types';

function projectWith(...tables: LootTable[]): Project {
  const p = emptyProject();
  p.items = [goldItem(), { id: 'gem', name: 'Gem', value: 50, autoSell: false }];
  p.tables = tables;
  return p;
}

const table = (id: string, mode: LootTable['mode'], rolls: [number, number], entries: Entry[]): LootTable => ({
  id,
  name: id,
  mode,
  rolls: { min: rolls[0], max: rolls[1] },
  entries,
});
const item = (weight: number, itemId: string, min = 1, max = min): Entry => ({
  id: itemId + weight,
  weight,
  outcome: { kind: 'item', itemId, qty: { min, max } },
});
const nothing = (weight: number): Entry => ({ id: 'none', weight, outcome: { kind: 'nothing' } });
const nested = (weight: number, tableId: string): Entry => ({ id: tableId, weight, outcome: { kind: 'table', tableId } });

describe('drop rates', () => {
  it('splits weighted tables by share of weight and caps each-chances at 100%', () => {
    expect(entryChances(table('t', 'weighted', [1, 1], [item(3, GOLD), nothing(1)]))).toEqual([0.75, 0.25]);
    expect(entryChances(table('t', 'each', [1, 1], [item(30, GOLD), item(150, 'gem')]))).toEqual([0.3, 1]);
    expect(entryChances(table('t', 'weighted', [1, 1], [nothing(0)]))).toEqual([0]);
  });

  it('gives expected quantity and chance for a single weighted roll', () => {
    const p = projectWith(table('t', 'weighted', [1, 1], [item(1, GOLD, 2, 6), nothing(1)]));
    expect(tableRates(p, 't').get(GOLD)).toEqual({ expected: 2, chance: 0.5 });
  });

  it('averages over a range of roll counts', () => {
    // 1 or 2 rolls at 50%: expected 0.75, miss chance (0.5 + 0.25) / 2.
    const p = projectWith(table('t', 'weighted', [1, 2], [item(1, 'gem'), nothing(1)]));
    expect(tableRates(p, 't').get('gem')).toEqual({ expected: 0.75, chance: 0.625 });
  });

  it('treats each-mode entries as independent chances', () => {
    const p = projectWith(table('t', 'each', [1, 1], [item(70, 'gem'), item(35, 'gem', 1, 2), item(20, GOLD, 1, 3)]));
    const gem = tableRates(p, 't').get('gem')!;
    expect(gem.expected).toBeCloseTo(0.7 + 0.35 * 1.5);
    expect(gem.chance).toBeCloseTo(1 - 0.3 * 0.65);
    expect(tableRates(p, 't').get(GOLD)!.expected).toBeCloseTo(0.4);
  });

  it('counts quantities that can roll 0 as a miss', () => {
    const p = projectWith(table('t', 'weighted', [1, 1], [item(1, 'gem', 0, 1)]));
    expect(tableRates(p, 't').get('gem')).toEqual({ expected: 0.5, chance: 0.5 });
  });

  it('follows nested tables', () => {
    const p = sampleProject();
    const q = (2 / 110) * 0.15; // goblin roll → rare table → moonblade
    const moonblade = tableRates(p, 'goblin').get('moonblade')!;
    expect(moonblade.expected).toBeCloseTo(1.5 * q, 12);
    expect(moonblade.chance).toBeCloseTo(1 - ((1 - q) + (1 - q) ** 2) / 2, 12);
  });

  it('stays finite when tables loop', () => {
    const p = projectWith(
      table('a', 'weighted', [1, 1], [item(1, 'gem'), nested(1, 'b')]),
      table('b', 'weighted', [1, 1], [nested(1, 'a')]),
    );
    const gem = tableRates(p, 'a').get('gem')!;
    expect(Number.isFinite(gem.expected) && gem.chance >= 0 && gem.chance <= 1).toBe(true);
  });

  it('raises a guaranteed entry to its renewal rate and keeps the shares summing to 1', () => {
    const t = table('t', 'weighted', [1, 1], [item(1, 'gem'), nothing(9)]);
    t.pity = { entryId: t.entries[0].id, after: 9 };
    const chances = entryChances(t);
    // p = 0.1, guaranteed at latest on the 10th roll: long-run rate p / (1 - 0.9^10) ≈ 0.154.
    expect(chances[0]).toBeCloseTo(0.1 / (1 - 0.9 ** 10), 12);
    expect(chances[0] + chances[1]).toBeCloseTo(1, 12);
    expect(chances[0]).toBeGreaterThan(0.1);
  });

  it('guarantees a zero-weight entry exactly once per pity cycle', () => {
    const t = table('t', 'weighted', [1, 1], [item(0, 'gem'), item(1, GOLD)]);
    t.pity = { entryId: t.entries[0].id, after: 4 };
    const chances = entryChances(t);
    expect(chances[0]).toBeCloseTo(1 / 5, 12);
    expect(chances[1]).toBeCloseTo(4 / 5, 12);
  });

  it('ignores bad-luck protection that points nowhere or has a bad miss count', () => {
    const t = table('t', 'weighted', [1, 1], [item(1, 'gem'), nothing(1)]);
    t.pity = { entryId: 'missing', after: 5 };
    expect(entryChances(t)).toEqual([0.5, 0.5]);
    t.pity = { entryId: t.entries[0].id, after: 0 };
    expect(entryChances(t)).toEqual([0.5, 0.5]);
  });

  it('adds up a whole step of the sample scenario, auto-sold items included', () => {
    const r = stepRates(sampleProject());
    // Goblin roll in gold: (50×4 + 25×2 + 8×9 + 2×0.85×45) / 110; ×1.5 rolls ×3 goblins. Wolf: 0.7×6 + 0.35×1.5×3 + 0.2×2.
    const goblin = ((50 * 4 + 25 * 2 + 8 * 9 + 2 * 0.85 * 45) / 110) * 1.5 * 3;
    const wolf = 0.7 * 6 + 0.35 * 1.5 * 3 + 0.2 * 2;
    expect(r.goldIn).toBeCloseTo(goblin + wolf, 10);
    expect(r.net).toBeCloseTo(goblin + wolf - 6, 10);
    expect(r.items.get('pelt')).toEqual({ expected: 0.7, chance: 0.7 });
    const goblinMoon = tableRates(sampleProject(), 'goblin').get('moonblade')!.chance;
    expect(r.items.get('moonblade')!.chance).toBeCloseTo(1 - (1 - goblinMoon) ** 3, 12);
  });
});
