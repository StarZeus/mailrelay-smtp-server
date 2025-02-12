'use client';

import { useState, useCallback } from 'react';
import type { EmailRule, RuleConditionType, RuleActionType, RuleOperator, RuleCondition as ImportedRuleCondition } from '@/lib/types';
import { X, Plus, Trash2 } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import CodeMirror with no SSR
const CodeMirror = dynamic(
  async () => {
    const { default: CodeMirrorComponent } = await import('@uiw/react-codemirror');
    const { javascript } = await import('@codemirror/lang-javascript');
    const ReactCodeMirror = (props: any) => (
      <CodeMirrorComponent {...props} extensions={[javascript()]} />
    );
    return ReactCodeMirror;
  },
  { ssr: false }
);

interface RuleFormProps {
  rule?: EmailRule | null;
  prefilledRule?: EmailRule | null;
  onClose: () => void;
  onSubmit: () => void;
  onActionTypeChange?: (type: RuleActionType) => void;
  showInPanel?: boolean;
}

const CONDITION_TYPES: { value: RuleConditionType; label: string }[] = [
  { value: 'from', label: 'From Address' },
  { value: 'to', label: 'To Address' },
  { value: 'subject', label: 'Subject' },
  { value: 'content', label: 'Content' },
  { value: 'hasAttachment', label: 'Has Attachment' },
  { value: 'attachmentName', label: 'Attachment Name' },
  { value: 'receivedDate', label: 'Received Date' },
  { value: 'receivedTime', label: 'Received Time' },
  { value: 'dayOfWeek', label: 'Day of Week' },
  { value: 'headerField', label: 'Email Header Field' },
  { value: 'emailSize', label: 'Email Size' },
  { value: 'priority', label: 'Priority' },
];

type DayOperator = 'equals' | 'notEquals';

// Map condition types to operator groups
const OPERATOR_TYPE_MAP: Record<RuleConditionType, keyof typeof OPERATORS_BY_TYPE> = {
  from: 'text',
  to: 'text',
  subject: 'text',
  content: 'text',
  attachmentName: 'text',
  hasAttachment: 'boolean',
  receivedDate: 'date',
  receivedTime: 'time',
  dayOfWeek: 'day',
  headerField: 'text',
  emailSize: 'number',
  priority: 'text',
};

const OPERATORS_BY_TYPE = {
  text: [
    { value: 'contains' as RuleOperator, label: 'Contains' },
    { value: 'notContains' as RuleOperator, label: 'Does Not Contain' },
    { value: 'equals' as RuleOperator, label: 'Equals' },
    { value: 'notEquals' as RuleOperator, label: 'Does Not Equal' },
    { value: 'startsWith' as RuleOperator, label: 'Starts With' },
    { value: 'endsWith' as RuleOperator, label: 'Ends With' },
    { value: 'matches' as RuleOperator, label: 'Matches Regex' }
  ],
  date: [
    { value: 'before' as RuleOperator, label: 'Before' },
    { value: 'after' as RuleOperator, label: 'After' },
    { value: 'between' as RuleOperator, label: 'Between' }
  ],
  boolean: [
    { value: 'true' as RuleOperator, label: 'Is True' },
    { value: 'false' as RuleOperator, label: 'Is False' }
  ],
  number: [
    { value: 'greaterThan' as RuleOperator, label: 'Greater Than' },
    { value: 'lessThan' as RuleOperator, label: 'Less Than' },
    { value: 'equals' as RuleOperator, label: 'Equals' },
    { value: 'notEquals' as RuleOperator, label: 'Does Not Equal' },
    { value: 'inRange' as RuleOperator, label: 'In Range' }
  ],
  time: [
    { value: 'before' as RuleOperator, label: 'Before' },
    { value: 'after' as RuleOperator, label: 'After' },
    { value: 'between' as RuleOperator, label: 'Between' }
  ],
  day: [
    { value: 'equals' as RuleOperator, label: 'Is' },
    { value: 'notEquals' as RuleOperator, label: 'Is Not' }
  ]
} as const;

const DAYS_OF_WEEK = [
  { value: 'Monday', label: 'Monday' },
  { value: 'Tuesday', label: 'Tuesday' },
  { value: 'Wednesday', label: 'Wednesday' },
  { value: 'Thursday', label: 'Thursday' },
  { value: 'Friday', label: 'Friday' },
  { value: 'Saturday', label: 'Saturday' },
  { value: 'Sunday', label: 'Sunday' }
];

const ACTION_TYPES: { value: RuleActionType; label: string }[] = [
  { value: 'forward', label: 'Forward to Email' },
  { value: 'webhook', label: 'Send to Webhook' },
  { value: 'kafka', label: 'Send to Kafka Topic' },
  { value: 'javascript', label: 'JavaScript' }
];

interface FormData {
  name: string;
  isActive: boolean;
  conditions: ImportedRuleCondition[];
  action: {
    type: RuleActionType;
    config: {
      forwardTo?: string;
      webhookUrl?: string;
      kafkaTopic?: string;
      kafkaBroker?: string;
      code?: string;
    };
  };
}

export function RuleForm({ 
  rule, 
  prefilledRule, 
  onClose, 
  onSubmit,
  onActionTypeChange,
  showInPanel = false 
}: RuleFormProps) {
  const initialConditions: ImportedRuleCondition[] = 
    rule?.conditionGroups?.[0]?.conditions || 
    prefilledRule?.conditionGroups?.[0]?.conditions || 
    [{ type: 'from', operator: 'contains', value: '' }];

  const [formData, setFormData] = useState<FormData>({
    name: rule?.name || prefilledRule?.name || '',
    isActive: rule?.isActive ?? prefilledRule?.isActive ?? true,
    conditions: initialConditions,
    action: rule?.action || prefilledRule?.action || { type: 'forward', config: { forwardTo: '' } }
  });

  const handleAddCondition = () => {
    setFormData(prev => ({
      ...prev,
      conditions: [
        ...(prev.conditions || []),
        { type: 'from', operator: 'contains', value: '' }
      ]
    }));
  };

  const handleRemoveCondition = (index: number) => {
    setFormData(prev => ({
      ...prev,
      conditions: prev.conditions?.filter((_, i) => i !== index)
    }));
  };

  const handleConditionChange = (index: number, field: keyof ImportedRuleCondition, newValue: string) => {
    setFormData(prev => ({
      ...prev,
      conditions: prev.conditions.map((condition, i) => {
        if (i !== index) return condition;

        if (field === 'type') {
          const operatorType = OPERATOR_TYPE_MAP[newValue as RuleConditionType];
          return {
            ...condition,
            type: newValue as RuleConditionType,
            operator: OPERATORS_BY_TYPE[operatorType][0].value,
            value: '',
            value2: undefined
          };
        }

        if (field === 'operator') {
          return { 
            ...condition, 
            operator: newValue as RuleOperator,
            value2: newValue !== 'between' && newValue !== 'inRange' ? undefined : condition.value2
          };
        }

        return { 
          ...condition, 
          [field]: newValue 
        };
      })
    }));
  };

  const getOperatorsForCondition = (conditionType: RuleConditionType) => {
    const operatorType = OPERATOR_TYPE_MAP[conditionType];
    return OPERATORS_BY_TYPE[operatorType];
  };

  const renderValueInput = (condition: ImportedRuleCondition, index: number) => {
    const operatorType = OPERATOR_TYPE_MAP[condition.type];
    
    if (operatorType === undefined) {
      return null;
    }

    if (operatorType === 'boolean') {
      return null; // Boolean conditions don't need value input
    }

    if (operatorType === 'day') {
      return (
        <select
          className="form-select"
          value={condition.value}
          onChange={(e) => handleConditionChange(index, 'value', e.target.value)}
        >
          <option value="">Select Day</option>
          {DAYS_OF_WEEK.map(day => (
            <option key={day.value} value={day.value}>
              {day.label}
            </option>
          ))}
        </select>
      );
    }

    if (condition.type === 'receivedDate') {
      return (
        <>
          <input
            type="date"
            value={condition.value}
            onChange={e => handleConditionChange(index, 'value', e.target.value)}
            className="block w-1/3 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            required
          />
          {condition.operator === 'between' && (
            <input
              type="date"
              value={condition.value2 || ''}
              onChange={e => handleConditionChange(index, 'value2', e.target.value)}
              className="block w-1/3 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              required
            />
          )}
        </>
      );
    }

    if (condition.type === 'receivedTime') {
      return (
        <input
          type="time"
          value={condition.value}
          onChange={e => handleConditionChange(index, 'value', e.target.value)}
          className="block w-1/3 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          required
        />
      );
    }

    if (condition.type === 'headerField') {
      return (
        <input
          type="text"
          value={condition.value}
          onChange={e => handleConditionChange(index, 'value', e.target.value)}
          placeholder="Header field name (e.g., X-Priority)"
          className="block w-1/3 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          required
        />
      );
    }

    return (
      <input
        type="text"
        value={condition.value}
        onChange={e => handleConditionChange(index, 'value', e.target.value)}
        placeholder="Value"
        className="block w-1/3 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        required
      />
    );
  };

  const handleValueChange = (index: number, value: string | number) => {
    handleConditionChange(index, 'value', value.toString());
  };

  const handleActionTypeChange = (type: RuleActionType) => {
    setFormData(prev => ({
      ...prev,
      action: {
        type,
        config: type === 'forward'
          ? { forwardTo: '' }
          : type === 'webhook'
          ? { webhookUrl: '' }
          : type === 'kafka'
          ? { kafkaTopic: '', kafkaBroker: '' }
          : { code: defaultJavaScriptCode }
      }
    }));
    onActionTypeChange?.(type);
  };

  const renderActionConfig = () => {
    switch (formData.action?.type) {
      case 'forward':
        return (
          <input
            type="email"
            value={formData.action.config.forwardTo || ''}
            onChange={e => setFormData(prev => ({
              ...prev,
              action: {
                ...prev.action!,
                config: { forwardTo: e.target.value }
              }
            }))}
            placeholder="Forward to email address"
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            pattern="[^\s@]+@[^\s@]+\.[^\s@]+"
            title="Please enter a valid email address"
            required
          />
        );

      case 'webhook':
        return (
          <input
            type="url"
            value={formData.action.config.webhookUrl || ''}
            onChange={e => setFormData(prev => ({
              ...prev,
              action: {
                ...prev.action!,
                config: { webhookUrl: e.target.value }
              }
            }))}
            placeholder="Webhook URL (e.g., https://example.com/webhook)"
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            pattern="https?:\/\/.+"
            title="Please enter a valid URL starting with http:// or https://"
            required
          />
        );

      case 'kafka':
        return (
          <div className="space-y-3">
            <input
              type="text"
              value={formData.action.config.kafkaTopic || ''}
              onChange={e => setFormData(prev => ({
                ...prev,
                action: {
                  ...prev.action!,
                  config: {
                    ...prev.action!.config,
                    kafkaTopic: e.target.value
                  }
                }
              }))}
              placeholder="Kafka Topic (e.g., my-topic)"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              pattern="[a-zA-Z0-9._-]+"
              title="Topic name can only contain alphanumeric characters, dots, underscores, and hyphens"
              required
            />
            <input
              type="text"
              value={formData.action.config.kafkaBroker || ''}
              onChange={e => setFormData(prev => ({
                ...prev,
                action: {
                  ...prev.action!,
                  config: {
                    ...prev.action!.config,
                    kafkaBroker: e.target.value
                  }
                }
              }))}
              placeholder="Kafka Broker (e.g., localhost:9092)"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              pattern="[a-zA-Z0-9\.\-]+:[0-9]+"
              title="Please enter a valid broker address in the format host:port"
              required
            />
          </div>
        );

      case 'javascript':
        return (
          <div className="space-y-2">
            <div className="text-sm text-gray-500">
              Write JavaScript code to process the email. Available variables:
            </div>
            <ul className="text-sm text-gray-500 list-disc list-inside space-y-1 mb-2">
              <li><code>email.from</code> - Sender address</li>
              <li><code>email.to</code> - Recipient address</li>
              <li><code>email.subject</code> - Email subject</li>
              <li><code>email.text</code> - Plain text content</li>
              <li><code>email.html</code> - HTML content</li>
              <li><code>email.headers</code> - Email headers</li>
              <li><code>email.attachments</code> - Email attachments</li>
              <li><code>email.date</code> - Received date</li>
            </ul>
            <div className="text-sm text-gray-500 mb-4">
              Return an object with any of these properties:
            </div>
            <ul className="text-sm text-gray-500 list-disc list-inside space-y-1 mb-4">
              <li><code>modifiedEmail</code> - Changes to apply to the email</li>
              <li><code>forward</code> - Forward email configuration</li>
              <li><code>webhook</code> - Webhook configuration</li>
              <li><code>kafka</code> - Kafka configuration</li>
            </ul>
            <div className="border rounded-md overflow-hidden">
              <CodeMirror
                value={formData.action.config.code || defaultJavaScriptCode}
                height="400px"
                onChange={(value: string) => setFormData(prev => ({
                  ...prev,
                  action: {
                    ...prev.action!,
                    config: { code: value }
                  }
                }))}
                theme="light"
                basicSetup={{
                  lineNumbers: true,
                  highlightActiveLineGutter: true,
                  highlightSpecialChars: true,
                  history: true,
                  foldGutter: true,
                  drawSelection: true,
                  dropCursor: true,
                  allowMultipleSelections: true,
                }}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Validate email address for forward action
      if (formData.action.type === 'forward') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.action.config.forwardTo || '')) {
          alert('Please enter a valid email address for forwarding');
          return;
        }
      }

      // Validate webhook URL
      if (formData.action.type === 'webhook') {
        try {
          new URL(formData.action.config.webhookUrl || '');
        } catch (error) {
          alert('Please enter a valid webhook URL (e.g., https://example.com/webhook)');
          return;
        }
      }

      // Validate Kafka broker and topic
      if (formData.action.type === 'kafka') {
        const kafkaBroker = formData.action.config.kafkaBroker || '';
        const kafkaTopic = formData.action.config.kafkaTopic || '';

        // Validate broker format (host:port)
        const brokerRegex = /^[a-zA-Z0-9.-]+:\d+$/;
        if (!brokerRegex.test(kafkaBroker)) {
          alert('Please enter a valid Kafka broker address (e.g., localhost:9092)');
          return;
        }

        // Validate topic name (alphanumeric, dots, underscores, and hyphens)
        const topicRegex = /^[a-zA-Z0-9._-]+$/;
        if (!topicRegex.test(kafkaTopic)) {
          alert('Please enter a valid Kafka topic name (alphanumeric characters, dots, underscores, and hyphens only)');
          return;
        }
      }

      // Ensure we have at least one condition
      const conditions = formData.conditions.length > 0 
        ? formData.conditions 
        : [{ type: 'from' as RuleConditionType, operator: 'contains' as RuleOperator, value: '' }];

      // Structure the data properly
      const ruleData = {
        name: formData.name,
        isActive: formData.isActive,
        conditionGroups: [{
          operator: 'AND' as const,
          conditions
        }],
        action: formData.action
      };

      console.log('Submitting rule data:', ruleData);

      const response = await fetch('/api/rules', {
        method: rule ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule ? { ...ruleData, id: rule.id } : ruleData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server error:', errorData);
        throw new Error(errorData.error || 'Failed to save rule');
      }

      const savedRule = await response.json();
      console.log('Rule saved successfully:', savedRule);
      onSubmit();
    } catch (error) {
      console.error('Error saving rule:', error);
    }
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="p-6">
      <div className="space-y-6">
        {/* Rule Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Rule Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            required
          />
        </div>

        {/* Conditions */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Conditions
            </label>
            <button
              type="button"
              onClick={handleAddCondition}
              className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Condition
            </button>
          </div>
          <div className="space-y-3">
            {formData.conditions?.map((condition, index) => (
              <div key={index} className="flex gap-3 items-start">
                <select
                  value={condition.type}
                  onChange={e => handleConditionChange(index, 'type', e.target.value as RuleConditionType)}
                  className="block w-1/4 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  {CONDITION_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <select
                  value={condition.operator}
                  onChange={e => handleConditionChange(index, 'operator', e.target.value)}
                  className="block w-1/4 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  {getOperatorsForCondition(condition.type).map(op => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
                {renderValueInput(condition, index)}
                {formData.conditions!.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveCondition(index)}
                    className="p-2 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Action */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Action
          </label>
          <div className="space-y-3">
            <select
              value={formData.action?.type}
              onChange={e => handleActionTypeChange(e.target.value as RuleActionType)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              {ACTION_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>

            {renderActionConfig()}
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {rule ? 'Update Rule' : 'Create Rule'}
        </button>
      </div>
    </form>
  );

  if (showInPanel) {
    return formContent;
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900">
            {rule ? 'Edit Rule' : 'New Rule'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {formContent}
      </div>
    </div>
  );
}

const defaultJavaScriptCode = `// Example: Modify email subject and forward to another address
return {
  modifiedEmail: {
    subject: \`[Processed] \${email.subject}\`,
    headers: {
      'X-Processed': 'true'
    }
  },
  forward: {
    to: 'another@example.com',
    subject: 'Forwarded email'
  }
};

// Example: Send to webhook if email has attachments
if (email.attachments?.length > 0) {
  return {
    webhook: {
      url: 'https://api.example.com/process',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        subject: email.subject,
        attachmentCount: email.attachments.length
      }
    }
  };
}

// Example: Send specific emails to Kafka
if (email.subject.includes('URGENT')) {
  return {
    kafka: {
      topic: 'urgent-emails',
      message: {
        from: email.from,
        subject: email.subject,
        priority: 'high'
      }
    }
  };
}

// Return empty object for no action
return {};`; 