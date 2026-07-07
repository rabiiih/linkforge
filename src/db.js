const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 10,
});

/** Create schema if it doesn't exist (idempotent, safe to run on every boot). */
async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS links (
      id         BIGSERIAL PRIMARY KEY,
      code       TEXT UNIQUE NOT NULL,
      url        TEXT NOT NULL,
      clicks     BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_links_code ON links (code);
  `);
}

/** Retry helper — containers may start before Postgres finishes initializing. */
async function connectWithRetry(retries = 10, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query('SELECT 1');
      console.log(`[db] connected (attempt ${attempt})`);
      return;
    } catch (err) {
      console.warn(`[db] not ready (attempt ${attempt}/${retries}): ${err.message}`);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function insertLink(code, url) {
  const { rows } = await pool.query(
    'INSERT INTO links (code, url) VALUES ($1, $2) RETURNING code, url, created_at',
    [code, url]
  );
  return rows[0];
}

async function findByCode(code) {
  const { rows } = await pool.query(
    'SELECT code, url, clicks, created_at FROM links WHERE code = $1',
    [code]
  );
  return rows[0] || null;
}

async function incrementClicks(code) {
  await pool.query('UPDATE links SET clicks = clicks + 1 WHERE code = $1', [code]);
}

async function healthy() {
  await pool.query('SELECT 1');
  return true;
}

module.exports = { pool, migrate, connectWithRetry, insertLink, findByCode, incrementClicks, healthy };
