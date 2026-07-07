const { createClient } = require('redis');

const client = createClient({
  url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
});

client.on('error', (err) => console.warn(`[cache] ${err.message}`));

const TTL_SECONDS = 60 * 60 * 24; // cache resolved links for 24h

async function connect() {
  await client.connect();
  console.log('[cache] connected');
}

async function getUrl(code) {
  return client.get(`link:${code}`);
}

async function setUrl(code, url) {
  await client.set(`link:${code}`, url, { EX: TTL_SECONDS });
}

async function healthy() {
  const pong = await client.ping();
  return pong === 'PONG';
}

module.exports = { client, connect, getUrl, setUrl, healthy };
