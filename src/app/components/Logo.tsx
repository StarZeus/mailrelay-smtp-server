import { Mail } from 'lucide-react';

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
        <Mail className="w-5 h-5 text-white" />
      </div>
      <div className="flex flex-col">
        <span className="text-lg font-semibold text-gray-900 leading-none">MailRelay</span>
        <span className="text-xs text-gray-500">SMTP Server</span>
      </div>
    </div>
  );
} 