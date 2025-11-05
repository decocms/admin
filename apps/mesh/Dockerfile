# Use Bun official image
FROM oven/bun:1 AS base
WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
FROM base AS deps
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile --production

# Build stage (if needed)
FROM base AS builder
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile
COPY . .

# Production stage
FROM base AS runner
WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
# Copy application code
COPY --from=builder /app .

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

# Set environment to development for debugging
ENV NODE_ENV=development
ENV DATABASE_URL=file:/app/data/mesh.db

# Run database migrations on startup and start the application
# Added debug logging to check directory structure and permissions
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
