# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1: dependencies — installs ONLY production deps, cached separately
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ---------------------------------------------------------------------------
# Stage 2: runtime — minimal final image, no npm cache, no dev deps
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Run as the built-in unprivileged user, never as root
USER node

COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node src ./src

EXPOSE 3000

# Container-level healthcheck (compose also uses service healthchecks)
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "src/server.js"]
