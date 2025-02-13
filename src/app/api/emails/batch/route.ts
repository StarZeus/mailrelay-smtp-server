import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { emailIds, action } = await request.json();

    if (action === 'delete') {
      await prisma.email.deleteMany({
        where: {
          id: {
            in: emailIds
          }
        }
      });
    } else if (action === 'markUnread') {
      await prisma.email.updateMany({
        where: {
          id: {
            in: emailIds
          }
        },
        data: {
          isRead: false
        }
      });
    }

    revalidatePath('/');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error performing batch operation:', error);
    return NextResponse.json({ error: 'Failed to perform batch operation' }, { status: 500 });
  }
} 