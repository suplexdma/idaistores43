import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { getAdminSession, requireAdmin } from "@/lib/admin-session";
import { connectToDatabase } from "@/lib/db";
import Post from "@/models/Post";
import TrashEntry from "@/models/TrashEntry";

const postSchema = z.object({
  title: z.string().trim().min(1).max(180),
  slug: z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  content: z.string().trim().min(1).max(100000),
  coverImage: z.object({ url: z.string().url(), publicId: z.string().optional() }).optional(),
  metaTitle: z.string().trim().max(180).optional(),
  metaDescription: z.string().trim().max(320).optional(),
  status: z.enum(["Draft", "Published"]),
});
type RouteContext = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  if (!(await requireAdmin(["SuperAdmin", "Manager"]))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  if (!isValidObjectId(params.id)) return NextResponse.json({ error: "Invalid post id." }, { status: 400 });
  try {
    await connectToDatabase();
    const post = await Post.findOne({ _id: params.id, deletedAt: null }).lean();
    return post ? NextResponse.json({ post }) : NextResponse.json({ error: "Post not found." }, { status: 404 });
  } catch (error) {
    console.error("Admin post lookup failed:", error);
    return NextResponse.json({ error: "Unable to load post." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  if (!(await requireAdmin(["SuperAdmin", "Manager"]))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  if (!isValidObjectId(params.id)) return NextResponse.json({ error: "Invalid post id." }, { status: 400 });
  let input: z.infer<typeof postSchema>;
  try {
    input = postSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? error.issues : "Invalid post." }, { status: 400 });
  }
  if (input.status === "Published" && !input.coverImage) {
    return NextResponse.json({ error: "Upload a cover image before publishing." }, { status: 400 });
  }
  try {
    await connectToDatabase();
    const current = await Post.findOne({ _id: params.id, deletedAt: null }).select("status publishedAt");
    if (!current) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    const post = await Post.findByIdAndUpdate(
      params.id,
      {
        $set: {
          ...input,
          publishedAt: input.status === "Published" ? current.publishedAt ?? new Date() : undefined,
        },
      },
      { new: true, runValidators: true },
    );
    return NextResponse.json({ id: post?._id.toString() });
  } catch (error) {
    if (isDuplicateKeyError(error)) return NextResponse.json({ error: "That post slug is already in use." }, { status: 409 });
    console.error("Admin post update failed:", error);
    return NextResponse.json({ error: "Unable to update post." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  if (!(await requireAdmin(["SuperAdmin", "Manager"]))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  if (!isValidObjectId(params.id)) return NextResponse.json({ error: "Invalid post id." }, { status: 400 });
  try {
    await connectToDatabase();
    const post = await Post.findOne({ _id: params.id, deletedAt: null });
    if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    const session = await getAdminSession();
    await TrashEntry.create({
      entityType: "post",
      originalId: post._id,
      title: post.title,
      payload: post.toObject(),
      deletedBy: session?.sub,
    });
    post.deletedAt = new Date();
    await post.save();
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Admin post delete failed:", error);
    return NextResponse.json({ error: "Unable to move post to Trash." }, { status: 500 });
  }
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}
