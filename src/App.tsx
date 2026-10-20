import { useMemo } from 'react';
import { ProblemsPanel, ScenarioPanel } from './components/ScenarioPanel';
import { ItemsPanel, TablesPanel } from './components/Sidebar';
import { TableEditor } from './components/TableEditor';
import { Toolbar } from './components/Toolbar';
import { problems } from './model/project';
import { useProject } from './store';

export default function App() {
  const project = useProject();
  const issues = useMemo(() => problems(project), [project]);

  return (
    <div className="app">
      <Toolbar />
      <main className="workspace">
        <aside className="sidebar">
          <ItemsPanel />
          <TablesPanel />
        </aside>
        <div className="center">
          <TableEditor />
        </div>
        <aside className="sidebar right">
          <ScenarioPanel />
          <ProblemsPanel problems={issues} />
        </aside>
      </main>
    </div>
  );
}
