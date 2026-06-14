import { Pause, Play } from 'lucide-react';
import type { RefObject } from 'react';
import type { BeatTick } from '../../shared/beatGrid';
import { formatTime } from './formatTime';

interface WaveformPanelProps {
  barBeat: { bar: number; beat: number } | null;
  currentTime: number;
  duration: number;
  autoScrollPlayhead: boolean;
  isPlaying: boolean;
  ticks: BeatTick[];
  timelineScrollLeft: number;
  timelineWidth: number;
  waveformRef: RefObject<HTMLDivElement>;
  zoom: number;
  onSetAutoScrollPlayhead: (enabled: boolean) => void;
  onSetZoom: (zoom: number) => void;
  onTogglePlayback: () => void;
  hasSource: boolean;
}

export function WaveformPanel({
  barBeat,
  currentTime,
  duration,
  autoScrollPlayhead,
  isPlaying,
  ticks,
  timelineScrollLeft,
  timelineWidth,
  waveformRef,
  zoom,
  onSetAutoScrollPlayhead,
  onSetZoom,
  onTogglePlayback,
  hasSource
}: WaveformPanelProps) {
  return (
    <section className="waveform-panel">
      <div className="waveform-wrap">
        <div ref={waveformRef} className="waveform" />
        {duration > 0 && (
          <div
            className="waveform-overlay"
            style={{
              transform: `translateX(${-timelineScrollLeft}px)`,
              width: `${timelineWidth}px`
            }}
          >
            <div className="centerline" />
            {ticks.map((tick) => (
              <span
                className={tick.isBar ? 'tick bar-tick' : 'tick beat-tick'}
                key={`${tick.time}-${tick.bar}-${tick.beat}`}
                style={{ left: `${(tick.time / duration) * 100}%` }}
                title={`Bar ${tick.bar} beat ${tick.beat}`}
              />
            ))}
            <span className="playhead" style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
          </div>
        )}
      </div>

      <div className="transport">
        <button type="button" onClick={onTogglePlayback} disabled={!hasSource}>
          {isPlaying ? <Pause size={17} /> : <Play size={17} />}
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <span className="readout">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        <span className="readout">{barBeat ? `Bar ${barBeat.bar} Beat ${barBeat.beat}` : 'No grid'}</span>
        <label>
          Zoom
          <input min="20" max="260" type="range" value={zoom} onChange={(event) => onSetZoom(Number(event.target.value))} />
        </label>
        <label className="checkbox-control">
          <input
            type="checkbox"
            checked={autoScrollPlayhead}
            onChange={(event) => onSetAutoScrollPlayhead(event.target.checked)}
          />
          Follow playhead
        </label>
      </div>
    </section>
  );
}
