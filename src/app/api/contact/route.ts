import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendContactEmail } from "@/lib/mail";

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  message: z.string().trim().min(10).max(3000),
  website: z.string().max(0).optional(),
});

export async function POST(request: NextRequest) {
  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof z.ZodError ? error.issues : "Invalid contact message." },
      { status: 400 },
    );
  }

  try {
    await sendContactEmail(input);
    return NextResponse.json({ message: "Thank you. Your message has been sent." });
  } catch (error) {
    console.error("Contact message delivery failed:", error);
    return NextResponse.json(
      { error: "We could not deliver your message right now. Please contact us on WhatsApp." },
      { status: 503 },
    );
  }
}
