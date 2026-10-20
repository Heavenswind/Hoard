import { useMemo } from 'react';
import { stepRates } from '../model/rates';
import { tableCycles } from '../model/project';
import { capitalize, compact, num, pct } from '../format';
import type { SimState } from '../useSimulation';
import { GOAL_COLORS, GOLD_COLOR, LineChart } from './LineChart';

export function Results({ sim, blocked }: { sim: SimState; blocked: boolean }) {
  const { result, project, ms, pending } = sim;
  const exact = useMemo(() => (project && tableCycles(project).length === 0 ? stepRates(project) : null), [project]);

  if (!result || !project) {
    return (
      <section className="card">
        <h2>Simulation</h2>
        <p className="muted">{blocked ? 'Fix the errors under Problems to run the simulation.' : 'Simulating…'}</p>
      </section>
    );
  }

  const s = project.scenario;
  const step = s.stepName || 'step';
  const last = result.steps - 1;
  const itemName = (id: string) => project.items.find((i) => i.id === id)?.name ?? '(deleted)';
  const xName = (i: number) => `${capitalize(step)} ${i + 1}`;
  const stepAt = (k: number | null) => (k === null ? `not within ${result.steps}` : `${step} ${k}`);
  const shownGoals = s.goals.slice(0, GOAL_COLORS.length);
  const dropped = result.items.filter((r) => r.total.mean > 0);

  return (
    <section className={`card results${pending || blocked ? ' stale' : ''}`}>
      <div className="card-head">
        <h2>Simulation</h2>
        <span className="muted">
          {result.runs.toLocaleString('en')} runs × {result.steps} {step}s · seed {s.seed} · {Math.round(ms)} ms
        </span>
      </div>
      {blocked && <p className="note">Showing the last good run. Fix the errors under Problems to update it.</p>}

      <div className="tiles">
        <div className="tile">
          <span className="muted">
            Gold after {result.steps} {step}s, median run
          </span>
          <strong>{num(result.gold.p50[last])}</strong>
          <span className="muted">
            Middle 80% of runs: {num(result.gold.p10[last])} – {num(result.gold.p90[last])}
          </span>
        </div>
        {s.goals.length > 0 && (
          <div className="tile">
            <span className="muted">
              Runs with every goal after {result.steps} {step}s
            </span>
            <strong>{pct(result.allGoals.byStep[last])}</strong>
            <span className="muted">
              {result.allGoals.step50 === null
                ? `Fewer than half get them all within ${result.steps} ${step}s`
                : `Half of runs have them all by ${step} ${result.allGoals.step50}`}
            </span>
          </div>
        )}
      </div>

      <h3>Gold on hand after each {step}</h3>
      <p className="muted note">After upkeep and shop purchases. The line is the median run; the band covers the middle 80% of runs.</p>
      <LineChart
        label={`Gold on hand after each ${step}`}
        series={[{ id: 'p50', name: 'Median', color: GOLD_COLOR, values: result.gold.p50 }]}
        band={{ name: '10th–90th percentile', color: GOLD_COLOR, lo: result.gold.p10, hi: result.gold.p90 }}
        formatTick={compact}
        formatValue={num}
        xName={xName}
        endLabels
      />

      {s.goals.length > 0 && (
        <>
          <h3>Chance the player has each goal item by {step} N</h3>
          <p className="muted note">Dots mark the {step} by which half of all runs have it, bought or dropped.</p>
          <LineChart
            label={`Chance of having each goal item by ${step}`}
            series={shownGoals.map((g, n) => ({
              id: g.id,
              name: itemName(g.itemId),
              color: GOAL_COLORS[n],
              values: result.goals[n].byStep,
            }))}
            markers={shownGoals.flatMap((g, n) => {
              const k = result.goals[n].step50;
              return k === null ? [] : [{ seriesId: g.id, index: k - 1, label: `${step} ${k}` }];
            })}
            yMax={1}
            formatTick={pct}
            formatValue={pct}
            xName={xName}
          />
          {s.goals.length > shownGoals.length && (
            <p className="muted note">The chart shows the first {shownGoals.length} goals; the table has all of them.</p>
          )}
          <table className="grid">
            <thead>
              <tr>
                <th>Goal</th>
                <th className="num">Price</th>
                <th className="num">Half of runs by</th>
                <th className="num">90% of runs by</th>
                <th className="num">From a drop</th>
                <th className="num">Had by the end</th>
              </tr>
            </thead>
            <tbody>
              {s.goals.map((g, n) => (
                <tr key={g.id}>
                  <td>{itemName(g.itemId)}</td>
                  <td className="num">{num(g.price)}</td>
                  <td className="num">{stepAt(result.goals[n].step50)}</td>
                  <td className="num">{stepAt(result.goals[n].step90)}</td>
                  <td className="num">{pct(result.goals[n].viaDrop)}</td>
                  <td className="num">{pct(result.goals[n].byStep[last])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h3>Drops over a whole run</h3>
      <table className="grid">
        <thead>
          <tr>
            <th>Item</th>
            <th className="num">Avg per {step}</th>
            <th className="num">Avg total</th>
            <th className="num">Middle 80% of runs</th>
            <th className="num">At least one by the end</th>
          </tr>
        </thead>
        <tbody>
          {dropped.map((r) => (
            <tr key={r.itemId}>
              <td>{itemName(r.itemId)}</td>
              <td className="num">{exact ? num(exact.items.get(r.itemId)?.expected ?? 0) : '—'}</td>
              <td className="num">{num(r.total.mean)}</td>
              <td className="num">
                {num(Math.round(r.total.p10))} – {num(Math.round(r.total.p90))}
              </td>
              <td className="num">{pct(r.byStep[last])}</td>
            </tr>
          ))}
          {dropped.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">
                Nothing dropped. Add encounters to the scenario.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="muted note">Totals count every copy that dropped, including auto-sold ones. "Avg per {step}" is exact; the rest is simulated.</p>
    </section>
  );
}
