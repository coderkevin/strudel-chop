import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin, { type Region } from 'wavesurfer.js/dist/plugins/regions.esm.js';
import type { ChopRegion, SourceDetail, SourceMetadata } from '../../shared/types';
import type { SourceMetadataUpdater } from './editorTypes';

interface UseWaveformEditorOptions {
  detail: SourceDetail | null;
  selectedChopId: string | null;
  setSelectedChopId: (id: string) => void;
  setStatus: (status: string) => void;
  sourceMetadata: SourceMetadata | null;
  updateSourceMetadata: SourceMetadataUpdater;
}

export function useWaveformEditor({
  detail,
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

  useEffect(() => {
    sourceMetadataRef.current = sourceMetadata;
  }, [sourceMetadata]);

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
    });
    regions.on('region-updated', (region) => {
      updateChopRegion(region.id, region.start, region.end);
    });
    regions.on('region-clicked', (region, event) => {
      event.stopPropagation();
      setSelectedChopId(region.id);
      region.play();
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
      chops: current.chops.map((chop) => (chop.id === id ? { ...chop, start, end } : chop))
    }));
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
