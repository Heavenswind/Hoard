// Undo/redo as plain data: past states, the present one, and undone states that can be redone.

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

const LIMIT = 200;

export function historyOf<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/** Makes `next` the present as a new undo step. Committing the same object is a no-op. */
export function commit<T>(h: History<T>, next: T): History<T> {
  if (next === h.present) return h;
  return { past: [...h.past, h.present].slice(-LIMIT), present: next, future: [] };
}

/** Swaps the present without adding an undo step (used to merge a burst of typing into one step). */
export function replace<T>(h: History<T>, next: T): History<T> {
  return { ...h, present: next };
}

export function undo<T>(h: History<T>): History<T> {
  if (h.past.length === 0) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
}

export function redo<T>(h: History<T>): History<T> {
  if (h.future.length === 0) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
}
