const express = require('express');
const db = require('./db');
const cache = require('./cache');
const { generateCode, isValidUrl, isValidCode } = require('./shortener');

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 3000);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// ---------------------------------------------------------------------------
// Health — used by Docker healthchecks and the CI smoke test
// ---------------------------------------------------------------------------
app.get('/health', async (_req, res) => {
  try {
    await db.healthy();
    await cache.healthy();
    res.json({ status: 'ok', db: 'up', cache: 'up' });
  } catch (err) {
    res.status(503).json({ status: 'degraded', error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/shorten  { "url": "https://example.com/very/long/path" }
// ---------------------------------------------------------------------------
app.post('/api/shorten', async (req, res) => {
  const { url } = req.body || {};
  if (!isValidUrl(url)) {
    return res.status(400).json({ error: 'Provide a valid http(s) URL in {"url": "..."}' });
  }

  // Retry on the (rare) random-code collision instead of failing the request.
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateCode();
    try {
      const link = await db.insertLink(code, url);
      await cache.setUrl(code, url);
      return res.status(201).json({
        code: link.code,
        url: link.url,
        shortUrl: `${BASE_URL}/${link.code}`,
        createdAt: link.created_at,
      });
    } catch (err) {
      if (err.code === '23505') continue; // unique_violation → try a new code
      console.error('[shorten]', err);
      return res.status(500).json({ error: 'internal error' });
    }
  }
  res.status(500).json({ error: 'could not allocate a unique code, try again' });
});

// ---------------------------------------------------------------------------
// GET /api/stats/:code — click count and metadata
// ---------------------------------------------------------------------------
app.get('/api/stats/:code', async (req, res) => {
  const { code } = req.params;
  if (!isValidCode(code)) return res.status(400).json({ error: 'invalid code format' });

  const link = await db.findByCode(code);
  if (!link) return res.status(404).json({ error: 'not found' });

  res.json({
    code: link.code,
    url: link.url,
    clicks: Number(link.clicks),
    createdAt: link.created_at,
  });
});

// ---------------------------------------------------------------------------
// GET /:code — the redirect itself (cache-first, DB fallback)
// ---------------------------------------------------------------------------
app.get('/:code', async (req, res) => {
  const { code } = req.params;
  if (!isValidCode(code)) return res.status(400).json({ error: 'invalid code format' });

  try {
    let url = await cache.getUrl(code); // hot path: Redis
    if (!url) {
      const link = await db.findByCode(code); // cold path: Postgres
      if (!link) return res.status(404).json({ error: 'not found' });
      url = link.url;
      await cache.setUrl(code, url); // repopulate cache
    }
    db.incrementClicks(code).catch((e) => console.warn('[clicks]', e.message)); // fire-and-forget
    res.redirect(302, url);
  } catch (err) {
    console.error('[redirect]', err);
    res.status(500).json({ error: 'internal error' });
  }
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function main() {
  await db.connectWithRetry();
  await db.migrate();
  await cache.connect();
  app.listen(PORT, () => console.log(`[api] LinkForge listening on ${PORT}`));
}

// Graceful shutdown so `docker compose down` doesn't wait for a SIGKILL
process.on('SIGTERM', async () => {
  console.log('[api] SIGTERM received, shutting down');
  await db.pool.end().catch(() => {});
  await cache.client.quit().catch(() => {});
  process.exit(0);
});

if (require.main === module) {
  main().catch((err) => {
    console.error('[boot] fatal:', err);
    process.exit(1);
  });
}

module.exports = app;
