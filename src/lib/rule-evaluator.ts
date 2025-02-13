import type { RuleCondition, RuleConditionGroup, Email } from './types';
import type { ParsedMail, AddressObject } from 'mailparser';

function getEmailAddress(address: AddressObject | AddressObject[] | undefined | string): string {
  if (!address) return '';
  if (typeof address === 'string') return address;
  if (Array.isArray(address)) {
    return address.map(a => a.text).join(', ');
  }
  return address.text || '';
}

export function evaluateCondition(
  condition: RuleCondition, 
  email: (ParsedMail & { receivedAt: Date }) | Email
): boolean {
  const { type, operator, value, value2 } = condition;

  switch (type) {
    case 'from':
    case 'to':
    case 'subject':
    case 'content': {
      const emailValue = {
        from: getEmailAddress('from' in email ? email.from : ''),
        to: getEmailAddress('to' in email ? email.to : ''),
        subject: email.subject || '',
        content: 'text' in email ? email.text || '' : ''
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

    // ... rest of the condition types ...
  }

  return false;
}

export function evaluateConditionGroup(
  group: RuleConditionGroup, 
  email: (ParsedMail & { receivedAt: Date }) | Email
): boolean {
  if (group.operator === 'AND') {
    return group.conditions.every(condition => 
      evaluateCondition(condition, email)
    );
  } else { // OR
    return group.conditions.some(condition => 
      evaluateCondition(condition, email)
    );
  }
} 