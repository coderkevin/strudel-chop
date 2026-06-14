import fs from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import type {
  LibraryConfig,
  SourceDetail,
  SourceSidecar,
  SourceSummary,
  StrudelSampleMap
} from '../shared/types';
import { exportWavSlice, probeAudio } from './audio';
import { getLibraryPaths, sidecarPathForSource, sourceIdFromFile } from './paths';

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
      exportsBaseUrl: '/'
    };
    await fs.writeFile(paths.config, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  }

  try {
    await fs.access(paths.strudelMap);
  } catch {
    await writeStrudelMap({});
  }
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
  const sidecar: SourceSidecar = {
    version: 1,
    sourceFile: fileName,
    originalName,
    importedAt: new Date().toISOString(),
    soundName: sourceIdFromFile(fileName).replace(/-/g, '_'),
    metadata,
    beatGrid: [],
    chops: []
  };

  await saveSidecar(sidecar);

  return detailFromSidecar(sidecar);
}

export async function listSources(): Promise<SourceSummary[]> {
  const paths = getLibraryPaths();
  const entries = await fs.readdir(paths.sources).catch(() => []);
  const sidecars = entries.filter((entry) => entry.endsWith('.strudel-chop.json'));
  const summaries = await Promise.all(
    sidecars.map(async (entry) => {
      const sidecar = await readSidecarByPath(path.join(paths.sources, entry));
      const id = sourceIdFromFile(sidecar.sourceFile);

      return {
        id,
        sourceFile: sidecar.sourceFile,
        originalName: sidecar.originalName,
        soundName: sidecar.soundName,
        duration: sidecar.metadata.duration,
        chopCount: sidecar.chops.length,
        importedAt: sidecar.importedAt
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

  const sidecar = await readSidecarByPath(sidecarPathForSource(path.join(paths.sources, sourceFile)));

  return detailFromSidecar(sidecar);
}

export async function saveSidecar(sidecar: SourceSidecar): Promise<SourceSidecar> {
  const paths = getLibraryPaths();
  const fullPath = path.join(paths.sources, sidecar.sourceFile);

  await fs.writeFile(sidecarPathForSource(fullPath), `${JSON.stringify(sidecar, null, 2)}\n`, 'utf8');

  return sidecar;
}

export async function exportSource(id: string): Promise<SourceSidecar> {
  const paths = getLibraryPaths();
  const detail = await getSource(id);
  const sidecar = detail.sidecar;
  const sourcePath = path.join(paths.sources, sidecar.sourceFile);
  const sortedChops = [...sidecar.chops].sort((a, b) => a.order - b.order);
  const exportDir = path.join(paths.exports, sidecar.soundName);

  await fs.rm(exportDir, { recursive: true, force: true });
  await fs.mkdir(exportDir, { recursive: true });

  const files: string[] = [];
  for (let index = 0; index < sortedChops.length; index += 1) {
    const chop = sortedChops[index];
    const fileName = `${String(index).padStart(3, '0')}.wav`;
    await exportWavSlice(sourcePath, path.join(exportDir, fileName), chop.start, chop.end);
    files.push(`${sidecar.soundName}/${fileName}`);
  }

  const updated: SourceSidecar = {
    ...sidecar,
    lastExport: {
      exportedAt: new Date().toISOString(),
      soundName: sidecar.soundName,
      files
    }
  };

  await saveSidecar(updated);
  await regenerateStrudelMap();

  return updated;
}

async function regenerateStrudelMap(): Promise<void> {
  const sources = await listSources();
  const entries: Record<string, string[]> = {};

  for (const source of sources) {
    const sidecar = (await getSource(source.id)).sidecar;
    if (sidecar.lastExport?.files.length) {
      entries[sidecar.lastExport.soundName] = sidecar.lastExport.files;
    }
  }

  await writeStrudelMap(entries);
}

async function writeStrudelMap(entries: Record<string, string[]>): Promise<void> {
  const paths = getLibraryPaths();
  const map: StrudelSampleMap = {
    _base: '/',
    ...entries
  };

  await fs.writeFile(paths.strudelMap, `${JSON.stringify(map, null, 2)}\n`, 'utf8');
}

async function readSidecarByPath(sidecarPath: string): Promise<SourceSidecar> {
  return JSON.parse(await fs.readFile(sidecarPath, 'utf8')) as SourceSidecar;
}

function detailFromSidecar(sidecar: SourceSidecar): SourceDetail {
  return {
    id: sourceIdFromFile(sidecar.sourceFile),
    sourceUrl: `/sources/${encodeURIComponent(sidecar.sourceFile)}`,
    sidecar
  };
}
