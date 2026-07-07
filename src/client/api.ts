import type { LibraryConfig, SourceDetail, SourceMetadata, SourceSummary } from '../shared/types';

export async function getConfig(): Promise<LibraryConfig> {
  return fetchJson('/api/config');
}

export async function saveConfig(config: LibraryConfig): Promise<LibraryConfig> {
  return fetchJson('/api/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
}

export async function listSources(): Promise<SourceSummary[]> {
  return fetchJson('/api/sources');
}

export async function getSource(id: string): Promise<SourceDetail> {
  return fetchJson(`/api/sources/${encodeURIComponent(id)}`);
}

export async function importAudio(file: File): Promise<SourceDetail> {
  const body = new FormData();
  body.append('audio', file);

  const response = await fetch('/api/sources', {
    method: 'POST',
    body
  });

  return readResponse(response);
}

export async function saveSource(id: string, sourceMetadata: SourceMetadata): Promise<SourceMetadata> {
  return fetchJson(`/api/sources/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sourceMetadata)
  });
}

export async function exportSource(id: string): Promise<SourceMetadata> {
  return fetchJson(`/api/sources/${encodeURIComponent(id)}/export`, {
    method: 'POST'
  });
}

export async function detectSourceKeys(id: string): Promise<SourceMetadata> {
  return fetchJson(`/api/sources/${encodeURIComponent(id)}/detect-keys`, {
    method: 'POST'
  });
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  return readResponse(await fetch(url, init));
}

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error ?? 'Request failed.');
  }

  return body as T;
}
