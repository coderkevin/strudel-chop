import { useCallback, useEffect, useState } from 'react';
import { exportSource, getSource, importAudio, listSources, saveSource } from '../api';
import type { SourceDetail, SourceSummary } from '../../shared/types';

export function useSourceLibrary() {
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [detail, setDetail] = useState<SourceDetail | null>(null);
  const [status, setStatus] = useState('Ready');
  const [isBusy, setIsBusy] = useState(false);

  const refreshSources = useCallback(async () => {
    setSources(await listSources());
  }, []);

  useEffect(() => {
    refreshSources().catch((error) => setStatus(error.message));
  }, [refreshSources]);

  async function openSource(id: string) {
    setIsBusy(true);
    try {
      setDetail(await getSource(id));
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
