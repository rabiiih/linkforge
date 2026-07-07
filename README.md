# LinkForge 🔗

A production-style **URL shortener microservice** built to demonstrate real-world Docker, Docker Compose, and CI/CD practices.

![CI](https://github.com/YOUR_USERNAME/linkforge/actions/workflows/ci.yml/badge.svg)

**Stack:** Node.js (Express) · PostgreSQL 16 · Redis 7 · Nginx · Docker Compose · GitHub Actions

---

## Architecture

```
                        ┌────────────────────────────────────┐
                        │            Docker network           │
                        │                                     │
 client ──:8080──▶ ┌───────┐  frontend  ┌───────┐  backend  ┌──────────┐
                   │ nginx │───────────▶│  api  │──────────▶│ postgres │
                   │ proxy │ rate-limit │ node  │           │ (volume) │
                   └───────┘            └───┬───┘           └──────────┘
                                            │      backend  ┌──────────┐
                                            └──────────────▶│  redis   │
                                                cache-first │  cache   │
                                                            └──────────┘
```

- **nginx** — reverse proxy, rate limiting (10 req/s), only container with a published port
- **api** — Express service; validates URLs, generates collision-safe short codes
- **postgres** — source of truth, persisted in a named volume
- **redis** — 24h read-through cache with LRU eviction (`GET /:code` rarely touches the DB)
- **Two networks** — nginx cannot reach the database; only the API bridges `frontend` ↔ `backend`

## Quick start

```bash
git clone https://github.com/YOUR_USERNAME/linkforge.git
cd linkforge
cp .env.example .env         # then edit the password
docker compose -f compose.yaml up -d --build
```

```bash
# Shorten a URL
curl -X POST http://localhost:8080/api/shorten \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://en.wikipedia.org/wiki/URL_shortening"}'
# → {"code":"x7Kp2mQ","shortUrl":"http://localhost:8080/x7Kp2mQ",...}

# Use it
curl -iL http://localhost:8080/x7Kp2mQ        # 302 → the long URL

# Click stats
curl http://localhost:8080/api/stats/x7Kp2mQ  # {"clicks":1,...}
```

## Development mode (hot reload)

```bash
docker compose up --build
```
The dev override (`compose.override.yaml`) is applied automatically: your source is bind-mounted, `nodemon` restarts on save, and Postgres is exposed on `localhost:5432` for GUI tools.

Or use the Makefile: `make dev`, `make up`, `make logs`, `make test`, `make sh`, `make psql`, `make clean`.

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/shorten` | Body `{"url": "https://..."}` → creates a short link |
| `GET`  | `/:code` | 302 redirect to the original URL, increments clicks |
| `GET`  | `/api/stats/:code` | Click count + metadata |
| `GET`  | `/health` | Liveness/readiness — checks DB and Redis |

## Testing & CI

- **Unit tests** (`npm test`) — pure business logic (code generation, URL validation, protocol whitelist against `javascript:` redirects) with Node's built-in test runner; zero external dependencies.
- **GitHub Actions pipeline** (3 gated stages):
  1. `unit-tests` — fast feedback
  2. `docker-build` — production image must build
  3. `integration` — boots the **entire Compose stack** in CI, waits on `/health`, then shortens a URL, follows the redirect, and verifies the click counter. Logs are dumped automatically on failure.

## Engineering decisions worth noting

- **Multi-stage Dockerfile** → final image contains only prod dependencies and source; runs as the unprivileged `node` user; has a container-level `HEALTHCHECK`.
- **Healthchecked startup ordering** → `depends_on: condition: service_healthy` plus in-app connection retry; no "connection refused" races.
- **Cache-first reads** → redirects hit Redis; Postgres only on cache miss, with read-through repopulation. Click increments are fire-and-forget so they never slow the redirect.
- **Collision handling** → short codes come from `crypto.randomBytes` (not guessable, not enumerable); a `UNIQUE` constraint plus insert-retry handles the ~1-in-2.5-trillion collision.
- **Security** → URL protocol whitelist (blocks `javascript:`/`file:` open-redirect abuse), strict code-format validation, DB/cache unreachable from outside, secrets in `.env` (gitignored), nginx rate limiting.
- **Config layering** → `compose.yaml` is production-shaped; `compose.override.yaml` adds dev conveniences automatically and is skipped in CI/prod with `-f compose.yaml`.

## Project layout

```
├── src/
│   ├── server.js        # Express app + graceful shutdown
│   ├── shortener.js     # pure logic (unit tested)
│   ├── db.js            # pg pool, migration, retry
│   └── cache.js         # redis client
├── tests/               # node:test unit tests
├── nginx/default.conf   # reverse proxy + rate limit
├── Dockerfile           # multi-stage, non-root
├── compose.yaml         # prod-shaped stack
├── compose.override.yaml# dev: hot reload, exposed ports
├── .github/workflows/ci.yml
├── Makefile
└── .env.example
```

## License

MIT
