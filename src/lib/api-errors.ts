import { NextResponse } from "next/server";
import { z } from "zod";

export function validationErrorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: error.issues }, { status: 400 });
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Invalid request body." },
    { status: 400 },
  );
}

export function isDuplicateKeyError(
  error: unknown,
): error is { code: number; keyPattern?: Record<string, unknown> } {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}
