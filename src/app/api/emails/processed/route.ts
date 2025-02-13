import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // First get all EmailRuleProcessing records
    const processedEmails = await prisma.EmailRuleProcessing.findMany({
      include: {
        email: true,
        rule: true
      },
      orderBy: {
        processedAt: 'desc'
      }
    });

    // Group by email and transform the data
    const emailMap = new Map();
    processedEmails.forEach(record => {
      if (!emailMap.has(record.emailId)) {
        emailMap.set(record.emailId, {
          ...record.email,
          processedRules: []
        });
      }
      emailMap.get(record.emailId).processedRules.push({
        id: record.id,
        rule: record.rule,
        processedAt: record.processedAt,
        success: record.success,
        error: record.error
      });
    });

    const emails = Array.from(emailMap.values());

    // Sort emails by receivedAt in descending order
    emails.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());

    // Log some debug information
    console.log('Found processed emails:', emails.length);
    emails.forEach(email => {
      const ruleNames = email.processedRules
        .map(pr => pr.rule.name)
        .join(', ');
      console.log(`Email ${email.id} processed by ${email.processedRules.length} rules: ${ruleNames}`);
    });

    return NextResponse.json(emails);
  } catch (error) {
    console.error('Error fetching processed emails:', error);
    return NextResponse.json({ error: 'Failed to fetch processed emails' }, { status: 500 });
  }
} 