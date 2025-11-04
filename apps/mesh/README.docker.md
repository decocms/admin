# Docker Deployment Guide for MCP Mesh

This guide explains how to build and deploy the MCP Mesh application using Docker.

## Prerequisites

- Docker (v20.10 or higher)
- Docker Compose (v2.0 or higher) - optional
- A GitHub account for pushing to GitHub Container Registry

## Quick Start with Docker Compose

1. **Create an environment file**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Build and run with Docker Compose**:
   ```bash
   docker-compose up -d
   ```

3. **View logs**:
   ```bash
   docker-compose logs -f mesh
   ```

4. **Stop the application**:
   ```bash
   docker-compose down
   ```

## Manual Docker Commands

### Building the Image

```bash
# Build the Docker image
docker build -t mesh:latest .

# Build with a specific tag
docker build -t mesh:v1.0.0 .
```

### Running the Container

```bash
# Run with environment variables
docker run -d \
  -p 3000:3000 \
  -v mesh-data:/app/data \
  --env-file .env \
  --name mesh \
  mesh:latest

# Run with inline environment variables
docker run -d \
  -p 3000:3000 \
  -v mesh-data:/app/data \
  -e NODE_ENV=production \
  -e DATABASE_URL=sqlite:/app/data/mesh.db \
  --name mesh \
  mesh:latest
```

### Container Management

```bash
# View logs
docker logs -f mesh

# Stop the container
docker stop mesh

# Start the container
docker start mesh

# Remove the container
docker rm mesh

# View container stats
docker stats mesh

# Execute commands inside the container
docker exec -it mesh bun run src/database/migrate.ts
```

## GitHub Container Registry

The GitHub Actions workflow automatically builds and pushes images to GitHub Container Registry (ghcr.io).

### Pulling from GitHub Container Registry

```bash
# Pull the latest image
docker pull ghcr.io/YOUR_GITHUB_USERNAME/cms/mesh:latest

# Pull a specific tag
docker pull ghcr.io/YOUR_GITHUB_USERNAME/cms/mesh:main-abc1234
```

### Running from GitHub Container Registry

```bash
docker run -d \
  -p 3000:3000 \
  -v mesh-data:/app/data \
  --env-file .env \
  --name mesh \
  ghcr.io/YOUR_GITHUB_USERNAME/cms/mesh:latest
```

## Environment Variables

The application requires various environment variables. Create a `.env` file with the following:

```env
# Application
NODE_ENV=production

# Database
DATABASE_URL=sqlite:/app/data/mesh.db

# Better Auth Configuration
BETTER_AUTH_SECRET=your-secret-key-here
BETTER_AUTH_URL=https://your-domain.com

# Add other required environment variables here
```

## Data Persistence

The Docker setup uses a named volume (`mesh-data`) to persist the SQLite database across container restarts.

```bash
# Backup the database
docker run --rm -v mesh-data:/data -v $(pwd):/backup alpine tar czf /backup/mesh-backup.tar.gz -C /data .

# Restore the database
docker run --rm -v mesh-data:/data -v $(pwd):/backup alpine tar xzf /backup/mesh-backup.tar.gz -C /data
```

## Health Checks

The container includes a health check that verifies the application is responding on port 3000:

```bash
# Check container health status
docker inspect --format='{{.State.Health.Status}}' mesh
```

## Troubleshooting

### Container won't start

1. Check logs:
   ```bash
   docker logs mesh
   ```

2. Verify environment variables are set correctly

3. Ensure port 3000 is not already in use:
   ```bash
   lsof -i :3000
   ```

### Database issues

1. Check database permissions:
   ```bash
   docker exec mesh ls -la /app/data
   ```

2. Manually run migrations:
   ```bash
   docker exec mesh bun run src/database/migrate.ts
   ```

### Performance issues

1. Check container resource usage:
   ```bash
   docker stats mesh
   ```

2. Allocate more resources to Docker if needed

## Production Deployment

For production deployments, consider:

1. **Use a reverse proxy** (nginx, Caddy, Traefik) for SSL/TLS termination
2. **Set up monitoring** (Prometheus, Grafana)
3. **Configure logging** aggregation (ELK stack, Loki)
4. **Use container orchestration** (Kubernetes, Docker Swarm) for scaling
5. **Set up automated backups** for the database
6. **Configure secrets management** (Vault, Docker secrets)

### Example with Traefik

```yaml
version: '3.8'

services:
  mesh:
    image: ghcr.io/YOUR_GITHUB_USERNAME/cms/mesh:latest
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    volumes:
      - mesh-data:/app/data
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.mesh.rule=Host(`mesh.yourdomain.com`)"
      - "traefik.http.routers.mesh.entrypoints=websecure"
      - "traefik.http.routers.mesh.tls.certresolver=letsencrypt"
      - "traefik.http.services.mesh.loadbalancer.server.port=3000"
    restart: unless-stopped

volumes:
  mesh-data:
    driver: local
```

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/release-mesh.yaml`) automatically:

1. Builds the Docker image when you push a version tag
2. Pushes to GitHub Container Registry
3. Tags images with semantic versions and `latest`
4. Supports multi-platform builds (amd64, arm64)

### Triggering Releases

```bash
# Create and push a tag to trigger a release
git tag mesh-v1.0.0
git push origin mesh-v1.0.0

# Or use standard semver tags
git tag v1.0.0
git push origin v1.0.0

# Or manually trigger the workflow
gh workflow run release-mesh.yaml
```

## Local Development with Docker

For local development, you can override the command to use hot-reload:

```bash
docker run -it \
  -p 3000:3000 \
  -v $(pwd):/app \
  -v /app/node_modules \
  --env-file .env \
  mesh:latest \
  bun --hot run src/index.ts
```

Or add a development service to `docker-compose.yml`:

```yaml
services:
  mesh-dev:
    build:
      context: .
      dockerfile: Dockerfile
      target: builder
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
    env_file:
      - .env
    volumes:
      - .:/app
      - /app/node_modules
    command: bun --hot run src/index.ts
```

## Support

For issues and questions, please refer to the main [README.md](./README.md) or open an issue on GitHub.

