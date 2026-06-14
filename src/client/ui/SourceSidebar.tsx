import { FolderOpen, Scissors } from 'lucide-react';
import type { SourceSummary } from '../../shared/types';

interface SourceSidebarProps {
  activeSourceId?: string;
  sources: SourceSummary[];
  onImport: (file: File | undefined) => void;
  onOpenSource: (id: string) => void;
}

export function SourceSidebar({ activeSourceId, sources, onImport, onOpenSource }: SourceSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <Scissors size={22} />
        <h1>Strudel Chop</h1>
      </div>
      <label className="import-button">
        <FolderOpen size={16} />
        Import audio
        <input accept=".mp3,.flac,.wav,audio/*" type="file" onChange={(event) => onImport(event.target.files?.[0])} />
      </label>
      <div className="source-list">
        {sources.map((source) => (
          <button
            className={activeSourceId === source.id ? 'source active' : 'source'}
            key={source.id}
            type="button"
            onClick={() => onOpenSource(source.id)}
          >
            <strong>{source.originalName}</strong>
            <span>
              {source.soundName} · {source.chopCount} chops
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
