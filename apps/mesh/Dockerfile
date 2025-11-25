# syntax=docker/dockerfile:1.7-labs

# Use Bun official image (Alpine-based)
FROM oven/bun:1-alpine AS base
WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++

# Create non-root user early and setup /app ownership
RUN addgroup -g 1001 -S bunapp && \
    adduser -u 1001 -S -G bunapp bunuser && \
    chown -R bunuser:bunapp /app

# Dependencies stage - install dependencies in separate layer for better caching
FROM base AS deps
WORKDIR /app
USER bunuser

# Copy all package.json files preserving monorepo structure
COPY --chown=bunuser:bunapp --parents **/package.json ./

# Copy lockfile and npmrc
COPY --chown=bunuser:bunapp bun.lockb .npmrc ./

# Install all dependencies (including dev) with frozen lockfile
RUN bun install --frozen-lockfile

# Build stage
FROM base AS builder
WORKDIR /app
USER bunuser

# Copy package.json files first (needed for build scripts)
COPY --chown=bunuser:bunapp package.json bun.lockb ./

# Copy node_modules from deps stage (this layer will be cached when dependencies don't change)
COPY --from=deps --chown=bunuser:bunapp /app/node_modules ./node_modules

# Copy source code (this will invalidate cache when source changes, but deps layer stays cached)
COPY --chown=bunuser:bunapp . .

# Build packages/bindings first (workspace dependency)
WORKDIR /app/packages/bindings
RUN bun run build

# Build the frontend static assets
WORKDIR /app/apps/mesh
RUN bun run build:client

# Build the server and migration script
WORKDIR /app/apps/mesh
RUN bun run build:server && bun run build:migrate

# Production stage
FROM base AS runner
WORKDIR /app

# Copy only what's needed for production (minimal approach)

# Mesh app (runtime files only - no node_modules needed!)
COPY --from=builder --chown=bunuser:bunapp /app/apps/mesh/server.js ./apps/mesh/server.js
COPY --from=builder --chown=bunuser:bunapp /app/apps/mesh/migrate.js ./apps/mesh/migrate.js
COPY --from=builder --chown=bunuser:bunapp /app/apps/mesh/dist ./apps/mesh/dist
COPY --from=builder --chown=bunuser:bunapp /app/apps/mesh/package.json ./apps/mesh/
COPY --from=builder --chown=bunuser:bunapp /app/apps/mesh/migrations ./apps/mesh/migrations
# Bindings package (workspace dependency)
COPY --from=builder --chown=bunuser:bunapp /app/packages/bindings ./packages/bindings


# Create data directory with correct ownership
USER root
RUN mkdir -p /app/data && \
    chown bunuser:bunapp /app/data

USER bunuser

# Expose the port (default Hono port is usually 3000 or 8000)
EXPOSE 3000


# Set environment to production
ENV NODE_ENV=production
ENV DATABASE_URL=file:/app/data/mesh.db

# Set working directory to mesh app
WORKDIR /app/apps/mesh

# Run database migrations on startup and start the application
# Both Kysely and Better Auth migrations are bundled in migrate.js
CMD ["sh", "-c", "\
  echo '=== Starting migrations ===' && \
  bun run migrate.js && \
  echo '=== Starting application ===' && \
  bun run start"]