'use client';

import { format } from 'date-fns';
import type { Email } from '@/lib/types';
import clsx from 'clsx';
import { Trash2, Mail } from 'lucide-react';
import { useState } from 'react';

interface EmailListProps {
  emails: Email[];
  selectedEmailId: number | null;
  onSelectEmail: (email: Email) => void;
}

export function EmailList({ emails, selectedEmailId, onSelectEmail }: EmailListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const handleCheckboxClick = (e: React.MouseEvent, emailId: number) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(emailId)) {
        newSet.delete(emailId);
      } else {
        newSet.add(emailId);
      }
      return newSet;
    });
  };

  const handleBatchAction = async (action: 'delete' | 'markUnread') => {
    if (selectedIds.size === 0) return;

    try {
      const response = await fetch('/api/emails/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailIds: Array.from(selectedIds),
          action
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to perform batch action');
      }

      // Clear selection
      setSelectedIds(new Set());
      // Refresh the page
      window.location.reload();
    } catch (error) {
      console.error('Error performing batch action:', error);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-10 bg-white border-b px-4 py-2 flex items-center gap-2 shadow-sm">
          <span className="text-sm text-gray-600">
            {selectedIds.size} selected
          </span>
          <div className="h-4 w-px bg-gray-300 mx-2" />
          <button
            onClick={() => handleBatchAction('delete')}
            className="p-2 text-gray-700 hover:bg-red-100 rounded-md transition-colors"
            title="Delete selected"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleBatchAction('markUnread')}
            className="p-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            title="Mark as unread"
          >
            <Mail className="w-4 h-4" />
          </button>
        </div>
      )}
      <div className="flex-1 overflow-auto">
        {emails.map((email) => (
          <div
            key={email.id}
            className={clsx(
              'relative flex items-start px-4 py-2.5 border-b border-gray-100 hover:bg-blue-50/50 transition-colors group',
              selectedEmailId === email.id && 'bg-blue-100/50',
              !email.isRead && 'bg-blue-50/30'
            )}
            onMouseEnter={() => setHoveredId(email.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedIds.has(email.id)}
                onChange={(e) => e.stopPropagation()}
                onClick={(e) => handleCheckboxClick(e, email.id)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => onSelectEmail(email)}
              className="flex-1 text-left focus:outline-none px-3"
            >
              <div className="flex justify-between items-baseline mb-1">
                <h3 className={clsx(
                  'text-sm',
                  !email.isRead && 'font-semibold text-gray-900',
                  email.isRead && 'text-gray-600'
                )}>
                  {email.from}
                </h3>
                <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                  {format(new Date(email.receivedAt), 'MMM d, h:mm a')}
                </span>
              </div>
              <h4 className={clsx(
                'text-sm mb-0.5',
                !email.isRead && 'font-semibold text-gray-800',
                email.isRead && 'text-gray-700'
              )}>
                {email.subject || '(No Subject)'}
              </h4>
              <p className="text-sm text-gray-500 truncate leading-snug">
                {email.text?.slice(0, 100) || '(No content)'}
              </p>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
} 