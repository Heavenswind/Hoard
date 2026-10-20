import { addItem, addTable, itemUsages, removeItem, updateItem } from '../model/edits';
import { GOLD } from '../model/types';
import { useEditor, useProject } from '../store';
import { NumberInput, TextInput } from './fields';

export function ItemsPanel() {
  const project = useProject();
  const edit = useEditor((s) => s.edit);

  return (
    <section className="panel">
      <h2>
        Items
        <button onClick={() => edit(addItem)}>+ Item</button>
      </h2>
      <div className="item-row head muted">
        <span>Name</span>
        <span>Sells for</span>
        <span title="Sell every copy as soon as it drops">Auto-sell</span>
      </div>
      {project.items.map((item) => {
        const gold = item.id === GOLD;
        const used = itemUsages(project, item.id);
        return (
          <div className="item-row" key={item.id}>
            <TextInput
              aria-label="Item name"
              value={item.name}
              onChange={(name) => edit((p) => updateItem(p, item.id, { name }), `item-name-${item.id}`)}
            />
            <NumberInput
              aria-label={`${item.name} sell value`}
              min={0}
              value={item.value}
              disabled={gold}
              title={gold ? 'Gold is the currency: always worth 1' : 'Gold the player gets for selling one'}
              onChange={(value) => edit((p) => updateItem(p, item.id, { value }), `item-value-${item.id}`)}
            />
            <input
              type="checkbox"
              aria-label={`Auto-sell ${item.name}`}
              checked={item.autoSell}
              disabled={gold}
              onChange={(e) => edit((p) => updateItem(p, item.id, { autoSell: e.target.checked }))}
            />
            <button
              className="icon danger"
              aria-label={`Delete ${item.name}`}
              disabled={gold || used.length > 0}
              title={gold ? 'Gold is built in' : used.length ? `Used by ${used.join(', ')}` : 'Delete item'}
              onClick={() => edit((p) => removeItem(p, item.id))}
            >
              ×
            </button>
          </div>
        );
      })}
    </section>
  );
}

export function TablesPanel() {
  const project = useProject();
  const edit = useEditor((s) => s.edit);
  const selected = useEditor((s) => s.selectedTableId);
  const selectTable = useEditor((s) => s.selectTable);

  return (
    <section className="panel">
      <h2>
        Loot tables
        <button
          onClick={() => {
            const { project: next, id } = addTable(useEditor.getState().history.present);
            edit(() => next);
            selectTable(id);
          }}
        >
          + Table
        </button>
      </h2>
      <ul className="table-list">
        {project.tables.map((t) => (
          <li key={t.id}>
            <button className={t.id === selected ? 'active' : ''} onClick={() => selectTable(t.id)}>
              <span>{t.name}</span>
              <span className="muted">
                {t.entries.length} {t.entries.length === 1 ? 'entry' : 'entries'} · {t.mode === 'each' ? 'own chances' : 'weighted'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
