import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin, { type Region } from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { generateBeatTicks, type BeatTick } from '../../shared/beatGrid';
import type { ChopRegion, SourceDetail, SourceMetadata } from '../../shared/types';
import type { SourceMetadataUpdater } from './editorTypes';

interface RegionDragState {
  duration: number;
  pointerCurrentX: number;
  pointerStartX: number;
  regionEnd: number;
  regionId: string;
  regionStart: number;
  side?: 'start' | 'end';
  timelineDuration: number;
  timelineWidth: number;
}

interface UseWaveformEditorOptions {
  detail: SourceDetail | null;
  onRegionClick: (id: string) => void;
  selectedChopId: string | null;
  setSelectedChopId: (id: string) => void;
  setStatus: (status: string) => void;
  sourceMetadata: SourceMetadata | null;
  updateSourceMetadata: SourceMetadataUpdater;
}

export function useWaveformEditor({
  detail,
  onRegionClick,
  selectedChopId,
  setSelectedChopId,
  setStatus,
  sourceMetadata,
  updateSourceMetadata
}: UseWaveformEditorOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopSelected, setLoopSelected] = useState(false);
  const [autoScrollPlayhead, setAutoScrollPlayhead] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [timelineScrollLeft, setTimelineScrollLeft] = useState(0);
  const [timelineWidth, setTimelineWidth] = useState(1);
  const [isWaveformReady, setIsWaveformReady] = useState(false);
  const [zoom, setZoom] = useState(60);
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const regionMapRef = useRef<Map<string, Region>>(new Map());
  const sourceMetadataRef = useRef<SourceMetadata | null>(null);
  const beatTicksRef = useRef<BeatTick[]>([]);
  const regionDragStateRef = useRef<RegionDragState | null>(null);
  const isShiftPressedRef = useRef(false);
  const isSnappingRegionRef = useRef(false);

  useEffect(() => {
    sourceMetadataRef.current = sourceMetadata;
    beatTicksRef.current = generateBeatTicks(sourceMetadata?.beatGrid ?? [], sourceMetadata?.metadata.duration ?? 0);
  }, [sourceMetadata]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        isShiftPressedRef.current = true;
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        isShiftPressedRef.current = false;
      }
    };
    const handleBlur = () => {
      isShiftPressedRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  useEffect(() => {
    if (!waveformRef.current || !detail) {
      return undefined;
    }

    const regions = RegionsPlugin.create();
    const wavesurfer = WaveSurfer.create({
      container: waveformRef.current,
      url: detail.sourceUrl,
      height: 220,
      autoScroll: autoScrollPlayhead,
      interact: false,
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
    setIsWaveformReady(false);

    wavesurfer.on('ready', () => {
      drawRegions(detail.sourceMetadata.chops);
      wavesurfer.zoom(zoom);
      syncTimelineMetrics(wavesurfer);
      setIsWaveformReady(true);
      setStatus(`Loaded ${detail.sourceMetadata.originalName}`);
    });
    wavesurfer.on('play', () => setIsPlaying(true));
    wavesurfer.on('pause', () => setIsPlaying(false));
    wavesurfer.on('timeupdate', (time) => setCurrentTime(time));
    wavesurfer.on('interaction', () => setCurrentTime(wavesurfer.getCurrentTime()));

    regions.on('region-created', (region) => {
      regionMapRef.current.set(region.id, region);
      trackRegionDrag(region, wavesurfer);
    });
    regions.on('region-update', (region, side) => {
      snapRegion(region, side);
    });
    regions.on('region-updated', (region, side) => {
      snapRegion(region, side);
      updateChopRegion(region.id, region.start, region.end);
    });
    regions.on('region-clicked', (region, event) => {
      event.stopPropagation();
      onRegionClick(region.id);
    });
    const scrollElement = getWaveformScrollElement(wavesurfer);
    const handleScroll = () => {
      syncTimelineMetrics(wavesurfer);
    };
    const removeClickSeek = scrollElement ? addClickOnlySeek(scrollElement, wavesurfer, setCurrentTime) : undefined;
    scrollElement?.addEventListener('scroll', handleScroll);

    return () => {
      scrollElement?.removeEventListener('scroll', handleScroll);
      removeClickSeek?.();
      wavesurfer.destroy();
      wavesurferRef.current = null;
      regionsRef.current = null;
      regionMapRef.current.clear();
    };
  }, [detail?.id]);

  useEffect(() => {
    wavesurferRef.current?.setOptions({ autoScroll: autoScrollPlayhead });
  }, [autoScrollPlayhead]);

  useEffect(() => {
    if (isWaveformReady) {
      const wavesurfer = wavesurferRef.current;
      if (wavesurfer) {
        try {
          wavesurfer.zoom(zoom);
        } catch {
          return;
        }
        syncTimelineMetrics(wavesurfer);
      }
    }
  }, [isWaveformReady, zoom]);

  useEffect(() => {
    const wavesurfer = wavesurferRef.current;
    if (!wavesurfer || !selectedChopId || !loopSelected) {
      return undefined;
    }

    const unsubscribe = wavesurfer.on('timeupdate', (time) => {
      const chop = sourceMetadata?.chops.find((candidate) => candidate.id === selectedChopId);
      if (chop && time >= chop.end) {
        wavesurfer.setTime(chop.start);
        void wavesurfer.play();
      }
    });

    return unsubscribe;
  }, [loopSelected, selectedChopId, sourceMetadata?.chops]);

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
        color: 'rgba(20, 184, 166, 0.18)',
        drag: true,
        resize: true
      });
      regionMapRef.current.set(chop.id, region);
    }
  }

  function updateChopRegion(id: string, start: number, end: number) {
    updateSourceMetadata((current) => ({
      ...current,
      chops: current.chops.map((chop) => (chop.id === id ? { ...chop, start, end, keyDetection: undefined } : chop))
    }));
  }

  function snapRegion(region: Region, side?: 'start' | 'end') {
    if (isShiftPressedRef.current || isSnappingRegionRef.current || !beatTicksRef.current.length) {
      return;
    }

    const snapped = snapRegionBounds(region.start, region.end, side, beatTicksRef.current, regionDragStateRef.current);
    if (Math.abs(snapped.start - region.start) < 0.0001 && Math.abs(snapped.end - region.end) < 0.0001) {
      return;
    }

    isSnappingRegionRef.current = true;
    region.setOptions(snapped);
    isSnappingRegionRef.current = false;
  }

  function trackRegionDrag(region: Region, wavesurfer: WaveSurfer) {
    const element = region.element;
    if (!element) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }

      const timelineWidth = element.parentElement?.getBoundingClientRect().width ?? 0;
      if (timelineWidth <= 0) {
        return;
      }

      regionDragStateRef.current = {
        duration: Math.max(0.01, region.end - region.start),
        pointerCurrentX: event.clientX,
        pointerStartX: event.clientX,
        regionEnd: region.end,
        regionId: region.id,
        regionStart: region.start,
        side: getRegionResizeSide(event.target),
        timelineDuration: wavesurfer.getDuration(),
        timelineWidth
      };
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (regionDragStateRef.current?.regionId === region.id) {
        regionDragStateRef.current = {
          ...regionDragStateRef.current,
          pointerCurrentX: event.clientX
        };
      }
    };
    const clearDragState = () => {
      if (regionDragStateRef.current?.regionId === region.id) {
        regionDragStateRef.current = null;
      }
    };

    element.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove, { capture: true });
    window.addEventListener('pointerup', clearDragState);
    window.addEventListener('pointercancel', clearDragState);
    region.once('remove', () => {
      element.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove, { capture: true });
      window.removeEventListener('pointerup', clearDragState);
      window.removeEventListener('pointercancel', clearDragState);
      clearDragState();
    });
  }

  function syncTimelineMetrics(wavesurfer: WaveSurfer): void {
    const scrollElement = getWaveformScrollElement(wavesurfer);

    if (!scrollElement) {
      return;
    }

    setTimelineScrollLeft(scrollElement.scrollLeft);
    setTimelineWidth(getWaveformTimelineWidth(wavesurfer));
  }

  function togglePlayback() {
    void wavesurferRef.current?.playPause();
  }

  function getCurrentTime() {
    return wavesurferRef.current?.getCurrentTime() ?? currentTime;
  }

  function scrollToTime(time: number) {
    const wavesurfer = wavesurferRef.current;
    if (!wavesurfer) {
      return;
    }

    const scrollElement = getWaveformScrollElement(wavesurfer);
    if (!scrollElement) {
      return;
    }

    const duration = wavesurfer.getDuration();
    if (duration <= 0) {
      return;
    }

    const timelineX = (time / duration) * scrollElement.scrollWidth;
    const targetScrollLeft = timelineX - scrollElement.clientWidth / 2;
    scrollElement.scrollTo({
      left: Math.max(0, targetScrollLeft),
      behavior: 'smooth'
    });
    syncTimelineMetrics(wavesurfer);
  }

  return {
    currentTime,
    autoScrollPlayhead,
    isPlaying,
    loopSelected,
    refs: {
      waveformRef,
      wavesurferRef,
      regionsRef,
      regionMapRef
    },
    setLoopSelected,
    setAutoScrollPlayhead,
    setZoom,
    getCurrentTime,
    scrollToTime,
    timelineScrollLeft,
    timelineWidth,
    togglePlayback,
    zoom
  };
}

function getWaveformScrollElement(wavesurfer: WaveSurfer): HTMLElement | null {
  const wrapper = wavesurfer.getWrapper();

  return wrapper.parentElement;
}

function getWaveformTimelineWidth(wavesurfer: WaveSurfer): number {
  const scrollElement = getWaveformScrollElement(wavesurfer);

  return Math.max(scrollElement?.scrollWidth ?? 1, 1);
}

function snapRegionBounds(
  start: number,
  end: number,
  side: 'start' | 'end' | undefined,
  ticks: BeatTick[],
  dragState: RegionDragState | null
): { start: number; end: number } {
  const duration = Math.max(0.01, end - start);

  if (dragState) {
    const timeDelta =
      ((dragState.pointerCurrentX - dragState.pointerStartX) / dragState.timelineWidth) * dragState.timelineDuration;
    const dragSide = dragState.side ?? side;

    if (dragSide === 'start') {
      const snappedStart = Math.min(nearestBeatTime(dragState.regionStart + timeDelta, ticks), dragState.regionEnd - 0.01);
      return { start: snappedStart, end: dragState.regionEnd };
    }

    if (dragSide === 'end') {
      const snappedEnd = Math.max(nearestBeatTime(dragState.regionEnd + timeDelta, ticks), dragState.regionStart + 0.01);
      return { start: dragState.regionStart, end: snappedEnd };
    }

    const snappedStart = clampRegionStart(nearestBeatTime(dragState.regionStart + timeDelta, ticks), dragState.duration, dragState.timelineDuration);

    return { start: snappedStart, end: snappedStart + dragState.duration };
  }

  if (side === 'start') {
    const snappedStart = Math.min(nearestBeatTime(start, ticks), end - 0.01);
    return { start: snappedStart, end };
  }

  if (side === 'end') {
    const snappedEnd = Math.max(nearestBeatTime(end, ticks), start + 0.01);
    return { start, end: snappedEnd };
  }

  const snappedStart = nearestBeatTime(start, ticks);

  return { start: snappedStart, end: snappedStart + duration };
}

function nearestBeatTime(time: number, ticks: BeatTick[]): number {
  return ticks.reduce((nearest, tick) =>
    Math.abs(tick.time - time) < Math.abs(nearest - time) ? tick.time : nearest
  , ticks[0]?.time ?? time);
}

function clampRegionStart(start: number, duration: number, timelineDuration: number): number {
  return Math.max(0, Math.min(start, Math.max(0, timelineDuration - duration)));
}

function getRegionResizeSide(target: EventTarget | null): 'start' | 'end' | undefined {
  if (!(target instanceof Element)) {
    return undefined;
  }

  if (target.closest('[part*="region-handle-left"]')) {
    return 'start';
  }

  if (target.closest('[part*="region-handle-right"]')) {
    return 'end';
  }

  return undefined;
}

function addClickOnlySeek(
  scrollElement: HTMLElement,
  wavesurfer: WaveSurfer,
  setCurrentTime: (time: number) => void
): () => void {
  const dragThreshold = 4;
  let pointerStart: { id: number; x: number; y: number; scrollLeft: number } | null = null;

  const handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || isRegionEvent(event)) {
      pointerStart = null;
      return;
    }

    pointerStart = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      scrollLeft: scrollElement.scrollLeft
    };
  };

  const handlePointerUp = (event: PointerEvent) => {
    if (!pointerStart || event.pointerId !== pointerStart.id || isRegionEvent(event)) {
      pointerStart = null;
      return;
    }

    const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
    const scrolled = Math.abs(scrollElement.scrollLeft - pointerStart.scrollLeft);
    const isClick = moved <= dragThreshold && scrolled <= dragThreshold;

    if (isClick) {
      const scrollRect = scrollElement.getBoundingClientRect();
      const timelineX = scrollElement.scrollLeft + event.clientX - scrollRect.left;
      const percent = Math.max(0, Math.min(1, timelineX / Math.max(scrollElement.scrollWidth, 1)));
      const time = percent * wavesurfer.getDuration();

      wavesurfer.setTime(time);
      setCurrentTime(time);
    }

    pointerStart = null;
  };

  const handlePointerCancel = () => {
    pointerStart = null;
  };

  scrollElement.addEventListener('pointerdown', handlePointerDown);
  scrollElement.addEventListener('pointerup', handlePointerUp);
  scrollElement.addEventListener('pointercancel', handlePointerCancel);

  return () => {
    scrollElement.removeEventListener('pointerdown', handlePointerDown);
    scrollElement.removeEventListener('pointerup', handlePointerUp);
    scrollElement.removeEventListener('pointercancel', handlePointerCancel);
  };
}

function isRegionEvent(event: PointerEvent): boolean {
  return event
    .composedPath()
    .some((target) => target instanceof HTMLElement && target.getAttribute('part')?.includes('region'));
}
