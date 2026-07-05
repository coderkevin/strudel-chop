import { useCallback, useEffect, useMemo, useState } from 'react';
import { exportSource, getSource, importAudio, listSources, saveSource } from '../api';
import type { SourceDetail, SourceMetadata, SourceSummary } from '../../shared/types';

function serializeSourceMetadata(sourceMetadata: SourceMetadata | null): string {
  return sourceMetadata ? JSON.stringify(sourceMetadata) : '';
}

export function useSourceLibrary() {
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [detail, setDetail] = useState<SourceDetail | null>(null);
  const [savedSourceMetadataSnapshot, setSavedSourceMetadataSnapshot] = useState('');
  const [status, setStatus] = useState('Ready');
  const [isBusy, setIsBusy] = useState(false);
  const currentSourceMetadataSnapshot = useMemo(
    () => serializeSourceMetadata(detail?.sourceMetadata ?? null),
    [detail?.sourceMetadata]
  );
  const hasUnsavedChanges = Boolean(detail && currentSourceMetadataSnapshot !== savedSourceMetadataSnapshot);

  const refreshSources = useCallback(async () => {
    setSources(await listSources());
  }, []);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return undefined;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    refreshSources().catch((error) => setStatus(error.message));
  }, [refreshSources]);

  async function openSource(id: string) {
    setIsBusy(true);
    try {
      const opened = await getSource(id);
      setDetail(opened);
      setSavedSourceMetadataSnapshot(serializeSourceMetadata(opened.sourceMetadata));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to open source.');
    } finally {
      setIsBusy(false);
    }
  }

  async function onImport(file: File | undefined) {
    if (!file) {
      return;
    }

    setIsBusy(true);
    try {
      const imported = await importAudio(file);
      setDetail(imported);
      setSavedSourceMetadataSnapshot(serializeSourceMetadata(imported.sourceMetadata));
      await refreshSources();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Import failed.');
    } finally {
      setIsBusy(false);
    }
  }

  async function persist() {
    if (!detail) {
      return;
    }

    setIsBusy(true);
    try {
      const saved = await saveSource(detail.id, detail.sourceMetadata);
      setDetail({ ...detail, sourceMetadata: saved });
      setSavedSourceMetadataSnapshot(serializeSourceMetadata(saved));
      await refreshSources();
      setStatus('Saved source metadata.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setIsBusy(false);
    }
  }

  async function exportCurrent() {
    if (!detail) {
      return;
    }

    setIsBusy(true);
    try {
      await saveSource(detail.id, detail.sourceMetadata);
      const exported = await exportSource(detail.id);
      setDetail({ ...detail, sourceMetadata: exported });
      setSavedSourceMetadataSnapshot(serializeSourceMetadata(exported));
      await refreshSources();
      setStatus(`Exported ${exported.lastExport?.files.length ?? 0} chops for ${exported.soundName}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Export failed.');
    } finally {
      setIsBusy(false);
    }
  }

  return {
    detail,
    exportCurrent,
    hasUnsavedChanges,
    isBusy,
    onImport,
    openSource,
    persist,
    setDetail,
    setStatus,
    sources,
    status
  };
}
