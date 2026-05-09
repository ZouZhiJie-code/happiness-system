import { z } from "zod";
import { NextResponse } from "next/server";

import {
  fetchUserSettings,
  saveUserSettings,
  SettingsError
} from "@/server/services/settings/settings.service";

// ─── Schemas ─────────────────────────────────────────────────────────────

const updateSettingsSchema = z.object({
  nickname: z.string().max(50).nullable().optional(),
  avatar: z.string().url().nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  memoryEnabled: z.boolean().optional(),
  transcriptAutoFallbackEnabled: z.boolean().optional(),
  timezone: z.string().optional(),
  interview: z.record(z.unknown()).optional(),
  notification: z.record(z.unknown()).optional(),
  reminder: z.record(z.unknown()).optional(),
  dataManagement: z.record(z.unknown()).optional()
});

// ─── Handlers ────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const settings = await fetchUserSettings();
    return NextResponse.json(settings);
  } catch (error) {
    if (error instanceof SettingsError) {
      return NextResponse.json({ error: error.code }, { status: 500 });
    }
    return NextResponse.json({ error: "SETTINGS_FETCH_FAILED" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = updateSettingsSchema.safeParse(await request.json());

    if (!body.success) {
      return NextResponse.json(
        { error: "INVALID_SETTINGS_DATA", details: body.error.flatten() },
        { status: 400 }
      );
    }

    const settings = await saveUserSettings(body.data);
    return NextResponse.json(settings);
  } catch (error) {
    if (error instanceof SettingsError) {
      return NextResponse.json({ error: error.code }, { status: 500 });
    }
    return NextResponse.json({ error: "SETTINGS_SAVE_FAILED" }, { status: 500 });
  }
}
