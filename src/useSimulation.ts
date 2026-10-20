import { useEffect, useState } from 'react';
import { simulate, type SimResult } from './model/simulate';
import type { Project } from './model/types';

export interface SimState {
  result: SimResult | null;
  /** The project the result was computed from, for labels (it may lag behind the one being edited). */
  project: Project | null;
  ms: number;
  pending: boolean;
}

/** Re-runs the simulation shortly after edits stop. Keeps the last result while blocked or recomputing. */
export function useSimulation(project: Project, blocked: boolean): SimState {
  const [state, setState] = useState<SimState>({ result: null, project: null, ms: 0, pending: true });

  useEffect(() => {
    if (blocked) {
      setState((s) => ({ ...s, pending: false }));
      return;
    }
    setState((s) => ({ ...s, pending: true }));
    const timer = setTimeout(() => {
      const start = performance.now();
      const result = simulate(project);
      setState({ result, project, ms: performance.now() - start, pending: false });
    }, 200);
    return () => clearTimeout(timer);
  }, [project, blocked]);

  return state;
}
