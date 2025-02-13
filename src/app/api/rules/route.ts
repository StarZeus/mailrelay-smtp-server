import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import type { EmailRule } from '@/lib/types';

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

// Get all rules
export async function GET() {
  try {
    // Test database connection
    await prisma.$connect();
    
    // Log the connection status
    console.log('Database connection established');
    
    const rules = await prisma.emailRule.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log('Found rules:', rules.length);

    // Transform the rules to match our frontend type
    const transformedRules = rules.map((rule: { id: number; name: string; isActive: boolean; conditions: any; action: any; createdAt: Date }) => {
      try {
        // Ensure conditions is an array
        const conditions = rule.conditions || [];
        if (!Array.isArray(conditions)) {
          console.warn(`Invalid conditions format for rule ${rule.id}:`, rule.conditions);
          return {
            id: rule.id,
            name: rule.name,
            isActive: rule.isActive,
            conditionGroups: [],
            action: rule.action,
            createdAt: rule.createdAt
          };
        }

        return {
          ...rule,
          conditionGroups: conditions,
          conditions: undefined
        };
      } catch (transformError) {
        console.error('Error transforming rule:', rule.id, transformError);
        // Return a minimal valid rule object if transformation fails
        return {
          id: rule.id,
          name: rule.name,
          isActive: rule.isActive,
          conditionGroups: [],
          action: rule.action,
          createdAt: rule.createdAt
        };
      }
    });

    return new NextResponse(
      JSON.stringify(transformedRules),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in GET /api/rules:', error);
    
    // Determine if it's a database connection error
    const isConnectionError = error instanceof Error && 
      error.message.toLowerCase().includes('connect');
    
    const statusCode = isConnectionError ? 503 : 500;
    const errorMessage = isConnectionError 
      ? 'Database connection failed' 
      : 'Failed to fetch rules';

    return new NextResponse(
      JSON.stringify({
        error: errorMessage,
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
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

// Create a new rule
export async function POST(request: Request) {
  try {
    const data = await request.json();
    console.log('Creating rule with data:', data); // Debug log

    // Ensure conditionGroups is an array
    if (!Array.isArray(data.conditionGroups)) {
      throw new Error('conditionGroups must be an array');
    }

    const rule = await prisma.emailRule.create({
      data: {
        name: data.name,
        isActive: data.isActive ?? true,
        conditions: data.conditionGroups || [], // Store conditionGroups as conditions
        action: data.action || { type: 'forward', config: {} }
      }
    });

    console.log('Created rule:', rule); // Debug log

    // Transform the response
    const transformedRule = {
      ...rule,
      conditionGroups: rule.conditions || [],
      conditions: undefined
    };

    return new NextResponse(
      JSON.stringify(transformedRule),
      {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error creating rule:', error);
    
    // Return a more detailed error response
    return new NextResponse(
      JSON.stringify({
        error: 'Failed to create rule',
        details: error instanceof Error ? error.message : 'Unknown error',
        data: error // Include the full error for debugging
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

// Update a rule
export async function PUT(request: Request) {
  try {
    const data = await request.json();
    const rule = await prisma.emailRule.update({
      where: { id: data.id },
      data: {
        name: data.name,
        isActive: data.isActive,
        conditions: data.conditionGroups,
        action: data.action
      }
    });

    const transformedRule = {
      ...rule,
      conditionGroups: rule.conditions,
      conditions: undefined
    };

    return NextResponse.json(transformedRule);
  } catch (error) {
    console.error('Error updating rule:', error);
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 });
  }
}

// Delete a rule
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    await prisma.emailRule.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting rule:', error);
    return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 });
  }
} 