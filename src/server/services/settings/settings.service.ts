import {
  getUserSettings,
  upsertUserSettings,
  type UserSettingsData
} from "@/server/repositories/settings.repository";

export type SettingsErrorCode =
  | "SETTINGS_NOT_FOUND"
  | "SETTINGS_SAVE_FAILED"
  | "INVALID_SETTINGS_DATA";

export class SettingsError extends Error {
  constructor(
    public readonly code: SettingsErrorCode,
    message: string = code,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "SettingsError";
  }
}

export async function fetchUserSettings(): Promise<UserSettingsData> {
  try {
    const settings = await getUserSettings();

    if (!settings) {
      // 返回默认设置
      return {
        nickname: null,
        avatar: null,
        bio: null,
        memoryEnabled: false,
        transcriptAutoFallbackEnabled: true,
        timezone: "Asia/Shanghai",
        interview: {},
        notification: {},
        reminder: {},
        dataManagement: {}
      };
    }

    return settings;
  } catch (error) {
    throw new SettingsError("SETTINGS_NOT_FOUND", "Failed to fetch settings.", error);
  }
}

export async function saveUserSettings(data: Partial<UserSettingsData>): Promise<UserSettingsData> {
  try {
    return await upsertUserSettings(data);
  } catch (error) {
    throw new SettingsError("SETTINGS_SAVE_FAILED", "Failed to save settings.", error);
  }
}
