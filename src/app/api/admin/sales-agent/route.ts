import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-session";
import { connectToDatabase } from "@/lib/db";
import AIConversation from "@/models/AIConversation";

const deleteSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("all") }),
  z.object({ action: z.literal("session"), id: z.string().regex(/^[a-f\d]{24}$/i) }),
  z.object({
    action: z.literal("message"),
    id: z.string().regex(/^[a-f\d]{24}$/i),
    index: z.number().int().min(0),
  }),
]);

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  try {
    await connectToDatabase();
    const sessions = await AIConversation.find()
      .select("sessionId userId messages createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .lean();
    return NextResponse.json({
      sessions: sessions.map((session) => ({
        id: session._id.toString(),
        sessionId: session.sessionId,
        userId: session.userId?.toString() ?? "",
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messages: session.messages.map((message: { role: string; content: string; createdAt?: Date | null }, index: number) => ({
          index,
          role: message.role,
          content: message.content,
          createdAt: message.createdAt ?? session.updatedAt,
        })),
      })),
    });
  } catch (error) {
    console.error("AI conversation listing failed:", error);
    return NextResponse.json({ error: "Unable to load AI conversations." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAdmin(["SuperAdmin"]))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let input: z.infer<typeof deleteSchema>;
  try {
    input = deleteSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof z.ZodError ? error.issues : "Invalid delete request." },
      { status: 400 },
    );
  }

  try {
    await connectToDatabase();
    if (input.action === "all") {
      const result = await AIConversation.deleteMany({});
      return NextResponse.json({ deletedCount: result.deletedCount });
    }

    if (!isValidObjectId(input.id)) {
      return NextResponse.json({ error: "Invalid conversation id." }, { status: 400 });
    }
    if (input.action === "session") {
      const result = await AIConversation.deleteOne({ _id: input.id });
      if (result.deletedCount !== 1) {
        return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
      }
      return NextResponse.json({ deleted: true });
    }

    const conversation = await AIConversation.findById(input.id);
    if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    if (input.index >= conversation.messages.length) {
      return NextResponse.json({ error: "Message not found." }, { status: 404 });
    }
    conversation.messages.splice(input.index, 1);
    await conversation.save();
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("AI conversation deletion failed:", error);
    return NextResponse.json({ error: "Unable to delete AI conversation data." }, { status: 500 });
  }
}
