import { useEffect, useMemo, useRef, useState } from 'react';

const CLICK_TRACK_URL = '/calibration-click-120bpm.wav';
const CLICK_BPM = 120;
const CLICK_COUNT = 16;
const CLICK_INTERVAL_SECONDS = 60 / CLICK_BPM;
const CLICK_MATCH_WINDOW_SECONDS = CLICK_INTERVAL_SECONDS / 2;
const CLICK_TIMES = Array.from({ length: CLICK_COUNT }, (_, index) => index * CLICK_INTERVAL_SECONDS);

interface SettingsPanelProps {
  tapLatencyMs: number;
  onSetTapLatencyMs: (tapLatencyMs: number) => Promise<unknown>;
}

interface CalibrationTap {
  id: string;
  time: number;
}

export function SettingsPanel({ tapLatencyMs, onSetTapLatencyMs }: SettingsPanelProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [taps, setTaps] = useState<CalibrationTap[]>([]);
  const [draftLatencyMs, setDraftLatencyMs] = useState(tapLatencyMs);
  const [isSaving, setIsSaving] = useState(false);
  const matchedOffsets = useMemo(() => matchTapOffsets(taps), [taps]);
  const calibratedLatencyMs = useMemo(() => {
    if (!matchedOffsets.length) {
      return null;
    }

    return Math.round(median(matchedOffsets) * 1000);
  }, [matchedOffsets]);

  useEffect(() => {
    setDraftLatencyMs(tapLatencyMs);
  }, [tapLatencyMs]);

  async function playCalibrationTrack() {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    setTaps([]);
    audio.currentTime = 0;
    await audio.play();
  }

  function stopCalibrationTrack() {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    audio.pause();
    audio.currentTime = 0;
  }

  function addCalibrationTap() {
    const audio = audioRef.current;

    if (!audio || audio.paused || audio.ended) {
      return;
    }

    setTaps((current) => [...current, { id: crypto.randomUUID(), time: audio.currentTime }]);
  }

  async function saveLatency(nextLatencyMs: number) {
    setIsSaving(true);
    try {
      await onSetTapLatencyMs(nextLatencyMs);
      setDraftLatencyMs(nextLatencyMs);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="settings-panel">
      <audio ref={audioRef} src={CLICK_TRACK_URL} preload="auto" />
      <div className="settings-heading">
        <div>
          <h3>Settings</h3>
        </div>
        <label>
          Tap compensation
          <div className="latency-input">
            <input
              type="number"
              step="1"
              value={draftLatencyMs}
              onChange={(event) => setDraftLatencyMs(Number(event.target.value))}
            />
            <span>ms</span>
          </div>
        </label>
        <button type="button" onClick={() => saveLatency(draftLatencyMs)} disabled={isSaving}>
          Save
        </button>
      </div>
      <div className="calibration-grid">
        <div className="calibration-controls">
          <div className="button-row">
            <button type="button" onClick={playCalibrationTrack}>
              Play clicks
            </button>
            <TapCaptureButton onTap={addCalibrationTap} />
            <button type="button" onClick={stopCalibrationTrack}>
              Stop
            </button>
            <button type="button" onClick={() => setTaps([])} disabled={!taps.length}>
              Clear taps
            </button>
          </div>
          <div className="calibration-readout">
            <span>{taps.length} taps</span>
            <span>{matchedOffsets.length} matched</span>
            <span>{formatLatencyResult(calibratedLatencyMs)}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => calibratedLatencyMs !== null && saveLatency(calibratedLatencyMs)}
          disabled={calibratedLatencyMs === null || isSaving}
        >
          Use calibration result
        </button>
      </div>
    </section>
  );
}

interface TapCaptureButtonProps {
  onTap: () => void;
}

function TapCaptureButton({ onTap }: TapCaptureButtonProps) {
  return (
    <button
      type="button"
      className="primary-action"
      onPointerDown={(event) => {
        if (event.button === 0) {
          onTap();
        }
      }}
      onKeyDown={(event) => {
        if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onTap();
        }
      }}
    >
      Tap
    </button>
  );
}

function matchTapOffsets(taps: CalibrationTap[]): number[] {
  return taps.flatMap((tap) => {
    const nearestClickTime = nearestValue(CLICK_TIMES, tap.time);
    const offset = tap.time - nearestClickTime;

    return Math.abs(offset) <= CLICK_MATCH_WINDOW_SECONDS ? [offset] : [];
  });
}

function nearestValue(values: number[], target: number): number {
  return values.reduce((nearest, value) => (Math.abs(value - target) < Math.abs(nearest - target) ? value : nearest));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function formatLatencyResult(latencyMs: number | null): string {
  if (latencyMs === null) {
    return 'No result yet';
  }

  if (latencyMs === 0) {
    return '0 ms';
  }

  return latencyMs > 0 ? `${latencyMs} ms late` : `${Math.abs(latencyMs)} ms early`;
}
