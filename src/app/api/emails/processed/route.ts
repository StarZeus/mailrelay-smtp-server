import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const emails = await prisma.email.findMany({
      where: {
        processedByRules: true
      },
      include: {
        processedRules: {
          include: {
            rule: true
          }
        }
      },
      orderBy: {
        receivedAt: 'desc'
      }
    });

    // Filter out emails with no processed rules
    const emailsWithRules = emails.filter(email => email.processedRules.length > 0);

    console.log('Found processed emails:', emailsWithRules.length);
    return NextResponse.json(emailsWithRules);
  } catch (error) {
    console.error('Error fetching processed emails:', error);
    return NextResponse.json({ error: 'Failed to fetch processed emails' }, { status: 500 });
  }
} 