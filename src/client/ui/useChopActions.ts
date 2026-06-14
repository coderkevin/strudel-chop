import type { ChopRegion, SourceMetadata } from '../../shared/types';
import type { SourceMetadataUpdater, WaveformEditorRefs } from './editorTypes';

interface UseChopActionsOptions {
  currentTime: number;
  duration: number;
  selectedChopId: string | null;
  setSelectedChopId: (id: string | null) => void;
  sourceMetadata: SourceMetadata | null;
  updateSourceMetadata: SourceMetadataUpdater;
  waveformRefs: WaveformEditorRefs;
}

export function useChopActions({
  currentTime,
  duration,
  selectedChopId,
  setSelectedChopId,
  sourceMetadata,
  updateSourceMetadata,
  waveformRefs
}: UseChopActionsOptions) {
  function addChopFromPlayhead() {
    if (!waveformRefs.regionsRef.current || !sourceMetadata) {
      return;
    }

    const id = crypto.randomUUID();
    const start = Math.max(0, currentTime);
    const end = Math.min(duration, start + 4);
    const region = waveformRefs.regionsRef.current.addRegion({
      id,
      start,
      end,
      content: `${sourceMetadata.chops.length + 1}`,
      color: 'rgba(20, 184, 166, 0.24)',
      drag: true,
      resize: true
    });

    waveformRefs.regionMapRef.current.set(id, region);
    setSelectedChopId(id);
    updateSourceMetadata((current) => ({
      ...current,
      chops: [
        ...current.chops,
        {
          id,
          name: `chop ${current.chops.length + 1}`,
          start,
          end,
          order: current.chops.length
        }
      ]
    }));
  }

  function moveChop(id: string, direction: -1 | 1) {
    updateSourceMetadata((current) => ({
      ...current,
      chops: moveByDirection(current.chops, id, direction)
    }));
  }

  function deleteSelectedChop() {
    if (!selectedChopId) {
      return;
    }

    waveformRefs.regionMapRef.current.get(selectedChopId)?.remove();
    waveformRefs.regionMapRef.current.delete(selectedChopId);
    updateSourceMetadata((current) => ({
      ...current,
      chops: current.chops
        .filter((chop) => chop.id !== selectedChopId)
        .sort((a, b) => a.order - b.order)
        .map((chop, order) => ({ ...chop, order }))
    }));
    setSelectedChopId(null);
  }

  function playSelectedChop() {
    const chop = sourceMetadata?.chops.find((candidate) => candidate.id === selectedChopId);
    if (!chop || !waveformRefs.wavesurferRef.current) {
      return;
    }

    waveformRefs.wavesurferRef.current.setTime(chop.start);
    void waveformRefs.wavesurferRef.current.play();
  }

  return {
    addChopFromPlayhead,
    deleteSelectedChop,
    moveChop,
    playSelectedChop
  };
}

function moveByDirection(chops: ChopRegion[], id: string, direction: -1 | 1): ChopRegion[] {
  const ordered = [...chops].sort((a, b) => a.order - b.order);
  const index = ordered.findIndex((chop) => chop.id === id);
  const nextIndex = index + direction;

  if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) {
    return ordered;
  }

  const [item] = ordered.splice(index, 1);
  ordered.splice(nextIndex, 0, item);

  return ordered.map((chop, order) => ({ ...chop, order }));
}
