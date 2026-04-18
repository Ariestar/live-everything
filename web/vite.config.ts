import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODELS_ROOT = path.resolve(__dirname, '../models');
const KB_ROOT = path.resolve(__dirname, '../data/knowledge-base');

type Middlewares = ViteDevServer['middlewares'];

function contentTypeFor(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.json':
      return 'application/json; charset=utf-8';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

/**
 * 把 `root` 下的文件作为静态资源挂到 `urlPrefix`。
 * 防越权：禁止通过 `..` 逃逸到 root 外。
 * 走这里而不是 `publicDir` 是因为这两个目录**在 web 工程外**，
 * 让前端能直接读（开发）和打包进 dist（生产）。
 */
function attachStaticDirMiddleware(
  middlewares: Middlewares,
  urlPrefix: string,
  root: string
) {
  middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const raw = req.url?.split('?')[0] ?? '';
    if (!raw.startsWith(urlPrefix)) return next();

    const rel = decodeURIComponent(raw.slice(urlPrefix.length));
    const abs = path.normalize(path.join(root, rel));
    const rootWithSep = path.normalize(root + path.sep);
    if (!abs.startsWith(rootWithSep) && abs !== root) {
      res.statusCode = 403;
      res.end();
      return;
    }

    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return next();

    const st = fs.statSync(abs);
    res.setHeader('Content-Type', contentTypeFor(path.extname(abs)));
    res.setHeader('Content-Length', String(st.size));
    res.setHeader('Cache-Control', 'no-cache');
    fs.createReadStream(abs).pipe(res);
  });
}

function copyDirToDist(src: string, destRelative: string) {
  if (!fs.existsSync(src)) return;
  const dest = path.resolve(__dirname, 'dist', destRelative);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

function localAssetsPlugin(): Plugin {
  return {
    name: 'local-hf-models-and-kb',
    configureServer(server) {
      attachStaticDirMiddleware(server.middlewares, '/models/', MODELS_ROOT);
      attachStaticDirMiddleware(server.middlewares, '/kb/', KB_ROOT);
    },
    configurePreviewServer(server) {
      attachStaticDirMiddleware(server.middlewares, '/models/', MODELS_ROOT);
      attachStaticDirMiddleware(server.middlewares, '/kb/', KB_ROOT);
    },
    closeBundle() {
      copyDirToDist(MODELS_ROOT, 'models');
      copyDirToDist(KB_ROOT, 'kb');
    },
  };
}

const AGENT_BACKEND = process.env.VITE_AGENT_BACKEND ?? 'http://localhost:8000';

export default defineConfig({
  plugins: [react(), localAssetsPlugin()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      // agent FastAPI 服务（默认 http://localhost:8000）
      '/api': {
        target: AGENT_BACKEND,
        changeOrigin: true,
      },
      // 预留：原生 WebSocket /ws 也转发，后端已提供实时多 agent 通道
      '/ws': {
        target: AGENT_BACKEND.replace(/^http/, 'ws'),
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
