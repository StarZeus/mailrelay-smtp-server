require('@babel/register')({
  presets: [
    ['@babel/preset-typescript', { allowNamespaces: true }]
  ],
  extensions: ['.ts', '.tsx'],
});

const { createSMTPServer } = require('./src/lib/smtp-server');

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

// Handle process signals
process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal. Shutting down SMTP server...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT signal. Shutting down SMTP server...');
  process.exit(0);
});

// Start the SMTP server
createSMTPServer(2525); 