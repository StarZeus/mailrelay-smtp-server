import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { evaluateCondition, evaluateConditionGroup } from '@/lib/smtp-server';
import type { EmailRule, RuleCondition, RuleConditionGroup } from '@/lib/types';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { ruleId, sampleEmail } = await request.json();

    if (!ruleId || !sampleEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Fetch the rule
    const rule = await prisma.emailRule.findUnique({
      where: { id: ruleId }
    });

    if (!rule) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      );
    }

    // Test the rule against the sample email
    const ruleMatches = rule.conditionGroups.some((group: RuleConditionGroup) => 
      evaluateConditionGroup(group, sampleEmail)
    );

    // Return detailed results
    const results = {
      ruleMatches,
      groupResults: rule.conditionGroups.map((group: RuleConditionGroup) => ({
        operator: group.operator,
        matches: evaluateConditionGroup(group, sampleEmail),
        conditions: group.conditions.map((condition: RuleCondition) => ({
          type: condition.type,
          operator: condition.operator,
          value: condition.value,
          value2: condition.value2,
          matches: evaluateCondition(condition, sampleEmail)
        }))
      }))
    };

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error testing rule:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 