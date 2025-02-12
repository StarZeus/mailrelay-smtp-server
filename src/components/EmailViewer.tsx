'use client';

import { format } from 'date-fns';
import type { Email } from '@/lib/types';
import { Reply, Forward, MoreHorizontal, Trash2 } from 'lucide-react';

interface EmailViewerProps {
  email: Email | null;
}

export function EmailViewer({ email }: EmailViewerProps) {
  const handleDelete = async () => {
    if (!email) return;

    try {
      const response = await fetch('/api/emails/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailIds: [email.id],
          action: 'delete'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete email');
      }

      // Refresh the page
      window.location.reload();
    } catch (error) {
      console.error('Error deleting email:', error);
    }
  };

  if (!email) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 bg-gray-50">
        <p>Select an email to read</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Email actions toolbar */}
      <div className="flex items-center gap-2 px-6 py-3 border-b">
        <button className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">
          <Reply className="w-4 h-4 mr-1.5" />
          Reply
        </button>
        <button className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
          <Forward className="w-4 h-4 mr-1.5" />
          Forward
        </button>
        <div className="h-5 w-px bg-gray-300 mx-1" />
        <button 
          onClick={handleDelete}
          className="p-1.5 text-gray-700 hover:bg-red-100 rounded-md transition-colors"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <div className="flex-1" />
        <button className="p-1.5 text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Email content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="max-w-4xl">
          <h1 className="text-xl font-semibold text-gray-900 mb-4">
            {email.subject || '(No Subject)'}
          </h1>
          
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
              <span className="text-white font-medium text-sm">
                {email.from.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between mb-1">
                <h2 className="text-base font-medium text-gray-900 truncate">
                  {email.from}
                </h2>
                <span className="text-sm text-gray-500 ml-4">
                  {format(new Date(email.receivedAt), 'MMM d, yyyy h:mm a')}
                </span>
              </div>
              <p className="text-sm text-gray-600">
                To: {email.to}
              </p>
            </div>
          </div>

          <div className="prose max-w-none text-gray-800">
            {email.html ? (
              <div dangerouslySetInnerHTML={{ __html: email.html }} />
            ) : (
              <pre className="whitespace-pre-wrap font-sans">{email.text || '(No content)'}</pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 