import { useEffect, useState } from 'react';
import { getConfig, saveConfig } from '../api';
import type { LibraryConfig } from '../../shared/types';

const DEFAULT_CONFIG: LibraryConfig = {
  version: 1,
  createdAt: new Date().toISOString(),
  exportsBaseUrl: '/',
  tapLatencyMs: 0
};

export function useLibraryConfig() {
  const [config, setConfig] = useState<LibraryConfig>(DEFAULT_CONFIG);
  const [isConfigBusy, setIsConfigBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      setIsConfigBusy(true);
      try {
        const nextConfig = await getConfig();
        if (!cancelled) {
          setConfig(nextConfig);
        }
      } finally {
        if (!cancelled) {
          setIsConfigBusy(false);
        }
      }
    }

    void loadConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  async function updateConfig(patch: Partial<LibraryConfig>) {
    setIsConfigBusy(true);
    try {
      const updated = await saveConfig({ ...config, ...patch });
      setConfig(updated);
      return updated;
    } finally {
      setIsConfigBusy(false);
    }
  }

  return {
    config,
    isConfigBusy,
    updateConfig
  };
}
