import { PUBLIC_WHATSAPP_NUMBER } from "@/lib/whatsapp";

export function WhatsAppFloat() {
  return (
    <a
      href={`https://wa.me/${PUBLIC_WHATSAPP_NUMBER}`}
      target="_blank"
      rel="noreferrer"
      aria-label="Contact IDAI STORES 43 on WhatsApp"
      className="fixed bottom-5 left-5 z-50 flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl transition hover:scale-105 hover:bg-[#20bd5a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366]"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7" fill="none">
        <path
          d="M20.1 11.8a8.1 8.1 0 0 1-12 7.1L4 20l1.2-4A8.1 8.1 0 1 1 20.1 11.8Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M9 8.2c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.7 1.7c.1.2.1.4 0 .6l-.5.6c-.2.2-.2.4 0 .6.7 1.1 1.6 1.9 2.8 2.5.2.1.4.1.6-.1l.7-.8c.2-.2.4-.2.6-.1l1.6.8c.3.1.4.3.4.5 0 .4-.2 1.2-.8 1.7-.5.5-1.3.7-2 .5-1.2-.3-2.7-1.1-4.1-2.4-1.1-1-2.1-2.4-2.4-3.5-.3-.8-.1-1.5.3-2.1.3-.4.7-.6 1.1-.6Z"
          fill="currentColor"
        />
      </svg>
    </a>
  );
}
