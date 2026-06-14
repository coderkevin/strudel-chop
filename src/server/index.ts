import cors from 'cors';
import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { exportSource, getSource, importSource, listSources, saveSidecar, ensureLibrary } from './library';
import { getLibraryPaths, getPort } from './paths';

const upload = multer({ dest: path.join(process.cwd(), '.tmp-uploads') });

async function main(): Promise<void> {
  const app = express();
  const port = getPort();
  const paths = getLibraryPaths();

  await ensureLibrary();

  app.use(cors());
  app.use(express.json({ limit: '8mb' }));
  app.use('/sources', express.static(paths.sources));
  app.use('/', express.static(paths.exports));

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true, library: paths.root });
  });

  app.get('/api/sources', async (_request, response, next) => {
    try {
      response.json(await listSources());
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/sources', upload.single('audio'), async (request, response, next) => {
    try {
      if (!request.file) {
        throw new Error('Missing uploaded audio file.');
      }

      response.status(201).json(await importSource(request.file.path, request.file.originalname));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/sources/:id', async (request, response, next) => {
    try {
      response.json(await getSource(request.params.id));
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/sources/:id', async (request, response, next) => {
    try {
      const detail = await getSource(request.params.id);
      const updated = {
        ...detail.sidecar,
        ...request.body,
        sourceFile: detail.sidecar.sourceFile,
        originalName: detail.sidecar.originalName,
        metadata: detail.sidecar.metadata,
        importedAt: detail.sidecar.importedAt,
        version: 1
      };

      response.json(await saveSidecar(updated));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/sources/:id/export', async (request, response, next) => {
    try {
      response.json(await exportSource(request.params.id));
    } catch (error) {
      next(error);
    }
  });

  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa'
  });

  app.use(vite.middlewares);

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : 'Unknown error';
    response.status(500).json({ error: message });
  });

  app.listen(port, () => {
    console.log(`Strudel Chop app: http://localhost:${port}/app`);
    console.log(`Strudel samples: http://localhost:${port}/`);
    console.log(`Library: ${paths.root}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
