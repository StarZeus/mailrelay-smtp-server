'use server';

import { SMTPServer } from 'smtp-server';
import { simpleParser, ParsedMail, AddressObject, HeaderValue, Attachment } from 'mailparser';
import prisma from '@/lib/prisma';
import nodemailer from 'nodemailer';
import type { Attachment as NodemailerAttachment } from 'nodemailer/lib/mailer';
import { Kafka } from 'kafkajs';
import axios from 'axios';
import { Isolate, Reference } from 'isolated-vm';
import type { JavaScriptActionResult, RuleCondition, RuleConditionGroup, Email, RuleActionType } from './types';
import { evaluateCondition, evaluateConditionGroup } from './rule-evaluator';

// Type definitions
let kafka: Kafka | null = null;

// Create reusable transporter object for email forwarding
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '2525'),
  secure: false,
  tls: {
    rejectUnauthorized: false
  },
  debug: true,
  logger: true
});

// Initialize Kafka client if configured
if (process.env.KAFKA_BROKERS) {
  kafka = new Kafka({
    clientId: 'email-rules',
    brokers: process.env.KAFKA_BROKERS.split(','),
  });
}

// Helper function to safely get email address
function getEmailAddress(address: AddressObject | AddressObject[] | undefined): string {
  if (!address) return '';
  if (Array.isArray(address)) {
    return address.map(a => a.text).join(', ');
  }
  return address.text || '';
}

// Helper function to convert mailparser attachment to nodemailer attachment
function convertAttachment(att: Attachment): NodemailerAttachment {
  return {
    filename: att.filename,
    content: att.content,
    contentType: att.contentType,
    contentDisposition: 'attachment',
    cid: att.cid
  };
}

interface ProcessableEmail extends ParsedMail {
  id?: number;
  receivedAt: Date;
}

async function processEmailRules(parsedEmail: ProcessableEmail) {
  try {
    // Fetch all active rules
    const rules = await prisma.emailRule.findMany({
      where: { isActive: true }
    });

    console.log(`Processing ${rules.length} active rules for email:`, parsedEmail.id);

    for (const rule of rules) {
      const conditionGroups = (typeof rule.conditionGroups === 'string'
        ? JSON.parse(rule.conditionGroups)
        : rule.conditionGroups) as RuleConditionGroup[];

      const ruleMatches = conditionGroups?.some(group => 
        evaluateConditionGroup(group, parsedEmail)
      );

      console.log(`Rule "${rule.name}" (${rule.id}) matches:`, ruleMatches);

      if (ruleMatches) {
        // Update email with rule information immediately
        await prisma.email.update({
          where: { id: parsedEmail.id },
          data: {
            processedByRules: true,
            processedByRuleId: rule.id,
            processedByRuleName: rule.name
          }
        });

        console.log(`Updated email ${parsedEmail.id} with rule "${rule.name}" (${rule.id})`);

        const action = typeof rule.action === 'string'
          ? JSON.parse(rule.action)
          : rule.action;

        // Process the rule action
        switch (action.type) {
          case 'forward':
            if (action.config.forwardTo) {
              await transporter.sendMail({
                from: getEmailAddress(parsedEmail.from),
                to: action.config.forwardTo,
                subject: parsedEmail.subject || '',
                text: parsedEmail.text || '',
                html: parsedEmail.html || undefined,
                attachments: parsedEmail.attachments?.map(convertAttachment)
              });
              console.log(`Forwarded email to ${action.config.forwardTo}`);
            }
            break;

          case 'webhook':
            if (action.config.webhookUrl) {
              await axios.post(action.config.webhookUrl, {
                from: getEmailAddress(parsedEmail.from),
                to: getEmailAddress(parsedEmail.to),
                subject: parsedEmail.subject || '',
                text: parsedEmail.text || '',
                html: parsedEmail.html || null,
                receivedAt: new Date()
              });
              console.log(`Sent webhook to ${action.config.webhookUrl}`);
            }
            break;

          case 'kafka':
            if (kafka && action.config.kafkaTopic) {
              const producer = kafka.producer();
              await producer.connect();
              await producer.send({
                topic: action.config.kafkaTopic,
                messages: [{
                  value: JSON.stringify({
                    from: getEmailAddress(parsedEmail.from),
                    to: getEmailAddress(parsedEmail.to),
                    subject: parsedEmail.subject,
                    text: parsedEmail.text,
                    html: parsedEmail.html,
                    receivedAt: new Date()
                  })
                }]
              });
              await producer.disconnect();
              console.log(`Sent message to Kafka topic ${action.config.kafkaTopic}`);
            }
            break;
        }

        // Return after processing the first matching rule
        return;
      }
    }

    // If no rules matched, mark the email as processed but with no rule
    await prisma.email.update({
      where: { id: parsedEmail.id },
      data: {
        processedByRules: false,
        processedByRuleId: null,
        processedByRuleName: null
      }
    });
    console.log(`Email ${parsedEmail.id} was not matched by any rules`);

  } catch (error) {
    console.error('Error processing email rules:', error);
    throw error; // Rethrow to handle in the caller
  }
}

/**
 * Creates and starts an SMTP server
 * @param {number} port - The port to listen on
 */
export function createSMTPServer(port = 2525) {
  console.log('Creating SMTP server on port:', port);
  
  const server = new SMTPServer({
    secure: false,
    disabledCommands: ['AUTH', 'STARTTLS'],
    logger: true,
    size: 31457280, // 30MB max message size
    hideSTARTTLS: true,
    onData(stream, session, callback) {
      console.log('Receiving email data...');
      let buffer = '';
      stream.on('data', (chunk) => {
        buffer += chunk;
      });

      stream.on('end', async () => {
        try {
          console.log('Processing received email...');
          // Parse the email
          const parsed = await simpleParser(buffer);
          
          // Store in database
          const email = await prisma.email.create({
            data: {
              from: getEmailAddress(parsed.from),
              to: getEmailAddress(parsed.to),
              subject: parsed.subject || '',
              text: parsed.text || '',
              html: parsed.html || null,
              attachments: JSON.stringify(parsed.attachments || []),
              headers: JSON.stringify(Object.fromEntries(parsed.headers || new Map())),
              size: Buffer.byteLength(buffer),
              processedByRules: false,
            },
          });

          console.log('Email stored in database with ID:', email.id);

          // Process email rules
          await processEmailRules({ 
            ...parsed, 
            id: email.id,
            receivedAt: new Date()
          });

          console.log('Email rules processed');
          callback();
        } catch (err) {
          console.error('Error processing email:', err);
          callback(new Error('Error processing email'));
        }
      });

      stream.on('error', (err) => {
        console.error('Stream error:', err);
        callback(new Error('Stream error'));
      });
    },
    onConnect(session, callback) {
      console.log('New connection from:', session.remoteAddress);
      callback();
    },
    onAuth(auth, session, callback) {
      console.log('Auth attempt from:', session.remoteAddress);
      // Allow all auth attempts since we disabled AUTH
      callback(null, { user: 123 });
    }
  });

  server.on('error', (err) => {
    console.error('SMTP Server error:', err);
  });

  try {
    server.listen(port, '0.0.0.0', () => {
      console.log('✓ SMTP Server running on port', port);
      console.log('  You can now send emails to localhost:', port);
    });
  } catch (error) {
    console.error('Failed to start SMTP server:', error);
    process.exit(1);
  }

  return server;
} 