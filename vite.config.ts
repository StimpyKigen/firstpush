import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import { defineConfig } from 'vite';
import { getDevAllowedHosts } from './src/lib/devAllowedHosts';

const MAX_DEV_API_BODY_BYTES = 16 * 1024 * 1024;

function resolveApiHandlerModule(pathname: string): string | null {
  const clean = pathname.replace(/\/+$/, '').toLowerCase();
  if (clean === '/api/admin' || clean.startsWith('/api/admin/')) {
    return '/api/admin.ts';
  }
  if (clean === '/api/homepage-feed' || clean.startsWith('/images/uploads/')) {
    return '/api/homepage-feed.ts';
  }
  if (clean === '/api/sports' || clean.startsWith('/api/sports/') || clean.startsWith('/api/cron/')) {
    return '/api/sports.ts';
  }
  if (clean === '/api/tokens' || clean.startsWith('/api/tokens/') || clean === '/api/mpesa/verify-code') {
    return '/api/tokens.ts';
  }
  if (clean === '/api/auth' || clean.startsWith('/api/auth/')) {
    return '/api/auth.ts';
  }
  if (clean === '/api/subscription' || clean.startsWith('/api/subscription/')) {
    return '/api/subscription.ts';
  }
  if (clean === '/api/moderation' || clean.startsWith('/api/moderation/')) {
    return '/api/moderation.ts';
  }
  if (
    clean === '/api/health' ||
    clean === '/api/jackpots/mirror' ||
    clean === '/api/ai' ||
    clean.startsWith('/api/gemini/')
  ) {
    return '/api/ai.ts';
  }
  return null;
}

function readRawRequestBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let settled = false;

    req.on('data', (chunk: Buffer | string) => {
      if (settled) return;
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buf.length;
      if (totalBytes > maxBytes) {
        settled = true;
        reject(Object.assign(new Error('Request payload exceeds maximum transport limit.'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(buf);
    });

    req.on('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks).toString('utf-8'));
    });

    req.on('error', (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
  });
}

function attachVercelResponseShim(res: ServerResponse): any {
  const wrapped = res as any;
  if (typeof wrapped.status !== 'function') {
    wrapped.status = (code: number) => {
      wrapped.statusCode = code;
      return wrapped;
    };
  }
  if (typeof wrapped.json !== 'function') {
    wrapped.json = (payload: any) => {
      if (!wrapped.headersSent) {
        wrapped.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      if (!wrapped.writableEnded) {
        wrapped.end(JSON.stringify(payload));
      }
      return wrapped;
    };
  }
  if (typeof wrapped.send !== 'function') {
    wrapped.send = (payload: any) => {
      if (typeof payload === 'object' && payload !== null && !Buffer.isBuffer(payload)) {
        return wrapped.json(payload);
      }
      if (!wrapped.writableEnded) {
        wrapped.end(payload);
      }
      return wrapped;
    };
  }
  return wrapped;
}

export default defineConfig(() => {
  const isHmrDisabled = process.env.DISABLE_HMR === 'true';

  return {
    plugins: [
      react({
        // Turn off Fast Refresh when HMR is explicitly disabled to prevent React hook dispatcher errors
        fastRefresh: !isHmrDisabled,
      } as any),
      tailwindcss(),
      {
        name: 'authoritative-api-dev-bridge',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (!req.url) {
              return next();
            }

            const url = new URL(req.url, 'http://localhost');
            const isUploadRoute = url.pathname.startsWith('/images/uploads/');
            if (!url.pathname.startsWith('/api/') && !isUploadRoute) {
              return next();
            }

            const adaptedRes = attachVercelResponseShim(res);
            const modulePath = resolveApiHandlerModule(url.pathname);
            if (!modulePath) {
              return adaptedRes.status(404).json({
                success: false,
                error: isUploadRoute ? 'Media asset not found.' : `Unknown API endpoint: ${url.pathname}`,
              });
            }

            try {
              const query: Record<string, string | string[]> = {};
              url.searchParams.forEach((value, key) => {
                const existing = query[key];
                if (existing === undefined) {
                  query[key] = value;
                } else if (Array.isArray(existing)) {
                  existing.push(value);
                } else {
                  query[key] = [existing, value];
                }
              });

              const adaptedReq = req as any;
              adaptedReq.query = query;

              const method = String(req.method || 'GET').toUpperCase();
              if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS' && adaptedReq.body === undefined) {
                adaptedReq.body = await readRawRequestBody(req, MAX_DEV_API_BODY_BYTES);
              }

              const handlerModule = await server.ssrLoadModule(modulePath);
              if (typeof handlerModule?.default !== 'function') {
                return adaptedRes.status(500).json({
                  success: false,
                  error: 'API handler module is unavailable.',
                });
              }

              await handlerModule.default(adaptedReq, adaptedRes);
            } catch (err: any) {
              if (err?.statusCode === 413) {
                return adaptedRes.status(413).json({
                  success: false,
                  error: err.message || 'Payload Too Large.',
                });
              }
              return adaptedRes.status(500).json({
                success: false,
                error: 'Internal Server Error',
              });
            }
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@/components': path.resolve(__dirname, 'src/components'),
        '@': path.resolve(__dirname, '.'),
      },
      dedupe: ['react', 'react-dom', 'react-router-dom'],
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react-router-dom',
        'zustand',
        'lucide-react',
      ],
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      allowedHosts: getDevAllowedHosts(),
    },
    build: {
      target: 'esnext',
      minify: 'esbuild' as const,
      cssMinify: true,
      sourcemap: false,
    },
  };
});
