import { describe, expect, it } from 'vitest';
import { emptyProject, goldItem, sampleProject } from './project';
import { stepRates } from './rates';
import { simulate } from './simulate';
import { GOLD, type Project } from './types';

/** Every step pays exactly 10 gold; the shop sells a sword (35) and a shield (20); the helm only drops. */
function fixedIncome(): Project {
  const p = emptyProject();
  p.items = [
    goldItem(),
    { id: 'sword', name: 'Sword', value: 10, autoSell: false },
    { id: 'shield', name: 'Shield', value: 5, autoSell: false },
    { id: 'helm', name: 'Helm', value: 5, autoSell: false },
  ];
  p.tables = [
    {
      id: 'chest',
      name: 'Chest',
      mode: 'weighted',
      rolls: { min: 1, max: 1 },
      entries: [{ id: 'a', weight: 1, outcome: { kind: 'item', itemId: GOLD, qty: { min: 10, max: 10 } } }],
    },
  ];
  p.scenario = {
    ...p.scenario,
    steps: 8,
    runs: 50,
    encounters: [{ id: 'e', tableId: 'chest', count: 1 }],
    goals: [
      { id: 'g1', itemId: 'sword', price: 35 },
      { id: 'g2', itemId: 'shield', price: 20 },
    ],
  };
  return p;
}

describe('simulation', () => {
  it('buys goals in order as soon as they are affordable', () => {
    const r = simulate(fixedIncome());
    // Gold: 10 20 30 40→5 15 25→5 15 25.
    expect(r.gold.p50).toEqual([10, 20, 30, 5, 15, 5, 15, 25]);
    expect(r.goals.map((g) => [g.step50, g.step90, g.viaDrop])).toEqual([
      [4, 4, 0],
      [6, 6, 0],
    ]);
    expect(r.goals[1].byStep).toEqual([0, 0, 0, 0, 0, 1, 1, 1]);
    expect(r.allGoals).toEqual({ byStep: [0, 0, 0, 0, 0, 1, 1, 1], step50: 6 });
  });

  it('only counts runs with every goal as having them all', () => {
    const p = fixedIncome();
    p.scenario.goals.push({ id: 'g3', itemId: 'helm', price: 1000 });
    const r = simulate(p);
    expect(r.goals[1].step50).toBe(6);
    expect(r.allGoals).toEqual({ byStep: [0, 0, 0, 0, 0, 0, 0, 0], step50: null });
    p.scenario.goals = [];
    expect(simulate(p).allGoals).toEqual({ byStep: [], step50: null });
  });

  it('counts a goal as reached when the item drops first, and skips buying it', () => {
    const p = fixedIncome();
    p.tables[0].mode = 'each';
    p.tables[0].entries = [
      { id: 'a', weight: 100, outcome: { kind: 'item', itemId: GOLD, qty: { min: 10, max: 10 } } },
      { id: 'b', weight: 100, outcome: { kind: 'item', itemId: 'sword', qty: { min: 1, max: 1 } } },
    ];
    const r = simulate(p);
    expect(r.goals[0]).toMatchObject({ step50: 1, viaDrop: 1 });
    // Sword never bought, so the shield (20) is bought at step 2 with the first 20 gold.
    expect(r.goals[1].step50).toBe(2);
    expect(r.gold.p50.slice(0, 3)).toEqual([10, 0, 10]);
  });

  it('never lets upkeep push gold below zero', () => {
    const p = fixedIncome();
    p.scenario.upkeep = 25;
    p.scenario.goals = [];
    expect(simulate(p).gold.p90).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('reports goals that never happen as null', () => {
    const p = fixedIncome();
    p.scenario.goals = [{ id: 'g', itemId: 'helm', price: 1000 }];
    expect(simulate(p).goals[0]).toMatchObject({ step50: null, step90: null, viaDrop: 0 });
  });

  it('honours bad-luck protection and matches its exact long-run rate', () => {
    const p = fixedIncome();
    p.scenario = { ...p.scenario, steps: 50, runs: 500, goals: [] };
    p.tables[0].entries = [
      { id: 'g', weight: 99, outcome: { kind: 'item', itemId: GOLD, qty: { min: 1, max: 1 } } },
      { id: 'h', weight: 1, outcome: { kind: 'item', itemId: 'helm', qty: { min: 1, max: 1 } } },
    ];
    p.tables[0].pity = { entryId: 'h', after: 9 };
    const r = simulate(p);
    const helm = r.items.find((i) => i.itemId === 'helm')!;
    // One roll per step, guaranteed at latest on the 10th: every run has a helm by step 10.
    expect(helm.byStep[9]).toBe(1);
    const exact = stepRates(p).items.get('helm')!.expected;
    expect(helm.total.mean / 50 / exact).toBeGreaterThan(0.9);
    expect(helm.total.mean / 50 / exact).toBeLessThan(1.1);
  });

  it('gives always-drop entries on every roll, leaving the weighted pick alone', () => {
    const p = fixedIncome();
    p.scenario = { ...p.scenario, steps: 20, runs: 200, goals: [] };
    p.tables[0].entries = [
      { id: 'g', weight: 1, outcome: { kind: 'item', itemId: GOLD, qty: { min: 10, max: 10 } } },
      { id: 'h', weight: 3, outcome: { kind: 'item', itemId: 'helm', qty: { min: 1, max: 1 } } },
      { id: 's', weight: 0, always: true, outcome: { kind: 'item', itemId: 'shield', qty: { min: 2, max: 2 } } },
    ];
    const r = simulate(p);
    const shield = r.items.find((i) => i.itemId === 'shield')!;
    // One roll per step, 2 shields guaranteed per roll: every run has 40 after 20 steps.
    expect(shield.byStep[0]).toBe(1);
    expect(shield.total.p10).toBe(40);
    expect(shield.total.p90).toBe(40);
    const helm = r.items.find((i) => i.itemId === 'helm')!;
    expect(helm.total.mean / 20).toBeGreaterThan(0.65);
    expect(helm.total.mean / 20).toBeLessThan(0.85);
  });

  it('boosts lucky entries by the scenario luck and matches the exact rates', () => {
    const p = fixedIncome();
    p.scenario = { ...p.scenario, steps: 20, runs: 500, goals: [], luck: 3 };
    p.tables[0].entries = [
      { id: 'g', weight: 9, outcome: { kind: 'item', itemId: GOLD, qty: { min: 1, max: 1 } } },
      { id: 'h', weight: 1, lucky: true, outcome: { kind: 'item', itemId: 'helm', qty: { min: 1, max: 1 } } },
    ];
    const r = simulate(p);
    const helm = r.items.find((i) => i.itemId === 'helm')!;
    // Effective weights 9 and 3, so the helm lands on a quarter of the rolls.
    expect(stepRates(p).items.get('helm')!.expected).toBeCloseTo(0.25, 12);
    expect(helm.total.mean / 20).toBeGreaterThan(0.2);
    expect(helm.total.mean / 20).toBeLessThan(0.3);
  });

  it('repeats exactly with the same seed', () => {
    const p = sampleProject();
    p.scenario.runs = 200;
    const a = simulate(p);
    expect(simulate(p)).toEqual(a);
    p.scenario.seed = 2;
    expect(simulate(p).gold.mean).not.toEqual(a.gold.mean);
  });

  it('agrees with the exact drop maths on the sample project', () => {
    const p = sampleProject();
    p.scenario.runs = 4000;
    const r = simulate(p);
    const exact = stepRates(p);
    const steps = p.scenario.steps;
    for (const id of ['gold', 'ear', 'pelt', 'fang', 'herb']) {
      const simulated = r.items.find((i) => i.itemId === id)!.total.mean / steps;
      expect(simulated / exact.items.get(id)!.expected).toBeGreaterThan(0.98);
      expect(simulated / exact.items.get(id)!.expected).toBeLessThan(1.02);
    }
    // Chance of at least one Moonblade drop within the whole scenario.
    const moonblade = r.items.find((i) => i.itemId === 'moonblade')!.byStep[steps - 1];
    expect(moonblade).toBeCloseTo(1 - (1 - exact.items.get('moonblade')!.chance) ** steps, 1);
  });

  it('keeps percentiles in order and gold growing on average in the sample', () => {
    const r = simulate(sampleProject());
    for (let s = 0; s < r.steps; s++) {
      expect(r.gold.p10[s]).toBeLessThanOrEqual(r.gold.p50[s]);
      expect(r.gold.p50[s]).toBeLessThanOrEqual(r.gold.p90[s]);
    }
    expect(r.goals[0].step50).not.toBeNull();
  });
});
