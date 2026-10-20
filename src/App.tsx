import { useMemo } from 'react';
import { Results } from './components/Results';
import { ProblemsPanel, ScenarioPanel } from './components/ScenarioPanel';
import { ItemsPanel, TablesPanel } from './components/Sidebar';
import { TableEditor } from './components/TableEditor';
import { Toolbar } from './components/Toolbar';
import { problems } from './model/project';
import { useProject } from './store';
import { useSimulation } from './useSimulation';

export default function App() {
  const project = useProject();
  const issues = useMemo(() => problems(project), [project]);
  const blocked = issues.some((p) => p.level === 'error');
  const sim = useSimulation(project, blocked);

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
          <Results sim={sim} blocked={blocked} />
        </div>
        <aside className="sidebar right">
          <ScenarioPanel />
          <ProblemsPanel problems={issues} />
        </aside>
      </main>
    </div>
  );
}
