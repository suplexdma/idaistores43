"use client";

import { useEffect, useState } from "react";
import { ArrowUp, MessageCircle } from "lucide-react";
import { PUBLIC_WHATSAPP_NUMBER } from "@/lib/whatsapp";

export function FloatingActions() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function updateVisibility() {
      setVisible(window.scrollY > 320);
    }
    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-center gap-2 sm:bottom-6 sm:right-6">
      <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Scroll to top" disabled={!visible} className={`flex size-12 items-center justify-center rounded-full border border-brand-olive/20 bg-white text-brand-charcoal shadow-lg transition hover:-translate-y-0.5 hover:bg-brand-olive hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold sm:size-14 ${visible ? "" : "opacity-55"}`}>
        <ArrowUp aria-hidden="true" className="size-5" />
      </button>
      <button type="button" onClick={() => window.dispatchEvent(new Event("idai:open-chat"))} aria-label="Chat with IDAI Assistant Now" className="group relative flex size-12 items-center justify-center rounded-full bg-brand-olive text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-brand-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold sm:size-14">
        <span aria-hidden="true" className="pointer-events-none absolute right-[calc(100%+0.65rem)] w-max translate-x-2 rounded-xl bg-brand-charcoal px-3 py-2 text-xs font-medium text-white opacity-0 shadow-lg transition duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">Chat with IDAI Assistant Now</span>
        <MessageCircle aria-hidden="true" className="size-5" />
      </button>
      <a href={`https://wa.me/${PUBLIC_WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp Now!" className="group relative flex size-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#159447] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold sm:size-14">
        <span aria-hidden="true" className="pointer-events-none absolute right-[calc(100%+0.65rem)] w-max translate-x-2 rounded-xl bg-[#159447] px-3 py-2 text-xs font-medium text-white opacity-0 shadow-lg transition duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">Chat on WhatsApp Now!</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none">
          <path d="M20.1 11.8a8.1 8.1 0 0 1-12 7.1L4 20l1.2-4A8.1 8.1 0 1 1 20.1 11.8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M9 8.2c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.7 1.7c.1.2.1.4 0 .6l-.5.6c-.2.2-.2.4 0 .6.7 1.1 1.6 1.9 2.8 2.5.2.1.4.1.6-.1l.7-.8c.2-.2.4-.2.6-.1l1.6.8c.3.1.4.3.4.5 0 .4-.2 1.2-.8 1.7-.5.5-1.3.7-2 .5-1.2-.3-2.7-1.1-4.1-2.4-1.1-1-2.1-2.4-2.4-3.5-.3-.8-.1-1.5.3-2.1.3-.4.7-.6 1.1-.6Z" fill="currentColor" />
        </svg>
      </a>
    </div>
  );
}
