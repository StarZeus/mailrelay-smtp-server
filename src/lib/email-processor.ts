import nodemailer from 'nodemailer';
import type { EmailRule, Email, RuleConditionGroup } from './types';
import { evaluateConditionGroup } from './rule-evaluator';
import prisma from './prisma';
import axios from 'axios';
import { Kafka } from 'kafkajs';
import type { ParsedMail, AddressObject, Attachment } from 'mailparser';
import type { Attachment as NodemailerAttachment } from 'nodemailer/lib/mailer';

// Type definitions
interface ProcessableEmail extends ParsedMail {
  id?: number;
  receivedAt: Date;
}

let kafka: Kafka | null = null;

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

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.FORWARD_SMTP_HOST || process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.FORWARD_SMTP_PORT || process.env.SMTP_PORT || '2525'),
  secure: process.env.FORWARD_SMTP_SECURE === 'true',
  ...(process.env.FORWARD_SMTP_USER && process.env.FORWARD_SMTP_PASS ? {
    auth: {
      user: process.env.FORWARD_SMTP_USER,
      pass: process.env.FORWARD_SMTP_PASS
    }
  } : {}),
  tls: {
    rejectUnauthorized: process.env.NODE_ENV === 'production'
  },
  debug: process.env.NODE_ENV !== 'production',
  logger: process.env.NODE_ENV !== 'production'
});

// Log transporter configuration (without sensitive data)
console.log('SMTP Forwarding Configuration:', {
  host: process.env.FORWARD_SMTP_HOST || process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.FORWARD_SMTP_PORT || process.env.SMTP_PORT || '2525'),
  secure: process.env.FORWARD_SMTP_SECURE === 'true',
  auth: process.env.FORWARD_SMTP_USER ? { user: process.env.FORWARD_SMTP_USER } : undefined
});

// Verify transporter connection
transporter.verify()
  .then(() => console.log('SMTP Forwarding Connection Verified'))
  .catch(err => console.error('SMTP Forwarding Connection Error:', err));

// Helper functions
function evaluateRule(email: Email, rule: any): boolean {
  const conditionGroups = (typeof rule.conditionGroups === 'string'
    ? JSON.parse(rule.conditionGroups)
    : rule.conditionGroups) as RuleConditionGroup[];

  return conditionGroups.some(group => evaluateConditionGroup(group, email));
}

async function executeRuleAction(email: Email, rule: any) {
  const action = typeof rule.action === 'string'
    ? JSON.parse(rule.action)
    : rule.action;

  const config = action.config as any;
  
  switch (action.type) {
    case 'webhook':
      if (config.webhookUrl) {
        const response = await fetch(config.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: email.from,
            to: email.to,
            subject: email.subject,
            text: email.text,
            html: email.html,
            receivedAt: email.receivedAt
          })
        });
        console.log('Webhook response:', await response.text());
      }
      break;
    // ... other cases ...
  }
}

export async function processEmailRules(parsedEmail: ProcessableEmail) {
  try {
    // Fetch all active rules
    const rules = await prisma.emailRule.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' } // Process rules in order of creation
    });

    console.log(`Processing ${rules.length} active rules for email:`, parsedEmail.id);
    
    let rulesProcessed = false;
    const processedRules: { id: number; name: string; success: boolean; error?: string }[] = [];

    for (const rule of rules) {
      const conditionGroups = (typeof rule.conditionGroups === 'string'
        ? JSON.parse(rule.conditionGroups)
        : rule.conditionGroups) as RuleConditionGroup[];

      const ruleMatches = conditionGroups?.some(group => 
        evaluateConditionGroup(group, parsedEmail)
      );

      console.log(`Rule "${rule.name}" (${rule.id}) matches:`, ruleMatches);

      if (ruleMatches) {
        rulesProcessed = true;
        let success = true;
        let error: string | undefined;

        try {
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
                console.log(`Forwarded email to ${action.config.forwardTo} by rule "${rule.name}"`);
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
                  receivedAt: new Date(),
                  processedByRule: rule.name
                });
                console.log(`Sent webhook to ${action.config.webhookUrl} by rule "${rule.name}"`);
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
                      receivedAt: new Date(),
                      processedByRule: rule.name
                    })
                  }]
                });
                await producer.disconnect();
                console.log(`Sent message to Kafka topic ${action.config.kafkaTopic} by rule "${rule.name}"`);
              }
              break;
          }
        } catch (actionError) {
          success = false;
          error = actionError instanceof Error ? actionError.message : 'Unknown error';
          console.error(`Error processing action for rule "${rule.name}":`, actionError);
        }
        console.log('After Case again');

        processedRules.push({ 
          id: rule.id, 
          name: rule.name,
          success,
          error
        });

        // Create rule processing record
        await prisma.emailRuleProcessing.create({
          data: {
            emailId: parsedEmail.id!,
            ruleId: rule.id,
            success,
            error
          }
        });
      }

      console.log('Looping around again');
    }

    // Update email with processed status
    if (parsedEmail.id) {
      await prisma.email.update({
        where: { id: parsedEmail.id },
        data: {
          processedByRules: rulesProcessed
        }
      });
    }

    if (rulesProcessed) {
      const successfulRules = processedRules.filter(r => r.success);
      const failedRules = processedRules.filter(r => !r.success);
      
      console.log(`Email ${parsedEmail.id} processing summary:`);
      if (successfulRules.length > 0) {
        console.log('Successfully processed by:', successfulRules.map(r => r.name).join(', '));
      }
      if (failedRules.length > 0) {
        console.log('Failed processing by:', failedRules.map(r => `${r.name} (${r.error})`).join(', '));
      }
    } else {
      console.log(`Email ${parsedEmail.id} was not matched by any rules`);
    }

  } catch (error) {
    console.error('Error processing email rules:', error);
    throw error;
  }
}

export async function processEmailWithRules(email: any, rules: EmailRule[]) {
  try {
    console.log('Processing email with rules:', rules.length);
    
    for (const rule of rules) {
      if (!rule.isActive) continue;

      // Check if any condition group matches
      const matches = rule.conditionGroups.some(group => 
        evaluateConditionGroup(group, { ...email, receivedAt: new Date() })
      );

      if (!matches) continue;

      console.log(`Rule ${rule.name} matched, executing action:`, rule.action.type);

      // Execute the matched rule's action
      switch (rule.action.type) {
        case 'forward':
          if (!rule.action.config.forwardTo) {
            throw new Error('Forward email address is required');
          }
          await forwardEmail(email, rule.action.config.forwardTo);
          break;
        case 'webhook':
          if (!rule.action.config.webhookUrl) {
            throw new Error('Webhook URL is required');
          }
          await sendToWebhook(email, rule.action.config.webhookUrl);
          break;
        case 'kafka':
          if (!rule.action.config.kafkaTopic || !rule.action.config.kafkaBroker) {
            throw new Error('Kafka topic and broker are required');
          }
          await sendToKafka(email, rule.action.config.kafkaTopic, rule.action.config.kafkaBroker);
          break;
        case 'javascript':
          if (!rule.action.config.code) {
            throw new Error('JavaScript code is required');
          }
          await executeJavaScript(email, rule.action.config.code);
          break;
      }
    }
  } catch (error) {
    console.error('Error processing email rules:', error);
    throw error;
  }
}

async function forwardEmail(email: any, forwardTo: string) {
  try {
    await transporter.sendMail({
      from: email.from,
      to: forwardTo,
      subject: email.subject,
      text: email.text,
      html: email.html,
      headers: email.headers,
      attachments: email.attachments,
    });
    console.log('Email forwarded successfully to:', forwardTo);
  } catch (error) {
    console.error('Error forwarding email:', error);
    throw error;
  }
}

async function sendToWebhook(email: any, webhookUrl: string) {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(email),
    });
    
    if (!response.ok) {
      throw new Error(`Webhook failed with status ${response.status}`);
    }
    console.log('Email sent to webhook successfully');
  } catch (error) {
    console.error('Error sending to webhook:', error);
    throw error;
  }
}

async function sendToKafka(email: any, topic: string, broker: string) {
  try {
    // Implement Kafka producer logic here
    console.log('Email sent to Kafka topic:', topic);
  } catch (error) {
    console.error('Error sending to Kafka:', error);
    throw error;
  }
}

async function executeJavaScript(email: any, code: string) {
  try {
    const sandbox = {
      email,
      console: { log: console.log },
    };

    const result = new Function('email', 'console', `
      try {
        ${code}
      } catch (error) {
        console.error('Error in JavaScript execution:', error);
        throw error;
      }
    `)(sandbox.email, sandbox.console);

    if (result) {
      if (result.forward) {
        await forwardEmail(email, result.forward.to);
      }
      if (result.webhook) {
        await sendToWebhook(email, result.webhook.url);
      }
      if (result.kafka) {
        await sendToKafka(email, result.kafka.topic, result.kafka.broker);
      }
    }
  } catch (error) {
    console.error('Error executing JavaScript:', error);
    throw error;
  }
} 