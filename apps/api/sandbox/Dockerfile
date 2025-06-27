# syntax=docker/dockerfile:1

FROM oven/bun:alpine
# Set destination for COPY
WORKDIR /app

# Install git
RUN apk add --no-cache nodejs npm
RUN bun add wrangler @cloudflare/sandbox

EXPOSE 3000
# Run
CMD ["bun", "node_modules/@cloudflare/sandbox/container_src/index.ts"]
