import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import {
  updateJoyEntryRequestSchema,
  updateJoyEntryResponseSchema
} from "@/features/joy-interview/schema/joy-interview.schema";
import { updateJoyEntry } from "@/server/repositories/joy-interview.repository";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const parsed = updateJoyEntryRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_JOY_ENTRY_REQUEST" }, { status: 400 });
  }

  try {
    const updated = await updateJoyEntry(id, parsed.data);

    return NextResponse.json(updateJoyEntryResponseSchema.parse(updated));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "JOY_ENTRY_NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ error: "JOY_ENTRY_UPDATE_FAILED" }, { status: 500 });
  }
}
