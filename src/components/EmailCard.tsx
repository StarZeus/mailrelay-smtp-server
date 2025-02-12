import { format } from 'date-fns';
import type { Email } from '@/lib/types';

interface EmailCardProps {
  email: Email;
}

export function EmailCard({ email }: EmailCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-4">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-xl font-semibold mb-2">{email.subject || '(No Subject)'}</h2>
          <p className="text-gray-600 mb-1">From: {email.from}</p>
          <p className="text-gray-600 mb-2">To: {email.to}</p>
        </div>
        <span className="text-sm text-gray-500">
          {format(new Date(email.receivedAt), 'MMM d, yyyy h:mm a')}
        </span>
      </div>
      
      <div className="border-t pt-4">
        {email.html ? (
          <div dangerouslySetInnerHTML={{ __html: email.html }} className="prose max-w-none" />
        ) : (
          <pre className="whitespace-pre-wrap text-gray-700">{email.text || '(No Content)'}</pre>
        )}
      </div>
    </div>
  );
} 