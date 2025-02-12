import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const emails = await prisma.email.findMany({
      where: {
        // Add a condition to find emails that have been processed by rules
        // This will be updated when we implement rule processing
        processedByRules: true
      },
      orderBy: {
        receivedAt: 'desc'
      }
    });

    return NextResponse.json(emails);
  } catch (error) {
    console.error('Error fetching processed emails:', error);
    return NextResponse.json(
      { error: 'Failed to fetch processed emails' }, 
      { status: 500 }
    );
  }
} 