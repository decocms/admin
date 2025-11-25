# Use Bun official image
FROM oven/bun:1 AS base
WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user early and setup /app ownership
RUN addgroup --system --gid 1001 bunapp && \
    adduser --system --uid 1001 bunuser && \
    chown -R bunuser:bunapp /app

# Build stage
FROM base AS builder
WORKDIR /app
USER bunuser

# Copy everything
COPY --chown=bunuser:bunapp . .

# Install all dependencies (including dev) with frozen lockfile
RUN bun install --frozen-lockfile

# Build packages/bindings first (workspace dependency)
WORKDIR /app/packages/bindings
RUN bun run build

# Build the frontend static assets
WORKDIR /app/apps/mesh
RUN bun run build:client

# Production stage
FROM base AS runner
WORKDIR /app

# Copy only what's needed for production (minimal approach)
# Root workspace files
COPY --from=builder --chown=bunuser:bunapp /app/package.json ./

# Mesh app (runtime files only)
COPY --from=builder --chown=bunuser:bunapp /app/apps/mesh/dist ./apps/mesh/dist
COPY --from=builder --chown=bunuser:bunapp /app/apps/mesh/src ./apps/mesh/src
COPY --from=builder --chown=bunuser:bunapp /app/apps/mesh/package.json ./apps/mesh/
COPY --from=builder --chown=bunuser:bunapp /app/apps/mesh/migrations ./apps/mesh/migrations
COPY --from=builder --chown=bunuser:bunapp /app/apps/mesh/scripts ./apps/mesh/scripts
COPY --from=builder --chown=bunuser:bunapp /app/apps/mesh/tsconfig.json ./apps/mesh/
COPY --from=builder --chown=bunuser:bunapp /app/apps/mesh/vite.config.ts ./apps/mesh/

# UI package (workspace dependency)
COPY --from=builder --chown=bunuser:bunapp /app/packages/ui ./packages/ui

# Bindings package (workspace dependency)
COPY --from=builder --chown=bunuser:bunapp /app/packages/bindings ./packages/bindings

# Copy working node_modules from builder (includes dev deps, but avoids OOM)
COPY --from=builder --chown=bunuser:bunapp /app/node_modules ./node_modules

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
CMD ["sh", "-c", "\
  echo '=== Starting migrations ===' && \
  bun run src/database/migrate.ts && \
  (bun run better-auth:migrate || echo 'Better-auth migration failed, skipping...') && \
  bun run start"]