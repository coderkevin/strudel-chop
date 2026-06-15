import { estimateBpmFromTapTimes } from '../../shared/beatGrid';
import type { BeatGridSection, SourceMetadata } from '../../shared/types';
import type { SourceMetadataUpdater } from './editorTypes';

export interface BeatGridTap {
  id: string;
  time: number;
}

interface UseBeatGridActionsOptions {
  barBeat: { bar: number; beat: number } | null;
  currentTime: number;
  sourceMetadata: SourceMetadata | null;
  updateSourceMetadata: SourceMetadataUpdater;
}

export function useBeatGridActions({
  barBeat,
  currentTime,
  sourceMetadata,
  updateSourceMetadata
}: UseBeatGridActionsOptions) {
  function applyTappedDownbeats(taps: BeatGridTap[], firstBeatTapId = taps[0]?.id) {
    if (!taps.length) {
      return;
    }

    const sortedTaps = [...taps].sort((a, b) => a.time - b.time);
    const firstBeatTap = sortedTaps.find((tap) => tap.id === firstBeatTapId) ?? sortedTaps[0];
    const bpm = estimateBpmFromTapTimes(sortedTaps.map((tap) => tap.time)) ?? sourceMetadata?.beatGrid[0]?.bpm ?? 120;

    updateSourceMetadata((current) => {
      const section: BeatGridSection = {
        id: crypto.randomUUID(),
        time: firstBeatTap.time,
        bar: 1,
        beat: 1,
        bpm,
        beatsPerBar: current.beatGrid[0]?.beatsPerBar ?? 4,
        beatUnit: current.beatGrid[0]?.beatUnit ?? 4
      };

      return {
        ...current,
        beatGrid: [section, ...current.beatGrid.slice(1)]
      };
    });
  }

  function setFirstBeat() {
    updateSourceMetadata((current) => {
      const section: BeatGridSection = {
        id: crypto.randomUUID(),
        time: currentTime,
        bar: 1,
        beat: 1,
        bpm: current.beatGrid[0]?.bpm ?? 120,
        beatsPerBar: current.beatGrid[0]?.beatsPerBar ?? 4,
        beatUnit: current.beatGrid[0]?.beatUnit ?? 4
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
        beat: barBeat?.beat ?? 1,
        bpm: previous?.bpm ?? 120,
        beatsPerBar: previous?.beatsPerBar ?? 4,
        beatUnit: previous?.beatUnit ?? 4
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
      beatGrid: current.beatGrid.map((section) =>
        section.id === id ? clampBeatGridSection({ ...section, ...patch }) : section
      )
    }));
  }

  function deleteSection(id: string) {
    updateSourceMetadata((current) => ({
      ...current,
      beatGrid: current.beatGrid.filter((section) => section.id !== id)
    }));
  }

  return {
    addSection,
    applyTappedDownbeats,
    deleteSection,
    setFirstBeat,
    updateSection
  };
}

function clampBeatGridSection(section: BeatGridSection): BeatGridSection {
  const beatsPerBar = positiveIntegerOr(section.beatsPerBar, 4);
  const beatUnit = positiveIntegerOr(section.beatUnit, 4);
  const bpm = positiveNumberOr(section.bpm, 120);
  const beat = section.beat ? Math.min(Math.max(1, Math.floor(section.beat)), beatsPerBar) : section.beat;

  return {
    ...section,
    bpm,
    beat,
    beatsPerBar,
    beatUnit
  };
}

function positiveIntegerOr(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

function positiveNumberOr(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0.01, value);
}
