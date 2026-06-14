import type { BeatGridSection } from './types';

export interface BeatTick {
  time: number;
  bar: number;
  beat: number;
  isBar: boolean;
}

export function getSortedSections(sections: BeatGridSection[]): BeatGridSection[] {
  return [...sections].sort((a, b) => a.time - b.time);
}

export function secondsPerBeat(bpm: number): number {
  if (bpm <= 0) {
    throw new Error('BPM must be greater than zero.');
  }

  return 60 / bpm;
}

export function generateBeatTicks(
  sections: BeatGridSection[],
  duration: number,
  maxTicks = 5000
): BeatTick[] {
  const sorted = getSortedSections(sections);
  const ticks: BeatTick[] = [];

  for (let sectionIndex = 0; sectionIndex < sorted.length; sectionIndex += 1) {
    const section = sorted[sectionIndex];
    const nextSection = sorted[sectionIndex + 1];
    const endTime = Math.min(nextSection?.time ?? duration, duration);
    const beatLength = secondsPerBeat(section.bpm);
    let beatOffset = 0;

    while (ticks.length < maxTicks) {
      const time = section.time + beatOffset * beatLength;

      if (time > endTime + 0.0001 || time > duration + 0.0001) {
        break;
      }

      const beatInBar = beatOffset % section.beatsPerBar;
      const bar = section.bar + Math.floor(beatOffset / section.beatsPerBar);
      ticks.push({
        time,
        bar,
        beat: beatInBar + 1,
        isBar: beatInBar === 0
      });
      beatOffset += 1;
    }
  }

  return ticks;
}

export function currentBarBeat(
  sections: BeatGridSection[],
  currentTime: number
): { bar: number; beat: number } | null {
  const sorted = getSortedSections(sections);
  const section = [...sorted].reverse().find((candidate) => candidate.time <= currentTime);

  if (!section) {
    return null;
  }

  const beatLength = secondsPerBeat(section.bpm);
  const beatOffset = Math.max(0, Math.floor((currentTime - section.time) / beatLength));

  return {
    bar: section.bar + Math.floor(beatOffset / section.beatsPerBar),
    beat: (beatOffset % section.beatsPerBar) + 1
  };
}

export function clampRegion(start: number, end: number, duration: number): { start: number; end: number } {
  const safeStart = Math.max(0, Math.min(start, duration));
  const safeEnd = Math.max(safeStart + 0.01, Math.min(end, duration));

  return { start: safeStart, end: safeEnd };
}
