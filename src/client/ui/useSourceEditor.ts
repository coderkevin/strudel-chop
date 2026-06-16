import { useMemo, useRef, useState } from 'react';
import { currentBarBeat, generateBeatTicks } from '../../shared/beatGrid';
import type { SourceMetadata } from '../../shared/types';
import { useBeatGridActions } from './useBeatGridActions';
import { useBeatGridTapper } from './useBeatGridTapper';
import { useChopActions } from './useChopActions';
import { useLibraryConfig } from './useLibraryConfig';
import { useSourceLibrary } from './useSourceLibrary';
import { useWaveformEditor } from './useWaveformEditor';

export function useSourceEditor() {
  const library = useSourceLibrary();
  const libraryConfig = useLibraryConfig();
  const [selectedChopId, setSelectedChopId] = useState<string | null>(null);
  const auditionChopRef = useRef<(id: string) => void>(() => undefined);
  const sourceMetadata = library.detail?.sourceMetadata ?? null;
  const duration = sourceMetadata?.metadata.duration ?? 0;

  function updateSourceMetadata(updater: (current: SourceMetadata) => SourceMetadata) {
    library.setDetail((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        sourceMetadata: updater(current.sourceMetadata)
      };
    });
  }

  const waveform = useWaveformEditor({
    detail: library.detail,
    onRegionClick: (id) => auditionChopRef.current(id),
    selectedChopId,
    setSelectedChopId,
    setStatus: library.setStatus,
    sourceMetadata,
    updateSourceMetadata
  });
  const ticks = useMemo(
    () => generateBeatTicks(sourceMetadata?.beatGrid ?? [], duration),
    [duration, sourceMetadata?.beatGrid]
  );
  const barBeat = useMemo(
    () => currentBarBeat(sourceMetadata?.beatGrid ?? [], waveform.currentTime),
    [sourceMetadata?.beatGrid, waveform.currentTime]
  );
  const tapper = useBeatGridTapper(waveform.getCurrentTime, libraryConfig.config.tapLatencyMs);
  const beatGridActions = useBeatGridActions({
    barBeat,
    currentTime: waveform.currentTime,
    sourceMetadata,
    updateSourceMetadata
  });
  const chopActions = useChopActions({
    currentTime: waveform.currentTime,
    duration,
    ticks,
    selectedChopId,
    setSelectedChopId,
    sourceMetadata,
    updateSourceMetadata,
    waveformRefs: waveform.refs
  });
  auditionChopRef.current = chopActions.auditionChop;
  const selectedChop = sourceMetadata?.chops.find((chop) => chop.id === selectedChopId);

  async function openSource(id: string) {
    setSelectedChopId(null);
    await library.openSource(id);
  }

  function selectChop(id: string) {
    setSelectedChopId(id);
    const chop = sourceMetadata?.chops.find((candidate) => candidate.id === id);
    if (chop) {
      waveform.scrollToTime(chop.start);
    }
  }

  return {
    actions: {
      ...beatGridActions,
      ...chopActions,
      addBeatGridTap: tapper.addTap,
      clearBeatGridTaps: tapper.clearTaps,
      exportCurrent: library.exportCurrent,
      onImport: library.onImport,
      openSource,
      persist: library.persist,
      removeBeatGridTap: tapper.removeTap,
      setAutoScrollPlayhead: waveform.setAutoScrollPlayhead,
      setTapLatencyMs: (tapLatencyMs: number) => libraryConfig.updateConfig({ tapLatencyMs }),
      setLoopSelected: waveform.setLoopSelected,
      setSelectedChopId: selectChop,
      setZoom: waveform.setZoom,
      togglePlayback: waveform.togglePlayback
    },
    state: {
      barBeat,
      currentTime: waveform.currentTime,
      detail: library.detail,
      duration,
      autoScrollPlayhead: waveform.autoScrollPlayhead,
      isAuditioningSelectedChop: chopActions.isAuditioningSelectedChop,
      isBusy: library.isBusy || libraryConfig.isConfigBusy,
      isPlaying: waveform.isPlaying,
      loopSelected: waveform.loopSelected,
      selectedChop,
      selectedChopId,
      sourceMetadata,
      tapLatencyMs: libraryConfig.config.tapLatencyMs,
      sources: library.sources,
      status: library.status,
      tapEstimatedBpm: tapper.estimatedBpm,
      taps: tapper.taps,
      ticks,
      timelineScrollLeft: waveform.timelineScrollLeft,
      timelineWidth: waveform.timelineWidth,
      waveformRef: waveform.refs.waveformRef,
      zoom: waveform.zoom
    }
  };
}
