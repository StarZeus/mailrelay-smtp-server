'use server';

import { evaluateCondition, evaluateConditionGroup } from '@/lib/smtp-server';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { email, conditions } = await request.json();
    
    const result = conditions.some((group: any) => 
      evaluateConditionGroup(group, { ...email, receivedAt: new Date() })
    );

    return NextResponse.json({ matches: result });
  } catch (error) {
    console.error('Error testing rule:', error);
    return NextResponse.json({ error: 'Failed to test rule' }, { status: 500 });
  }
} 