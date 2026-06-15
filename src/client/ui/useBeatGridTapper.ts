import { useEffect, useState } from 'react';
import { estimateBpmFromTapTimes } from '../../shared/beatGrid';
import type { BeatGridTap } from './useBeatGridActions';

export function useBeatGridTapper(getCurrentTime: () => number, tapLatencyMs: number) {
  const [taps, setTaps] = useState<BeatGridTap[]>([]);
  const [estimatedBpm, setEstimatedBpm] = useState<number | null>(null);

  useEffect(() => {
    if (taps.length < 2) {
      setEstimatedBpm(null);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setEstimatedBpm(estimateBpmFromTapTimes(taps.map((tap) => tap.time)));
    }, 200);

    return () => window.clearTimeout(timeoutId);
  }, [taps]);

  function addTap() {
    const compensatedTime = Math.max(0, getCurrentTime() - tapLatencyMs / 1000);

    setTaps((current) =>
      [...current, { id: crypto.randomUUID(), time: compensatedTime }].sort((a, b) => a.time - b.time)
    );
  }

  function clearTaps() {
    setTaps([]);
  }

  function removeTap(id: string) {
    setTaps((current) => current.filter((tap) => tap.id !== id));
  }

  return {
    addTap,
    clearTaps,
    estimatedBpm,
    removeTap,
    taps
  };
}
