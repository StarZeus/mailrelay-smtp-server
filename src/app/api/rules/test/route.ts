export const dynamic = 'force-dynamic';

import { evaluateConditionGroup } from '@/lib/rule-evaluator';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, conditionGroups } = await request.json();
    
    if (!Array.isArray(conditionGroups)) {
      throw new Error('conditionGroups must be an array');
    }

    // Test if any condition group matches
    const result = conditionGroups.some((group) => 
      evaluateConditionGroup(group, { ...email, receivedAt: new Date() })
    );

    return NextResponse.json({ matches: result });
  } catch (error) {
    console.error('Error testing rule:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to test rule' }, 
      { status: 500 }
    );
  }
} 