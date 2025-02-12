'use client';

import { useState, useEffect } from 'react';
import type { EmailRule, RuleConditionType, RuleActionType } from '@/lib/types';
import { Plus, Trash2, Edit2, Check, X, Play, ArrowLeft } from 'lucide-react';
import { RuleForm } from '@/components/RuleForm';
import { RuleTestModal } from '@/components/RuleTestModal';
import Link from 'next/link';

export default function RulesPage() {
  const [rules, setRules] = useState<EmailRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<EmailRule | null>(null);
  const [testingRule, setTestingRule] = useState<EmailRule | null>(null);

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
        
        console.error('Failed to fetch rules:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        
        throw new Error(errorData.error || 'Failed to fetch rules');
      }

      if (!contentType?.includes('application/json')) {
        console.error('Invalid response type:', contentType);
        throw new Error('Invalid response type from server');
      }

      const data = await response.json();
      
      if (!Array.isArray(data)) {
        console.error('Invalid data format:', data);
        throw new Error('Invalid data format received');
      }

      setRules(data);
    } catch (error) {
      console.error('Error fetching rules:', error);
      setRules([]); // Set empty array on error
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

  return (
    <main className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="inline-flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5 mr-1" />
              Back to Inbox
            </Link>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Email Rules</h1>
              <p className="mt-1 text-sm text-gray-500">
                Create and manage rules to automatically process incoming emails
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsFormOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Rule
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
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
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {rules.map((rule) => (
                <li key={rule.id} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {rule.name}
                        </h3>
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
                      <div className="mt-2 flex flex-col gap-1">
                        <p className="text-sm text-gray-500">
                          Conditions:{' '}
                          {rule.conditionGroups.map((group, groupIndex) => (
                            <span key={groupIndex}>
                              {groupIndex > 0 && ' OR '}
                              ({group.conditions
                                .map(
                                  (c) =>
                                    `${c.type} ${c.operator} "${c.value}${c.value2 ? ` and "${c.value2}"` : ''}"`)
                                .join(` ${group.operator} `)})
                            </span>
                          ))}
                        </p>
                        <p className="text-sm text-gray-500">
                          Action: {rule.action.type}{' '}
                          {rule.action.type === 'forward'
                            ? `to ${rule.action.config.forwardTo}`
                            : rule.action.type === 'webhook'
                            ? `to ${rule.action.config.webhookUrl}`
                            : `to ${rule.action.config.kafkaTopic}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleTestRule(rule)}
                        className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-100 rounded-md"
                        title="Test Rule"
                      >
                        <Play className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleToggleRule(rule)}
                        className={`p-1 rounded-md ${
                          rule.isActive
                            ? 'text-green-600 hover:bg-green-100'
                            : 'text-gray-400 hover:bg-gray-100'
                        }`}
                        title={rule.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {rule.isActive ? (
                          <Check className="w-5 h-5" />
                        ) : (
                          <X className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleEditRule(rule)}
                        className="p-1 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-md"
                        title="Edit"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-100 rounded-md"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {isFormOpen && (
        <RuleForm
          rule={editingRule}
          onClose={handleFormClose}
          onSubmit={handleFormSubmit}
        />
      )}

      {testingRule && (
        <RuleTestModal
          rule={testingRule}
          onClose={() => setTestingRule(null)}
        />
      )}
    </main>
  );
} 