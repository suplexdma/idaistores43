import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import PasswordResetToken from "@/models/PasswordResetToken";
import User from "@/models/User";

const resetSchema = z.object({
  email: z.string().trim().email().max(254),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit reset code."),
  password: z.string().min(12).max(128)
    .regex(/[a-z]/, "Include a lowercase letter.")
    .regex(/[A-Z]/, "Include an uppercase letter.")
    .regex(/[0-9]/, "Include a number."),
});
const COOLDOWN_MS = 5 * 60 * 1000;

function hashCode(code: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must be set to at least 32 characters.");
  return createHmac("sha256", secret).update(code).digest("hex");
}

export async function POST(request: NextRequest) {
  let input: z.infer<typeof resetSchema>;
  try {
    input = resetSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof z.ZodError ? error.issues : "Invalid request body." },
      { status: 400 },
    );
  }

  try {
    await connectToDatabase();
    const user = await User.findOne({ email: input.email.toLowerCase() }).select("_id");
    const now = new Date();
    const record = user
      ? await PasswordResetToken.findOne({ userId: user._id }).select("+codeHash attempts cooldownUntil expiresAt")
      : null;
    if (!user || !record || !record.codeHash || record.expiresAt <= now) {
      return NextResponse.json({ error: "This reset code is invalid or has expired." }, { status: 400 });
    }

    if (record.cooldownUntil && record.cooldownUntil > now) {
      return NextResponse.json(
        { error: "Too many incorrect attempts. Please wait 5 minutes before trying again." },
        { status: 429 },
      );
    }
    if (record.cooldownUntil && record.cooldownUntil <= now) {
      record.attempts = 0;
      record.cooldownUntil = undefined;
    }

    const candidateHash = hashCode(input.code);
    const matches =
      candidateHash.length === record.codeHash.length &&
      timingSafeEqual(Buffer.from(candidateHash), Buffer.from(record.codeHash));
    if (!matches) {
      const attempts = (record.attempts ?? 0) + 1;
      record.attempts = attempts >= 3 ? 3 : attempts;
      if (attempts >= 3) record.cooldownUntil = new Date(now.getTime() + COOLDOWN_MS);
      await record.save();
      return NextResponse.json(
        {
          error: attempts >= 3
            ? "Too many incorrect attempts. Please wait 5 minutes before trying again."
            : `Incorrect reset code. ${3 - attempts} attempt${3 - attempts === 1 ? "" : "s"} remaining.`,
        },
        { status: attempts >= 3 ? 429 : 400 },
      );
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const consumed = await PasswordResetToken.findOneAndDelete({
      _id: record._id,
      codeHash: record.codeHash,
      expiresAt: { $gt: now },
      $or: [{ cooldownUntil: null }, { cooldownUntil: { $lte: now } }],
    }).select("+codeHash");
    if (!consumed) {
      return NextResponse.json({ error: "This reset code is invalid or has expired." }, { status: 400 });
    }

    const userUpdate = await User.updateOne({ _id: user._id }, { $set: { passwordHash } });
    if (userUpdate.matchedCount !== 1) {
      return NextResponse.json({ error: "Customer account not found." }, { status: 404 });
    }
    return NextResponse.json({ message: "Password reset successful. You can now sign in." });
  } catch (error) {
    console.error("Password reset failed:", error);
    return NextResponse.json({ error: "Unable to reset password." }, { status: 500 });
  }
}
