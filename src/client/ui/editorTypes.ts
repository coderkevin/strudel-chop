import type { Dispatch, RefObject, SetStateAction, MutableRefObject } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import type RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import type { Region } from 'wavesurfer.js/dist/plugins/regions.esm.js';
import type { SourceDetail, SourceMetadata } from '../../shared/types';

export type SourceMetadataUpdater = (updater: (current: SourceMetadata) => SourceMetadata) => void;

export interface WaveformEditorRefs {
  waveformRef: RefObject<HTMLDivElement>;
  wavesurferRef: RefObject<WaveSurfer | null>;
  regionsRef: RefObject<RegionsPlugin | null>;
  regionMapRef: MutableRefObject<Map<string, Region>>;
}

export interface SourceSelectionState {
  detail: SourceDetail | null;
  selectedChopId: string | null;
  setDetail: Dispatch<SetStateAction<SourceDetail | null>>;
  setSelectedChopId: Dispatch<SetStateAction<string | null>>;
}
