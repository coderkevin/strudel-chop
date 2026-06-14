export type SourceFormat = 'mp3' | 'flac' | 'wav';

export interface LibraryConfig {
  version: 1;
  createdAt: string;
  exportsBaseUrl: string;
}

export interface SourceMetadata {
  duration: number;
  formatName?: string;
  sampleRate?: number;
  channels?: number;
  bitRate?: number;
}

export interface BeatGridSection {
  id: string;
  time: number;
  bar: number;
  bpm: number;
  beatsPerBar: number;
}

export interface ChopRegion {
  id: string;
  name: string;
  start: number;
  end: number;
  order: number;
}

export interface LastExport {
  exportedAt: string;
  soundName: string;
  files: string[];
}

export interface SourceSidecar {
  version: 1;
  sourceFile: string;
  originalName: string;
  importedAt: string;
  soundName: string;
  metadata: SourceMetadata;
  beatGrid: BeatGridSection[];
  chops: ChopRegion[];
  lastExport?: LastExport;
}

export interface SourceSummary {
  id: string;
  sourceFile: string;
  originalName: string;
  soundName: string;
  duration: number;
  chopCount: number;
  importedAt: string;
}

export interface SourceDetail {
  id: string;
  sourceUrl: string;
  sidecar: SourceSidecar;
}

export interface StrudelSampleMap {
  _base: string;
  [soundName: string]: string | string[];
}
