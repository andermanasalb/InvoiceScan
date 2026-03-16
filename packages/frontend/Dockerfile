# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/frontend/package.json ./packages/frontend/package.json

RUN pnpm install --frozen-lockfile

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM deps AS build

COPY packages/shared ./packages/shared
COPY packages/frontend ./packages/frontend

# Build args that Next.js bakes into the client bundle at build time.
# Override with --build-arg in CI or docker compose.
ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm --filter @invoice-flow/frontend build

# ─── Stage 3: production ──────────────────────────────────────────────────────
FROM node:22-alpine AS production

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

WORKDIR /app

# Next.js standalone output bundles the server + required node_modules.
COPY --from=build --chown=nextjs:nodejs /app/packages/frontend/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/packages/frontend/.next/static ./packages/frontend/.next/static
COPY --from=build --chown=nextjs:nodejs /app/packages/frontend/public ./packages/frontend/public

USER nextjs

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/ || exit 1

# next.js standalone produces packages/frontend/server.js relative to the WORKDIR
CMD ["node", "packages/frontend/server.js"]
