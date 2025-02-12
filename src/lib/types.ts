export interface Email {
  id: number;
  from: string;
  to: string;
  subject: string | null;
  text: string | null;
  html: string | null;
  attachments: any | null;
  headers: any | null;
  receivedAt: Date;
  isRead: boolean;
  processedByRules: boolean;
}

export type RuleConditionType = 
  | 'from' 
  | 'to' 
  | 'subject' 
  | 'content' 
  | 'hasAttachment'
  | 'attachmentName'
  | 'receivedDate'
  | 'receivedTime'
  | 'dayOfWeek'
  | 'headerField'
  | 'emailSize'
  | 'priority';

export type RuleOperator = 
  | 'contains' 
  | 'notContains'
  | 'equals' 
  | 'notEquals'
  | 'startsWith' 
  | 'endsWith'
  | 'matches' // for regex
  | 'before' // for dates
  | 'after'  // for dates
  | 'between' // for dates
  | 'exists'  // for attachments and headers
  | 'true'    // for boolean conditions
  | 'false'   // for boolean conditions
  | 'greaterThan' // for sizes
  | 'lessThan'    // for sizes
  | 'inRange'     // for sizes
  | 'high'        // for priority
  | 'normal'      // for priority
  | 'low';        // for priority

export type RuleActionType = 
  | 'forward' 
  | 'webhook' 
  | 'kafka'
  | 'javascript';

export interface RuleCondition {
  type: RuleConditionType;
  operator: RuleOperator;
  value: string;
  value2?: string; // For 'between' and 'inRange' operators
}

export interface RuleConditionGroup {
  operator: 'AND' | 'OR';
  conditions: RuleCondition[];
}

export interface JavaScriptActionResult {
  modifiedEmail?: {
    subject?: string;
    text?: string;
    html?: string;
    to?: string[];
    cc?: string[];
    bcc?: string[];
    headers?: Record<string, string>;
  };
  forward?: {
    to: string;
    subject?: string;
    text?: string;
    html?: string;
  };
  webhook?: {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH';
    headers?: Record<string, string>;
    body?: any;
  };
  kafka?: {
    topic: string;
    message: any;
  };
}

export interface EmailRule {
  id: number;
  name: string;
  isActive: boolean;
  conditionGroups: RuleConditionGroup[];
  action: {
    type: RuleActionType;
    config: {
      // For email forwarding
      forwardTo?: string;
      // For webhook
      webhookUrl?: string;
      // For Kafka
      kafkaTopic?: string;
      kafkaBroker?: string;
      // For JavaScript
      code?: string;
    };
  };
  createdAt: Date;
} 