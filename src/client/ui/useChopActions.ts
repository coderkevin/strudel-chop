import { useEffect, useState } from 'react';
import type { BeatTick } from '../../shared/beatGrid';
import type { ChopRegion, SourceMetadata } from '../../shared/types';
import type { SourceMetadataUpdater, WaveformEditorRefs } from './editorTypes';

interface UseChopActionsOptions {
  currentTime: number;
  duration: number;
  ticks: BeatTick[];
  selectedChopId: string | null;
  setSelectedChopId: (id: string | null) => void;
  sourceMetadata: SourceMetadata | null;
  updateSourceMetadata: SourceMetadataUpdater;
  waveformRefs: WaveformEditorRefs;
}

export function useChopActions({
  currentTime,
  duration,
  ticks,
  selectedChopId,
  setSelectedChopId,
  sourceMetadata,
  updateSourceMetadata,
  waveformRefs
}: UseChopActionsOptions) {
  const [auditioningChopId, setAuditioningChopId] = useState<string | null>(null);

  useEffect(() => {
    const wavesurfer = waveformRefs.wavesurferRef.current;
    const chop = sourceMetadata?.chops.find((candidate) => candidate.id === auditioningChopId);

    if (!wavesurfer || !chop) {
      return undefined;
    }

    const stopAudition = () => {
      setAuditioningChopId(null);
    };
    const unsubscribeTimeUpdate = wavesurfer.on('timeupdate', (time) => {
      if (time >= chop.end) {
        setAuditioningChopId(null);
        wavesurfer.pause();
      }
    });
    const unsubscribePause = wavesurfer.on('pause', stopAudition);

    return () => {
      unsubscribeTimeUpdate();
      unsubscribePause();
    };
  }, [auditioningChopId, sourceMetadata?.chops, waveformRefs.wavesurferRef]);

  function addChopFromPlayhead() {
    if (!waveformRefs.regionsRef.current || !sourceMetadata) {
      return;
    }

    const id = crypto.randomUUID();
    const start = snapTime(Math.max(0, currentTime), ticks);
    const end = snapTime(Math.min(duration, start + 4), ticks);
    const safeEnd = Math.max(start + 0.01, Math.min(duration, end));
    const region = waveformRefs.regionsRef.current.addRegion({
      id,
      start,
      end: safeEnd,
      content: `${sourceMetadata.chops.length + 1}`,
      color: 'rgba(20, 184, 166, 0.24)',
      drag: true,
      resize: true
    });

    waveformRefs.regionMapRef.current.set(id, region);
    setSelectedChopId(id);
    updateSourceMetadata((current) => ({
      ...current,
      chops: [
        ...current.chops,
        {
          id,
          name: `chop ${current.chops.length + 1}`,
          start,
          end: safeEnd,
          order: current.chops.length
        }
      ]
    }));
  }

  function updateChopName(id: string, name: string) {
    updateSourceMetadata((current) => ({
      ...current,
      chops: current.chops.map((chop) => (chop.id === id ? { ...chop, name } : chop))
    }));
  }

  function moveChop(id: string, direction: -1 | 1) {
    updateSourceMetadata((current) => ({
      ...current,
      chops: moveByDirection(current.chops, id, direction)
    }));
  }

  function deleteSelectedChop() {
    if (!selectedChopId) {
      return;
    }

    waveformRefs.regionMapRef.current.get(selectedChopId)?.remove();
    waveformRefs.regionMapRef.current.delete(selectedChopId);
    setAuditioningChopId((current) => (current === selectedChopId ? null : current));
    updateSourceMetadata((current) => ({
      ...current,
      chops: current.chops
        .filter((chop) => chop.id !== selectedChopId)
        .sort((a, b) => a.order - b.order)
        .map((chop, order) => ({ ...chop, order }))
    }));
    setSelectedChopId(null);
  }

  function playSelectedChop() {
    if (!selectedChopId) {
      return;
    }

    auditionChop(selectedChopId);
  }

  function auditionChop(id: string) {
    const chop = sourceMetadata?.chops.find((candidate) => candidate.id === id);
    if (!chop || !waveformRefs.wavesurferRef.current) {
      return;
    }

    setSelectedChopId(id);

    if (auditioningChopId === chop.id) {
      waveformRefs.wavesurferRef.current.pause();
      setAuditioningChopId(null);
      return;
    }

    waveformRefs.wavesurferRef.current.setTime(chop.start);
    setAuditioningChopId(chop.id);
    void waveformRefs.wavesurferRef.current.play();
  }

  return {
    addChopFromPlayhead,
    auditionChop,
    deleteSelectedChop,
    isAuditioningSelectedChop: Boolean(selectedChopId && auditioningChopId === selectedChopId),
    moveChop,
    playSelectedChop,
    updateChopName
  };
}

function snapTime(time: number, ticks: BeatTick[]): number {
  if (!ticks.length) {
    return time;
  }

  return ticks.reduce((nearest, tick) =>
    Math.abs(tick.time - time) < Math.abs(nearest - time) ? tick.time : nearest
  , ticks[0].time);
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
