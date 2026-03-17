# ─── Stage 1: deps ────────────────────────────────────────────────────────────
# Install ALL workspace dependencies (including devDeps needed for the build).
FROM node:22-alpine AS deps

# Enable corepack to use pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace manifests and lockfile so pnpm can resolve workspace deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/backend/package.json ./packages/backend/package.json

# Install all deps (including devDeps — needed by nest build / swc)
RUN pnpm install --frozen-lockfile

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM deps AS build

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend

# Build the NestJS app (outputs to packages/backend/dist/)
RUN pnpm --filter backend build

# Use pnpm deploy to extract production-only deps into a clean directory.
# This prunes devDeps and hoists only what is needed at runtime.
RUN pnpm --filter backend deploy --prod --legacy /app/deploy

# Copy the compiled dist into the deploy directory
RUN cp -r packages/backend/dist /app/deploy/dist

# ─── Stage 3: production ──────────────────────────────────────────────────────
FROM node:22-alpine AS production

RUN corepack enable && corepack prepare pnpm@latest --activate

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

WORKDIR /app

# Copy the lean production package from the build stage
COPY --from=build --chown=nestjs:nodejs /app/deploy ./

# Runtime directories (uploads / exports are mounted as volumes in compose)
RUN mkdir -p uploads exports && chown nestjs:nodejs uploads exports

USER nestjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/health || exit 1

CMD ["node", "dist/main.js"]
