import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import User from "@/models/User";

const schema = z.object({ email: z.string().trim().email().max(254) });

export async function POST(request: NextRequest) {
  let email: string;
  try {
    const body = schema.parse(await request.json());
    email = body.email.toLowerCase();
  } catch {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const exists = Boolean(await User.exists({ email }));
    return NextResponse.json({ exists }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Customer account lookup failed:", error);
    return NextResponse.json({ error: "Unable to verify your account right now." }, { status: 500 });
  }
}
