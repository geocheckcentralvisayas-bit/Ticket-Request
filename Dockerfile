# syntax=docker/dockerfile:1

# ---- build ----
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Native build deps for better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

RUN npm ci

COPY shared shared
COPY backend backend
COPY frontend frontend

RUN npm run build --workspace=shared \
  && npm run build --workspace=backend \
  && npm run build --workspace=frontend

# ---- runtime ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

# Install production deps (includes better-sqlite3 native module)
RUN npm ci --omit=dev --ignore-scripts=false

# Built artifacts
COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/frontend/dist frontend/dist

# Data directory for SQLite (mount a persistent volume in production)
RUN mkdir -p /app/data

EXPOSE 3002

# Secrets (JWT_*, SMTP_*, NOTIFICATION_EMAILS) must be provided as environment variables.
# DB_PATH can be set to a path on a persistent volume, e.g. /app/data/envis.db
CMD ["node", "backend/dist/index.js"]
