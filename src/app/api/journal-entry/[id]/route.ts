import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import {
  updateJournalEntryContentRequestSchema,
  updateJournalEntryRequestSchema,
  updateJournalEntryResponseSchema
} from "@/features/interview/schema/interview.schema";
import { updateJournalEntry, updateJournalEntryContent } from "@/server/repositories/interview.repository";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const parsed = updateJournalEntryRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_JOURNAL_ENTRY_REQUEST" }, { status: 400 });
  }

  try {
    const updated = await updateJournalEntry(id, parsed.data);

    return NextResponse.json(updateJournalEntryResponseSchema.parse(updated));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "JOURNAL_ENTRY_NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ error: "JOURNAL_ENTRY_UPDATE_FAILED" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const parsed = updateJournalEntryContentRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_JOURNAL_ENTRY_REQUEST" }, { status: 400 });
  }

  try {
    const updated = await updateJournalEntryContent(id, parsed.data);

    return NextResponse.json(updateJournalEntryResponseSchema.parse(updated));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "JOURNAL_ENTRY_NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ error: "JOURNAL_ENTRY_UPDATE_FAILED" }, { status: 500 });
  }
}
