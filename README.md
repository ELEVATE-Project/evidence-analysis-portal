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

3. **Configure environment variables** (optional):
   ```bash
   cp .env.example .env  # If you have a template
   ```
   
   Default configuration proxies API requests to `http://localhost:8000`. Customize as needed.

4. **Run development server**:
   ```bash
   npm run dev
   ```
   
   The frontend will be available at `http://localhost:5173`
   
   API requests to `/api/*` are automatically proxied to the backend.

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