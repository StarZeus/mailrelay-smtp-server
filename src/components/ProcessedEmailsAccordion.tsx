import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { Email } from '@/lib/types';

interface ProcessedEmailsAccordionProps {
  emails: Email[];
  onSelectEmail: (email: Email) => void;
  selectedEmailId: number | null;
}

export default function ProcessedEmailsAccordion({ 
  emails, 
  onSelectEmail,
  selectedEmailId 
}: ProcessedEmailsAccordionProps) {
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());

  // Group emails by rule name, only including processed emails with valid rules
  const emailsByRule = emails.reduce<Record<string, Email[]>>((acc, email) => {
    // Only include emails that have been processed by rules and have a rule name
    if (!email.processedByRules || !email.processedByRuleName) return acc;
    
    if (!acc[email.processedByRuleName]) {
      acc[email.processedByRuleName] = [];
    }
    acc[email.processedByRuleName].push(email);
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
              {ruleEmails.map((email) => (
                <button
                  key={email.id}
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
                      {new Date(email.receivedAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center text-sm text-gray-500">
                    <span className="truncate">{email.from}</span>
                    <span className="mx-1">→</span>
                    <span className="truncate">{email.to}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
} 