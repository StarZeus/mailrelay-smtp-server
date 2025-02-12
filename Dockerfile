# Use Node.js LTS (iron) as the base image
FROM node:20-slim AS base

# Install dependencies needed for Prisma and other native modules
RUN apt-get update && apt-get install -y \
    openssl \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/server.js ./server.js

# Copy env file and set environment variables
COPY .env.production .env
ENV DATABASE_URL="file:/app/prisma/dev.db"
ENV SMTP_HOST="0.0.0.0"
ENV SMTP_PORT="2525"

USER nextjs

EXPOSE 3000
EXPOSE 2525

# Start both Next.js and SMTP server
CMD ["npm", "run", "dev"] 