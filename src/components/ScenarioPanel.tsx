import { useMemo } from 'react';
import {
  addEncounter,
  addGoal,
  moveGoal,
  removeEncounter,
  removeGoal,
  updateEncounter,
  updateGoal,
  updateScenario,
} from '../model/edits';
import { tableCycles, type Problem } from '../model/project';
import { stepRates } from '../model/rates';
import { capitalize, num } from '../format';
import { useEditor, useProject } from '../store';
import { NumberInput, TextInput } from './fields';

export function ScenarioPanel() {
  const project = useProject();
  const edit = useEditor((s) => s.edit);
  const s = project.scenario;
  const step = s.stepName || 'step';
  const rates = useMemo(() => stepRates(project), [project]);
  // With a loop the exact maths stops at the repeat, so its numbers would be too low.
  const looped = useMemo(() => tableCycles(project).length > 0, [project]);

  return (
    <section className="panel">
      <h2>Scenario</h2>
      <div className="form-grid">
        <label>
          One step is a
          <TextInput
            aria-label="Step name"
            value={s.stepName}
            onChange={(stepName) => edit((p) => updateScenario(p, { stepName }), 'step-name')}
          />
        </label>
        <label>
          {capitalize(step)}s per run
          <NumberInput min={1} step={1} value={s.steps} onChange={(steps) => edit((p) => updateScenario(p, { steps }), 'steps')} />
        </label>
        <label>
          Runs to simulate
          <NumberInput min={1} step={100} value={s.runs} onChange={(runs) => edit((p) => updateScenario(p, { runs }), 'runs')} />
        </label>
        <label>
          Upkeep per {step}
          <NumberInput
            min={0}
            title="Gold spent every step: food, repairs, rent"
            value={s.upkeep}
            onChange={(upkeep) => edit((p) => updateScenario(p, { upkeep }), 'upkeep')}
          />
        </label>
        <label>
          Random seed
          <NumberInput step={1} value={s.seed} onChange={(seed) => edit((p) => updateScenario(p, { seed }), 'seed')} />
        </label>
      </div>

      <h3>Each {step}, the player meets</h3>
      {s.encounters.map((e) => (
        <div className="list-row" key={e.id}>
          <NumberInput
            className="short"
            aria-label="How many"
            min={0}
            step={1}
            value={e.count}
            onChange={(count) => edit((p) => updateEncounter(p, e.id, { count }), `count-${e.id}`)}
          />
          ×
          <select aria-label="Loot table" value={e.tableId} onChange={(ev) => edit((p) => updateEncounter(p, e.id, { tableId: ev.target.value }))}>
            {!project.tables.some((t) => t.id === e.tableId) && <option value={e.tableId}>(deleted)</option>}
            {project.tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button className="icon danger" aria-label="Remove encounter" onClick={() => edit((p) => removeEncounter(p, e.id))}>
            ×
          </button>
        </div>
      ))}
      <button onClick={() => edit(addEncounter)} disabled={project.tables.length === 0}>
        + Encounter
      </button>

      <h3>Shop goals, saved for in this order</h3>
      {s.goals.map((g, n) => (
        <div className="list-row" key={g.id}>
          <select aria-label="Goal item" value={g.itemId} onChange={(ev) => edit((p) => updateGoal(p, g.id, { itemId: ev.target.value }))}>
            {!project.items.some((i) => i.id === g.itemId) && <option value={g.itemId}>(deleted)</option>}
            {project.items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
          for
          <NumberInput
            className="short"
            aria-label="Price"
            min={0}
            value={g.price}
            onChange={(price) => edit((p) => updateGoal(p, g.id, { price }), `price-${g.id}`)}
          />
          <button className="icon" aria-label="Move up" disabled={n === 0} onClick={() => edit((p) => moveGoal(p, g.id, -1))}>
            ↑
          </button>
          <button className="icon" aria-label="Move down" disabled={n === s.goals.length - 1} onClick={() => edit((p) => moveGoal(p, g.id, 1))}>
            ↓
          </button>
          <button className="icon danger" aria-label="Remove goal" onClick={() => edit((p) => removeGoal(p, g.id))}>
            ×
          </button>
        </div>
      ))}
      <button onClick={() => edit(addGoal)}>+ Goal</button>
      <p className="muted note">A goal also counts as reached if the item drops before the player can afford it.</p>

      {looped ? (
        <p className="muted note">Fix the table loop under Problems to see the gold per {step}.</p>
      ) : (
        <>
          <div className="summary">
            <div>
              <span className="muted">Gold in per {step}</span>
              <strong>{num(rates.goldIn)}</strong>
            </div>
            <div>
              <span className="muted">Upkeep</span>
              <strong>−{num(s.upkeep)}</strong>
            </div>
            <div>
              <span className="muted">Net per {step}</span>
              <strong>
                {rates.net >= 0 ? '+' : ''}
                {num(rates.net)}
              </strong>
            </div>
          </div>
          <p className="muted note">Exact averages. Gold in counts dropped gold plus auto-sold items at their value.</p>
        </>
      )}
    </section>
  );
}

export function ProblemsPanel({ problems }: { problems: Problem[] }) {
  const selectTable = useEditor((s) => s.selectTable);
  return (
    <section className="panel">
      <h2>Problems</h2>
      {problems.length === 0 ? (
        <p className="status-line">
          <span className="status-icon good" aria-hidden>
            ✓
          </span>
          No problems found.
        </p>
      ) : (
        <ul className="problems">
          {problems.map((p, n) => (
            <li key={n}>
              <span className={`status-icon ${p.level}`} aria-hidden>
                {p.level === 'error' ? '✕' : '!'}
              </span>
              <span className="sr-only">{p.level === 'error' ? 'Error:' : 'Warning:'}</span>
              {p.tableId ? (
                <button className="link" onClick={() => selectTable(p.tableId!)}>
                  {p.message}
                </button>
              ) : (
                <span>{p.message}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
