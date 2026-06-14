import type { BeatGridSection, SourceMetadata } from '../../shared/types';
import type { SourceMetadataUpdater } from './editorTypes';

interface UseBeatGridActionsOptions {
  barBeat: { bar: number; beat: number } | null;
  currentTime: number;
  updateSourceMetadata: SourceMetadataUpdater;
}

export function useBeatGridActions({ barBeat, currentTime, updateSourceMetadata }: UseBeatGridActionsOptions) {
  function setDownbeat() {
    updateSourceMetadata((current) => {
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
    updateSourceMetadata((current) => {
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
    updateSourceMetadata((current) => ({
      ...current,
      beatGrid: current.beatGrid.map((section) => (section.id === id ? { ...section, ...patch } : section))
    }));
  }

  return {
    addSection,
    setDownbeat,
    updateSection
  };
}
