import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import AdminUser from "@/models/AdminUser";

const registerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
  bootstrapSecret: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const bootstrapSecret = process.env.ADMIN_BOOTSTRAP_SECRET;
  if (!bootstrapSecret) {
    return NextResponse.json(
      { error: "Admin registration is not configured." },
      { status: 503 },
    );
  }

  let input: z.infer<typeof registerSchema>;
  try {
    input = registerSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof z.ZodError ? error.issues : "Invalid request body." },
      { status: 400 },
    );
  }

  if (input.bootstrapSecret !== bootstrapSecret) {
    return NextResponse.json({ error: "Invalid setup credentials." }, { status: 403 });
  }

  try {
    const mongoose = await connectToDatabase();
    const database = mongoose.connection.db;
    if (!database) {
      throw new Error("MongoDB connection is not initialized.");
    }

    const claimId = randomUUID();
    const setupLocks = database.collection<{
      _id: string;
      claimId: string;
      createdAt: Date;
      completedAt?: Date;
    }>("admin_setup_locks");
    try {
      await setupLocks.insertOne({
        _id: "initial-admin-registration",
        claimId,
        createdAt: new Date(),
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return NextResponse.json(
          { error: "Initial admin registration is already complete or in progress." },
          { status: 409 },
        );
      }
      throw error;
    }

    let registrationCompleted = false;
    try {
      if ((await AdminUser.countDocuments()) > 0) {
        return NextResponse.json(
          { error: "Initial admin registration is already complete." },
          { status: 409 },
        );
      }

      const passwordHash = await bcrypt.hash(input.password, 12);
      await AdminUser.create({
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash,
        role: "SuperAdmin",
        accessLevel: "Full Access",
      });
      await setupLocks.updateOne(
        { _id: "initial-admin-registration", claimId },
        { $set: { completedAt: new Date() } },
      );
      registrationCompleted = true;
      return NextResponse.json(
        { message: "Initial admin account created." },
        { status: 201 },
      );
    } finally {
      if (!registrationCompleted) {
        await setupLocks.deleteOne({
          _id: "initial-admin-registration",
          claimId,
        });
      }
    }
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return NextResponse.json(
        { error: "An admin account with that email already exists." },
        { status: 409 },
      );
    }
    console.error("Admin registration failed:", error);
    return NextResponse.json({ error: "Unable to register admin." }, { status: 500 });
  }
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}
