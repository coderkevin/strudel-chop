import { ArrowDown, ArrowUp, Play, Plus, Repeat, Trash2 } from 'lucide-react';
import type { ChopRegion } from '../../shared/types';
import { formatTime } from './formatTime';

interface ChopsPanelProps {
  chops: ChopRegion[];
  hasSource: boolean;
  loopSelected: boolean;
  selectedChop?: ChopRegion;
  selectedChopId: string | null;
  onAddChop: () => void;
  onDeleteSelectedChop: () => void;
  onMoveChop: (id: string, direction: -1 | 1) => void;
  onPlaySelectedChop: () => void;
  onSelectChop: (id: string) => void;
  onSetLoopSelected: (enabled: boolean) => void;
}

export function ChopsPanel({
  chops,
  hasSource,
  loopSelected,
  selectedChop,
  selectedChopId,
  onAddChop,
  onDeleteSelectedChop,
  onMoveChop,
  onPlaySelectedChop,
  onSelectChop,
  onSetLoopSelected
}: ChopsPanelProps) {
  const orderedChops = [...chops].sort((a, b) => a.order - b.order);

  return (
    <section className="panel">
      <div className="panel-heading">
        <h3>Chops</h3>
        <div className="button-row">
          <button type="button" onClick={onAddChop} disabled={!hasSource}>
            <Plus size={15} />
            New chop
          </button>
          <button type="button" onClick={onPlaySelectedChop} disabled={!selectedChop}>
            <Play size={15} />
            Audition
          </button>
          <button
            className={loopSelected ? 'active-toggle' : ''}
            type="button"
            onClick={() => onSetLoopSelected(!loopSelected)}
            disabled={!selectedChop}
          >
            <Repeat size={15} />
            Loop
          </button>
          <button type="button" onClick={onDeleteSelectedChop} disabled={!selectedChop}>
            <Trash2 size={15} />
            Delete
          </button>
        </div>
      </div>
      <div className="chop-list">
        {orderedChops.map((chop, index) => (
          <div className={selectedChopId === chop.id ? 'chop active' : 'chop'} key={chop.id}>
            <button className="chop-main" type="button" onClick={() => onSelectChop(chop.id)}>
              <span className="index">{String(index).padStart(3, '0')}</span>
              <span>{chop.name}</span>
              <span>
                {formatTime(chop.start)} - {formatTime(chop.end)}
              </span>
            </button>
            <div className="reorder-buttons">
              <button type="button" title="Move up" onClick={() => onMoveChop(chop.id, -1)} disabled={index === 0}>
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                title="Move down"
                onClick={() => onMoveChop(chop.id, 1)}
                disabled={index === orderedChops.length - 1}
              >
                <ArrowDown size={14} />
              </button>
            </div>
          </div>
        ))}
        {!orderedChops.length && <p className="empty">Drag on the waveform or press New chop to create a region, then resize its edges.</p>}
      </div>
    </section>
  );
}
