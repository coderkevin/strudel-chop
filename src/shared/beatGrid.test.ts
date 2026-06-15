import { describe, expect, it } from 'vitest';
import { currentBarBeat, estimateBpmFromTapTimes, generateBeatTicks, nearestBarTick } from './beatGrid';

describe('beat grid', () => {
  it('generates constant tempo beat and bar ticks', () => {
    const ticks = generateBeatTicks(
      [{ id: 'a', time: 1, bar: 1, bpm: 120, beatsPerBar: 4 }],
      3
    );

    expect(ticks.map((tick) => tick.time)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3]);
    expect(ticks[0]).toMatchObject({ bar: 0, beat: 3, isBar: false });
    expect(ticks[2]).toMatchObject({ bar: 1, beat: 1, isBar: true });
  });

  it('supports tempo sections', () => {
    const ticks = generateBeatTicks(
      [
        { id: 'a', time: 0, bar: 1, bpm: 120, beatsPerBar: 4 },
        { id: 'b', time: 2, bar: 2, bpm: 60, beatsPerBar: 4 }
      ],
      5
    );

    expect(ticks.map((tick) => tick.time)).toEqual([0, 0.5, 1, 1.5, 2, 2, 3, 4, 5]);
  });

  it('reports current bar and beat', () => {
    expect(
      currentBarBeat([{ id: 'a', time: 1, bar: 9, bpm: 120, beatsPerBar: 4 }], 2.1)
    ).toEqual({ bar: 9, beat: 3 });
  });

  it('uses the section time signature for bar ticks', () => {
    const ticks = generateBeatTicks(
      [{ id: 'a', time: 0, bar: 1, beat: 1, bpm: 120, beatsPerBar: 3, beatUnit: 4 }],
      3
    );

    expect(ticks.map((tick) => ({ time: tick.time, bar: tick.bar, beat: tick.beat, isBar: tick.isBar }))).toEqual([
      { time: 0, bar: 1, beat: 1, isBar: true },
      { time: 0.5, bar: 1, beat: 2, isBar: false },
      { time: 1, bar: 1, beat: 3, isBar: false },
      { time: 1.5, bar: 2, beat: 1, isBar: true },
      { time: 2, bar: 2, beat: 2, isBar: false },
      { time: 2.5, bar: 2, beat: 3, isBar: false },
      { time: 3, bar: 3, beat: 1, isBar: true }
    ]);
  });

  it('projects backward from a section beat', () => {
    const ticks = generateBeatTicks(
      [{ id: 'a', time: 10, bar: 5, beat: 1, bpm: 120, beatsPerBar: 4 }],
      12
    );

    expect(ticks[0]).toMatchObject({ time: 0, bar: 0, beat: 1, isBar: true });
    expect(ticks.find((tick) => tick.time === 10)).toMatchObject({ bar: 5, beat: 1 });
  });

  it('finds the nearest projected bar line', () => {
    expect(
      nearestBarTick([{ id: 'a', time: 10, bar: 5, beat: 1, bpm: 120, beatsPerBar: 4 }], 12, 1.1)
    ).toMatchObject({ time: 2, bar: 1, beat: 1, sectionId: 'a' });
  });

  it('estimates bpm from beat-spaced taps', () => {
    expect(estimateBpmFromTapTimes([0, 0.475, 0.95, 1.425])).toBeCloseTo(126.32, 2);
  });

  it('estimates bpm from downbeat-spaced taps', () => {
    expect(estimateBpmFromTapTimes([0, 1.9, 3.8])).toBeCloseTo(126.32, 2);
  });

  it('estimates bpm from separated tap groups with missing taps between them', () => {
    expect(estimateBpmFromTapTimes([0, 1.9, 3.8, 38, 39.9, 41.8])).toBeCloseTo(126.32, 2);
  });

  it('estimates bpm from larger separated tap groups without exploding work', () => {
    const firstGroup = Array.from({ length: 10 }, (_, index) => index * 1.9);
    const secondGroup = Array.from({ length: 50 }, (_, index) => 91.2 + index * 1.9);

    expect(estimateBpmFromTapTimes([...firstGroup, ...secondGroup])).toBeCloseTo(126.32, 2);
  });
});
