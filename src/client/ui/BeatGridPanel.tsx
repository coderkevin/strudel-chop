import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { BeatGridSection } from '../../shared/types';
import type { BeatGridTap } from './useBeatGridActions';
import { formatTime } from './formatTime';

interface BeatGridPanelProps {
  beatGrid: BeatGridSection[];
  hasSource: boolean;
  taps: BeatGridTap[];
  tapEstimatedBpm: number | null;
  onAddSection: () => void;
  onAddTap: () => void;
  onApplyTappedDownbeats: (taps: BeatGridTap[], firstBeatTapId?: string) => void;
  onClearTaps: () => void;
  onDeleteSection: (id: string) => void;
  onSetFirstBeat: () => void;
  onUpdateSection: (id: string, patch: Partial<BeatGridSection>) => void;
}

export function BeatGridPanel({
  beatGrid,
  hasSource,
  taps,
  tapEstimatedBpm,
  onAddSection,
  onAddTap,
  onApplyTappedDownbeats,
  onClearTaps,
  onDeleteSection,
  onSetFirstBeat,
  onUpdateSection
}: BeatGridPanelProps) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h3>Beat grid</h3>
        <div className="button-row">
          <TapDownbeatButton disabled={!hasSource} onTap={onAddTap} />
          <button type="button" onClick={onSetFirstBeat} disabled={!hasSource}>
            Set first beat
          </button>
          <button type="button" onClick={onAddSection} disabled={!hasSource}>
            <Plus size={15} />
            Add section
          </button>
        </div>
      </div>
      <TapList
        estimatedBpm={tapEstimatedBpm}
        taps={taps}
        onApplyTappedDownbeats={onApplyTappedDownbeats}
        onClearTaps={onClearTaps}
      />
      <div className="section-list">
        {beatGrid.map((section) => (
          <BeatGridSectionCard
            key={section.id}
            section={section}
            onDeleteSection={onDeleteSection}
            onUpdateSection={onUpdateSection}
          />
        ))}
        {!beatGrid.length && <p className="empty">Tap downbeats, then create a grid from the selected first beat.</p>}
      </div>
    </section>
  );
}

interface TapDownbeatButtonProps {
  disabled: boolean;
  onTap: () => void;
}

function TapDownbeatButton({ disabled, onTap }: TapDownbeatButtonProps) {
  return (
    <button
      type="button"
      onPointerDown={(event) => {
        if (!disabled && event.button === 0) {
          onTap();
        }
      }}
      onKeyDown={(event) => {
        if (!disabled && !event.repeat && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onTap();
        }
      }}
      disabled={disabled}
    >
      Tap downbeat
    </button>
  );
}

interface TapListProps {
  estimatedBpm: number | null;
  taps: BeatGridTap[];
  onApplyTappedDownbeats: (taps: BeatGridTap[], firstBeatTapId?: string) => void;
  onClearTaps: () => void;
}

function TapList({ estimatedBpm, taps, onApplyTappedDownbeats, onClearTaps }: TapListProps) {
  const [firstBeatTapId, setFirstBeatTapId] = useState<string | undefined>(taps[0]?.id);

  useEffect(() => {
    if (!taps.length) {
      setFirstBeatTapId(undefined);
      return;
    }

    if (!firstBeatTapId || !taps.some((tap) => tap.id === firstBeatTapId)) {
      setFirstBeatTapId(taps[0].id);
    }
  }, [firstBeatTapId, taps]);

  if (!taps.length) {
    return null;
  }

  return (
    <div className="tap-list">
      <div className="tap-list-heading">
        <span>{taps.length} taps</span>
        <span>{estimatedBpm ? `${estimatedBpm} BPM` : 'Tap at least twice'}</span>
      </div>
      <div className="tap-controls">
        <label>
          First beat
          <select value={firstBeatTapId} onChange={(event) => setFirstBeatTapId(event.target.value)}>
            {taps.map((tap, index) => (
              <option key={tap.id} value={tap.id}>
                {index + 1} · {formatTime(tap.time)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => onApplyTappedDownbeats(taps, firstBeatTapId)} disabled={!firstBeatTapId}>
          Create grid
        </button>
        <button type="button" onClick={onClearTaps}>
          Clear taps
        </button>
      </div>
    </div>
  );
}

interface BeatGridSectionCardProps {
  section: BeatGridSection;
  onDeleteSection: (id: string) => void;
  onUpdateSection: (id: string, patch: Partial<BeatGridSection>) => void;
}

function BeatGridSectionCard({ section, onDeleteSection, onUpdateSection }: BeatGridSectionCardProps) {
  const beatUnit = section.beatUnit ?? 4;
  const offsetMs = Math.round(section.time * 1000);

  function shiftTime(offsetSeconds: number) {
    onUpdateSection(section.id, { time: Math.max(0, Number((section.time + offsetSeconds).toFixed(3))) });
  }

  return (
    <div className="section-card">
      <label>
        First beat offset
        <input
          type="number"
          step="1"
          value={offsetMs}
          onChange={(event) => onUpdateSection(section.id, { time: Math.max(0, Number(event.target.value) / 1000) })}
        />
      </label>
      <div className="nudge-row" aria-label="Nudge first beat">
        <button type="button" onClick={() => shiftTime(-0.01)}>-10ms</button>
        <button type="button" onClick={() => shiftTime(0.01)}>+10ms</button>
      </div>
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
        Time signature
        <div className="time-signature-input">
          <input
            aria-label="Beats per bar"
            type="number"
            min="1"
            value={section.beatsPerBar}
            onChange={(event) => onUpdateSection(section.id, { beatsPerBar: Number(event.target.value) })}
          />
          <span>/</span>
          <input
            aria-label="Beat unit"
            type="number"
            min="1"
            value={beatUnit}
            onChange={(event) => onUpdateSection(section.id, { beatUnit: Number(event.target.value) })}
          />
        </div>
      </label>
      <button type="button" onClick={() => onDeleteSection(section.id)}>
        <Trash2 size={14} />
        Delete
      </button>
    </div>
  );
}
