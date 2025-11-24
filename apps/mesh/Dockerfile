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

# Install dependencies (production only)
FROM base AS deps
WORKDIR /app
USER bunuser

# Copy everything needed for workspace resolution
COPY --chown=bunuser:bunapp . .

# Remove unnecessary workspaces (like your original approach)
USER root
RUN rm -rf bun.lockb \
    /app/apps/api \
    /app/apps/web \
    /app/apps/outbound \
    /app/packages/ai \
    /app/packages/runtime \
    /app/packages/sdk \
    /app/packages/bindings \
    /app/packages/cf-sandbox \
    /app/packages/cli \
    /app/packages/create-deco

# Install production dependencies (no frozen lockfile since we modified workspace)
USER bunuser
RUN bun install --production

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

# Copy the entire built workspace from builder
COPY --from=builder --chown=bunuser:bunapp /app ./

# Overwrite with production-only node_modules from deps stage
COPY --from=deps --chown=bunuser:bunapp /app/node_modules ./node_modules

# Create data directory with correct ownership
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