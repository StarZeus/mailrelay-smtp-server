import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function DELETE() {
  try {
    await prisma.email.deleteMany({});
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing emails:', error);
    return NextResponse.json({ error: 'Failed to clear emails' }, { status: 500 });
  }
} 