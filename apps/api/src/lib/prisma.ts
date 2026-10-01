import { PrismaClient as PrismaClientLocal } from '@prisma/client-local';
import { PrismaClient as PrismaClientCloud } from '@prisma/client-cloud';

const isCloud = process.env.RUNTIME_MODE === 'cloud';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientLocal | undefined;
};

export const prisma: PrismaClientLocal =
  globalForPrisma.prisma ??
  ((isCloud ? new PrismaClientCloud() : new PrismaClientLocal()) as unknown as PrismaClientLocal);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export const isCloudMode = isCloud;
