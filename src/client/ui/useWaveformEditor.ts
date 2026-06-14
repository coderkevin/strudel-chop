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
  const [currentTime, setCurrentTime] = useState(0);
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
      setIsWaveformReady(true);
      setStatus(`Loaded ${detail.sourceMetadata.originalName}`);
    });
    wavesurfer.on('play', () => setIsPlaying(true));
    wavesurfer.on('pause', () => setIsPlaying(false));
    wavesurfer.on('timeupdate', (time) => setCurrentTime(time));
    wavesurfer.on('interaction', () => setCurrentTime(wavesurfer.getCurrentTime()));

    regions.on('region-created', (region) => {
      regionMapRef.current.set(region.id, region);
      const current = sourceMetadataRef.current;

      if (current && !current.chops.some((chop) => chop.id === region.id)) {
        const order = current.chops.length;
        updateSourceMetadata((metadata) => ({
          ...metadata,
          chops: [
            ...metadata.chops,
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
    if (isWaveformReady) {
      wavesurferRef.current?.zoom(zoom);
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

  function togglePlayback() {
    void wavesurferRef.current?.playPause();
  }

  return {
    currentTime,
    isPlaying,
    loopSelected,
    refs: {
      waveformRef,
      wavesurferRef,
      regionsRef,
      regionMapRef
    },
    setLoopSelected,
    setZoom,
    togglePlayback,
    zoom
  };
}
