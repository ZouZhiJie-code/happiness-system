import { z } from "zod";
import { NextResponse } from "next/server";

import {
  getAllProfiles,
  addProfileFact,
  updateProfileFact,
  deleteProfileFact,
  ProfileError
} from "@/server/services/memory/profile.service";

// ─── Schemas ─────────────────────────────────────────────────────────────

const addProfileSchema = z.object({
  dimension: z.enum(["joy", "fulfillment", "reflection", "improvement", "gratitude"] as const),
  summary: z.string().min(2, "摘要至少 2 字").max(500, "摘要不超过 500 字"),
  topicTags: z.array(z.string().min(1).max(30)).max(10)
});

const updateProfileSchema = z.object({
  id: z.string().min(1),
  summary: z.string().min(2).max(500),
  topicTags: z.array(z.string().min(1).max(30)).max(10)
});

const deleteProfileSchema = z.object({
  id: z.string().min(1)
});

// ─── Handlers ────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const result = await getAllProfiles();
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "PROFILE_QUERY_FAILED" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = addProfileSchema.safeParse(await request.json());
    if (!body.success) {
      return NextResponse.json({ error: "INVALID_PROFILE_INPUT", details: body.error.flatten() }, { status: 400 });
    }

    const created = await addProfileFact(body.data);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof ProfileError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    return NextResponse.json({ error: "PROFILE_CREATE_FAILED" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = updateProfileSchema.safeParse(await request.json());
    if (!body.success) {
      return NextResponse.json({ error: "INVALID_PROFILE_INPUT", details: body.error.flatten() }, { status: 400 });
    }

    const updated = await updateProfileFact(body.data);
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ProfileError) {
      const status = error.code === "MEMORY_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: error.code }, { status });
    }
    return NextResponse.json({ error: "PROFILE_UPDATE_FAILED" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const body = deleteProfileSchema.safeParse({ id: searchParams.get("id") });
    if (!body.success) {
      return NextResponse.json({ error: "INVALID_PROFILE_INPUT" }, { status: 400 });
    }

    await deleteProfileFact(body.data.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProfileError) {
      const status = error.code === "MEMORY_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: error.code }, { status });
    }
    return NextResponse.json({ error: "PROFILE_DELETE_FAILED" }, { status: 500 });
  }
}
