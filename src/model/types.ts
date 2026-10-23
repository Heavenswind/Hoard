// A project is a set of items, the loot tables that drop them, and one scenario to simulate.
// Everything is plain JSON so a game can load the same tables it was balanced with.

/** Id of the built-in currency. Every project has it; upkeep and shop prices are paid in it. */
export const GOLD = 'gold';

export interface Item {
  id: string;
  name: string;
  /** Gold the player gets for selling one. */
  value: number;
  /** Sell every copy as soon as it drops (vendor trash). */
  autoSell: boolean;
}

/** Inclusive integer range; every value in it is equally likely. */
export interface Range {
  min: number;
  max: number;
}

export type Outcome =
  | { kind: 'item'; itemId: string; qty: Range }
  | { kind: 'table'; tableId: string }
  | { kind: 'nothing' };

export interface Entry {
  id: string;
  /** Relative weight in a 'weighted' table; percent chance (0–100) in an 'each' table. */
  weight: number;
  /** Weighted tables only: drops on every roll, on top of the weighted pick. The weight is ignored. */
  always?: boolean;
  /** The scenario's luck multiplies this entry's weight (weighted) or chance (each). For rare drops boosted by gear. */
  lucky?: boolean;
  outcome: Outcome;
}

/**
 * weighted: each roll picks exactly one entry, in proportion to the weights.
 * each: each roll checks every entry against its own chance, so one roll can give several entries or none.
 */
export type TableMode = 'weighted' | 'each';

/**
 * Bad-luck protection, for weighted tables only. After `after` rolls of the table in a row
 * without the entry being picked, the next roll gives it instead of a weighted pick.
 */
export interface Pity {
  entryId: string;
  after: number;
}

export interface LootTable {
  id: string;
  name: string;
  mode: TableMode;
  rolls: Range;
  entries: Entry[];
  pity?: Pity;
}

/** Something the player meets every step, e.g. 3 goblins per fight. */
export interface Encounter {
  id: string;
  tableId: string;
  count: number;
}

/**
 * An item the player is saving up for. It's bought for `price` gold once affordable, unless it drops first.
 * Purchases happen in list order: the player saves for the first goal they don't have yet.
 */
export interface Goal {
  id: string;
  itemId: string;
  price: number;
}

export interface Scenario {
  /** What one step is called in the UI: fight, run, day… */
  stepName: string;
  steps: number;
  runs: number;
  seed: number;
  encounters: Encounter[];
  /** Gold spent every step (food, repairs). Gold never goes below zero. */
  upkeep: number;
  /** Magic find from gear: multiplies the weight or chance of entries marked lucky. Missing means 1 (no effect). */
  luck?: number;
  goals: Goal[];
}

export interface Project {
  format: 'hoard';
  version: 1;
  name: string;
  items: Item[];
  tables: LootTable[];
  scenario: Scenario;
}
