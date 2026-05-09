export interface UserSettings {
  nickname: string | null;
  avatar: string | null;
  bio: string | null;
  memoryEnabled: boolean;
  transcriptAutoFallbackEnabled: boolean;
  timezone: string;
  interview: InterviewSettings;
  notification: NotificationSettings;
  reminder: ReminderSettings;
  dataManagement: DataManagementSettings;
}

export interface InterviewSettings {
  inquiryDepth?: "gentle" | "moderate" | "deep";
  guideEnabled?: boolean;
}

export interface NotificationSettings {
  emailEnabled?: boolean;
  systemEnabled?: boolean;
}

export interface ReminderSettings {
  dailyReminder?: {
    enabled: boolean;
    time?: string; // HH:mm
  };
  weeklyReminder?: {
    enabled: boolean;
    day?: number; // 0-6 (周日-周六)
    time?: string;
  };
  monthlyReview?: {
    enabled: boolean;
    day?: number; // 1-31
    time?: string; // HH:mm
  };
}

export interface DataManagementSettings {
  exportFormat?: "json" | "pdf";
}

export type SettingsModule =
  | "profile"
  | "interview"
  | "notification"
  | "reminder"
  | "data";
