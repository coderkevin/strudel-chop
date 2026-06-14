import { describe, expect, it } from 'vitest';
import { currentBarBeat, generateBeatTicks } from './beatGrid';

describe('beat grid', () => {
  it('generates constant tempo beat and bar ticks', () => {
    const ticks = generateBeatTicks(
      [{ id: 'a', time: 1, bar: 1, bpm: 120, beatsPerBar: 4 }],
      3
    );

    expect(ticks.map((tick) => tick.time)).toEqual([1, 1.5, 2, 2.5, 3]);
    expect(ticks[0]).toMatchObject({ bar: 1, beat: 1, isBar: true });
    expect(ticks[4]).toMatchObject({ bar: 2, beat: 1, isBar: true });
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
});
