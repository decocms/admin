# syntax=docker/dockerfile:1.7-labs

# Use Bun official image (Alpine-based)
FROM oven/bun:1-alpine AS base
WORKDIR /app

# Create non-root user early and setup /app ownership
RUN addgroup -g 1001 -S bunapp && \
    adduser -u 1001 -S -G bunapp bunuser && \
    chown -R bunuser:bunapp /app

# Dependencies stage - install dependencies in separate layer for better caching
FROM base AS deps
WORKDIR /app
USER bunuser

# Copy package.json files recursively to preserve monorepo structure
COPY --chown=bunuser:bunapp package.json bun.lockb .npmrc ./
COPY --chown=bunuser:bunapp --parents packages/**/package.json ./
COPY --chown=bunuser:bunapp --parents apps/**/package.json ./

# Install all dependencies (including dev) with frozen lockfile
RUN bun install --frozen-lockfile

# Build stage - builds packages that will be used later in the build process
FROM deps AS builder
USER bunuser

WORKDIR /app

# Copy the rest of the files (.dockerignore excludes node_modules)
COPY --chown=bunuser:bunapp . .

# Build packages/bindings first (workspace dependency)
WORKDIR /app/packages/bindings
RUN bun run build

# Build mesh app (client and server - includes migrate)
WORKDIR /app/apps/mesh
RUN bun run build:client
RUN bun run build:server

# Production stage
FROM base AS runner
USER bunuser

WORKDIR /app
# Copy only what's needed for production

# Mesh app (runtime files + external dependencies)
# Copy SPA client assets
COPY --from=builder --chown=bunuser:bunapp /app/apps/mesh/dist ./apps/mesh/dist

# Copy server and migrate scripts with their shared dependencies
COPY --from=builder --chown=bunuser:bunapp /app/apps/mesh/dist-server ./apps/mesh/dist-server

# Copy start script
COPY --from=builder --chown=bunuser:bunapp /app/apps/mesh/package.json ./apps/mesh

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
# Both Kysely and Better Auth migrations are handled by migrate.js
CMD ["sh", "-c", "\
  echo '=== Starting migrations ===' && \
  bun run db:migrate && \
  echo '=== Starting application ===' && \
  bun run start"]