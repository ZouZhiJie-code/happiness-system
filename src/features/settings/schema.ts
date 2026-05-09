import { z } from "zod";

export const profileFormSchema = z.object({
  nickname: z.string().max(50, "昵称不超过50字").nullable(),
  avatar: z.string().url("请输入有效的图片URL").nullable(),
  bio: z.string().max(500, "简介不超过500字").nullable()
});

export const interviewSettingsSchema = z.object({
  memoryEnabled: z.boolean(),
  transcriptAutoFallbackEnabled: z.boolean(),
  inquiryDepth: z.enum(["gentle", "moderate", "deep"]).optional(),
  guideEnabled: z.boolean().optional()
});

export const notificationSettingsSchema = z.object({
  emailEnabled: z.boolean().optional(),
  systemEnabled: z.boolean().optional()
});

export const reminderSettingsSchema = z.object({
  dailyReminder: z
    .object({
      enabled: z.boolean(),
      time: z.string().optional()
    })
    .optional(),
  weeklyReminder: z
    .object({
      enabled: z.boolean(),
      day: z.number().min(0).max(6).optional(),
      time: z.string().optional()
    })
    .optional(),
  monthlyReview: z
    .object({
      enabled: z.boolean(),
      day: z.number().min(1).max(31).optional(),
      time: z.string().optional()
    })
    .optional()
});

export const dataManagementSchema = z.object({
  exportFormat: z.enum(["json", "pdf"]).optional()
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
export type InterviewSettingsValues = z.infer<typeof interviewSettingsSchema>;
export type NotificationSettingsValues = z.infer<typeof notificationSettingsSchema>;
export type ReminderSettingsValues = z.infer<typeof reminderSettingsSchema>;
export type DataManagementValues = z.infer<typeof dataManagementSchema>;
