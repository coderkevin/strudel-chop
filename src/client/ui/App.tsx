import { ArrowDown, ArrowUp, Download, FolderOpen, Pause, Play, Plus, Repeat, Save, Scissors, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin, { type Region } from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { exportSource, getSource, importAudio, listSources, saveSource } from '../api';
import { currentBarBeat, generateBeatTicks } from '../../shared/beatGrid';
import type { BeatGridSection, ChopRegion, SourceDetail, SourceSidecar, SourceSummary } from '../../shared/types';

export function App() {
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [detail, setDetail] = useState<SourceDetail | null>(null);
  const [selectedChopId, setSelectedChopId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopSelected, setLoopSelected] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoom, setZoom] = useState(60);
  const [status, setStatus] = useState('Ready');
  const [isBusy, setIsBusy] = useState(false);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const regionMapRef = useRef<Map<string, Region>>(new Map());
  const sidecarRef = useRef<SourceSidecar | null>(null);

  const sidecar = detail?.sidecar ?? null;
  const duration = sidecar?.metadata.duration ?? 0;
  const ticks = useMemo(
    () => generateBeatTicks(sidecar?.beatGrid ?? [], duration),
    [duration, sidecar?.beatGrid]
  );
  const barBeat = useMemo(() => currentBarBeat(sidecar?.beatGrid ?? [], currentTime), [currentTime, sidecar?.beatGrid]);

  useEffect(() => {
    sidecarRef.current = sidecar;
  }, [sidecar]);

  const refreshSources = useCallback(async () => {
    setSources(await listSources());
  }, []);

  useEffect(() => {
    refreshSources().catch((error) => setStatus(error.message));
  }, [refreshSources]);

  useEffect(() => {
    if (!waveformRef.current || !detail) {
      return undefined;
    }

    const regions = RegionsPlugin.create();
    const wavesurfer = WaveSurfer.create({
      container: waveformRef.current,
      url: detail.sourceUrl,
      height: 220,
      waveColor: '#7c8796',
      progressColor: '#1f2937',
      cursorColor: 'transparent',
      normalize: true,
      minPxPerSec: zoom,
      plugins: [regions]
    });

    wavesurferRef.current = wavesurfer;
    regionsRef.current = regions;
    regionMapRef.current.clear();

    wavesurfer.on('ready', () => {
      drawRegions(detail.sidecar.chops);
      wavesurfer.zoom(zoom);
      setStatus(`Loaded ${detail.sidecar.originalName}`);
    });
    wavesurfer.on('play', () => setIsPlaying(true));
    wavesurfer.on('pause', () => setIsPlaying(false));
    wavesurfer.on('timeupdate', (time) => setCurrentTime(time));
    wavesurfer.on('interaction', () => setCurrentTime(wavesurfer.getCurrentTime()));

    regions.on('region-created', (region) => {
      regionMapRef.current.set(region.id, region);
      const current = sidecarRef.current;
      if (current && !current.chops.some((chop) => chop.id === region.id)) {
        const order = current.chops.length;
        updateSidecar((sidecarValue) => ({
          ...sidecarValue,
          chops: [
            ...sidecarValue.chops,
            {
              id: region.id,
              name: `chop ${order + 1}`,
              start: region.start,
              end: region.end,
              order
            }
          ]
        }));
        setSelectedChopId(region.id);
      }
    });
    regions.on('region-updated', (region) => {
      updateChopRegion(region.id, region.start, region.end);
    });
    regions.on('region-clicked', (region, event) => {
      event.stopPropagation();
      setSelectedChopId(region.id);
      region.play();
    });
    regions.enableDragSelection({
      color: 'rgba(20, 184, 166, 0.18)'
    });

    return () => {
      wavesurfer.destroy();
      wavesurferRef.current = null;
      regionsRef.current = null;
      regionMapRef.current.clear();
    };
  }, [detail?.id]);

  useEffect(() => {
    wavesurferRef.current?.zoom(zoom);
  }, [zoom]);

  useEffect(() => {
    const wavesurfer = wavesurferRef.current;
    if (!wavesurfer || !selectedChopId || !loopSelected) {
      return undefined;
    }

    const unsubscribe = wavesurfer.on('timeupdate', (time) => {
      const chop = sidecar?.chops.find((candidate) => candidate.id === selectedChopId);
      if (chop && time >= chop.end) {
        wavesurfer.setTime(chop.start);
        void wavesurfer.play();
      }
    });

    return unsubscribe;
  }, [loopSelected, selectedChopId, sidecar?.chops]);

  function drawRegions(chops: ChopRegion[]) {
    const regions = regionsRef.current;
    if (!regions) {
      return;
    }

    for (const chop of chops) {
      const region = regions.addRegion({
        id: chop.id,
        start: chop.start,
        end: chop.end,
        content: `${chop.order + 1}`,
        color: selectedChopId === chop.id ? 'rgba(20, 184, 166, 0.30)' : 'rgba(20, 184, 166, 0.18)',
        drag: true,
        resize: true
      });
      regionMapRef.current.set(chop.id, region);
    }
  }

  function updateSidecar(updater: (current: SourceSidecar) => SourceSidecar) {
    setDetail((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        sidecar: updater(current.sidecar)
      };
    });
  }

  function updateChopRegion(id: string, start: number, end: number) {
    updateSidecar((current) => ({
      ...current,
      chops: current.chops.map((chop) => (chop.id === id ? { ...chop, start, end } : chop))
    }));
  }

  async function openSource(id: string) {
    setIsBusy(true);
    try {
      setDetail(await getSource(id));
      setSelectedChopId(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to open source.');
    } finally {
      setIsBusy(false);
    }
  }

  async function onImport(file: File | undefined) {
    if (!file) {
      return;
    }

    setIsBusy(true);
    try {
      const imported = await importAudio(file);
      setDetail(imported);
      await refreshSources();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Import failed.');
    } finally {
      setIsBusy(false);
    }
  }

  async function persist() {
    if (!detail) {
      return;
    }

    setIsBusy(true);
    try {
      const saved = await saveSource(detail.id, detail.sidecar);
      setDetail({ ...detail, sidecar: saved });
      await refreshSources();
      setStatus('Saved sidecar metadata.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setIsBusy(false);
    }
  }

  async function exportCurrent() {
    if (!detail) {
      return;
    }

    setIsBusy(true);
    try {
      await saveSource(detail.id, detail.sidecar);
      const exported = await exportSource(detail.id);
      setDetail({ ...detail, sidecar: exported });
      await refreshSources();
      setStatus(`Exported ${exported.lastExport?.files.length ?? 0} chops for ${exported.soundName}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Export failed.');
    } finally {
      setIsBusy(false);
    }
  }

  function togglePlayback() {
    void wavesurferRef.current?.playPause();
  }

  function setDownbeat() {
    updateSidecar((current) => {
      const section: BeatGridSection = {
        id: crypto.randomUUID(),
        time: currentTime,
        bar: 1,
        bpm: current.beatGrid[0]?.bpm ?? 120,
        beatsPerBar: 4
      };

      return {
        ...current,
        beatGrid: [section, ...current.beatGrid.slice(1)]
      };
    });
  }

  function addSection() {
    updateSidecar((current) => {
      const previous = current.beatGrid.at(-1);
      const section: BeatGridSection = {
        id: crypto.randomUUID(),
        time: currentTime,
        bar: barBeat?.bar ?? previous?.bar ?? 1,
        bpm: previous?.bpm ?? 120,
        beatsPerBar: previous?.beatsPerBar ?? 4
      };

      return {
        ...current,
        beatGrid: [...current.beatGrid, section].sort((a, b) => a.time - b.time)
      };
    });
  }

  function updateSection(id: string, patch: Partial<BeatGridSection>) {
    updateSidecar((current) => ({
      ...current,
      beatGrid: current.beatGrid.map((section) => (section.id === id ? { ...section, ...patch } : section))
    }));
  }

  function addChopFromPlayhead() {
    if (!regionsRef.current || !sidecar) {
      return;
    }

    const id = crypto.randomUUID();
    const start = Math.max(0, currentTime);
    const end = Math.min(duration, start + 4);
    const region = regionsRef.current.addRegion({
      id,
      start,
      end,
      content: `${sidecar.chops.length + 1}`,
      color: 'rgba(20, 184, 166, 0.24)',
      drag: true,
      resize: true
    });

    regionMapRef.current.set(id, region);
    setSelectedChopId(id);
  }

  function moveChop(id: string, direction: -1 | 1) {
    updateSidecar((current) => ({
      ...current,
      chops: moveByDirection(current.chops, id, direction)
    }));
  }

  function deleteSelectedChop() {
    if (!selectedChopId) {
      return;
    }

    regionMapRef.current.get(selectedChopId)?.remove();
    regionMapRef.current.delete(selectedChopId);
    updateSidecar((current) => ({
      ...current,
      chops: current.chops
        .filter((chop) => chop.id !== selectedChopId)
        .sort((a, b) => a.order - b.order)
        .map((chop, order) => ({ ...chop, order }))
    }));
    setSelectedChopId(null);
  }

  function playSelectedChop() {
    const chop = sidecar?.chops.find((candidate) => candidate.id === selectedChopId);
    if (!chop || !wavesurferRef.current) {
      return;
    }

    wavesurferRef.current.setTime(chop.start);
    void wavesurferRef.current.play();
  }

  const selectedChop = sidecar?.chops.find((chop) => chop.id === selectedChopId);

  return (
    <main className="app-shell">
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
              className={detail?.id === source.id ? 'source active' : 'source'}
              key={source.id}
              type="button"
              onClick={() => openSource(source.id)}
            >
              <strong>{source.originalName}</strong>
              <span>{source.soundName} · {source.chopCount} chops</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="workspace">
        <header className="toolbar">
          <div>
            <h2>{sidecar?.originalName ?? 'Import a track to begin'}</h2>
            <p>{sidecar ? `${sidecar.soundName} · ${formatTime(duration)}` : 'Create an editable beat grid and export Strudel-ready slices.'}</p>
          </div>
          <div className="toolbar-actions">
            <button type="button" onClick={persist} disabled={!detail || isBusy}>
              <Save size={16} />
              Save
            </button>
            <button type="button" onClick={exportCurrent} disabled={!detail || isBusy || !sidecar?.chops.length}>
              <Download size={16} />
              Export
            </button>
          </div>
        </header>

        <section className="waveform-panel">
          <div className="waveform-wrap">
            <div ref={waveformRef} className="waveform" />
            {duration > 0 && (
              <div className="waveform-overlay">
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
            <button type="button" onClick={togglePlayback} disabled={!detail}>
              {isPlaying ? <Pause size={17} /> : <Play size={17} />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <span className="readout">{formatTime(currentTime)} / {formatTime(duration)}</span>
            <span className="readout">{barBeat ? `Bar ${barBeat.bar} Beat ${barBeat.beat}` : 'No grid'}</span>
            <label>
              Zoom
              <input min="20" max="260" type="range" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
            </label>
          </div>
        </section>

        <section className="editor-grid">
          <section className="panel">
            <div className="panel-heading">
              <h3>Beat grid</h3>
              <div className="button-row">
                <button type="button" onClick={setDownbeat} disabled={!detail}>
                  Set downbeat here
                </button>
                <button type="button" onClick={addSection} disabled={!detail}>
                  <Plus size={15} />
                  Add section
                </button>
              </div>
            </div>
            <div className="section-list">
              {sidecar?.beatGrid.map((section) => (
                <div className="section-card" key={section.id}>
                  <label>
                    Time
                    <input type="number" step="0.001" value={section.time} onChange={(event) => updateSection(section.id, { time: Number(event.target.value) })} />
                  </label>
                  <label>
                    Bar
                    <input type="number" min="1" value={section.bar} onChange={(event) => updateSection(section.id, { bar: Number(event.target.value) })} />
                  </label>
                  <label>
                    BPM
                    <input type="number" min="1" step="0.1" value={section.bpm} onChange={(event) => updateSection(section.id, { bpm: Number(event.target.value) })} />
                  </label>
                  <label>
                    Beats/bar
                    <input type="number" min="1" value={section.beatsPerBar} onChange={(event) => updateSection(section.id, { beatsPerBar: Number(event.target.value) })} />
                  </label>
                </div>
              ))}
              {!sidecar?.beatGrid.length && <p className="empty">Play to the first downbeat, then set the first marker.</p>}
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <h3>Chops</h3>
              <div className="button-row">
                <button type="button" onClick={addChopFromPlayhead} disabled={!detail}>
                  <Plus size={15} />
                  New chop
                </button>
                <button type="button" onClick={playSelectedChop} disabled={!selectedChop}>
                  <Play size={15} />
                  Audition
                </button>
                <button className={loopSelected ? 'active-toggle' : ''} type="button" onClick={() => setLoopSelected((value) => !value)} disabled={!selectedChop}>
                  <Repeat size={15} />
                  Loop
                </button>
                <button type="button" onClick={deleteSelectedChop} disabled={!selectedChop}>
                  <Trash2 size={15} />
                  Delete
                </button>
              </div>
            </div>
            <div className="chop-list">
              {sidecar?.chops
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((chop, index) => (
                  <div className={selectedChopId === chop.id ? 'chop active' : 'chop'} key={chop.id}>
                    <button className="chop-main" type="button" onClick={() => setSelectedChopId(chop.id)}>
                      <span className="index">{String(index).padStart(3, '0')}</span>
                      <span>{chop.name}</span>
                      <span>{formatTime(chop.start)} - {formatTime(chop.end)}</span>
                    </button>
                    <div className="reorder-buttons">
                      <button type="button" title="Move up" onClick={() => moveChop(chop.id, -1)} disabled={index === 0}>
                        <ArrowUp size={14} />
                      </button>
                      <button type="button" title="Move down" onClick={() => moveChop(chop.id, 1)} disabled={index === (sidecar?.chops.length ?? 0) - 1}>
                        <ArrowDown size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              {!sidecar?.chops.length && <p className="empty">Drag on the waveform or press New chop to create a region, then resize its edges.</p>}
            </div>
          </section>
        </section>
        <p className="status">{isBusy ? 'Working...' : status}</p>
      </section>
    </main>
  );
}

function formatTime(time: number): string {
  if (!Number.isFinite(time)) {
    return '0:00.000';
  }

  const minutes = Math.floor(time / 60);
  const seconds = time - minutes * 60;

  return `${minutes}:${seconds.toFixed(3).padStart(6, '0')}`;
}

function moveByDirection(chops: ChopRegion[], id: string, direction: -1 | 1): ChopRegion[] {
  const ordered = [...chops].sort((a, b) => a.order - b.order);
  const index = ordered.findIndex((chop) => chop.id === id);
  const nextIndex = index + direction;

  if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) {
    return ordered;
  }

  const [item] = ordered.splice(index, 1);
  ordered.splice(nextIndex, 0, item);

  return ordered.map((chop, order) => ({ ...chop, order }));
}
