import type { Plugin, ViteDevServer } from 'vite';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

const sendJson = (
  res: import('http').ServerResponse,
  status: number,
  body: unknown
) => {
  res.statusCode = status;
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
};

const handleTrainingRevenueRequest = async (
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse
) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, null);
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed. Use GET.' });
    return;
  }

  try {
    const host = req.headers.host || 'localhost:3003';
    const url = new URL(req.url || '/', `http://${host}`);
    const now = new Date();
    const year = Number(url.searchParams.get('year')) || now.getFullYear();
    const month = Number(url.searchParams.get('month')) || now.getMonth() + 1;
    const branch = url.searchParams.get('branch') || 'all';
    const classId = url.searchParams.get('classId') || undefined;

    const { getTrainingRevenueSummary } = await import(
      './src/services/trainingRevenueApiService.ts'
    );
    const data = await getTrainingRevenueSummary({ year, month, branch, classId });

    sendJson(res, 200, { ok: true, data });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
};

export function trainingRevenueApiPlugin(): Plugin {
  return {
    name: 'training-revenue-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/training-revenue')) {
          next();
          return;
        }
        void handleTrainingRevenueRequest(req, res);
      });
    },
  };
}
