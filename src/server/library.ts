import fs from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import type {
  LibraryConfig,
  SourceDetail,
  SourceMetadata,
  SourceSummary,
  StrudelSampleMap
} from '../shared/types';
import { exportWavSlice, probeAudio } from './audio';
import { detectChopKey } from './keyDetection';
import { getLibraryPaths, getPort, metadataPathForSource, sourceIdFromFile } from './paths';

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav']);

export async function ensureLibrary(): Promise<void> {
  const paths = getLibraryPaths();
  await fs.mkdir(paths.sources, { recursive: true });
  await fs.mkdir(paths.exports, { recursive: true });

  try {
    await fs.access(paths.config);
  } catch {
    const config: LibraryConfig = {
      version: 1,
      createdAt: new Date().toISOString(),
      exportsBaseUrl: getDefaultExportsBaseUrl(),
      tapLatencyMs: 0
    };
    await fs.writeFile(paths.config, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  }

  try {
    await fs.access(paths.strudelMap);
  } catch {
    await writeStrudelMap({});
  }

  await regenerateStrudelMap();
}

export async function getLibraryConfig(): Promise<LibraryConfig> {
  const paths = getLibraryPaths();
  const rawConfig = JSON.parse(await fs.readFile(paths.config, 'utf8')) as Partial<LibraryConfig>;

  return normalizeLibraryConfig(rawConfig);
}

export async function saveLibraryConfig(config: LibraryConfig): Promise<LibraryConfig> {
  const current = await getLibraryConfig();
  const updated = normalizeLibraryConfig({
    ...current,
    ...config,
    version: 1,
    createdAt: current.createdAt,
    exportsBaseUrl: config.exportsBaseUrl ?? current.exportsBaseUrl
  });
  const paths = getLibraryPaths();

  await fs.writeFile(paths.config, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');

  return updated;
}

export async function importSource(tempPath: string, originalName: string): Promise<SourceDetail> {
  const paths = getLibraryPaths();
  const extension = path.extname(originalName).toLowerCase();

  if (!AUDIO_EXTENSIONS.has(extension)) {
    throw new Error('Import must be an mp3, flac, or wav file.');
  }

  const safeBase = path
    .basename(originalName, extension)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const fileName = `${safeBase || 'source'}-${nanoid(7)}${extension}`;
  const destination = path.join(paths.sources, fileName);

  await fs.copyFile(tempPath, destination);
  await fs.unlink(tempPath).catch(() => undefined);

  const metadata = await probeAudio(destination);
  const sourceMetadata: SourceMetadata = {
    version: 1,
    sourceFile: fileName,
    originalName,
    importedAt: new Date().toISOString(),
    soundName: sourceIdFromFile(fileName).replace(/-/g, '_'),
    metadata,
    beatGrid: [],
    chops: []
  };

  await saveSourceMetadata(sourceMetadata);

  return detailFromSourceMetadata(sourceMetadata);
}

export async function listSources(): Promise<SourceSummary[]> {
  const paths = getLibraryPaths();
  const entries = await fs.readdir(paths.sources).catch(() => []);
  const metadataFiles = entries.filter((entry) => entry.endsWith('.strudel-chop.json'));
  const summaries = await Promise.all(
    metadataFiles.map(async (entry) => {
      const sourceMetadata = await readSourceMetadataByPath(path.join(paths.sources, entry));
      const id = sourceIdFromFile(sourceMetadata.sourceFile);

      return {
        id,
        sourceFile: sourceMetadata.sourceFile,
        originalName: sourceMetadata.originalName,
        soundName: sourceMetadata.soundName,
        duration: sourceMetadata.metadata.duration,
        chopCount: sourceMetadata.chops.length,
        importedAt: sourceMetadata.importedAt
      };
    })
  );

  return summaries.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
}

export async function getSource(id: string): Promise<SourceDetail> {
  const paths = getLibraryPaths();
  const entries = await fs.readdir(paths.sources);
  const sourceFile = entries.find((entry) => sourceIdFromFile(entry) === id && AUDIO_EXTENSIONS.has(path.extname(entry)));

  if (!sourceFile) {
    throw new Error('Source not found.');
  }

  const sourceMetadata = await readSourceMetadataByPath(metadataPathForSource(path.join(paths.sources, sourceFile)));

  return detailFromSourceMetadata(sourceMetadata);
}

export async function saveSourceMetadata(sourceMetadata: SourceMetadata): Promise<SourceMetadata> {
  const paths = getLibraryPaths();
  const fullPath = path.join(paths.sources, sourceMetadata.sourceFile);

  await fs.writeFile(metadataPathForSource(fullPath), `${JSON.stringify(sourceMetadata, null, 2)}\n`, 'utf8');

  return sourceMetadata;
}

export async function getStrudelMapForSound(soundName: string): Promise<StrudelSampleMap | undefined> {
  const entries = await getExportedSampleEntries();
  const files = entries[soundName];

  if (!files) {
    return undefined;
  }

  return createStrudelMap({ [soundName]: files });
}

export async function exportSource(id: string): Promise<SourceMetadata> {
  const paths = getLibraryPaths();
  const detail = await getSource(id);
  const sourceMetadata = detail.sourceMetadata;
  const sourcePath = path.join(paths.sources, sourceMetadata.sourceFile);
  const sortedChops = [...sourceMetadata.chops].sort((a, b) => a.order - b.order);
  const exportDir = path.join(paths.exports, sourceMetadata.soundName);

  await fs.rm(exportDir, { recursive: true, force: true });
  await fs.mkdir(exportDir, { recursive: true });

  const files: string[] = [];
  for (let index = 0; index < sortedChops.length; index += 1) {
    const chop = sortedChops[index];
    const fileName = `${String(index).padStart(3, '0')}.wav`;
    await exportWavSlice(sourcePath, path.join(exportDir, fileName), chop.start, chop.end, chop.fadeIn, chop.fadeOut);
    files.push(`${sourceMetadata.soundName}/${fileName}`);
  }

  const updated: SourceMetadata = {
    ...sourceMetadata,
    lastExport: {
      exportedAt: new Date().toISOString(),
      soundName: sourceMetadata.soundName,
      files
    }
  };

  await saveSourceMetadata(updated);
  await regenerateStrudelMap();

  return updated;
}

export async function detectSourceChopKeys(id: string): Promise<SourceMetadata> {
  const paths = getLibraryPaths();
  const detail = await getSource(id);
  const sourceMetadata = detail.sourceMetadata;
  const sourcePath = path.join(paths.sources, sourceMetadata.sourceFile);
  const chops: SourceMetadata['chops'] = [];

  for (const chop of sourceMetadata.chops) {
    chops.push({
      ...chop,
      keyDetection: await detectChopKey(sourcePath, chop)
    });
  }

  const updated: SourceMetadata = {
    ...sourceMetadata,
    chops
  };

  await saveSourceMetadata(updated);

  return updated;
}

async function regenerateStrudelMap(): Promise<void> {
  await writeStrudelMap(await getExportedSampleEntries());
}

async function getExportedSampleEntries(): Promise<Record<string, string[]>> {
  const sources = await listSources();
  const entries: Record<string, string[]> = {};

  for (const source of sources) {
    const sourceMetadata = (await getSource(source.id)).sourceMetadata;
    if (sourceMetadata.lastExport?.files.length) {
      entries[sourceMetadata.lastExport.soundName] = versionExportFiles(
        sourceMetadata.lastExport.files,
        sourceMetadata.lastExport.exportedAt
      );
    }
  }

  return entries;
}

async function writeStrudelMap(entries: Record<string, string[]>): Promise<void> {
  const paths = getLibraryPaths();
  const map = await createStrudelMap(entries);

  await fs.writeFile(paths.strudelMap, `${JSON.stringify(map, null, 2)}\n`, 'utf8');
}

async function createStrudelMap(entries: Record<string, string[]>): Promise<StrudelSampleMap> {
  const config = await getLibraryConfig();

  return {
    _base: config.exportsBaseUrl,
    ...entries
  };
}

async function readSourceMetadataByPath(sourceMetadataPath: string): Promise<SourceMetadata> {
  return JSON.parse(await fs.readFile(sourceMetadataPath, 'utf8')) as SourceMetadata;
}

function detailFromSourceMetadata(sourceMetadata: SourceMetadata): SourceDetail {
  return {
    id: sourceIdFromFile(sourceMetadata.sourceFile),
    sourceUrl: `/sources/${encodeURIComponent(sourceMetadata.sourceFile)}`,
    sourceMetadata
  };
}

function normalizeLibraryConfig(config: Partial<LibraryConfig>): LibraryConfig {
  return {
    version: 1,
    createdAt: config.createdAt ?? new Date().toISOString(),
    exportsBaseUrl: normalizeExportsBaseUrl(config.exportsBaseUrl),
    tapLatencyMs: Number.isFinite(config.tapLatencyMs) ? config.tapLatencyMs ?? 0 : 0
  };
}

function normalizeExportsBaseUrl(exportsBaseUrl: string | undefined): string {
  if (!exportsBaseUrl || exportsBaseUrl === '/') {
    return getDefaultExportsBaseUrl();
  }

  return exportsBaseUrl.endsWith('/') ? exportsBaseUrl : `${exportsBaseUrl}/`;
}

function getDefaultExportsBaseUrl(): string {
  return `http://localhost:${getPort()}/`;
}

function versionExportFiles(files: string[], exportedAt: string): string[] {
  const version = encodeURIComponent(exportedAt);

  return files.map((file) => `${file}?v=${version}`);
}
