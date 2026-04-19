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