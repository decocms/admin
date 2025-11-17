# Use Bun official image
FROM oven/bun:1 AS base
WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies (production only)
FROM base AS deps
# Copy root workspace files
COPY package.json bun.lockb* ./
COPY apps/mesh/package.json ./apps/mesh/
COPY packages/ui/package.json ./packages/ui/

# Install all dependencies (workspace aware)
RUN bun install --frozen-lockfile --production

# Build stage
FROM base AS builder
# Copy root workspace files
COPY package.json bun.lockb* ./
COPY apps/mesh/package.json ./apps/mesh/
COPY packages/ui/package.json ./packages/ui/

# Install all dependencies including dev dependencies
RUN bun install --frozen-lockfile

# Copy source code for both workspaces
COPY packages/ui ./packages/ui
COPY apps/mesh ./apps/mesh

# Build the frontend static assets
WORKDIR /app/apps/mesh
RUN bun run build:client

# Production stage
FROM base AS runner
WORKDIR /app

# Copy root workspace configuration
COPY --from=builder /app/package.json ./
COPY --from=builder /app/bun.lockb* ./

# Copy the packages/ui workspace (needed at runtime for imports)
COPY --from=builder /app/packages/ui ./packages/ui

# Copy the built mesh application
COPY --from=builder /app/apps/mesh ./apps/mesh

# Overwrite with production-only node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Create a non-root user
RUN addgroup --system --gid 1001 bunapp && \
    adduser --system --uid 1001 bunuser && \
    chown -R bunuser:bunapp /app

# Create data directory for SQLite database
RUN mkdir -p /app/data && \
    chown -R bunuser:bunapp /app/data

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
