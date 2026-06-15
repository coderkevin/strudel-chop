import type { BeatGridSection } from './types';

export interface BeatTick {
  sectionId: string;
  time: number;
  bar: number;
  beat: number;
  isBar: boolean;
}

export function getSortedSections(sections: BeatGridSection[]): BeatGridSection[] {
  return sections.filter(isUsableBeatGridSection).sort((a, b) => a.time - b.time);
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
    const startTime = sectionIndex === 0 ? 0 : section.time;
    const endTime = Math.min(nextSection?.time ?? duration, duration);
    const beatLength = secondsPerBeat(section.bpm);
    let beatOffset = Math.ceil((startTime - section.time) / beatLength);

    while (ticks.length < maxTicks) {
      const time = section.time + beatOffset * beatLength;

      if (time < startTime - 0.0001) {
        beatOffset += 1;
        continue;
      }

      if (time > endTime + 0.0001 || time > duration + 0.0001) {
        break;
      }

      const beatInfo = getBeatInfo(section, beatOffset);
      ticks.push({
        sectionId: section.id,
        time,
        bar: beatInfo.bar,
        beat: beatInfo.beat,
        isBar: beatInfo.beat === 1
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
  const section = [...sorted].reverse().find((candidate) => candidate.time <= currentTime) ?? sorted[0];

  if (!section) {
    return null;
  }

  const beatLength = secondsPerBeat(section.bpm);
  const beatOffset = Math.floor((currentTime - section.time) / beatLength);
  const beatInfo = getBeatInfo(section, beatOffset);

  return beatInfo;
}

export function nearestBarTick(
  sections: BeatGridSection[],
  duration: number,
  time: number
): BeatTick | null {
  const barTicks = generateBeatTicks(sections, duration).filter((tick) => tick.isBar);

  return (
    barTicks.reduce<BeatTick | null>((nearest, tick) => {
      if (!nearest) {
        return tick;
      }

      return Math.abs(tick.time - time) < Math.abs(nearest.time - time) ? tick : nearest;
    }, null)
  );
}

export function estimateBpmFromTapTimes(tapTimes: number[]): number | null {
  if (tapTimes.length < 2) {
    return null;
  }

  const sortedTapTimes = [...tapTimes].sort((a, b) => a - b);
  const pairIntervals: number[] = [];
  const localIntervals: number[] = [];
  const maxLocalIntervalSeconds = 8;
  const maxBeatCandidatesPerInterval = 32;

  for (let startIndex = 0; startIndex < sortedTapTimes.length - 1; startIndex += 1) {
    for (let endIndex = startIndex + 1; endIndex < sortedTapTimes.length; endIndex += 1) {
      const interval = sortedTapTimes[endIndex] - sortedTapTimes[startIndex];
      if (interval > 0) {
        pairIntervals.push(interval);
        if (interval <= maxLocalIntervalSeconds) {
          localIntervals.push(interval);
        }
      }
    }
  }

  if (!pairIntervals.length) {
    return null;
  }

  const candidateBpms = new Set<number>();
  const candidateIntervals = localIntervals.length ? localIntervals : pairIntervals.slice(0, 8);

  for (const interval of candidateIntervals) {
    const minBeatCount = Math.max(1, Math.ceil((interval * 60) / 220));
    const maxBeatCount = Math.min(
      maxBeatCandidatesPerInterval,
      Math.max(minBeatCount, Math.floor((interval * 220) / 60))
    );

    for (let beatCount = minBeatCount; beatCount <= maxBeatCount; beatCount += 1) {
      const bpm = (60 * beatCount) / interval;
      if (bpm >= 60 && bpm <= 220) {
        candidateBpms.add(Number(bpm.toFixed(4)));
      }
    }
  }

  if (!candidateBpms.size) {
    return null;
  }

  const scoringIntervals = sampleIntervals(pairIntervals, 500);
  let bestBpm = 120;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const bpm of candidateBpms) {
    const beatLength = secondsPerBeat(bpm);
    const residuals = scoringIntervals.map((interval) => {
      const beatCount = Math.max(1, Math.round(interval / beatLength));
      return Math.abs(interval - beatCount * beatLength);
    });
    const timingError = residuals.reduce((sum, residual) => sum + residual, 0) / residuals.length;
    const tempoPreference = Math.abs(bpm - 120) * 0.00001;
    const score = timingError + tempoPreference;

    if (score < bestScore) {
      bestScore = score;
      bestBpm = bpm;
    }
  }

  return Number(bestBpm.toFixed(2));
}

function sampleIntervals(intervals: number[], maxCount: number): number[] {
  if (intervals.length <= maxCount) {
    return intervals;
  }

  const sampled: number[] = [];
  const step = intervals.length / maxCount;

  for (let index = 0; index < maxCount; index += 1) {
    sampled.push(intervals[Math.floor(index * step)]);
  }

  return sampled;
}

export function clampRegion(start: number, end: number, duration: number): { start: number; end: number } {
  const safeStart = Math.max(0, Math.min(start, duration));
  const safeEnd = Math.max(safeStart + 0.01, Math.min(end, duration));

  return { start: safeStart, end: safeEnd };
}

function getBeatInfo(section: BeatGridSection, beatOffset: number): { bar: number; beat: number } {
  const sectionBeatIndex = (section.beat ?? 1) - 1;
  const absoluteBeatIndex = sectionBeatIndex + beatOffset;
  const beatInBar = modulo(absoluteBeatIndex, section.beatsPerBar);

  return {
    bar: section.bar + Math.floor(absoluteBeatIndex / section.beatsPerBar),
    beat: beatInBar + 1
  };
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function isUsableBeatGridSection(section: BeatGridSection): boolean {
  return section.bpm > 0 && section.beatsPerBar > 0;
}
