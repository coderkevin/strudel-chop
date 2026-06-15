import cors from 'cors';
import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  exportSource,
  getLibraryConfig,
  getSource,
  importSource,
  listSources,
  saveLibraryConfig,
  saveSourceMetadata,
  ensureLibrary
} from './library';
import { getLibraryPaths, getPort } from './paths';

const upload = multer({ dest: path.join(process.cwd(), '.tmp-uploads') });
const paths = getLibraryPaths();

async function main(): Promise<void> {
  const app = express();
  const port = getPort();

  await ensureLibrary();

  app.use(cors());
  app.use(express.json({ limit: '8mb' }));
  app.use('/sources', express.static(paths.sources));
  app.use('/', express.static(paths.exports));

  app.get('/api/health', getHealth);
  app.get('/api/config', getConfig);
  app.put('/api/config', putConfig);
  app.get('/api/sources', getSources);
  app.post('/api/sources', upload.single('audio'), postSource);
  app.get('/api/sources/:id', getSourceById);
  app.put('/api/sources/:id', putSourceMetadata);
  app.post('/api/sources/:id/export', postSourceExport);

  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa'
  });

  app.use(vite.middlewares);

  app.use(handleError);

  app.listen(port, () => {
    console.log(`Strudel Chop app: http://localhost:${port}/app`);
    console.log(`Strudel samples: http://localhost:${port}/`);
    console.log(`Library: ${paths.root}`);
  });
}

async function getConfig(
  _request: express.Request,
  response: express.Response,
  next: express.NextFunction
): Promise<void> {
  try {
    response.json(await getLibraryConfig());
  } catch (error) {
    next(error);
  }
}

async function putConfig(
  request: express.Request,
  response: express.Response,
  next: express.NextFunction
): Promise<void> {
  try {
    response.json(await saveLibraryConfig(request.body));
  } catch (error) {
    next(error);
  }
}

function getHealth(_request: express.Request, response: express.Response): void {
  response.json({ ok: true, library: paths.root });
}

async function getSources(
  _request: express.Request,
  response: express.Response,
  next: express.NextFunction
): Promise<void> {
  try {
    response.json(await listSources());
  } catch (error) {
    next(error);
  }
}

async function postSource(
  request: express.Request,
  response: express.Response,
  next: express.NextFunction
): Promise<void> {
  try {
    if (!request.file) {
      throw new Error('Missing uploaded audio file.');
    }

    response.status(201).json(await importSource(request.file.path, request.file.originalname));
  } catch (error) {
    next(error);
  }
}

async function getSourceById(
  request: express.Request,
  response: express.Response,
  next: express.NextFunction
): Promise<void> {
  try {
    response.json(await getSource(getSourceId(request)));
  } catch (error) {
    next(error);
  }
}

async function putSourceMetadata(
  request: express.Request,
  response: express.Response,
  next: express.NextFunction
): Promise<void> {
  try {
    const detail = await getSource(getSourceId(request));
    const existing = detail.sourceMetadata;
    const updated = {
      ...existing,
      ...request.body,
      sourceFile: existing.sourceFile,
      originalName: existing.originalName,
      metadata: existing.metadata,
      importedAt: existing.importedAt,
      version: 1
    };

    response.json(await saveSourceMetadata(updated));
  } catch (error) {
    next(error);
  }
}

async function postSourceExport(
  request: express.Request,
  response: express.Response,
  next: express.NextFunction
): Promise<void> {
  try {
    response.json(await exportSource(getSourceId(request)));
  } catch (error) {
    next(error);
  }
}

function getSourceId(request: express.Request): string {
  const id = request.params.id;

  if (Array.isArray(id)) {
    return id[0] ?? '';
  }

  return id;
}

function handleError(
  error: unknown,
  _request: express.Request,
  response: express.Response,
  _next: express.NextFunction
): void {
  const message = error instanceof Error ? error.message : 'Unknown error';
  response.status(500).json({ error: message });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
