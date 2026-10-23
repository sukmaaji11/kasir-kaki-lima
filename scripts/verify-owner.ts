import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const user = await prisma.user.findUnique({
    where: { username: "ownertest" },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      isActive: true,
      memberships: {
        select: {
          role: true,
          isActive: true,
          business: {
            select: { name: true, slug: true },
          },
        },
      },
    },
  });

  console.dir(user, { depth: null });
}

main().finally(() => prisma.$disconnect());
