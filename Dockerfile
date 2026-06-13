# Multi-stage production Dockerfile

# Stage 1: Build source
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install package manager and lock dependencies
COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source and compile Next.js application
COPY . .
RUN pnpm build

# Stage 2: Production runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install pnpm and only production dependencies
COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install --prod --frozen-lockfile

# Copy compiled build assets from build stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

# Set container security user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["pnpm", "start"]
