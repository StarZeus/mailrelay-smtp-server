#!/bin/bash
set -e

# Print server configuration
echo "Starting MailRelay SMTP Server v$(node -p "require('./package.json').version")"
echo "----------------------------------------"
echo "Configuration:"
echo "Web UI: ${NEXT_PUBLIC_HOST:-0.0.0.0}:${PORT:-3000}"
echo "SMTP: ${SMTP_HOST:-0.0.0.0}:${SMTP_PORT:-2525}"
echo "Database: ${DATABASE_URL}"
echo "----------------------------------------"

# Run database migrations if needed
echo "Running database migrations..."
npx prisma migrate deploy

# Start the application
echo "Starting application..."
exec npm run start 