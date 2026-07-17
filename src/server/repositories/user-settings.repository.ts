import { prisma } from "@/server/db/prisma";

export async function getUserMemorySettings(userId: string) {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { memoryEnabled: true }
  });

  return settings ?? { memoryEnabled: false };
}

export async function updateUserMemorySettings(userId: string, memoryEnabled: boolean) {
  return prisma.userSettings.upsert({
    where: { userId },
    update: { memoryEnabled },
    create: { userId, memoryEnabled },
    select: { memoryEnabled: true }
  });
}
