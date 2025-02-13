import nodemailer from 'nodemailer';
import type { EmailRule, Email, RuleConditionGroup } from './types';
import { evaluateConditionGroup } from './rule-evaluator';
import prisma from './prisma';

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

export async function processEmailRules(email: Email) {
  try {
    const rules = await prisma.emailRule.findMany({
      where: { isActive: true }
    });

    console.log('Processing rules:', rules);
    
    for (const rule of rules) {
      const ruleMatches = evaluateRule(email, rule);
      console.log('Rule matches:', ruleMatches);
      
      if (ruleMatches) {
        await executeRuleAction(email, rule);
        // Update email to mark which rule processed it
        await prisma.email.update({
          where: { id: email.id },
          data: {
            processedByRules: true,
            processedByRuleId: rule.id,
            processedByRuleName: rule.name
          }
        });
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Error processing email rules:', error);
    return false;
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