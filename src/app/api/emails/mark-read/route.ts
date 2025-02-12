import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { emailId } = await request.json();

    await prisma.email.update({
      where: { id: emailId },
      data: { isRead: true }
    });

    revalidatePath('/');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking email as read:', error);
    return NextResponse.json({ error: 'Failed to mark email as read' }, { status: 500 });
  }
} 