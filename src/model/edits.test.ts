import { describe, expect, it } from 'vitest';
import {
  addEntry,
  addItem,
  addTable,
  itemUsages,
  moveEntry,
  moveGoal,
  removeItem,
  tableUsages,
  uniqueName,
  updateEntry,
} from './edits';
import { commit, historyOf, redo, replace, undo } from './history';
import { problems, sampleProject } from './project';
import { GOLD } from './types';

describe('edits', () => {
  it('numbers new names that are already taken', () => {
    expect(uniqueName('New item', ['Gold'])).toBe('New item');
    expect(uniqueName('New item', ['New item', 'New item 2'])).toBe('New item 3');
    const p = addItem(addItem(sampleProject()));
    expect(p.items.slice(-2).map((i) => i.name)).toEqual(['New item', 'New item 2']);
  });

  it('never removes gold', () => {
    const p = sampleProject();
    expect(removeItem(p, GOLD)).toBe(p);
    expect(removeItem(p, 'herb').items.some((i) => i.id === 'herb')).toBe(false);
  });

  it('lists where items and tables are used', () => {
    const p = sampleProject();
    expect(itemUsages(p, GOLD)).toEqual(['Goblin', 'Wolf']);
    expect(itemUsages(p, 'moonblade')).toEqual(['Rare finds', 'shop goals']);
    expect(itemUsages(p, 'steel')).toEqual(['shop goals']);
    expect(tableUsages(p, 'rare')).toEqual(['Goblin']);
    expect(tableUsages(p, 'wolf')).toEqual(['encounters']);
  });

  it('adds entries that suit the table mode and keep the project valid', () => {
    let p = sampleProject();
    p = addEntry(p, 'wolf');
    p = addEntry(p, 'goblin');
    expect(p.tables[1].entries.at(-1)!.weight).toBe(50);
    expect(p.tables[0].entries.at(-1)!.weight).toBe(10);
    const { project, id } = addTable(p);
    expect(project.tables.at(-1)!.id).toBe(id);
    expect(problems(project).filter((x) => x.level === 'error')).toEqual([]);
  });

  it('updates and reorders without touching the original', () => {
    const p = sampleProject();
    const q = moveEntry(updateEntry(p, 'goblin', 'g2', { weight: 99 }), 'goblin', 'g2', -1);
    expect(q.tables[0].entries.slice(0, 2).map((e) => [e.id, e.weight])).toEqual([
      ['g2', 99],
      ['g1', 50],
    ]);
    expect(p.tables[0].entries[1].weight).toBe(25);
    expect(moveEntry(p, 'goblin', 'g1', -1)).toEqual(p);
    expect(moveGoal(p, 'q3', -1).scenario.goals.map((g) => g.id)).toEqual(['q1', 'q3', 'q2']);
  });
});

describe('history', () => {
  it('undoes, redoes and drops the redo branch on a new edit', () => {
    let h = historyOf(1);
    h = commit(h, 2);
    h = commit(h, 3);
    h = undo(h);
    expect(h.present).toBe(2);
    expect(redo(h).present).toBe(3);
    h = commit(h, 4);
    expect(h.future).toEqual([]);
    expect(undo(undo(h)).present).toBe(1);
    expect(undo(historyOf(1))).toEqual(historyOf(1));
  });

  it('replaces the present without adding a step', () => {
    const h = replace(commit(historyOf('a'), 'ab'), 'abc');
    expect(h.past).toEqual(['a']);
    expect(undo(h).present).toBe('a');
  });
});
