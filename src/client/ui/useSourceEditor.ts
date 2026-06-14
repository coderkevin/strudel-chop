import { useMemo, useState } from 'react';
import { currentBarBeat, generateBeatTicks } from '../../shared/beatGrid';
import type { SourceMetadata } from '../../shared/types';
import { useBeatGridActions } from './useBeatGridActions';
import { useChopActions } from './useChopActions';
import { useSourceLibrary } from './useSourceLibrary';
import { useWaveformEditor } from './useWaveformEditor';

export function useSourceEditor() {
  const library = useSourceLibrary();
  const [selectedChopId, setSelectedChopId] = useState<string | null>(null);
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
  const beatGridActions = useBeatGridActions({
    barBeat,
    currentTime: waveform.currentTime,
    updateSourceMetadata
  });
  const chopActions = useChopActions({
    currentTime: waveform.currentTime,
    duration,
    selectedChopId,
    setSelectedChopId,
    sourceMetadata,
    updateSourceMetadata,
    waveformRefs: waveform.refs
  });
  const selectedChop = sourceMetadata?.chops.find((chop) => chop.id === selectedChopId);

  async function openSource(id: string) {
    setSelectedChopId(null);
    await library.openSource(id);
  }

  return {
    actions: {
      ...beatGridActions,
      ...chopActions,
      exportCurrent: library.exportCurrent,
      onImport: library.onImport,
      openSource,
      persist: library.persist,
      setLoopSelected: waveform.setLoopSelected,
      setSelectedChopId,
      setZoom: waveform.setZoom,
      togglePlayback: waveform.togglePlayback
    },
    state: {
      barBeat,
      currentTime: waveform.currentTime,
      detail: library.detail,
      duration,
      isBusy: library.isBusy,
      isPlaying: waveform.isPlaying,
      loopSelected: waveform.loopSelected,
      selectedChop,
      selectedChopId,
      sourceMetadata,
      sources: library.sources,
      status: library.status,
      ticks,
      waveformRef: waveform.refs.waveformRef,
      zoom: waveform.zoom
    }
  };
}
