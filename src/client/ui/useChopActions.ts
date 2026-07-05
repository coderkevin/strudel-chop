import { useEffect, useRef, useState } from 'react';
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
  const auditionBaseVolumeRef = useRef(1);

  useEffect(() => {
    const wavesurfer = waveformRefs.wavesurferRef.current;
    const chop = sourceMetadata?.chops.find((candidate) => candidate.id === auditioningChopId);

    if (!wavesurfer || !chop) {
      return undefined;
    }

    let animationFrameId = 0;
    const updateAuditionGain = () => {
      wavesurfer.setVolume(auditionBaseVolumeRef.current * getAuditionGain(chop, wavesurfer.getCurrentTime()));
      animationFrameId = window.requestAnimationFrame(updateAuditionGain);
    };
    const stopAudition = () => {
      window.cancelAnimationFrame(animationFrameId);
      wavesurfer.setVolume(auditionBaseVolumeRef.current);
      setAuditioningChopId(null);
    };
    const unsubscribePause = wavesurfer.on('pause', stopAudition);

    updateAuditionGain();

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      unsubscribePause();
      wavesurfer.setVolume(auditionBaseVolumeRef.current);
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
          fadeIn: 0,
          fadeOut: 0,
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

  function updateChopFade(id: string, patch: Pick<Partial<ChopRegion>, 'fadeIn' | 'fadeOut'>) {
    updateSourceMetadata((current) => ({
      ...current,
      chops: current.chops.map((chop) =>
        chop.id === id
          ? {
              ...chop,
              ...normalizeFadePatch(chop, patch)
            }
          : chop
      )
    }));
  }

  function updateChopBounds(id: string, patch: Pick<Partial<ChopRegion>, 'start' | 'end'>) {
    updateSourceMetadata((current) => ({
      ...current,
      chops: current.chops.map((chop) => {
        if (chop.id !== id) {
          return chop;
        }

        const updated = normalizeChopBounds(chop, patch, duration);
        waveformRefs.regionMapRef.current.get(id)?.setOptions({
          start: updated.start,
          end: updated.end
        });

        return updated;
      })
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
      waveformRefs.wavesurferRef.current.setVolume(0);
      waveformRefs.wavesurferRef.current.pause();
      return;
    }

    auditionBaseVolumeRef.current = waveformRefs.wavesurferRef.current.getVolume();
    waveformRefs.wavesurferRef.current.setVolume(
      auditionBaseVolumeRef.current * getAuditionGain(chop, chop.start)
    );
    setAuditioningChopId(chop.id);
    void waveformRefs.wavesurferRef.current.play(chop.start, chop.end);
  }

  return {
    addChopFromPlayhead,
    auditionChop,
    deleteSelectedChop,
    isAuditioningSelectedChop: Boolean(selectedChopId && auditioningChopId === selectedChopId),
    moveChop,
    playSelectedChop,
    updateChopBounds,
    updateChopFade,
    updateChopName
  };
}

function normalizeChopBounds(
  chop: ChopRegion,
  patch: Pick<Partial<ChopRegion>, 'start' | 'end'>,
  duration: number
): ChopRegion {
  const nextStart = patch.start === undefined ? chop.start : clampTime(patch.start, duration);
  const nextEnd = patch.end === undefined ? chop.end : clampTime(patch.end, duration);
  const start = Math.min(nextStart, nextEnd - 0.01);
  const end = Math.max(nextEnd, start + 0.01);
  const nextChop = {
    ...chop,
    start: Math.max(0, start),
    end: Math.min(duration, end)
  };
  const safeFade = normalizeFadePatch(nextChop, {
    fadeIn: nextChop.fadeIn,
    fadeOut: nextChop.fadeOut
  });

  return { ...nextChop, ...safeFade };
}

function clampTime(value: number, duration: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(value, duration));
}

function normalizeFadePatch(chop: ChopRegion, patch: Pick<Partial<ChopRegion>, 'fadeIn' | 'fadeOut'>) {
  const duration = Math.max(0, chop.end - chop.start);

  return {
    fadeIn: patch.fadeIn === undefined ? chop.fadeIn : clampFade(patch.fadeIn, duration),
    fadeOut: patch.fadeOut === undefined ? chop.fadeOut : clampFade(patch.fadeOut, duration)
  };
}

function clampFade(value: number, duration: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(value, duration));
}

function getAuditionGain(chop: ChopRegion, time: number): number {
  const duration = Math.max(0.01, chop.end - chop.start);
  const fadeIn = clampFade(chop.fadeIn ?? 0, duration);
  const fadeOut = clampFade(chop.fadeOut ?? 0, duration);
  const elapsed = Math.max(0, time - chop.start);
  const remaining = Math.max(0, chop.end - time);
  const fadeInGain = fadeIn > 0 ? Math.min(1, elapsed / fadeIn) : 1;
  const fadeOutGain = fadeOut > 0 ? Math.min(1, remaining / fadeOut) : 1;

  return Math.max(0, Math.min(1, fadeInGain, fadeOutGain));
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
