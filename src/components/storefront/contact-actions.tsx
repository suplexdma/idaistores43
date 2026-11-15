"use client";

import { MessageCircle } from "lucide-react";
import { PUBLIC_WHATSAPP_NUMBER } from "@/lib/whatsapp";

export function ContactActions() {
  return (
    <div className="mt-7 flex flex-col gap-3">
      <button type="button" onClick={() => window.dispatchEvent(new Event("idai:open-chat-fullscreen"))} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-gold px-5 text-sm font-semibold text-brand-charcoal transition hover:bg-white">
        <MessageCircle aria-hidden="true" className="size-4" />Talk to our AI Agent
      </button>
      <a href={`https://wa.me/${PUBLIC_WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/25 px-5 text-sm font-semibold text-white transition hover:border-[#25D366] hover:bg-[#25D366]">
        <MessageCircle aria-hidden="true" className="size-4" />Message us on WhatsApp
      </a>
    </div>
  );
}
