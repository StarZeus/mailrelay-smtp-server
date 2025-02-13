import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const emails = await prisma.email.findMany({
      where: {
        processedByRules: true,
        processedByRuleName: {
          not: null
        }
      },
      orderBy: {
        receivedAt: 'desc'
      }
    });

    console.log('Found processed emails:', emails.length);
    return NextResponse.json(emails);
  } catch (error) {
    console.error('Error fetching processed emails:', error);
    return NextResponse.json({ error: 'Failed to fetch processed emails' }, { status: 500 });
  }
} 