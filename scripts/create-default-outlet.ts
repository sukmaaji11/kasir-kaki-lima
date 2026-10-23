import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const business = await prisma.business.findUnique({
    where: { slug: 'warung-test' },
    select: {
      id: true,
      name: true,
      outlets: {
        select: {
          id: true,
          name: true,
          code: true,
          isActive: true,
        },
      },
    },
  });

  if (!business) {
    throw new Error(
      'Bisnis "warung-test" tidak ditemukan. Tidak ada data yang diubah.',
    );
  }

  const activeOutlet = business.outlets.find((outlet) => outlet.isActive);

  if (activeOutlet) {
    console.log('Outlet aktif sudah tersedia:', activeOutlet);
    return;
  }

  const existingOutlet = business.outlets.find(
    (outlet) => outlet.name === 'Outlet Utama' || outlet.code === 'UTAMA',
  );

  if (existingOutlet) {
    const restored = await prisma.outlet.update({
      where: { id: existingOutlet.id },
      data: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        isActive: true,
      },
    });

    console.log('Outlet yang sudah ada diaktifkan:', restored);
    return;
  }

  const outlet = await prisma.outlet.create({
    data: {
      businessId: business.id,
      name: 'Outlet Utama',
      code: 'UTAMA',
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      code: true,
      isActive: true,
    },
  });

  console.log('Outlet berhasil dibuat:', outlet);
}

main()
  .catch((error) => {
    console.error('Gagal menyiapkan outlet:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
