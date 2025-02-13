import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// Initialize Prisma Client
let prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  // In development, prevent multiple instances of Prisma Client
  if (!(global as any).prisma) {
    (global as any).prisma = new PrismaClient();
  }
  prisma = (global as any).prisma;
}

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Test database connection
    await prisma.$connect();
    
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
    
    // Determine if it's a database connection error
    const isConnectionError = error instanceof Error && 
      error.message.toLowerCase().includes('connect');
    
    const statusCode = isConnectionError ? 503 : 500;
    const errorMessage = isConnectionError 
      ? 'Database connection failed' 
      : 'Failed to fetch processed emails';

    return NextResponse.json(
      {
        error: errorMessage,
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      {
        status: statusCode,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } finally {
    // Disconnect in development to prevent connection issues
    if (process.env.NODE_ENV !== 'production') {
      await prisma.$disconnect();
    }
  }
} 