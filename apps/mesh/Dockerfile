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

# Build the frontend static assets
WORKDIR /app/apps/mesh
RUN bun run build:client

# Production stage
FROM base AS runner
WORKDIR /app

# Copy only what's needed for production (minimal approach)
# Root workspace files
COPY --from=builder --chown=bunuser:bunapp /app/package.json ./
COPY --from=builder --chown=bunuser:bunapp /app/.npmrc ./
COPY --from=builder --chown=bunuser:bunapp /app/bun.lockb ./

# Copy ALL workspace package.json files for lockfile resolution
COPY --from=builder --chown=bunuser:bunapp /app/apps/api/package.json ./apps/api/
COPY --from=builder --chown=bunuser:bunapp /app/apps/outbound/package.json ./apps/outbound/
COPY --from=builder --chown=bunuser:bunapp /app/apps/web/package.json ./apps/web/
COPY --from=builder --chown=bunuser:bunapp /app/packages/ai/package.json ./packages/ai/
COPY --from=builder --chown=bunuser:bunapp /app/packages/cf-sandbox/package.json ./packages/cf-sandbox/
COPY --from=builder --chown=bunuser:bunapp /app/packages/cli/package.json ./packages/cli/
COPY --from=builder --chown=bunuser:bunapp /app/packages/create-deco/package.json ./packages/create-deco/
COPY --from=builder --chown=bunuser:bunapp /app/packages/runtime/package.json ./packages/runtime/
COPY --from=builder --chown=bunuser:bunapp /app/packages/sdk/package.json ./packages/sdk/

# Mesh app (runtime files only)
COPY --from=builder --chown=bunuser:bunapp /app/apps/mesh/dist ./apps/mesh/dist
COPY --from=builder --chown=bunuser:bunapp /app/apps/mesh/src ./apps/mesh/src
COPY --from=builder --chown=bunuser:bunapp /app/apps/mesh/package.json ./apps/mesh/
COPY --from=builder --chown=bunuser:bunapp /app/apps/mesh/migrations ./apps/mesh/migrations
COPY --from=builder --chown=bunuser:bunapp /app/apps/mesh/scripts ./apps/mesh/scripts
COPY --from=builder --chown=bunuser:bunapp /app/apps/mesh/vite.config.ts ./apps/mesh/
COPY --from=builder --chown=bunuser:bunapp /app/apps/mesh/tsconfig.json ./apps/mesh/

# UI package (workspace dependency)
COPY --from=builder --chown=bunuser:bunapp /app/packages/ui ./packages/ui

# Copy node_modules from builder first
COPY --from=builder --chown=bunuser:bunapp /app/node_modules ./node_modules

# Prune dev dependencies to reduce image size
USER bunuser
RUN bun install --frozen-lockfile --production

# Create data directory with correct ownership
USER root
RUN mkdir -p /app/data && \
    chown bunuser:bunapp /app/data

USER bunuser

# Expose the port (default Hono port is usually 3000 or 8000)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun run -e 'fetch("http://localhost:3000/health").then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))'

# Set environment to production
ENV NODE_ENV=production
ENV DATABASE_URL=file:/app/data/mesh.db

# Set working directory to mesh app
WORKDIR /app/apps/mesh

# Run database migrations on startup and start the application
CMD ["sh", "-c", "\
  echo '=== Debug Info ===' && \
  echo 'Current user:' && id && \
  echo 'Current directory:' && pwd && \
  echo 'DATABASE_URL:' $DATABASE_URL && \
  echo 'Checking /app directory:' && ls -la /app && \
  echo 'Checking /app/data directory:' && ls -la /app/data && \
  echo 'Testing write permissions:' && touch /app/data/test.txt && echo 'Write test successful' && rm /app/data/test.txt && \
  echo '=== Starting migrations ===' && \
  bun run src/database/migrate.ts && \
  bun run better-auth:migrate && \
  bun run start"]