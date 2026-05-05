# ==========================================
# Stage 1: Build Stage (Node.js)
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --no-audit --no-fund

# Copy source code
COPY . .

# Build the application
RUN npm run build

# ==========================================
# Stage 2: Runtime Stage (Node.js, no Nginx)
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

# Install lightweight static file server
RUN npm install -g serve@14.2.4 --no-audit --no-fund && npm cache clean --force

# Create non-root user
RUN addgroup -S app && adduser -S app -G app

# Copy built application from builder stage
COPY --from=builder --chown=app:app /app/dist ./dist

# Switch to non-root user
USER app

# Expose serving port
EXPOSE 4173

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -qO- http://127.0.0.1:4173/ > /dev/null || exit 1

# Serve SPA production build
CMD ["serve", "-s", "dist", "-l", "4173"]
