import { Plus } from 'lucide-react';
import type { BeatGridSection } from '../../shared/types';

interface BeatGridPanelProps {
  beatGrid: BeatGridSection[];
  hasSource: boolean;
  onAddSection: () => void;
  onSetDownbeat: () => void;
  onUpdateSection: (id: string, patch: Partial<BeatGridSection>) => void;
}

export function BeatGridPanel({ beatGrid, hasSource, onAddSection, onSetDownbeat, onUpdateSection }: BeatGridPanelProps) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h3>Beat grid</h3>
        <div className="button-row">
          <button type="button" onClick={onSetDownbeat} disabled={!hasSource}>
            Set downbeat here
          </button>
          <button type="button" onClick={onAddSection} disabled={!hasSource}>
            <Plus size={15} />
            Add section
          </button>
        </div>
      </div>
      <div className="section-list">
        {beatGrid.map((section) => (
          <BeatGridSectionCard key={section.id} section={section} onUpdateSection={onUpdateSection} />
        ))}
        {!beatGrid.length && <p className="empty">Play to the first downbeat, then set the first marker.</p>}
      </div>
    </section>
  );
}

interface BeatGridSectionCardProps {
  section: BeatGridSection;
  onUpdateSection: (id: string, patch: Partial<BeatGridSection>) => void;
}

function BeatGridSectionCard({ section, onUpdateSection }: BeatGridSectionCardProps) {
  return (
    <div className="section-card">
      <label>
        Time
        <input
          type="number"
          step="0.001"
          value={section.time}
          onChange={(event) => onUpdateSection(section.id, { time: Number(event.target.value) })}
        />
      </label>
      <label>
        Bar
        <input
          type="number"
          min="1"
          value={section.bar}
          onChange={(event) => onUpdateSection(section.id, { bar: Number(event.target.value) })}
        />
      </label>
      <label>
        BPM
        <input
          type="number"
          min="1"
          step="0.1"
          value={section.bpm}
          onChange={(event) => onUpdateSection(section.id, { bpm: Number(event.target.value) })}
        />
      </label>
      <label>
        Beats/bar
        <input
          type="number"
          min="1"
          value={section.beatsPerBar}
          onChange={(event) => onUpdateSection(section.id, { beatsPerBar: Number(event.target.value) })}
        />
      </label>
    </div>
  );
}
