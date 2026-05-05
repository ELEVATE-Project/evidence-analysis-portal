# Evidence Analysis Portal - Phase 1

React frontend SPA for the Evidence Analysis System.

## Setup

### Prerequisites
- Node.js 16+ and npm 8+
- Backend API running on `http://localhost:8000` (for development)

### Installation

1. **Navigate to frontend directory**:
   ```bash
   cd evidence-analysis-portal-p1
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```

   All portal configuration is env-driven. Update `.env` values as needed.

4. **Run development server**:
   ```bash
   npm run dev
   ```
   
   The frontend will be available at `http://localhost:5173`
   
   API requests are proxied based on `APPLICATION_BASE_URL` and `API_ENDPOINT`.

5. **Build for production**:
   ```bash
   npm run build
   ```
   
   Production bundle is generated in the `dist/` directory.

6. **Run linter**:
   ```bash
   npm run lint
   ```
   
   Checks code quality with ESLint.

## Docker Setup (No Nginx)

The frontend is built with Vite and served as static files using a Node-based server inside Docker Compose.

### Configure local `.env` (required)

Set backend URL in your local `.env` before build:

```env
APPLICATION_BASE_URL=/api/v1
API_ENDPOINT=http://localhost:8000
```

If running backend in Docker on the same compose network, use:

```env
API_ENDPOINT=http://backend:8000
```

### Build

```bash
docker compose build --no-cache
```

### Run

```bash
docker compose up -d
```

### Verify Production Build Is Served

```bash
# Main app
curl -I http://localhost:4173/

# SPA fallback route (should return index.html)
curl -I http://localhost:4173/reports

# Health check (container-level)
docker compose ps
```

### Debug Logs

```bash
docker compose logs -f portal
```

Additional troubleshooting:

```bash
# Container status
docker compose ps -a

# Resource usage
docker stats evidence-analysis-portal

# Inspect image layers
docker image history evidence-analysis-portal:latest

# Open shell for debugging
docker compose exec portal sh
```

### Stop and Remove

```bash
docker compose down
```

## Report Map Assets

District map files live in `public/maps/states`. To regenerate them from the DataMeet district shapefile:

```bash
mkdir -p /tmp/datameet-districts
curl -L https://raw.githubusercontent.com/datameet/maps/master/Districts/Census_2011/2011_Dist.shp -o /tmp/datameet-districts/2011_Dist.shp
curl -L https://raw.githubusercontent.com/datameet/maps/master/Districts/Census_2011/2011_Dist.dbf -o /tmp/datameet-districts/2011_Dist.dbf
npm run prepare:maps -- --shp /tmp/datameet-districts/2011_Dist.shp --dbf /tmp/datameet-districts/2011_Dist.dbf
```
