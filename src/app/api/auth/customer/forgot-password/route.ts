import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomInt } from "node:crypto";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { assertMailConfigured, sendPasswordResetCode } from "@/lib/mail";
import PasswordResetToken from "@/models/PasswordResetToken";
import User from "@/models/User";

const emailSchema = z.object({ email: z.string().trim().email().max(254) });
const EXPIRES_IN_MS = 10 * 60 * 1000;
const COOLDOWN_MS = 5 * 60 * 1000;

function hashCode(code: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must be set to at least 32 characters.");
  return createHmac("sha256", secret).update(code).digest("hex");
}

export async function POST(request: NextRequest) {
  let email: string;
  try {
    email = emailSchema.parse(await request.json()).email.toLowerCase();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof z.ZodError ? error.issues : "Invalid request body." },
      { status: 400 },
    );
  }

  try {
    if (process.env.NODE_ENV === "production") assertMailConfigured();
    await connectToDatabase();
    const user = await User.findOne({ email }).select("_id email");
    if (user) {
      const activeReset = await PasswordResetToken.findOne({ userId: user._id }).select("cooldownUntil");
      if (!activeReset?.cooldownUntil || activeReset.cooldownUntil <= new Date()) {
        const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
        await PasswordResetToken.findOneAndUpdate(
          { userId: user._id },
          {
            $set: {
              codeHash: hashCode(code),
              expiresAt: new Date(Date.now() + EXPIRES_IN_MS),
              attempts: 0,
            },
            $unset: { tokenHash: 1, cooldownUntil: 1 },
            $setOnInsert: { userId: user._id },
          },
          { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
        );
        if (process.env.NODE_ENV !== "production") {
          console.log("RESET CODE: ", code);
        }
        const smtpConfigured = Boolean(
          process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER &&
          process.env.SMTP_PASSWORD && process.env.SMTP_FROM,
        );
        if (smtpConfigured) {
          try {
            await sendPasswordResetCode(email, code);
          } catch (error) {
            if (process.env.NODE_ENV === "production") throw error;
            console.error("Password reset email delivery failed; use the development reset code printed above.", error);
          }
        } else if (process.env.NODE_ENV === "production") {
          throw new Error("SMTP settings are required to send password reset codes.");
        }
      }
    }

    return NextResponse.json({
      message: "If an account exists for that email, a reset code has been sent.",
      cooldownMinutes: COOLDOWN_MS / 60_000,
    });
  } catch (error) {
    console.error("Password reset code request failed:", error);
    return NextResponse.json(
      { error: "Password reset email is temporarily unavailable. Please try again later." },
      { status: 503 },
    );
  }
}
