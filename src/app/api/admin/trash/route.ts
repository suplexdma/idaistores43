import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-session";
import { connectToDatabase } from "@/lib/db";
import AdminNoteTask from "@/models/AdminNoteTask";
import Order from "@/models/Order";
import Post from "@/models/Post";
import Product from "@/models/Product";
import TrashEntry from "@/models/TrashEntry";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("restore"), id: z.string().regex(/^[a-f\d]{24}$/i) }),
  z.object({ action: z.literal("permanentlyDelete"), id: z.string().regex(/^[a-f\d]{24}$/i) }),
  z.object({ action: z.literal("all") }),
]);

const collections = {
  product: Product.collection,
  order: Order.collection,
  post: Post.collection,
  note: AdminNoteTask.collection,
  task: AdminNoteTask.collection,
};
const entityTypeSchema = z.enum(["product", "order", "post", "note", "task"]);

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  try {
    await connectToDatabase();
    const items = await TrashEntry.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json({
      items: items.map((item) => ({
        id: item._id.toString(),
        entityType: item.entityType,
        originalId: item.originalId.toString(),
        title: item.title,
        deletedAt: item.createdAt,
      })),
    });
  } catch (error) {
    console.error("Trash listing failed:", error);
    return NextResponse.json({ error: "Unable to load Trash." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(["SuperAdmin"]))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  let input: z.infer<typeof actionSchema>;
  try {
    input = actionSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? error.issues : "Invalid Trash action." }, { status: 400 });
  }
  try {
    await connectToDatabase();
    if (input.action === "all") {
      const entries = await TrashEntry.find().lean();
      for (const entry of entries) {
        const entityType = entityTypeSchema.parse(entry.entityType);
        await collections[entityType].deleteOne({ _id: entry.originalId });
      }
      const result = await TrashEntry.deleteMany({});
      return NextResponse.json({ deletedCount: result.deletedCount });
    }

    if (!isValidObjectId(input.id)) {
      return NextResponse.json({ error: "Invalid Trash item id." }, { status: 400 });
    }
    const entry = await TrashEntry.findById(input.id).lean();
    if (!entry) return NextResponse.json({ error: "Trash item not found." }, { status: 404 });
    const entityType = entityTypeSchema.parse(entry.entityType);

    if (input.action === "permanentlyDelete") {
      await collections[entityType].deleteOne({ _id: entry.originalId });
      await TrashEntry.deleteOne({ _id: entry._id });
      return NextResponse.json({ deleted: true });
    }

    const restored: Record<string, unknown> = {
      ...(entry.payload as Record<string, unknown>),
      _id: entry.originalId,
    };
    delete restored.deletedAt;
    await collections[entityType].replaceOne(
      { _id: entry.originalId },
      restored,
      { upsert: true },
    );
    await TrashEntry.deleteOne({ _id: entry._id });
    return NextResponse.json({ restored: true });
  } catch (error) {
    console.error("Trash action failed:", error);
    return NextResponse.json({ error: "Unable to complete the Trash action." }, { status: 500 });
  }
}
