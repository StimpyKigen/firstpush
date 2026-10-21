import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

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
        name: 'sports-api-dev-middleware',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url) {
              const url = new URL(req.url, 'http://localhost');
              if (url.pathname === '/api/sports/daily-fixtures') {
                try {
                  const { getDailyMarketHighlights } = await server.ssrLoadModule('/src/lib/sportsFeedService.ts');
                  const highlights = await getDailyMarketHighlights();
                  res.setHeader('Content-Type', 'application/json');
                  res.setHeader('Access-Control-Allow-Origin', '*');
                  res.end(JSON.stringify({ success: true, count: highlights.length, fixtures: highlights }));
                  return;
                } catch (err) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, error: String(err) }));
                  return;
                }
              }
              if (url.pathname === '/api/sports/fixtures') {
                try {
                  const { queryMarketFixtures } = await server.ssrLoadModule('/src/lib/sportsFeedService.ts');
                  const scope = (url.searchParams.get('scope') as any) || 'all';
                  const league = url.searchParams.get('league') || undefined;
                  const country = url.searchParams.get('country') || undefined;
                  const date = url.searchParams.get('date') || undefined;
                  const fixtures = queryMarketFixtures({ scope, league, country, date });
                  res.setHeader('Content-Type', 'application/json');
                  res.setHeader('Access-Control-Allow-Origin', '*');
                  res.end(JSON.stringify({ success: true, count: fixtures.length, fixtures }));
                  return;
                } catch (err) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, error: String(err) }));
                  return;
                }
              }
              if (url.pathname === '/api/sports/leagues') {
                try {
                  const { discoverAllLeagues } = await server.ssrLoadModule('/src/lib/sportsFeedService.ts');
                  const leagues = await discoverAllLeagues();
                  res.setHeader('Content-Type', 'application/json');
                  res.setHeader('Access-Control-Allow-Origin', '*');
                  res.end(JSON.stringify({ success: true, count: leagues.length, leagues }));
                  return;
                } catch (err) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, error: String(err) }));
                  return;
                }
              }
              if (url.pathname === '/api/sports/live') {
                try {
                  const { queryMarketFixtures, syncLiveScoresOnly } = await server.ssrLoadModule('/src/lib/sportsFeedService.ts');
                  let liveFixtures = queryMarketFixtures({ scope: 'live' });
                  if (liveFixtures.length === 0) {
                    void syncLiveScoresOnly();
                  }
                  res.setHeader('Content-Type', 'application/json');
                  res.setHeader('Access-Control-Allow-Origin', '*');
                  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                  res.end(JSON.stringify({ success: true, count: liveFixtures.length, fixtures: liveFixtures }));
                  return;
                } catch (err) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, error: String(err) }));
                  return;
                }
              }
              if (url.pathname === '/api/sports/sync-live') {
                try {
                  const { syncLiveScoresOnly, getSyncDiagnostics } = await server.ssrLoadModule('/src/lib/sportsFeedService.ts');
                  const result = await syncLiveScoresOnly();
                  res.setHeader('Content-Type', 'application/json');
                  res.setHeader('Access-Control-Allow-Origin', '*');
                  res.end(JSON.stringify({ success: true, result, diagnostics: getSyncDiagnostics() }));
                  return;
                } catch (err) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, error: String(err) }));
                  return;
                }
              }
              if (url.pathname === '/api/sports/status') {
                try {
                  const { getSyncDiagnostics } = await server.ssrLoadModule('/src/lib/sportsFeedService.ts');
                  const diagnostics = getSyncDiagnostics();
                  res.setHeader('Content-Type', 'application/json');
                  res.setHeader('Access-Control-Allow-Origin', '*');
                  res.end(JSON.stringify({ success: true, diagnostics }));
                  return;
                } catch (err) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, error: String(err) }));
                  return;
                }
              }
            }
            next();
          });
        },
      },
    ],
    resolve: {
      alias: {
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
      // Allow any tunnel / proxy host (Cloudflare, ngrok, etc.) during local dev.
      // This does not expose the server to the network on its own — the tunnel
      // is the only thing forwarding external traffic to localhost:3000.
      allowedHosts: true as const,
    },
    build: {
      target: 'esnext',
      minify: 'esbuild' as const,
      cssMinify: true,
      sourcemap: false,
    },
  };
});


