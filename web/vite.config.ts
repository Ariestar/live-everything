import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODELS_ROOT = path.resolve(__dirname, '../models');

function attachModelsMiddleware(
  server: ViteDevServer['middlewares'] extends infer M ? M : never
) {
  const handler = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const raw = req.url?.split('?')[0] ?? '';
    if (!raw.startsWith('/models/')) return next();

    const rel = decodeURIComponent(raw.slice('/models/'.length));
    const abs = path.normalize(path.join(MODELS_ROOT, rel));
    const rootWithSep = path.normalize(MODELS_ROOT + path.sep);
    if (!abs.startsWith(rootWithSep) && abs !== MODELS_ROOT) {
      res.statusCode = 403;
      res.end();
      return;
    }

    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return next();

    const ext = path.extname(abs);
    const ct =
      ext === '.json'
        ? 'application/json; charset=utf-8'
        : 'application/octet-stream';
    res.setHeader('Content-Type', ct);
    fs.createReadStream(abs).pipe(res);
  };

  server.use(handler);
}

function localHfModelsPlugin(): Plugin {
  return {
    name: 'local-hf-models',
    configureServer(server) {
      attachModelsMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      attachModelsMiddleware(server.middlewares);
    },
    closeBundle() {
      if (!fs.existsSync(MODELS_ROOT)) return;
      const dest = path.resolve(__dirname, 'dist/models');
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.cpSync(MODELS_ROOT, dest, { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), localHfModelsPlugin()],
  server: {
    host: true,
    port: 5173,
  },
});
