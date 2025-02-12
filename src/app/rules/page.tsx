'use client';

import { useState, useEffect } from 'react';
import type { EmailRule, RuleActionType } from '@/lib/types';
import { Plus, Trash2, Edit2, Check, X, Play, ArrowLeft } from 'lucide-react';
import { RuleForm } from '@/components/RuleForm';
import { RuleTestModal } from '@/components/RuleTestModal';
import { Logo } from '@/app/components/Logo';
import { Navigation } from '@/app/components/Navigation';
import dynamic from 'next/dynamic';
import {
  Panel,
  PanelGroup,
  PanelResizeHandle
} from 'react-resizable-panels';
import clsx from 'clsx';

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
};`;

export default function RulesPage() {
  const [rules, setRules] = useState<EmailRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<EmailRule | null>(null);
  const [selectedRule, setSelectedRule] = useState<EmailRule | null>(null);
  const [testingRule, setTestingRule] = useState<EmailRule | null>(null);
  const [showJavaScriptPane, setShowJavaScriptPane] = useState(false);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const response = await fetch('/api/rules');
      const contentType = response.headers.get('content-type');
      
      if (!response.ok) {
        const errorData = contentType?.includes('application/json') 
          ? await response.json()
          : { error: 'Unknown error occurred' };
        throw new Error(errorData.error || 'Failed to fetch rules');
      }

      if (!contentType?.includes('application/json')) {
        throw new Error('Invalid response type from server');
      }

      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error('Invalid data format received');
      }

      setRules(data);
    } catch (error) {
      console.error('Error fetching rules:', error);
      setRules([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleRule = async (rule: EmailRule) => {
    try {
      const response = await fetch('/api/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...rule,
          isActive: !rule.isActive
        })
      });

      if (!response.ok) throw new Error('Failed to update rule');
      await fetchRules();
    } catch (error) {
      console.error('Error toggling rule:', error);
    }
  };

  const handleDeleteRule = async (ruleId: number) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      const response = await fetch('/api/rules', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ruleId })
      });

      if (!response.ok) throw new Error('Failed to delete rule');
      await fetchRules();
      if (selectedRule?.id === ruleId) {
        setSelectedRule(null);
      }
    } catch (error) {
      console.error('Error deleting rule:', error);
    }
  };

  const handleEditRule = (rule: EmailRule) => {
    setEditingRule(rule);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingRule(null);
  };

  const handleFormSubmit = async () => {
    await fetchRules();
    handleFormClose();
  };

  const handleTestRule = (rule: EmailRule) => {
    setTestingRule(rule);
  };

  const handleActionTypeChange = (type: RuleActionType) => {
    setShowJavaScriptPane(type === 'javascript');
  };

  const renderRuleDetails = () => {
    if (isFormOpen) {
      if (showJavaScriptPane) {
        return (
          <PanelGroup direction="vertical">
            <Panel>
              <div className="h-full overflow-auto">
                <RuleForm
                  rule={editingRule}
                  onClose={handleFormClose}
                  onSubmit={handleFormSubmit}
                  onActionTypeChange={handleActionTypeChange}
                  showInPanel={true}
                />
              </div>
            </Panel>
            <PanelResizeHandle className="h-1 bg-gray-200 hover:bg-blue-500 transition-colors cursor-row-resize" />
            <Panel defaultSize={40}>
              <div className="h-full bg-gray-50 p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">JavaScript Preview</h3>
                <div className="h-full border rounded-md overflow-hidden bg-white">
                  <CodeMirror
                    value={defaultJavaScriptCode}
                    height="100%"
                    theme="light"
                    readOnly
                  />
                </div>
              </div>
            </Panel>
          </PanelGroup>
        );
      }

      return (
        <div className="h-full overflow-auto">
          <RuleForm
            rule={editingRule}
            onClose={handleFormClose}
            onSubmit={handleFormSubmit}
            onActionTypeChange={handleActionTypeChange}
            showInPanel={true}
          />
        </div>
      );
    }

    if (!selectedRule) {
      return (
        <div className="h-full flex items-center justify-center text-gray-500 bg-gray-50">
          <p>Select a rule to view details</p>
        </div>
      );
    }

    return (
      <div className="h-full overflow-auto p-6">
        <div className="max-w-4xl space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {selectedRule.name}
              </h2>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    selectedRule.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {selectedRule.isActive ? 'Active' : 'Inactive'}
                </span>
                <span className="text-sm text-gray-500">
                  Created {new Date(selectedRule.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleTestRule(selectedRule)}
                className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-100 rounded-md"
                title="Test Rule"
              >
                <Play className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleToggleRule(selectedRule)}
                className={`p-2 rounded-md ${
                  selectedRule.isActive
                    ? 'text-green-600 hover:bg-green-100'
                    : 'text-gray-400 hover:bg-gray-100'
                }`}
                title={selectedRule.isActive ? 'Deactivate' : 'Activate'}
              >
                {selectedRule.isActive ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <X className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={() => handleEditRule(selectedRule)}
                className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-md"
                title="Edit"
              >
                <Edit2 className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleDeleteRule(selectedRule.id)}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-100 rounded-md"
                title="Delete"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <section>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Conditions</h3>
              <div className="space-y-2">
                {selectedRule.conditionGroups.map((group, groupIndex) => (
                  <div key={groupIndex} className="bg-gray-50 p-3 rounded-md">
                    <div className="text-sm text-gray-600 mb-2">
                      Group {groupIndex + 1} ({group.operator})
                    </div>
                    <div className="space-y-1">
                      {group.conditions.map((condition, condIndex) => (
                        <div key={condIndex} className="text-sm text-gray-700">
                          {condition.type} {condition.operator} "{condition.value}"
                          {condition.value2 && ` and "${condition.value2}"`}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Action</h3>
              <div className="bg-gray-50 p-3 rounded-md">
                <div className="text-sm text-gray-700">
                  {selectedRule.action.type === 'forward' && (
                    <>Forward to {selectedRule.action.config.forwardTo}</>
                  )}
                  {selectedRule.action.type === 'webhook' && (
                    <>Send to webhook {selectedRule.action.config.webhookUrl}</>
                  )}
                  {selectedRule.action.type === 'kafka' && (
                    <>Send to Kafka topic {selectedRule.action.config.kafkaTopic}</>
                  )}
                  {selectedRule.action.type === 'javascript' && (
                    <div className="space-y-2">
                      <div>Execute JavaScript code:</div>
                      <div className="border rounded-md overflow-hidden">
                        <CodeMirror
                          value={selectedRule.action.config.code || ''}
                          height="200px"
                          readOnly
                          theme="light"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="h-screen bg-gray-100">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="bg-white shadow-sm">
          <div className="max-w-[1920px] mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <Logo />
              <button
                onClick={() => {
                  setIsFormOpen(true);
                  setEditingRule(null);
                  setSelectedRule(null);
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Rule
              </button>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-hidden">
          <PanelGroup direction="horizontal">
            {/* Navigation Panel */}
            <Panel defaultSize={15} minSize={10}>
              <Navigation />
            </Panel>

            <PanelResizeHandle className="w-1 bg-gray-200 hover:bg-blue-500 transition-colors cursor-col-resize" />

            {/* Rules List Panel */}
            <Panel defaultSize={25} minSize={20}>
              <div className="h-full bg-white overflow-hidden border-r">
                {isLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : rules.length === 0 ? (
                  <div className="text-center py-12">
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No rules yet</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Get started by creating a new rule
                    </p>
                    <div className="mt-6">
                      <button
                        onClick={() => setIsFormOpen(true)}
                        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        New Rule
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {rules.map((rule) => (
                      <button
                        key={rule.id}
                        onClick={() => setSelectedRule(rule)}
                        className={clsx(
                          'w-full px-4 py-3 text-left hover:bg-gray-50 focus:outline-none',
                          selectedRule?.id === rule.id && 'bg-blue-50'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-medium text-gray-900">
                              {rule.name}
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                              {rule.conditionGroups.length} condition group(s)
                            </p>
                          </div>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              rule.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {rule.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Panel>

            <PanelResizeHandle className="w-1 bg-gray-200 hover:bg-blue-500 transition-colors cursor-col-resize" />

            {/* Rule Details/Form Panel */}
            <Panel minSize={30}>
              {renderRuleDetails()}
            </Panel>
          </PanelGroup>
        </div>
      </div>

      {testingRule && (
        <RuleTestModal
          rule={testingRule}
          onClose={() => setTestingRule(null)}
        />
      )}
    </main>
  );
} 