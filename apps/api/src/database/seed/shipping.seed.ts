import type { PrismaClient } from '../../generated/prisma/client.js';

const M = 1_000_000;

/** Default shipping methods (fees in IRR). Idempotent by code. */
export async function seedShipping(prisma: PrismaClient): Promise<void> {
  const methods = [
    {
      code: 'post-standard',
      name: 'پست عادی',
      description: 'تحویل ۳ تا ۵ روز کاری',
      baseFee: 350_000,
      freeAboveAmount: 20 * M,
      estimatedDaysMin: 3,
      estimatedDaysMax: 5,
      sortOrder: 1,
    },
    {
      code: 'post-express',
      name: 'پست پیشتاز',
      description: 'تحویل ۱ تا ۳ روز کاری',
      baseFee: 600_000,
      freeAboveAmount: 50 * M,
      estimatedDaysMin: 1,
      estimatedDaysMax: 3,
      sortOrder: 2,
    },
    {
      code: 'courier-tehran',
      name: 'پیک تهران',
      description: 'تحویل همان روز در تهران',
      baseFee: 900_000,
      freeAboveAmount: null,
      estimatedDaysMin: 0,
      estimatedDaysMax: 1,
      sortOrder: 3,
    },
  ];
  for (const method of methods) {
    await prisma.shippingMethod.upsert({
      where: { code: method.code },
      update: { name: method.name, description: method.description, sortOrder: method.sortOrder },
      create: {
        ...method,
        baseFee: BigInt(method.baseFee),
        freeAboveAmount: method.freeAboveAmount === null ? null : BigInt(method.freeAboveAmount),
        isActive: true,
      },
    });
  }
}
