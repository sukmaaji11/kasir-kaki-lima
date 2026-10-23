import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { auth } from '../src/lib/auth/auth';
import { prisma } from '../src/lib/prisma';

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    const name = 'Owner Test';
    const username = 'ownertest';
    const email = 'owner.test@example.com';
    const businessName = 'Warung Test';
    const businessSlug = 'warung-test';

    const password = await rl.question(
      'Password Owner test (min. 8 karakter): ',
    );

    if (password.length < 8) {
      throw new Error('Password minimal 8 karakter.');
    }

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
      select: { id: true },
    });

    const existingBusiness = await prisma.business.findUnique({
      where: { slug: businessSlug },
      select: { id: true },
    });

    if (existingUser || existingBusiness) {
      throw new Error(
        'Username/email atau bisnis sudah ada. Tidak ada data yang dibuat; periksa database terlebih dahulu.',
      );
    }

    // Buat user dan credential melalui Better Auth.
    const result = await auth.api.signUpEmail({
      body: { name, email, password, username },
    });

    if (!result.user?.id) {
      throw new Error('Better Auth tidak mengembalikan user ID.');
    }

    const userId = result.user.id;

    try {
      await prisma.$transaction(async (tx) => {
        const business = await tx.business.create({
          data: {
            name: businessName,
            slug: businessSlug,
            isActive: true,
          },
          select: { id: true },
        });

        await tx.membership.create({
          data: {
            userId,
            businessId: business.id,
            role: 'OWNER',
            isActive: true,
          },
        });
      });
    } catch (error) {
      console.error(
        `Bisnis/membership gagal dibuat. User sudah tercipta dengan ID: ${userId}. Jangan jalankan ulang sebelum memeriksa database.`,
      );
      throw error;
    }

    console.log('\nAkun Owner berhasil dibuat.');
    console.log({ name, username, email, businessName, businessSlug });
    console.log('Password tidak ditampilkan.');
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Pembuatan akun gagal:', error);
  process.exitCode = 1;
});
