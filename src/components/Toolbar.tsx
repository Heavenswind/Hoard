import { useEffect, useRef, useState } from 'react';
import { downloadJson, readProjectFile, slug } from '../files';
import { emptyProject, sampleProject } from '../model/project';
import { useEditor, useProject } from '../store';
import { TextInput } from './fields';

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

export function Toolbar() {
  const project = useProject();
  const edit = useEditor((s) => s.edit);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const load = useEditor((s) => s.load);
  const canUndo = useEditor((s) => s.history.past.length > 0);
  const canRedo = useEditor((s) => s.history.future.length > 0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Inside a text field, Ctrl+Z belongs to the field.
      if (!(e.ctrlKey || e.metaKey) || isTyping(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) undo();
      else if (key === 'y' || (key === 'z' && e.shiftKey)) redo();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const open = async (file: File | undefined) => {
    if (!file) return;
    try {
      load(await readProjectFile(file));
      setError(null);
    } catch (err) {
      setError(err instanceof SyntaxError ? `${file.name} is not valid JSON.` : (err as Error).message);
    }
  };

  return (
    <header className="toolbar">
      <strong className="logo">Hoard</strong>
      <TextInput
        className="project-name"
        aria-label="Project name"
        value={project.name}
        onChange={(name) => edit((p) => ({ ...p, name }), 'project-name')}
      />
      <div className="group">
        <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          Undo
        </button>
        <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">
          Redo
        </button>
      </div>
      <div className="group">
        <button onClick={() => load(emptyProject())} title="Start an empty project (undoable)">
          New
        </button>
        <button onClick={() => load(sampleProject())} title="Load the forest sample (undoable)">
          Sample
        </button>
        <button onClick={() => fileRef.current?.click()}>Open…</button>
        <button onClick={() => downloadJson(`${slug(project.name)}.hoard.json`, project)}>Save</button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            void open(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      {error && <span className="error">{error}</span>}
    </header>
  );
}
