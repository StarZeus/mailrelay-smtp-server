import { ChevronDown, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';
import { useState } from 'react';
import type { Email } from '@/lib/types';
import { format } from 'date-fns';

interface ProcessedEmailsAccordionProps {
  emails: Email[];
  onSelectEmail: (email: Email) => void;
  selectedEmailId: number | null;
}

interface ProcessedRule {
  id: number;
  rule: {
    id: number;
    name: string;
  };
  processedAt: string;
  success: boolean;
  error?: string | null;
}

interface EmailWithProcessing extends Email {
  processedRules: ProcessedRule[];
}

export default function ProcessedEmailsAccordion({ 
  emails, 
  onSelectEmail,
  selectedEmailId 
}: ProcessedEmailsAccordionProps) {
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());

  // Group emails by rule name, allowing emails to appear under multiple rules
  const emailsByRule = emails.reduce<Record<string, EmailWithProcessing[]>>((acc, email) => {
    const emailWithProcessing = email as EmailWithProcessing;
    
    // For each rule that processed this email, add the email to that rule's group
    emailWithProcessing.processedRules.forEach(processedRule => {
      const ruleName = processedRule.rule.name;
      if (!acc[ruleName]) {
        acc[ruleName] = [];
      }
      // Add the email to this rule's group
      acc[ruleName].push(emailWithProcessing);
    });
    
    return acc;
  }, {});

  const toggleRule = (ruleName: string) => {
    const newExpanded = new Set(expandedRules);
    if (newExpanded.has(ruleName)) {
      newExpanded.delete(ruleName);
    } else {
      newExpanded.add(ruleName);
    }
    setExpandedRules(newExpanded);
  };

  // If no processed emails with rules, show a message
  if (Object.keys(emailsByRule).length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No emails have been processed by rules yet</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200">
      {Object.entries(emailsByRule).map(([ruleName, ruleEmails]) => (
        <div key={ruleName} className="bg-white">
          <button
            onClick={() => toggleRule(ruleName)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 focus:outline-none"
          >
            <div className="flex items-center">
              {expandedRules.has(ruleName) ? (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400" />
              )}
              <span className="ml-2 font-medium text-gray-900">{ruleName}</span>
              <span className="ml-2 px-2.5 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                {ruleEmails.length}
              </span>
            </div>
          </button>

          {expandedRules.has(ruleName) && (
            <div className="bg-gray-50">
              {ruleEmails.map((email) => {
                // Find the specific rule processing record for this rule
                const ruleProcessing = email.processedRules.find(
                  pr => pr.rule.name === ruleName
                );

                return (
                  <button
                    key={`${email.id}-${ruleName}`}
                    onClick={() => onSelectEmail(email)}
                    className={`w-full px-4 py-3 flex flex-col text-left hover:bg-gray-100 focus:outline-none ${
                      selectedEmailId === email.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">
                        {email.subject || '(No Subject)'}
                      </span>
                      <span className="text-sm text-gray-500">
                        {format(new Date(email.receivedAt), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center text-sm text-gray-500">
                      <span className="truncate">{email.from}</span>
                      <span className="mx-1">→</span>
                      <span className="truncate">{email.to}</span>
                    </div>
                    {ruleProcessing && (
                      <div className="mt-2">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            ruleProcessing.success
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                          title={ruleProcessing.error || undefined}
                        >
                          {ruleProcessing.success ? (
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                          ) : (
                            <XCircle className="w-3 h-3 mr-1" />
                          )}
                          {format(new Date(ruleProcessing.processedAt), 'h:mm a')}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
} 