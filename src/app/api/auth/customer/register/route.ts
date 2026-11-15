import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import User from "@/models/User";

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9\s()-]{6,19}$/, "Enter a valid phone number."),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters.")
    .max(128)
    .regex(/[a-z]/, "Include a lowercase letter.")
    .regex(/[A-Z]/, "Include an uppercase letter.")
    .regex(/[0-9]/, "Include a number."),
});

export async function POST(request: NextRequest) {
  let input: z.infer<typeof registerSchema>;
  try {
    input = registerSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof z.ZodError ? error.issues : "Invalid request body." },
      { status: 400 },
    );
  }

  try {
    await connectToDatabase();
    const normalizedEmail = input.email.toLowerCase();
    if (await User.exists({ $or: [{ email: normalizedEmail }, { phone: input.phone }] })) {
      return NextResponse.json(
        { error: "An account with that email or phone number already exists." },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await User.create({
      name: input.name,
      email: normalizedEmail,
      phone: input.phone,
      passwordHash,
    });

    return NextResponse.json(
      {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return NextResponse.json(
        { error: "An account with that email or phone number already exists." },
        { status: 409 },
      );
    }
    console.error("Customer registration failed:", error);
    return NextResponse.json({ error: "Unable to create account." }, { status: 500 });
  }
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}
