import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { requireAdmin, getAdminSession } from "@/lib/admin-session";
import { connectToDatabase } from "@/lib/db";
import AdminNoteTask from "@/models/AdminNoteTask";
import AdminUser from "@/models/AdminUser";
import TrashEntry from "@/models/TrashEntry";

const recordSchema = z.object({
  kind: z.enum(["note", "task"]),
  title: z.string().trim().min(1).max(180),
  content: z.string().trim().max(10000).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  completed: z.boolean().optional(),
  assignee: z.string().regex(/^[a-f\d]{24}$/i).nullable().optional(),
  favorite: z.boolean().optional(),
  pinned: z.boolean().optional(),
});

export async function GET() {
  if (!(await requireAdmin(["SuperAdmin", "Manager"]))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    await connectToDatabase();
    const [records, staff] = await Promise.all([
      AdminNoteTask.find({ deletedAt: null })
        .populate("assignee", "name email")
        .sort({ pinned: -1, favorite: -1, updatedAt: -1 })
        .lean(),
      AdminUser.find().select("name email").sort({ name: 1, email: 1 }).lean(),
    ]);
    return NextResponse.json({
      records: records.map((record) => ({
        ...record,
        id: record._id.toString(),
        dueDate: record.dueDate?.toISOString() ?? null,
        assignee: record.assignee && typeof record.assignee === "object" && "_id" in record.assignee
          ? {
              id: String(record.assignee._id),
              name: ("name" in record.assignee && typeof record.assignee.name === "string" && record.assignee.name) || ("email" in record.assignee ? String(record.assignee.email) : ""),
            }
          : null,
      })),
      staff: staff.map((member) => ({
        id: member._id.toString(),
        name: member.name || member.email,
      })),
    });
  } catch (error) {
    console.error("Notes and tasks listing failed:", error);
    return NextResponse.json({ error: "Unable to load notes and tasks." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(["SuperAdmin", "Manager"]))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  let input: z.infer<typeof recordSchema>;
  try {
    input = recordSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? error.issues : "Invalid record." }, { status: 400 });
  }
  try {
    await connectToDatabase();
    if (input.assignee && !isValidObjectId(input.assignee)) {
      return NextResponse.json({ error: "Invalid task assignee." }, { status: 400 });
    }
    if (input.assignee && !(await AdminUser.exists({ _id: input.assignee }))) {
      return NextResponse.json({ error: "Task assignee not found." }, { status: 400 });
    }
    const record = await AdminNoteTask.create({
      ...input,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      assignee: input.assignee || undefined,
      completed: input.kind === "task" ? input.completed ?? false : false,
    });
    return NextResponse.json({ id: record._id.toString() }, { status: 201 });
  } catch (error) {
    console.error("Notes/tasks creation failed:", error);
    return NextResponse.json({ error: "Unable to create the note or task." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin(["SuperAdmin", "Manager"]))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id || !isValidObjectId(id)) return NextResponse.json({ error: "Invalid record id." }, { status: 400 });

  let input: Partial<z.infer<typeof recordSchema>>;
  try {
    input = recordSchema.partial().parse(await request.json());
    if (Object.keys(input).length === 0) return NextResponse.json({ error: "No changes provided." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? error.issues : "Invalid update." }, { status: 400 });
  }
  try {
    await connectToDatabase();
    if (input.assignee && !(await AdminUser.exists({ _id: input.assignee }))) {
      return NextResponse.json({ error: "Task assignee not found." }, { status: 400 });
    }
    const update: Record<string, unknown> = { ...input };
    if (input.dueDate !== undefined) update.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    if (input.assignee !== undefined) update.assignee = input.assignee || null;
    const record = await AdminNoteTask.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: update },
      { new: true, runValidators: true },
    );
    if (!record) return NextResponse.json({ error: "Record not found." }, { status: 404 });
    return NextResponse.json({ saved: true });
  } catch (error) {
    console.error("Notes/tasks update failed:", error);
    return NextResponse.json({ error: "Unable to update the note or task." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAdmin(["SuperAdmin", "Manager"]))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id || !isValidObjectId(id)) return NextResponse.json({ error: "Invalid record id." }, { status: 400 });

  try {
    await connectToDatabase();
    const record = await AdminNoteTask.findOne({ _id: id, deletedAt: null });
    if (!record) return NextResponse.json({ error: "Record not found." }, { status: 404 });
    const session = await getAdminSession();
    const snapshot = record.toObject();
    await TrashEntry.create({
      entityType: record.kind,
      originalId: record._id,
      title: record.title,
      payload: snapshot,
      deletedBy: session?.sub,
    });
    record.deletedAt = new Date();
    await record.save();
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Notes/tasks delete failed:", error);
    return NextResponse.json({ error: "Unable to move the note or task to Trash." }, { status: 500 });
  }
}
