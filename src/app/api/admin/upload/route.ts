import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { uploadImage } from "@/lib/cloudinary";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(["SuperAdmin", "Manager"]);
  if (!admin || admin.accessLevel === "View Only") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let file: File | null;
  try {
    const formData = await request.formData();
    const candidate = formData.get("file");
    if (!(candidate instanceof File)) {
      return NextResponse.json({ error: "A file is required." }, { status: 400 });
    }
    file = candidate;
  } catch {
    return NextResponse.json({ error: "Invalid multipart upload." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, and WebP images are allowed." },
      { status: 400 },
    );
  }
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image must be between 1 byte and 5 MB." }, { status: 400 });
  }

  try {
    const result = await uploadImage(Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ image: result }, { status: 201 });
  } catch (error) {
    console.error("Cloudinary upload failed:", error);
    return NextResponse.json({ error: "Unable to upload image." }, { status: 502 });
  }
}
