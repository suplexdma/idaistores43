import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-session";
import { connectToDatabase } from "@/lib/db";
import Post from "@/models/Post";

const postSchema = z.object({
  title: z.string().trim().min(1).max(180),
  slug: z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  content: z.string().trim().min(1).max(100000),
  coverImage: z.object({ url: z.string().url(), publicId: z.string().optional() }).optional(),
  metaTitle: z.string().trim().max(180).optional(),
  metaDescription: z.string().trim().max(320).optional(),
  status: z.enum(["Draft", "Published"]),
});

export async function GET() {
  if (!(await requireAdmin(["SuperAdmin", "Manager"]))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  try {
    await connectToDatabase();
    const posts = await Post.find({ deletedAt: null }).sort({ updatedAt: -1 }).select("-content").lean();
    return NextResponse.json({ posts });
  } catch (error) {
    console.error("Admin posts listing failed:", error);
    return NextResponse.json({ error: "Unable to load posts." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(["SuperAdmin", "Manager"]))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
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
    const post = await Post.create({
      ...input,
      publishedAt: input.status === "Published" ? new Date() : undefined,
    });
    return NextResponse.json({ id: post._id.toString() }, { status: 201 });
  } catch (error) {
    if (isDuplicateKeyError(error)) return NextResponse.json({ error: "That post slug is already in use." }, { status: 409 });
    console.error("Admin post creation failed:", error);
    return NextResponse.json({ error: "Unable to create post." }, { status: 500 });
  }
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}
