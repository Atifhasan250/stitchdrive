# ── Stage 1: Build — install production dependencies ─────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ── Stage 2: Runtime — lean image with only what's needed ────────────────────
FROM node:20-slim

WORKDIR /app

# Copy installed node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy source
COPY . .

EXPOSE 8000

CMD ["node", "src/index.js"]
