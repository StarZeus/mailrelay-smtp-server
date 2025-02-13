'use client';

import { useState } from 'react';
import { X, Play } from 'lucide-react';
import type { EmailRule } from '@/lib/types';

interface SampleEmail {
  from: { text: string };
  to: { text: string };
  subject: string;
  text: string;
  html: string;
  date: string;
  size: number;
  headers: Record<string, string>;
  attachments: Array<{ filename: string }>;
}

interface RuleTestModalProps {
  rule: EmailRule;
  onClose: () => void;
}

interface TestResults {
  ruleMatches: boolean;
  groupResults: {
    operator: 'AND' | 'OR';
    matches: boolean;
    conditions: {
      type: string;
      operator: string;
      value: string;
      value2?: string;
      matches: boolean;
    }[];
  }[];
}

export function RuleTestModal({ rule, onClose }: RuleTestModalProps) {
  const [sampleEmail, setSampleEmail] = useState<SampleEmail>({
    from: { text: '' },
    to: { text: '' },
    subject: '',
    text: '',
    html: '',
    date: new Date().toISOString(),
    size: 0,
    headers: {},
    attachments: []
  });
  const [results, setResults] = useState<TestResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<boolean | null>(null);

  const handleTest = async () => {
    try {
      setTesting(true);
      setError(null);
      
      const response = await fetch('/api/rules/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: {
            from: sampleEmail.from,
            to: sampleEmail.to,
            subject: sampleEmail.subject,
            text: sampleEmail.text,
            html: sampleEmail.text,
            headers: {},
            attachments: []
          },
          conditionGroups: rule.conditionGroups
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to test rule');
      }

      const { matches } = await response.json();
      setMatches(matches);
    } catch (error) {
      console.error('Error testing rule:', error);
      setError(error instanceof Error ? error.message : 'Failed to test rule');
    } finally {
      setTesting(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setSampleEmail(prev => {
      if (field === 'from' || field === 'to') {
        return {
          ...prev,
          [field]: { text: value }
        };
      }
      return {
        ...prev,
        [field]: value
      };
    });
  };

  const handleAddAttachment = () => {
    setSampleEmail(prev => ({
      ...prev,
      attachments: [...prev.attachments, { filename: '' }]
    }));
  };

  const handleAttachmentChange = (index: number, filename: string) => {
    setSampleEmail(prev => ({
      ...prev,
      attachments: prev.attachments.map((att, i) => 
        i === index ? { ...att, filename } : att
      )
    }));
  };

  const handleRemoveAttachment = (index: number) => {
    setSampleEmail(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const handleAddHeader = () => {
    const headerName = prompt('Enter header name:');
    if (!headerName) return;
    
    const headerValue = prompt('Enter header value:');
    if (!headerValue) return;

    setSampleEmail(prev => ({
      ...prev,
      headers: {
        ...prev.headers,
        [headerName]: headerValue
      }
    }));
  };

  const handleRemoveHeader = (headerName: string) => {
    setSampleEmail(prev => {
      const newHeaders = { ...prev.headers };
      delete newHeaders[headerName];
      return {
        ...prev,
        headers: newHeaders
      };
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900">
            Test Rule: {rule.name}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="space-y-6">
            {/* Sample Email Form */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  From
                </label>
                <input
                  type="email"
                  value={sampleEmail.from.text}
                  onChange={e => handleInputChange('from', e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="sender@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  To
                </label>
                <input
                  type="email"
                  value={sampleEmail.to.text}
                  onChange={e => handleInputChange('to', e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="recipient@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject
              </label>
              <input
                type="text"
                value={sampleEmail.subject}
                onChange={e => handleInputChange('subject', e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="Email subject"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content
              </label>
              <textarea
                value={sampleEmail.text}
                onChange={e => handleInputChange('text', e.target.value)}
                rows={4}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="Email content"
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date
                </label>
                <input
                  type="datetime-local"
                  value={sampleEmail.date.slice(0, 16)}
                  onChange={e => handleInputChange('date', new Date(e.target.value).toISOString())}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Size (bytes)
                </label>
                <input
                  type="number"
                  value={sampleEmail.size}
                  onChange={e => handleInputChange('size', parseInt(e.target.value))}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  min="0"
                />
              </div>
            </div>

            {/* Attachments */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Attachments
                </label>
                <button
                  type="button"
                  onClick={handleAddAttachment}
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  Add Attachment
                </button>
              </div>
              <div className="space-y-2">
                {sampleEmail.attachments.map((att, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={att.filename}
                      onChange={e => handleAttachmentChange(index, e.target.value)}
                      className="block flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="Filename"
                    />
                    <button
                      onClick={() => handleRemoveAttachment(index)}
                      className="p-2 text-red-600 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Headers */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Headers
                </label>
                <button
                  type="button"
                  onClick={handleAddHeader}
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  Add Header
                </button>
              </div>
              <div className="space-y-2">
                {Object.entries(sampleEmail.headers).map(([name, value]) => (
                  <div key={name} className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">{name}: {value}</span>
                    <button
                      onClick={() => handleRemoveHeader(name)}
                      className="p-1 text-red-600 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Test Button */}
            <div className="flex justify-end">
              <button
                onClick={handleTest}
                disabled={isLoading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Testing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Test Rule
                  </>
                )}
              </button>
            </div>

            {/* Test Results */}
            {results && (
              <div className="mt-6 border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Test Results
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Rule Match:</span>
                    <span className={results.ruleMatches ? 'text-green-600' : 'text-red-600'}>
                      {results.ruleMatches ? 'Yes' : 'No'}
                    </span>
                  </div>

                  {results.groupResults.map((group, groupIndex) => (
                    <div key={groupIndex} className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium">
                          Group {groupIndex + 1} ({group.operator})
                        </span>
                        <span className={group.matches ? 'text-green-600' : 'text-red-600'}>
                          {group.matches ? 'Matches' : 'Does Not Match'}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {group.conditions.map((condition, condIndex) => (
                          <div key={condIndex} className="ml-4 text-sm">
                            <span className={condition.matches ? 'text-green-600' : 'text-red-600'}>
                              {condition.matches ? '✓' : '✗'}
                            </span>
                            {' '}
                            {condition.type} {condition.operator} "{condition.value}"
                            {condition.value2 && ` and "${condition.value2}"`}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 