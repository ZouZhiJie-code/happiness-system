import { prisma } from "@/server/db/prisma";

const DEMO_USER_ID = "local-demo-user";

async function ensureDemoUser(database: any) {
  await database.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {},
    create: {
      id: DEMO_USER_ID
    }
  });
}

export interface UserSettingsData {
  nickname?: string | null;
  avatar?: string | null;
  bio?: string | null;
  memoryEnabled: boolean;
  transcriptAutoFallbackEnabled: boolean;
  timezone: string;
  interview: Record<string, unknown>;
  notification: Record<string, unknown>;
  reminder: Record<string, unknown>;
  dataManagement: Record<string, unknown>;
}

export async function getUserSettings(): Promise<UserSettingsData | null> {
  const database = prisma as any;
  await ensureDemoUser(database);

  const settings = await database.userSettings.findUnique({
    where: { userId: DEMO_USER_ID }
  });

  if (!settings) {
    return null;
  }

  return {
    nickname: settings.nickname,
    avatar: settings.avatar,
    bio: settings.bio,
    memoryEnabled: settings.memoryEnabled,
    transcriptAutoFallbackEnabled: settings.transcriptAutoFallbackEnabled,
    timezone: settings.timezone,
    interview: (settings.interview as Record<string, unknown>) ?? {},
    notification: (settings.notification as Record<string, unknown>) ?? {},
    reminder: (settings.reminder as Record<string, unknown>) ?? {},
    dataManagement: (settings.dataManagement as Record<string, unknown>) ?? {}
  };
}

export async function upsertUserSettings(data: Partial<UserSettingsData>): Promise<UserSettingsData> {
  const database = prisma as any;
  await ensureDemoUser(database);

  const settings = await database.userSettings.upsert({
    where: { userId: DEMO_USER_ID },
    update: {
      ...(data.nickname !== undefined && { nickname: data.nickname }),
      ...(data.avatar !== undefined && { avatar: data.avatar }),
      ...(data.bio !== undefined && { bio: data.bio }),
      ...(data.memoryEnabled !== undefined && { memoryEnabled: data.memoryEnabled }),
      ...(data.transcriptAutoFallbackEnabled !== undefined && { transcriptAutoFallbackEnabled: data.transcriptAutoFallbackEnabled }),
      ...(data.timezone !== undefined && { timezone: data.timezone }),
      ...(data.interview !== undefined && { interview: data.interview }),
      ...(data.notification !== undefined && { notification: data.notification }),
      ...(data.reminder !== undefined && { reminder: data.reminder }),
      ...(data.dataManagement !== undefined && { dataManagement: data.dataManagement })
    },
    create: {
      userId: DEMO_USER_ID,
      nickname: data.nickname ?? null,
      avatar: data.avatar ?? null,
      bio: data.bio ?? null,
      memoryEnabled: data.memoryEnabled ?? false,
      transcriptAutoFallbackEnabled: data.transcriptAutoFallbackEnabled ?? true,
      timezone: data.timezone ?? "Asia/Shanghai",
      interview: data.interview ?? {},
      notification: data.notification ?? {},
      reminder: data.reminder ?? {},
      dataManagement: data.dataManagement ?? {}
    }
  });

  return {
    nickname: settings.nickname,
    avatar: settings.avatar,
    bio: settings.bio,
    memoryEnabled: settings.memoryEnabled,
    transcriptAutoFallbackEnabled: settings.transcriptAutoFallbackEnabled,
    timezone: settings.timezone,
    interview: (settings.interview as Record<string, unknown>) ?? {},
    notification: (settings.notification as Record<string, unknown>) ?? {},
    reminder: (settings.reminder as Record<string, unknown>) ?? {},
    dataManagement: (settings.dataManagement as Record<string, unknown>) ?? {}
  };
}
