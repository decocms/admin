# Use Bun official image
FROM oven/bun:1 AS base
WORKDIR /app

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

# Set environment to production
ENV NODE_ENV=production

# Run database migrations on startup and start the application
CMD ["sh", "-c", "bun run src/database/migrate.ts && bun run start"]

