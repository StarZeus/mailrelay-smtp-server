'use client';

import { EmailList } from '@/components/EmailList';
import { EmailViewer } from '@/components/EmailViewer';
import { RefreshButton } from '@/components/RefreshButton';
import { Logo } from '@/app/components/Logo';
import { Navigation } from '@/app/components/Navigation';
import type { Email } from '@/lib/types';
import { useEffect, useState, useCallback } from 'react';
import {
  Panel,
  PanelGroup,
  PanelResizeHandle
} from 'react-resizable-panels';
import { Search } from 'lucide-react';

async function getEmails(): Promise<Email[]> {
  const response = await fetch('/api/emails');
  if (!response.ok) {
    throw new Error('Failed to fetch emails');
  }
  return response.json();
}

const POLLING_INTERVAL = 3000; // Poll every 3 seconds

export const dynamic = 'force-dynamic';

export default function Home() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const unreadCount = emails.filter(email => !email.isRead).length;

  const fetchEmails = useCallback(async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) {
        setIsLoading(true);
      }
      const data = await getEmails();
      
      // Only update if there are changes
      setEmails(prevEmails => {
        if (prevEmails.length !== data.length || 
            JSON.stringify(prevEmails) !== JSON.stringify(data)) {
          return data;
        }
        return prevEmails;
      });
    } catch (error) {
      console.error('Error fetching emails:', error);
    } finally {
      if (isInitialLoad) {
        setIsLoading(false);
      }
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchEmails(true);
  }, [fetchEmails]);

  // Set up polling
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchEmails(false);
    }, POLLING_INTERVAL);

    return () => clearInterval(intervalId);
  }, [fetchEmails]);

  const handleSelectEmail = async (email: Email) => {
    if (!email.isRead) {
      try {
        await fetch('/api/emails/mark-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emailId: email.id }),
        });
        
        setEmails(emails.map(e => 
          e.id === email.id ? { ...e, isRead: true } : e
        ));
      } catch (error) {
        console.error('Error marking email as read:', error);
      }
    }
    setSelectedEmail(email);
  };

  // Update selected email when emails are updated
  useEffect(() => {
    if (selectedEmail) {
      const updatedEmail = emails.find(e => e.id === selectedEmail.id);
      if (updatedEmail && JSON.stringify(updatedEmail) !== JSON.stringify(selectedEmail)) {
        setSelectedEmail(updatedEmail);
      }
    }
  }, [emails, selectedEmail]);

  const filteredEmails = emails.filter(email => {
    const searchLower = searchQuery.toLowerCase();
    return (
      email.subject?.toLowerCase().includes(searchLower) ||
      email.from.toLowerCase().includes(searchLower) ||
      email.to.toLowerCase().includes(searchLower) ||
      email.text?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <main className="h-screen bg-gray-100">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="bg-white shadow-sm">
          <div className="max-w-[1920px] mx-auto px-4 py-3">
            <div className="flex items-center gap-4">
              <Logo />
              <div className="flex-1 max-w-xl">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search emails..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-1.5 text-sm bg-gray-100 border border-transparent rounded-md focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-colors"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <RefreshButton onClick={fetchEmails} />
                {unreadCount > 0 && (
                  <span className="text-sm font-medium text-blue-600">
                    {unreadCount} unread
                  </span>
                )}
              </div>
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

            {/* Email List Panel */}
            <Panel defaultSize={25} minSize={20}>
              <div className="h-full bg-white overflow-hidden border-r">
                {isLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : filteredEmails.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">
                      {searchQuery ? 'No emails match your search' : 'No emails yet'}
                    </p>
                    {!searchQuery && (
                      <p className="text-sm text-gray-400 mt-1">
                        Send an email to localhost:2525 to see it appear here
                      </p>
                    )}
                  </div>
                ) : (
                  <EmailList
                    emails={filteredEmails}
                    selectedEmailId={selectedEmail?.id ?? null}
                    onSelectEmail={handleSelectEmail}
                  />
                )}
              </div>
            </Panel>

            <PanelResizeHandle className="w-1 bg-gray-200 hover:bg-blue-500 transition-colors cursor-col-resize" />

            {/* Email Content Panel */}
            <Panel minSize={30}>
              <EmailViewer email={selectedEmail} />
            </Panel>
          </PanelGroup>
        </div>
      </div>
    </main>
  );
}
