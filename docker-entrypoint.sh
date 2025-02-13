#!/bin/bash
set -e

# Print server configuration
echo "Starting servers with configuration:"
echo "Web UI: ${NEXT_PUBLIC_HOST:-0.0.0.0}:${PORT:-3000}"
echo "SMTP: ${SMTP_HOST:-0.0.0.0}:${SMTP_PORT:-2525}"

# Ensure data directory exists and has correct permissions
mkdir -p /app/data
chown -R nextjs:nodejs /app/data

# Run database migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Start the application
echo "Starting application..."
exec npm run start 