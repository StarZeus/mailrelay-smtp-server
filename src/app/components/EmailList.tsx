import React, { useState } from 'react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import type { Email } from '@/lib/types';

interface EmailListProps {
  emails: Email[];
  selectedEmailId: number | null;
  onSelectEmail: (email: Email) => void;
}

export function EmailList({ emails, selectedEmailId, onSelectEmail }: EmailListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const handleCheckboxClick = (e: React.MouseEvent<HTMLInputElement>, emailId: number) => {
    e.stopPropagation();
    const newSelectedIds = new Set(selectedIds);
    if (newSelectedIds.has(emailId)) {
      newSelectedIds.delete(emailId);
    } else {
      newSelectedIds.add(emailId);
    }
    setSelectedIds(newSelectedIds);
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-10 bg-white border-b px-4 py-2 flex items-center gap-2 shadow-sm">
          <span className="text-sm text-gray-600">
            {selectedIds.size} selected
          </span>
        </div>
      )}
      <div className="flex-1 overflow-auto">
        {emails.map((email) => (
          <div
            key={email.id}
            className={clsx(
              'relative flex items-start px-4 py-2.5 border-b border-gray-100 hover:bg-blue-50/50 transition-colors group',
              selectedEmailId === email.id && 'bg-blue-100/50',
              !email.isRead && 'bg-blue-50'
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
                  !email.isRead && 'font-bold text-indigo-700'
                )}>
                  {email.from}
                </h3>
                <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                  {format(new Date(email.receivedAt), 'MMM d, h:mm a')}
                </span>
              </div>
              <h4 className={clsx(
                'text-sm mb-0.5',
                !email.isRead ? 'font-bold text-indigo-700' : 'text-gray-700'
              )}>
                {email.subject || '(No Subject)'}
              </h4>
              <p className={clsx(
                'text-sm truncate leading-snug',
                !email.isRead ? 'text-indigo-600' : 'text-gray-500'
              )}>
                {email.text?.slice(0, 100) || '(No content)'}
              </p>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
} 