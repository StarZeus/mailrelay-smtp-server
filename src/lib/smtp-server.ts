const SMTPServer = require('smtp-server').SMTPServer;
const { simpleParser } = require('mailparser');
const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');
const { Kafka } = require('kafkajs');
const axios = require('axios');
const ivm = require('isolated-vm');

// Type definitions
/** @type {import('kafkajs').Kafka | null} */
let kafka = null;

const prisma = new PrismaClient();

// Create a reusable transporter object for email forwarding
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '25'),
  secure: false,
});

// Initialize Kafka client if configured
if (process.env.KAFKA_BROKERS) {
  kafka = new Kafka({
    clientId: 'email-rules',
    brokers: process.env.KAFKA_BROKERS.split(','),
  });
}

/**
 * @typedef {Object} RuleCondition
 * @property {string} type
 * @property {string} operator
 * @property {string} value
 * @property {string} [value2]
 */

/**
 * @typedef {Object} RuleConditionGroup
 * @property {'AND' | 'OR'} operator
 * @property {RuleCondition[]} conditions
 */

/**
 * @param {RuleCondition} condition
 * @param {any} parsedEmail
 */
function evaluateCondition(condition, parsedEmail) {
  const { type, operator, value, value2 } = condition;

  switch (type) {
    case 'from':
    case 'to':
    case 'subject':
    case 'content': {
      const emailValue = {
        from: parsedEmail.from.text,
        to: parsedEmail.to.text,
        subject: parsedEmail.subject,
        content: parsedEmail.text
      }[type]?.toLowerCase() || '';
      const testValue = value.toLowerCase();

      switch (operator) {
        case 'contains': return emailValue.includes(testValue);
        case 'notContains': return !emailValue.includes(testValue);
        case 'equals': return emailValue === testValue;
        case 'notEquals': return emailValue !== testValue;
        case 'startsWith': return emailValue.startsWith(testValue);
        case 'endsWith': return emailValue.endsWith(testValue);
        case 'matches':
          try {
            const regex = new RegExp(testValue);
            return regex.test(emailValue);
          } catch (error) {
            console.error('Invalid regex pattern:', error);
            return false;
          }
      }
      break;
    }

    case 'hasAttachment': {
      const hasAttachments = Array.isArray(parsedEmail.attachments) && 
        parsedEmail.attachments.length > 0;
      return operator === 'true' ? hasAttachments : !hasAttachments;
    }

    case 'attachmentName': {
      if (!parsedEmail.attachments?.length) return false;
      const testValue = value.toLowerCase();
      const attachmentNames = parsedEmail.attachments
        .map((att: any) => att.filename?.toLowerCase())
        .filter(Boolean);

      switch (operator) {
        case 'contains': return attachmentNames.some(name => name.includes(testValue));
        case 'notContains': return !attachmentNames.some(name => name.includes(testValue));
        case 'equals': return attachmentNames.some(name => name === testValue);
        case 'notEquals': return !attachmentNames.some(name => name === testValue);
        case 'matches':
          try {
            const regex = new RegExp(testValue);
            return attachmentNames.some(name => regex.test(name));
          } catch (error) {
            console.error('Invalid regex pattern:', error);
            return false;
          }
      }
      break;
    }

    case 'emailSize': {
      const size = parsedEmail.size || 0; // in bytes
      const testSize = parseInt(value);
      const testSize2 = value2 ? parseInt(value2) : null;

      switch (operator) {
        case 'greaterThan': return size > testSize;
        case 'lessThan': return size < testSize;
        case 'inRange': return testSize2 ? size >= testSize && size <= testSize2 : false;
      }
      break;
    }

    case 'priority': {
      const priority = parsedEmail.headers?.['x-priority'] || 
                      parsedEmail.headers?.['importance'] || 
                      'normal';
      
      const normalizedPriority = priority.toLowerCase();
      return normalizedPriority === operator;
    }

    case 'receivedDate': {
      const emailDate = new Date(parsedEmail.date);
      const testDate = new Date(value);
      const testDate2 = value2 ? new Date(value2) : null;

      switch (operator) {
        case 'before': return emailDate < testDate;
        case 'after': return emailDate > testDate;
        case 'between': return testDate2 ? 
          emailDate > testDate && emailDate < testDate2 : false;
      }
      break;
    }

    case 'receivedTime': {
      const emailHour = new Date(parsedEmail.date).getHours();
      const emailMinute = new Date(parsedEmail.date).getMinutes();
      const [testHour, testMinute] = value.split(':').map(Number);
      const emailTime = emailHour * 60 + emailMinute;
      const testTime = testHour * 60 + testMinute;

      switch (operator) {
        case 'before': return emailTime < testTime;
        case 'after': return emailTime > testTime;
        case 'equals': return emailTime === testTime;
      }
      break;
    }

    case 'dayOfWeek': {
      const emailDay = new Date(parsedEmail.date).getDay().toString();
      return emailDay === value;
    }

    case 'headerField': {
      const headerExists = value in parsedEmail.headers;
      return operator === 'exists' ? headerExists : !headerExists;
    }
  }

  return false;
}

/**
 * @param {RuleConditionGroup} group
 * @param {any} parsedEmail
 */
function evaluateConditionGroup(group, parsedEmail) {
  if (group.operator === 'AND') {
    return group.conditions.every(condition => 
      evaluateCondition(condition, parsedEmail)
    );
  } else { // OR
    return group.conditions.some(condition => 
      evaluateCondition(condition, parsedEmail)
    );
  }
}

// Execute JavaScript code in an isolated environment
async function executeJavaScript(code: string, email: any): Promise<JavaScriptActionResult> {
  // Create a new isolate
  const isolate = new ivm.Isolate({ memoryLimit: 128 });

  try {
    // Create a new context within the isolate
    const context = await isolate.createContext();

    // Create a jail
    const jail = context.global;
    await jail.set('global', jail.derefInto());

    // Add console.log functionality
    await context.eval(`
      const console = {
        log: (...args) => { $0.applySync(undefined, args); },
        error: (...args) => { $1.applySync(undefined, args); }
      };
    `, [
      (...args: any[]) => console.log('JavaScript Action:', ...args),
      (...args: any[]) => console.error('JavaScript Action Error:', ...args)
    ]);

    // Inject the email object
    await context.global.set('email', {
      from: email.from.text,
      to: email.to.text,
      subject: email.subject,
      text: email.text,
      html: email.html,
      headers: email.headers,
      attachments: email.attachments,
      date: email.date
    });

    // Create the async wrapper
    const wrappedCode = `
      (async function() {
        try {
          ${code}
        } catch (error) {
          console.error(error.message);
          return {};
        }
      })()
    `;

    // Run the code with a timeout
    const script = await isolate.compileScript(wrappedCode);
    const result = await script.run(context, { timeout: 1000 });
    
    return result?.copy() || {};
  } catch (error) {
    console.error('Error executing JavaScript action:', error);
    return {};
  } finally {
    // Dispose the isolate
    isolate.dispose();
  }
}

// Process JavaScript action result
async function processJavaScriptResult(result: JavaScriptActionResult, parsedEmail: any) {
  try {
    // Handle email modifications
    if (result.modifiedEmail) {
      Object.assign(parsedEmail, {
        subject: result.modifiedEmail.subject ?? parsedEmail.subject,
        text: result.modifiedEmail.text ?? parsedEmail.text,
        html: result.modifiedEmail.html ?? parsedEmail.html,
        headers: {
          ...parsedEmail.headers,
          ...result.modifiedEmail.headers
        }
      });

      if (result.modifiedEmail.to) {
        parsedEmail.to = { text: result.modifiedEmail.to.join(', ') };
      }
    }

    // Handle forwarding
    if (result.forward) {
      await transporter.sendMail({
        from: parsedEmail.from.text,
        to: result.forward.to,
        subject: result.forward.subject || parsedEmail.subject,
        text: result.forward.text || parsedEmail.text,
        html: result.forward.html || parsedEmail.html,
        attachments: parsedEmail.attachments
      });
    }

    // Handle webhook
    if (result.webhook) {
      const { url, method = 'POST', headers = {}, body } = result.webhook;
      await axios({
        method,
        url,
        headers,
        data: body || {
          from: parsedEmail.from.text,
          to: parsedEmail.to.text,
          subject: parsedEmail.subject,
          text: parsedEmail.text,
          html: parsedEmail.html,
          receivedAt: new Date()
        }
      });
    }

    // Handle Kafka
    if (result.kafka && kafka) {
      const producer = kafka.producer();
      await producer.connect();
      await producer.send({
        topic: result.kafka.topic,
        messages: [{
          value: JSON.stringify(result.kafka.message || {
            from: parsedEmail.from.text,
            to: parsedEmail.to.text,
            subject: parsedEmail.subject,
            text: parsedEmail.text,
            html: parsedEmail.html,
            receivedAt: new Date()
          })
        }]
      });
      await producer.disconnect();
    }
  } catch (error) {
    console.error('Error processing JavaScript action result:', error);
  }
}

async function processEmailRules(parsedEmail: any) {
  try {
    // Fetch all active rules
    const rules = await prisma.emailRule.findMany({
      where: { isActive: true }
    });

    for (const rule of rules) {
      // A rule matches if ANY of its condition groups match (implicit OR between groups)
      const ruleMatches = rule.conditionGroups.some(group => 
        evaluateConditionGroup(group, parsedEmail)
      );

      if (ruleMatches) {
        const { type, config } = rule.action;

        switch (type) {
          case 'forward':
            if (config.forwardTo) {
              await transporter.sendMail({
                from: parsedEmail.from.text,
                to: config.forwardTo,
                subject: parsedEmail.subject,
                text: parsedEmail.text,
                html: parsedEmail.html,
                attachments: parsedEmail.attachments
              });
            }
            break;

          case 'webhook':
            if (config.webhookUrl) {
              await axios.post(config.webhookUrl, {
                from: parsedEmail.from.text,
                to: parsedEmail.to.text,
                subject: parsedEmail.subject,
                text: parsedEmail.text,
                html: parsedEmail.html,
                receivedAt: new Date()
              });
            }
            break;

          case 'kafka':
            if (kafka && config.kafkaTopic) {
              const producer = kafka.producer();
              await producer.connect();
              await producer.send({
                topic: config.kafkaTopic,
                messages: [{
                  value: JSON.stringify({
                    from: parsedEmail.from.text,
                    to: parsedEmail.to.text,
                    subject: parsedEmail.subject,
                    text: parsedEmail.text,
                    html: parsedEmail.html,
                    receivedAt: new Date()
                  })
                }]
              });
              await producer.disconnect();
            }
            break;
        }
      }
    }
  } catch (error) {
    console.error('Error processing email rules:', error);
  }
}

/**
 * Creates and starts an SMTP server
 * @param {number} port - The port to listen on
 */
function createSMTPServer(port = 2525) {
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
          await prisma.email.create({
            data: {
              from: parsed.from?.text || '',
              to: Array.isArray(parsed.to) 
                ? parsed.to.map(t => t.text).join(', ')
                : parsed.to?.text || '',
              subject: parsed.subject,
              text: parsed.text,
              html: parsed.html || null,
              attachments: parsed.attachments,
              headers: parsed.headers,
            },
          });

          console.log('Email stored in database');

          // Process email rules
          await processEmailRules(parsed);

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

// Export functions using CommonJS
module.exports = {
  createSMTPServer,
  evaluateCondition,
  evaluateConditionGroup
}; 