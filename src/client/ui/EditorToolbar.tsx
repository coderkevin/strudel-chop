import { Download, Save, Settings } from 'lucide-react';
import type { SourceMetadata } from '../../shared/types';
import { formatTime } from './formatTime';

interface EditorToolbarProps {
  duration: number;
  hasUnsavedChanges: boolean;
  isBusy: boolean;
  sourceMetadata: SourceMetadata | null;
  onExport: () => void;
  onSave: () => void;
  onToggleSettings: () => void;
  onUpdateSourceNames: (patch: Pick<Partial<SourceMetadata>, 'originalName' | 'soundName'>) => void;
}

export function EditorToolbar({
  duration,
  hasUnsavedChanges,
  isBusy,
  sourceMetadata,
  onExport,
  onSave,
  onToggleSettings,
  onUpdateSourceNames
}: EditorToolbarProps) {
  return (
    <header className="toolbar">
      <div className={sourceMetadata ? 'toolbar-title editing' : 'toolbar-title'}>
        {sourceMetadata ? (
          <>
            <label>
              Track name
              <input
                aria-label="Track name"
                value={sourceMetadata.originalName}
                onChange={(event) => onUpdateSourceNames({ originalName: event.target.value })}
              />
            </label>
            <label>
              Strudel sound
              <input
                aria-label="Strudel sound name"
                value={sourceMetadata.soundName}
                onChange={(event) => onUpdateSourceNames({ soundName: event.target.value })}
              />
            </label>
            <p>{formatTime(duration)}</p>
          </>
        ) : (
          <>
            <h2>Import a track to begin</h2>
            <p>Create an editable beat grid and export Strudel-ready slices.</p>
          </>
        )}
      </div>
      <div className="toolbar-actions">
        <button type="button" onClick={onToggleSettings}>
          <Settings size={16} />
          Settings
        </button>
        <button type="button" onClick={onSave} disabled={!sourceMetadata || isBusy || !hasUnsavedChanges}>
          <Save size={16} />
          {sourceMetadata && !hasUnsavedChanges ? 'Saved' : 'Save'}
        </button>
        <button type="button" onClick={onExport} disabled={!sourceMetadata || isBusy || !sourceMetadata.chops.length}>
          <Download size={16} />
          Export
        </button>
      </div>
    </header>
  );
}
