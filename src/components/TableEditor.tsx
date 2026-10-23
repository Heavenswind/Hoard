import { useMemo } from 'react';
import { addEntry, moveEntry, removeEntry, removeTable, tableUsages, updateEntry, updateQty, updateTable } from '../model/edits';
import { tableCycles } from '../model/project';
import { entryChances, tableRates } from '../model/rates';
import type { LootTable, Outcome, Project, TableMode } from '../model/types';
import { num, oneIn, pct } from '../format';
import { useEditor, useProject } from '../store';
import { NumberInput, TextInput } from './fields';

const outcomeKey = (o: Outcome) => (o.kind === 'item' ? `item:${o.itemId}` : o.kind === 'table' ? `table:${o.tableId}` : 'nothing');

/** What an entry drops, for the bad-luck protection picker. */
function outcomeName(project: Project, o: Outcome): string {
  if (o.kind === 'item') return project.items.find((i) => i.id === o.itemId)?.name ?? '(deleted)';
  if (o.kind === 'table') return `→ ${project.tables.find((t) => t.id === o.tableId)?.name ?? '(deleted)'}`;
  return 'Nothing';
}

function OutcomeSelect({ project, table, outcome, onChange }: { project: Project; table: LootTable; outcome: Outcome; onChange: (o: Outcome) => void }) {
  const key = outcomeKey(outcome);
  const known = key === 'nothing' || project.items.some((i) => key === `item:${i.id}`) || project.tables.some((t) => key === `table:${t.id}`);
  return (
    <select
      aria-label="Drops"
      value={key}
      onChange={(e) => {
        const [kind, id] = e.target.value.split(':');
        if (kind === 'item') onChange({ kind, itemId: id, qty: outcome.kind === 'item' ? outcome.qty : { min: 1, max: 1 } });
        else if (kind === 'table') onChange({ kind, tableId: id });
        else onChange({ kind: 'nothing' });
      }}
    >
      {!known && <option value={key}>(deleted)</option>}
      <optgroup label="Items">
        {project.items.map((i) => (
          <option key={i.id} value={`item:${i.id}`}>
            {i.name}
          </option>
        ))}
      </optgroup>
      <optgroup label="Roll another table">
        {project.tables
          .filter((t) => t.id !== table.id)
          .map((t) => (
            <option key={t.id} value={`table:${t.id}`}>
              → {t.name}
            </option>
          ))}
      </optgroup>
      <option value="nothing">Nothing</option>
    </select>
  );
}

function DropRates({ project, table }: { project: Project; table: LootTable }) {
  const rates = useMemo(() => tableRates(project, table.id), [project, table.id]);
  const looped = useMemo(() => tableCycles(project).length > 0, [project]);
  if (looped) {
    return (
      <section className="card">
        <h3>One {table.name} drop, on average</h3>
        <p className="muted">Some tables drop each other in a loop (see Problems). Fix it to see exact rates.</p>
      </section>
    );
  }
  const rows = project.items
    .filter((i) => (rates.get(i.id)?.expected ?? 0) > 0)
    .map((item) => ({ item, ...rates.get(item.id)! }))
    .sort((a, b) => b.chance - a.chance);
  const worth = rows.reduce((sum, r) => sum + r.expected * r.item.value, 0);

  return (
    <section className="card">
      <h3>One {table.name} drop, on average</h3>
      {rows.length === 0 ? (
        <p className="muted">This table can't drop anything yet.</p>
      ) : (
        <>
          <table className="grid rates">
            <thead>
              <tr>
                <th>Item</th>
                <th className="num">Avg quantity</th>
                <th className="num">Chance of at least 1</th>
                <th className="num">Odds</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.item.id}>
                  <td>{r.item.name}</td>
                  <td className="num">{num(r.expected)}</td>
                  <td className="num">{pct(r.chance)}</td>
                  <td className="num muted">{oneIn(r.chance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted note">
            Worth about <strong className="ink">{num(worth)} gold</strong> per drop, counting every item at its sell value. Exact
            numbers, nested tables included.
            {table.pity && ' With bad-luck protection these are long-run averages.'}
            {(project.scenario.luck ?? 1) !== 1 && ` Luck ×${num(project.scenario.luck!)} applied to lucky entries.`}
          </p>
        </>
      )}
    </section>
  );
}

function TableCard({ project, table }: { project: Project; table: LootTable }) {
  const edit = useEditor((s) => s.edit);
  const selectTable = useEditor((s) => s.selectTable);
  const usages = tableUsages(project, table.id);
  const shares = entryChances(table, project.scenario.luck ?? 1);
  const each = table.mode === 'each';
  const set = (fn: (t: LootTable) => LootTable, mergeKey?: string) => edit((p) => updateTable(p, table.id, fn), mergeKey);

  return (
    <section className="card">
      <div className="card-head">
        <TextInput
          className="title-input"
          aria-label="Table name"
          value={table.name}
          onChange={(name) => set((t) => ({ ...t, name }), `table-name-${table.id}`)}
        />
        <button
          className="danger"
          disabled={usages.length > 0}
          title={usages.length ? `Used by ${usages.join(', ')}` : 'Delete this table'}
          onClick={() => {
            edit((p) => removeTable(p, table.id));
            selectTable(project.tables.find((t) => t.id !== table.id)?.id ?? null);
          }}
        >
          Delete table
        </button>
      </div>
      <div className="table-settings">
        <label>
          Each roll
          <select
            aria-label="Table mode"
            value={table.mode}
            onChange={(e) => {
              const mode = e.target.value as TableMode;
              set((t) => ({
                ...t,
                mode,
                pity: mode === 'each' ? undefined : t.pity,
                entries: mode === 'each' ? t.entries.map(({ always: _, ...rest }) => rest) : t.entries,
              }));
            }}
          >
            <option value="weighted">picks one entry by weight</option>
            <option value="each">checks every entry's own chance</option>
          </select>
        </label>
        <label>
          Rolls per drop
          <NumberInput
            className="short"
            aria-label="Minimum rolls"
            min={0}
            step={1}
            value={table.rolls.min}
            onChange={(min) => set((t) => ({ ...t, rolls: { ...t.rolls, min } }), `rolls-min-${table.id}`)}
          />
          to
          <NumberInput
            className="short"
            aria-label="Maximum rolls"
            min={0}
            step={1}
            value={table.rolls.max}
            onChange={(max) => set((t) => ({ ...t, rolls: { ...t.rolls, max } }), `rolls-max-${table.id}`)}
          />
        </label>
        {!each && (
          <label>
            Guarantee
            <select
              aria-label="Bad-luck protection entry"
              value={table.pity?.entryId ?? ''}
              onChange={(e) => {
                const entryId = e.target.value;
                set((t) => ({ ...t, pity: entryId ? { entryId, after: t.pity?.after ?? 10 } : undefined }));
              }}
            >
              <option value="">nothing</option>
              {table.entries
                .filter((e) => !e.always)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {outcomeName(project, e.outcome)}
                  </option>
                ))}
            </select>
            {table.pity && (
              <>
                after
                <NumberInput
                  className="short"
                  aria-label="Misses before the guarantee"
                  min={1}
                  step={1}
                  value={table.pity.after}
                  onChange={(after) => set((t) => (t.pity ? { ...t, pity: { ...t.pity, after } } : t), `pity-after-${table.id}`)}
                />
                misses
              </>
            )}
          </label>
        )}
      </div>

      <table className="grid entries">
        <thead>
          <tr>
            <th>Drops</th>
            <th>Quantity</th>
            <th className="num">{each ? 'Chance %' : 'Weight'}</th>
            <th className="num">{each ? '' : 'Share'}</th>
            <th>Lucky</th>
            {!each && <th>Every roll</th>}
            <th />
          </tr>
        </thead>
        <tbody>
          {table.entries.map((e, n) => (
            <tr key={e.id}>
              <td>
                <OutcomeSelect
                  project={project}
                  table={table}
                  outcome={e.outcome}
                  onChange={(outcome) => edit((p) => updateEntry(p, table.id, e.id, { outcome }))}
                />
              </td>
              <td className="qty">
                {e.outcome.kind === 'item' ? (
                  <>
                    <NumberInput
                      className="short"
                      aria-label="Minimum quantity"
                      min={0}
                      step={1}
                      value={e.outcome.qty.min}
                      onChange={(min) => edit((p) => updateQty(p, table.id, e.id, { min }), `qty-min-${e.id}`)}
                    />
                    –
                    <NumberInput
                      className="short"
                      aria-label="Maximum quantity"
                      min={0}
                      step={1}
                      value={e.outcome.qty.max}
                      onChange={(max) => edit((p) => updateQty(p, table.id, e.id, { max }), `qty-max-${e.id}`)}
                    />
                  </>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
              <td className="num">
                {!each && e.always ? (
                  <span className="muted" title="Ignored while the entry drops every roll">
                    —
                  </span>
                ) : (
                  <NumberInput
                    className="short"
                    aria-label={each ? 'Chance percent' : 'Weight'}
                    min={0}
                    max={each ? 100 : undefined}
                    value={e.weight}
                    onChange={(weight) => edit((p) => updateEntry(p, table.id, e.id, { weight }), `weight-${e.id}`)}
                  />
                )}
              </td>
              <td className="num muted">{each ? '' : pct(shares[n])}</td>
              <td className="num">
                <input
                  type="checkbox"
                  aria-label="Scaled by luck"
                  title="The scenario's luck multiplier scales this entry"
                  checked={e.lucky ?? false}
                  onChange={(ev) => edit((p) => updateEntry(p, table.id, e.id, { lucky: ev.target.checked || undefined }))}
                />
              </td>
              {!each && (
                <td className="num">
                  <input
                    type="checkbox"
                    aria-label="Drops every roll"
                    title="Drops on every roll, on top of the weighted pick"
                    checked={e.always ?? false}
                    onChange={(ev) => {
                      const always = ev.target.checked || undefined;
                      set((t) => ({
                        ...t,
                        pity: always && t.pity?.entryId === e.id ? undefined : t.pity,
                        entries: t.entries.map((x) => (x.id === e.id ? { ...x, always } : x)),
                      }));
                    }}
                  />
                </td>
              )}
              <td className="row-actions">
                <button className="icon" aria-label="Move up" disabled={n === 0} onClick={() => edit((p) => moveEntry(p, table.id, e.id, -1))}>
                  ↑
                </button>
                <button
                  className="icon"
                  aria-label="Move down"
                  disabled={n === table.entries.length - 1}
                  onClick={() => edit((p) => moveEntry(p, table.id, e.id, 1))}
                >
                  ↓
                </button>
                <button className="icon danger" aria-label="Delete entry" onClick={() => edit((p) => removeEntry(p, table.id, e.id))}>
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={() => edit((p) => addEntry(p, table.id))}>+ Entry</button>
    </section>
  );
}

export function TableEditor() {
  const project = useProject();
  const selectedId = useEditor((s) => s.selectedTableId);
  const table = project.tables.find((t) => t.id === selectedId);

  if (!table) {
    return (
      <section className="card">
        <p className="muted">Pick a loot table on the left, or add one.</p>
      </section>
    );
  }
  return (
    <>
      <TableCard project={project} table={table} />
      <DropRates project={project} table={table} />
    </>
  );
}
