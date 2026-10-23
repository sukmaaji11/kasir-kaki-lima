import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/prisma';

export async function getOwnerContext() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect('/');
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.user.id,
      role: 'OWNER',
      isActive: true,
      business: {
        isActive: true,
      },
    },
    select: {
      business: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!membership) {
    redirect('/');
  }

  return {
    user: session.user,
    business: membership.business,
  };
}
