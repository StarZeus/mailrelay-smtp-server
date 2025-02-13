# Use Node.js LTS (iron) as the base image
FROM node:20-slim AS base
WORKDIR /app

# Install dependencies only when needed
FROM base AS deps
RUN apt-get update && apt-get install -y libc6
COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js
RUN npm run build

# Production image, copy all the files and run both servers
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Install production dependencies only
RUN npm ci --only=production

# Initialize the database
RUN npx prisma generate
RUN npx prisma migrate deploy

USER nextjs

EXPOSE 3000
EXPOSE 2525

# Start both Next.js and SMTP server
CMD ["npm", "run", "start"] 