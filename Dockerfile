# ============================================================
# Stage 1: deps — Install ALL dependencies (including devDeps)
# ============================================================
# Why a separate deps stage?
# We want to cache this expensive layer. If package.json/lockfile
# don't change, Docker reuses this cached layer on every rebuild.
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy ONLY the manifest files first.
# Docker caches this layer — node_modules are NOT re-installed
# unless package.json or pnpm-lock.yaml actually change.
COPY package.json pnpm-lock.yaml ./

# --frozen-lockfile ensures CI-safe, reproducible installs.
# devDependencies are needed at build time (TypeScript, PostCSS, etc.)
# HUSKY=0 skips git-hook installation — there is no .git inside the image.
ENV HUSKY=0
RUN pnpm install --frozen-lockfile


# ============================================================
# Stage 2: builder — Compile the Next.js application
# ============================================================
# Why standalone mode?
# next.config.ts has output: 'standalone' which tells Next.js to:
#   1. Produce a self-contained server at .next/standalone/server.js
#   2. Include only the node_modules actually used at runtime
# This means the final runner image does NOT need node_modules at all.
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

RUN npm install -g pnpm

# Reuse node_modules from the deps stage (cache hit on rebuilds)
COPY --from=deps /app/node_modules ./node_modules

# Copy the full source code
COPY . .

# NEXT_TELEMETRY_DISABLED=1 disables Next.js anonymous usage analytics
# during the build — not needed in CI/Docker.
ENV NEXT_TELEMETRY_DISABLED=1

# ── NEXT_PUBLIC_ vars must be declared as ARG here ────────────────────────────
# Next.js bakes NEXT_PUBLIC_* variables into the client-side JS bundle at
# BUILD TIME. They cannot be injected at container start like server vars.
# Values are passed in from docker-compose `build.args`.
ARG NEXT_PUBLIC_LIVEKIT_URL
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_LIVEKIT_URL=$NEXT_PUBLIC_LIVEKIT_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build the production app.
# next build reads next.config.ts and produces:
#   .next/standalone/  ← self-contained server
#   .next/static/      ← hashed static CSS/JS chunks
#   public/            ← raw static files (images, fonts etc.)
RUN pnpm build


# ============================================================
# Stage 3: runner — Minimal production image
# ============================================================
# This stage is what gets deployed. It intentionally contains
# NO build tools, NO devDependencies, NO source code.
# Only the compiled output is copied from the builder stage.
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root system user for security.
# Running as root in a container is a security risk — if the app is
# compromised, the attacker would have root access to the container.
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy only what's needed to run the app:
#
# 1. public/ — static assets (images, icons) served directly
COPY --from=builder /app/public ./public

# 2. .next/standalone/ — the self-contained Next.js server produced
#    by output: 'standalone'. This includes a minimal node_modules
#    with only runtime deps — no devDeps, no source files.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# 3. .next/static/ — hashed CSS/JS chunks. These must be placed at
#    .next/static relative to the server, because Next.js references
#    them via /_next/static/... URLs.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Drop to non-root user
USER nextjs

# Expose port and set hostname
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Container-level readiness probe hitting the app's health endpoint.
# busybox wget ships with alpine, so no extra packages are needed.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

# standalone mode produces a server.js at the root of the standalone dir.
# We run it directly with node — no pnpm/npm needed at all in this image.
CMD ["node", "server.js"]
