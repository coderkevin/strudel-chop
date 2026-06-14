import { Download, Save } from 'lucide-react';
import type { SourceMetadata } from '../../shared/types';
import { formatTime } from './formatTime';

interface EditorToolbarProps {
  duration: number;
  isBusy: boolean;
  sourceMetadata: SourceMetadata | null;
  onExport: () => void;
  onSave: () => void;
}

export function EditorToolbar({ duration, isBusy, sourceMetadata, onExport, onSave }: EditorToolbarProps) {
  return (
    <header className="toolbar">
      <div>
        <h2>{sourceMetadata?.originalName ?? 'Import a track to begin'}</h2>
        <p>
          {sourceMetadata
            ? `${sourceMetadata.soundName} · ${formatTime(duration)}`
            : 'Create an editable beat grid and export Strudel-ready slices.'}
        </p>
      </div>
      <div className="toolbar-actions">
        <button type="button" onClick={onSave} disabled={!sourceMetadata || isBusy}>
          <Save size={16} />
          Save
        </button>
        <button type="button" onClick={onExport} disabled={!sourceMetadata || isBusy || !sourceMetadata.chops.length}>
          <Download size={16} />
          Export
        </button>
      </div>
    </header>
  );
}
