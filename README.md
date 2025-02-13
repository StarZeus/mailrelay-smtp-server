# MailRelay SMTP Server

[![Docker Build](https://github.com/starzeus/mailrelay-smtp-server/actions/workflows/docker-image.yml/badge.svg)](https://github.com/starzeus/mailrelay-smtp-server/actions/workflows/docker-image.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-20.x-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.x-black.svg)](https://nextjs.org/)
[![Docker Pulls](https://img.shields.io/docker/pulls/starzeus/mailrelay-smtp-server.svg)](https://hub.docker.com/r/starzeus/mailrelay-smtp-server)
[![Docker Image Size](https://img.shields.io/docker/image-size/starzeus/mailrelay-smtp-server/latest)](https://hub.docker.com/r/starzeus/mailrelay-smtp-server)

A modern, feature-rich SMTP server with a beautiful web UI for managing and processing emails based on customizable rules.

## Features

### 1. SMTP Server
- Lightweight SMTP server listening on port 2525
- Accepts and processes incoming emails
- No authentication required (perfect for development/testing)
- Support for attachments and HTML content
- Maximum message size: 30MB

### 2. Mail UI Features
- **Modern Web Interface**: Clean, responsive design built with Next.js and Tailwind CSS
- **Real-time Email Viewing**: See incoming emails instantly
- **Email Organization**:
  - List view with search functionality
  - Detailed email viewer with HTML support
  - Attachment handling
  - Mark as read/unread
  
### 3. Rule Engine
- **Flexible Rule Creation**:
  - Match by sender, recipient, subject, content
  - Support for regex patterns
  - Multiple conditions with AND/OR operators
  
- **Actions**:
  - Forward emails to other addresses
  - Send to webhook endpoints
  - Push to Kafka topics
  - Execute custom JavaScript code
  
- **Rule Management**:
  - Enable/disable rules
  - Test rules against sample emails
  - View processed emails by rule

## Environment Variables

### Required Environment Variables
```env
# Database Configuration
DATABASE_URL="file:/path/to/your/database.db"  # SQLite database path

# SMTP Server Configuration
SMTP_HOST="0.0.0.0"        # SMTP server host, use 0.0.0.0 to accept all connections
SMTP_PORT="2525"           # SMTP server port
SMTP_MAX_SIZE="31457280"   # Maximum email size in bytes (default: 30MB)

# Web UI Configuration
NEXT_PUBLIC_HOST="0.0.0.0" # Web UI host
PORT="3000"                # Web UI port
```

### Optional Environment Variables
```env
# Kafka Integration (Optional)
KAFKA_BROKERS="localhost:9092"     # Comma-separated list of Kafka brokers
KAFKA_CLIENT_ID="email-rules"      # Kafka client ID

# Email Forwarding Configuration (Optional)
FORWARD_SMTP_HOST="smtp.gmail.com" # SMTP server for forwarding emails
FORWARD_SMTP_PORT="587"           # SMTP port for forwarding
FORWARD_SMTP_USER="your@email.com" # SMTP username
FORWARD_SMTP_PASS="your-password"  # SMTP password
FORWARD_SMTP_SECURE="true"        # Use TLS

# Development Options
NODE_ENV="production"              # Set to 'development' for development mode
DEBUG="smtp*"                      # Enable SMTP server debugging
```

## Quick Start

### Using Docker

```bash
# Pull the image
docker pull starzeus/mailrelay-smtp-server:latest

# Run with environment variables
docker run -d \
  -p ${PORT:-3000}:3000 \
  -p ${SMTP_PORT:-2525}:2525 \
  -e DATABASE_URL=file:/app/data/mailrelay.db \
  -e SMTP_HOST=0.0.0.0 \
  -e SMTP_PORT=2525 \
  -e NEXT_PUBLIC_HOST=0.0.0.0 \
  -e PORT=3000 \
  -v $(pwd)/data:/app/data \
  --name mailrelay \
  ${{ secrets.DOCKER_USERNAME }}/mailrelay-smtp-server:latest
```

### Using Docker Compose

```yaml
version: '3.8'
services:
  mailrelay:
    image: ${{ secrets.DOCKER_USERNAME }}/mailrelay-smtp-server:latest
    ports:
      - "${PORT:-3000}:3000"        # Web UI
      - "${SMTP_PORT:-2525}:2525"   # SMTP Server
    environment:
      - DATABASE_URL=file:/app/data/mailrelay.db
      - SMTP_HOST=0.0.0.0
      - SMTP_PORT=2525
      - SMTP_MAX_SIZE=31457280
      - NEXT_PUBLIC_HOST=0.0.0.0
      - PORT=3000
      - NODE_ENV=production
      # Add optional variables as needed
      - KAFKA_BROKERS=${KAFKA_BROKERS}
      - FORWARD_SMTP_HOST=${FORWARD_SMTP_HOST}
      - FORWARD_SMTP_PORT=${FORWARD_SMTP_PORT}
      - FORWARD_SMTP_USER=${FORWARD_SMTP_USER}
      - FORWARD_SMTP_PASS=${FORWARD_SMTP_PASS}
    volumes:
      - ./data:/app/data  # Persist database
```

### Example .env File
Create a `.env` file in the root directory:

```env
# Required Configuration
DATABASE_URL=file:/app/data/mailrelay.db
SMTP_HOST=0.0.0.0
SMTP_PORT=2525
NEXT_PUBLIC_HOST=0.0.0.0
PORT=3000

# Optional Configuration
KAFKA_BROKERS=localhost:9092
FORWARD_SMTP_HOST=smtp.gmail.com
FORWARD_SMTP_PORT=587
FORWARD_SMTP_USER=your@email.com
FORWARD_SMTP_PASS=your-app-specific-password
FORWARD_SMTP_SECURE=true
```

## Usage

1. **Access the Web UI**:
   - Open `http://localhost:3000` in your browser
   - You'll see the main dashboard with email list and viewer

2. **Send Test Emails**:
   ```bash
   # Using telnet
   telnet localhost 2525
   
   # Using swaks
   swaks --to user@example.com --from sender@example.com --server localhost --port 2525
   
   # Using curl
   curl smtp://localhost:2525 --mail-from sender@example.com --mail-rcpt receiver@example.com --upload-file email.txt
   ```

3. **Create Rules**:
   - Click "Rules" in the navigation
   - Click "New Rule"
   - Configure conditions and actions
   - Enable the rule
   - Test with sample emails

## Development

```bash
# Clone the repository
git clone https://github.com/starzeus/mailrelay-smtp-server.git

# Install dependencies
npm install

# Initialize database
npx prisma generate
npx prisma migrate dev

# Start development servers
npm run dev
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.