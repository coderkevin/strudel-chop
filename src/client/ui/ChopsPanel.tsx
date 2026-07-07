import { ArrowDown, ArrowUp, KeyRound, Pause, Play, Plus, Repeat, Trash2 } from 'lucide-react';
import type { ChopKeyDetection, ChopRegion, MusicalScale } from '../../shared/types';
import { formatTime } from './formatTime';

const TONICS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const SCALES: MusicalScale[] = ['major', 'minor'];
const NO_CLEAR_KEY_VALUE = 'no_clear_key';

interface ChopsPanelProps {
  chops: ChopRegion[];
  hasSource: boolean;
  isAuditioning: boolean;
  isBusy: boolean;
  loopSelected: boolean;
  selectedChop?: ChopRegion;
  selectedChopId: string | null;
  onAddChop: () => void;
  onDeleteSelectedChop: () => void;
  onDetectChopKeys: () => void;
  onMoveChop: (id: string, direction: -1 | 1) => void;
  onPlaySelectedChop: () => void;
  onSelectChop: (id: string) => void;
  onSetLoopSelected: (enabled: boolean) => void;
  onUpdateChopBounds: (id: string, patch: Pick<Partial<ChopRegion>, 'start' | 'end'>) => void;
  onUpdateChopFade: (id: string, patch: Pick<Partial<ChopRegion>, 'fadeIn' | 'fadeOut'>) => void;
  onUpdateChopKeyDetection: (id: string, keyDetection: ChopKeyDetection | undefined) => void;
  onUpdateChopName: (id: string, name: string) => void;
}

export function ChopsPanel({
  chops,
  hasSource,
  isAuditioning,
  isBusy,
  loopSelected,
  selectedChop,
  selectedChopId,
  onAddChop,
  onDeleteSelectedChop,
  onDetectChopKeys,
  onMoveChop,
  onPlaySelectedChop,
  onSelectChop,
  onSetLoopSelected,
  onUpdateChopBounds,
  onUpdateChopFade,
  onUpdateChopKeyDetection,
  onUpdateChopName
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
          <button type="button" onClick={onDetectChopKeys} disabled={!hasSource || isBusy || !orderedChops.length}>
            <KeyRound size={15} />
            Detect keys
          </button>
          <button
            className={isAuditioning ? 'active-toggle' : ''}
            type="button"
            onClick={onPlaySelectedChop}
            disabled={!selectedChop}
          >
            {isAuditioning ? <Pause size={15} /> : <Play size={15} />}
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
      <div className="chop-table">
        {orderedChops.length > 0 && (
          <div className="chop-table-header">
            <span>#</span>
            <span>Range</span>
            <span>Name</span>
            <span>Key</span>
            <span>Start ms</span>
            <span>End ms</span>
            <span>Fade in</span>
            <span>Fade out</span>
            <span>Order</span>
          </div>
        )}
        {orderedChops.map((chop, index) => (
          <div className={selectedChopId === chop.id ? 'chop active' : 'chop'} key={chop.id}>
            <button className="chop-index-button" type="button" onClick={() => onSelectChop(chop.id)}>
              <span className="index">{String(index).padStart(3, '0')}</span>
            </button>
            <button className="chop-range-button" type="button" onClick={() => onSelectChop(chop.id)}>
              <span>
                {formatTime(chop.start)} - {formatTime(chop.end)}
              </span>
            </button>
            <input
              aria-label={`Chop ${index + 1} name`}
              className="chop-name-input"
              value={chop.name}
              onChange={(event) => onUpdateChopName(chop.id, event.target.value)}
              onFocus={() => onSelectChop(chop.id)}
            />
            <select
              aria-label={`Chop ${index + 1} key`}
              className={getChopKeyClassName(chop.keyDetection)}
              title={getChopKeyTitle(chop.keyDetection)}
              value={getChopKeyValue(chop.keyDetection)}
              onChange={(event) => onUpdateChopKeyDetection(chop.id, parseChopKeyValue(event.target.value))}
              onFocus={() => onSelectChop(chop.id)}
            >
              <option value="">Not detected</option>
              <option value={NO_CLEAR_KEY_VALUE}>No clear key</option>
              {TONICS.map((tonic) =>
                SCALES.map((scale) => (
                  <option key={`${tonic}-${scale}`} value={`${tonic}|${scale}`}>
                    {tonic} {scale}
                  </option>
                ))
              )}
            </select>
            <input
              aria-label={`Chop ${index + 1} start offset`}
              className="chop-time-input"
              min="0"
              step="1"
              type="number"
              value={Math.round(chop.start * 1000)}
              onChange={(event) => onUpdateChopBounds(chop.id, { start: Number(event.target.value) / 1000 })}
              onFocus={() => onSelectChop(chop.id)}
            />
            <input
              aria-label={`Chop ${index + 1} end offset`}
              className="chop-time-input"
              min="0"
              step="1"
              type="number"
              value={Math.round(chop.end * 1000)}
              onChange={(event) => onUpdateChopBounds(chop.id, { end: Number(event.target.value) / 1000 })}
              onFocus={() => onSelectChop(chop.id)}
            />
            <input
              aria-label={`Chop ${index + 1} fade in`}
              className="chop-fade-input"
              min="0"
              step="0.001"
              type="number"
              value={chop.fadeIn ?? 0}
              onChange={(event) => onUpdateChopFade(chop.id, { fadeIn: Number(event.target.value) })}
              onFocus={() => onSelectChop(chop.id)}
            />
            <input
              aria-label={`Chop ${index + 1} fade out`}
              className="chop-fade-input"
              min="0"
              step="0.001"
              type="number"
              value={chop.fadeOut ?? 0}
              onChange={(event) => onUpdateChopFade(chop.id, { fadeOut: Number(event.target.value) })}
              onFocus={() => onSelectChop(chop.id)}
            />
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
        {!orderedChops.length && <p className="empty">Press New chop to create a region at the playhead, then resize its edges.</p>}
      </div>
    </section>
  );
}

function getChopKeyValue(keyDetection: ChopKeyDetection | undefined): string {
  if (!keyDetection) {
    return '';
  }

  if (keyDetection.status === 'no_clear_key') {
    return NO_CLEAR_KEY_VALUE;
  }

  return `${keyDetection.tonic}|${keyDetection.scale}`;
}

function parseChopKeyValue(value: string): ChopKeyDetection | undefined {
  const detectedAt = new Date().toISOString();

  if (!value) {
    return undefined;
  }

  if (value === NO_CLEAR_KEY_VALUE) {
    return {
      status: 'no_clear_key',
      reason: 'manual',
      detectedAt,
      source: 'manual'
    };
  }

  const [tonic, scale] = value.split('|');

  if (!tonic || !isMusicalScale(scale)) {
    return undefined;
  }

  return {
    status: 'detected',
    tonic,
    scale,
    strength: 1,
    detectedAt,
    source: 'manual'
  };
}

function getChopKeyTitle(keyDetection: ChopKeyDetection | undefined): string {
  if (!keyDetection) {
    return 'Run Detect keys after arranging chops.';
  }

  if (keyDetection.status === 'no_clear_key') {
    return `No clear key: ${keyDetection.reason.replace(/_/g, ' ')}`;
  }

  if (keyDetection.source === 'manual') {
    return 'Manually set key.';
  }

  return `Detection strength: ${keyDetection.strength.toFixed(2)}`;
}

function getChopKeyClassName(keyDetection: ChopKeyDetection | undefined): string {
  if (keyDetection?.status === 'detected') {
    return 'chop-key';
  }

  return 'chop-key chop-key-empty';
}

function isMusicalScale(value: string | undefined): value is MusicalScale {
  return value === 'major' || value === 'minor';
}
