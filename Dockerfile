# Use Node.js LTS with Debian bullseye for OpenSSL 1.1 support
FROM node:20-bullseye-slim AS base
WORKDIR /app

# Install dependencies only when needed
FROM base AS deps
# Install OpenSSL 1.1 for Prisma
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    openssl \
    libssl1.1 \
    ca-certificates \
    libc6 \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set build-time environment variables
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma Client and build Next.js
RUN npx prisma generate
RUN npm run build

# Production image, copy all the files and run both servers
FROM base AS runner
WORKDIR /app

# Set default environment variables
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL=file:/app/data/mailrelay.db \
    SMTP_HOST=0.0.0.0 \
    SMTP_PORT=2525 \
    SMTP_MAX_SIZE=31457280 \
    NEXT_PUBLIC_HOST=0.0.0.0 \
    PORT=3000 \
    FORWARD_SMTP_HOST="" \
    FORWARD_SMTP_PORT="" \
    FORWARD_SMTP_USER="" \
    FORWARD_SMTP_PASS="" \
    FORWARD_SMTP_SECURE="false"

# Install system dependencies including OpenSSL 1.1
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    openssl \
    libssl1.1 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create user and group first
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    # Create data directory and set permissions
    mkdir -p /app/data && \
    chown -R nextjs:nodejs /app

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/tsconfig.server.json ./tsconfig.server.json
COPY --from=builder /app/server ./server
COPY --from=builder /app/src/lib ./src/lib

# Copy next build output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Install production dependencies only
RUN npm ci --only=production

# Initialize the database
RUN npx prisma generate

# Copy and set up entrypoint script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh && \
    chown nextjs:nodejs /app/docker-entrypoint.sh

# Switch to non-root user
USER nextjs

# Initialize database after switching to nextjs user
RUN npx prisma migrate deploy

# Use ARG for build-time port configuration
ARG PORT=3000
ARG SMTP_PORT=2525

# Expose ports using ARG values
EXPOSE ${PORT}
EXPOSE ${SMTP_PORT}

# Use the entrypoint script
ENTRYPOINT ["/app/docker-entrypoint.sh"] 