import { useMemo, useEffect, useState } from "react";
import { Email } from "@/lib/types";
import { EmailCard } from "@/components/EmailCard";

const ProcessedEmailsAccordion = () => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEmails = async () => {
      try {
        const response = await fetch('/api/emails/processed');
        const data = await response.json();
        setEmails(data);
      } catch (error) {
        console.error('Error fetching processed emails:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmails();
  }, []);

  // Group emails by rule name
  const emailsByRule = useMemo(() => {
    return emails.reduce((acc: Record<string, Email[]>, email: Email) => {
      if (email.processedByRules && email.processedByRuleName) {
        const ruleName = email.processedByRuleName;
        if (!acc[ruleName]) {
          acc[ruleName] = [];
        }
        acc[ruleName].push(email);
      }
      return acc;
    }, {});
  }, [emails]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (Object.keys(emailsByRule).length === 0) {
    return <div className="text-muted-foreground">No emails have been processed by rules yet.</div>;
  }

  return (
    <div className="w-full space-y-2">
      {Object.entries(emailsByRule).map(([ruleName, ruleEmails]) => (
        <div key={ruleName} className="border rounded-lg p-4">
          <div className="flex items-center justify-between w-full mb-2">
            <h3 className="font-medium">{ruleName}</h3>
            <span className="bg-secondary text-secondary-foreground px-2 py-1 rounded text-sm">
              {ruleEmails.length}
            </span>
          </div>
          <div className="space-y-2">
            {ruleEmails.map((email: Email) => (
              <EmailCard key={email.id} email={email} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ProcessedEmailsAccordion; 