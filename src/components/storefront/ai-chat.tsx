"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Maximize2, Mic, Minimize2, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/cart-store";

type ChatMessage = { role: "user" | "assistant"; content: string; image?: string };
type ChatResponse = {
  sessionId?: string;
  reply?: string;
  error?: string;
  cartActions?: Array<{
    productId: string;
    slug: string;
    name: string;
    image?: string;
    unitPrice: number;
    stock: number;
    quantity: number;
    variantName?: string;
  }>;
};
type RecognitionResult = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SpeechRecognitionInstance = {
  lang: string;
  onresult: ((event: RecognitionResult) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
};

const greeting =
  "Hello! I’m your IDAI shopping assistant. I can help you explore stationery, toys, gifts, kitchenware, bags, and more.";
const suggestions = [
  "Show me stationery",
  "What toys are available?",
  "Find a thoughtful gift",
  "How much is delivery?",
];

function renderMessageContent(content: string): ReactNode[] {
  const inlinePattern =
    /\[([^\]]+)\]\((\/(?:product\/[a-z0-9-]+|account\/orders\/IDAI-\d{6}))\)|\*\*([^*]+)\*\*|\*([^*]+)\*/gi;
  const renderInline = (line: string, prefix: string): ReactNode[] => {
    const parts: ReactNode[] = [];
    let cursor = 0;
    for (const match of Array.from(line.matchAll(inlinePattern))) {
      const index = match.index ?? 0;
      if (index > cursor) parts.push(line.slice(cursor, index));
      if (match[2]) {
        parts.push(
          <Link key={`${prefix}-${index}`} href={match[2]} className="font-medium text-brand-olive underline underline-offset-2">
            {match[1]}
          </Link>,
        );
      } else if (match[3]) {
        parts.push(<strong key={`${prefix}-${index}`} className="font-semibold">{match[3]}</strong>);
      } else if (match[4]) {
        parts.push(<em key={`${prefix}-${index}`} className="italic">{match[4]}</em>);
      }
      cursor = index + match[0].length;
    }
    if (cursor < line.length) parts.push(line.slice(cursor));
    return parts;
  };

  const lines = content.split(/\r?\n/);
  const rendered: ReactNode[] = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      const items: ReactNode[] = [];
      while (index < lines.length) {
        const match = lines[index].match(ordered ? /^\s*\d+[.)]\s+(.+)$/ : /^\s*[-*]\s+(.+)$/);
        if (!match) break;
        items.push(<li key={`item-${index}`}>{renderInline(match[1], `inline-${index}`)}</li>);
        index += 1;
      }
      rendered.push(
        ordered
          ? <ol key={`list-${index}`} className="my-1 list-decimal space-y-1 pl-5">{items}</ol>
          : <ul key={`list-${index}`} className="my-1 list-disc space-y-1 pl-5">{items}</ul>,
      );
      continue;
    }
    rendered.push(<p key={`paragraph-${index}`} className="my-1">{renderInline(line, `inline-${index}`)}</p>);
    index += 1;
  }
  return rendered;
}

export function AiChat() {
  const addToCart = useCartStore((state) => state.addToCart);
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: greeting }]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const sessionId = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    sessionId.current = window.localStorage.getItem("idai-ai-session");
    const show = () => setOpen(true);
    const showFullscreen = () => {
      setFullscreen(true);
      setOpen(true);
    };
    window.addEventListener("idai:open-chat", show);
    window.addEventListener("idai:open-chat-fullscreen", showFullscreen);
    return () => {
      window.removeEventListener("idai:open-chat", show);
      window.removeEventListener("idai:open-chat-fullscreen", showFullscreen);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  async function sendMessage(event?: FormEvent<HTMLFormElement>, suggestedMessage?: string) {
    event?.preventDefault();
    const message = (suggestedMessage ?? input).trim();
    if ((!message && !image) || sending) return;
    const userMessage = message || "Please help me identify or learn about this image.";
    const attachedImage = image ?? undefined;
    setInput("");
    setImage(null);
    setError("");
    setMessages((current) => [...current, { role: "user", content: userMessage, image: attachedImage }]);
    setSending(true);
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          ...(attachedImage ? { imageDataUrl: attachedImage } : {}),
          ...(sessionId.current ? { sessionId: sessionId.current } : {}),
        }),
      });
      const result = (await response.json()) as ChatResponse;
      if (!response.ok || !result.reply) {
        throw new Error(result.error ?? "The assistant could not answer right now.");
      }
      if (result.sessionId) {
        sessionId.current = result.sessionId;
        window.localStorage.setItem("idai-ai-session", result.sessionId);
      }
      result.cartActions?.forEach((item) => addToCart(item));
      setMessages((current) => [...current, { role: "assistant", content: result.reply! }]);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Unable to send your message.");
    } finally {
      setSending(false);
      if (open) messageInputRef.current?.focus();
    }
  }

  function chooseImage(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Images must be 5 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImage(reader.result);
        setError("");
      } else {
        setError("Unable to read that image. Please try another file.");
      }
    };
    reader.onerror = () => setError("Unable to read that image. Please try another file.");
    reader.readAsDataURL(file);
  }

  function startVoiceInput() {
    const speech = window as SpeechWindow;
    const Recognition = speech.SpeechRecognition ?? speech.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Voice input is not supported by this browser.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = document.documentElement.dir === "rtl" ? "ur-PK" : "en-PK";
    recognition.onresult = (event) => {
      setInput((value) => `${value}${value ? " " : ""}${event.results[0]?.[0]?.transcript ?? ""}`);
    };
    recognition.onerror = () => {
      setListening(false);
      setError("Voice input could not start. Check microphone permission and try again.");
    };
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  }

  return (
    <section
      aria-label="IDAI shopping assistant"
      className={`fixed z-40 flex flex-col overflow-hidden border border-brand-olive/15 bg-white shadow-2xl transition-all duration-300 ${
        open
          ? fullscreen
            ? "inset-0 rounded-none"
            : "inset-0 rounded-none sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[min(42rem,calc(100dvh-9rem))] sm:w-[min(26rem,calc(100vw-3rem))] sm:rounded-[1.4rem]"
          : "pointer-events-none invisible h-0 w-0 opacity-0"
      }`}
      aria-hidden={!open}
    >
      <header className="flex shrink-0 items-center justify-between bg-brand-charcoal px-4 py-3.5 text-white sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-olive ring-2 ring-brand-gold/60">
            <Sparkles aria-hidden="true" className="size-5 text-brand-gold" />
            <span className="absolute bottom-0.5 right-0.5 size-2.5 rounded-full border-2 border-brand-charcoal bg-emerald-400" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">IDAI Shopping Assistant</p>
            <p className="mt-0.5 truncate text-[11px] text-white/65">Your thoughtful shopping companion</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => setFullscreen((value) => !value)} aria-label={fullscreen ? "Exit full screen" : "Switch to full screen"} className="hidden rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white sm:inline-flex">
            {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
          <button type="button" onClick={() => { setOpen(false); setFullscreen(false); }} aria-label="Close chat" className="rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white"><X className="size-5" /></button>
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#f7f7f4] p-4 sm:p-5" aria-live="polite">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] rounded-2xl px-3.5 py-3 text-sm leading-6 shadow-sm ${message.role === "user" ? "rounded-br-sm bg-brand-olive text-white" : "rounded-bl-sm border border-black/5 bg-white text-brand-charcoal"}`}>
              {message.image && <Image src={message.image} alt="Image shared with the shopping assistant" width={240} height={180} unoptimized className="mb-2 max-h-44 w-auto rounded-lg object-cover" />}
              {renderMessageContent(message.content)}
            </div>
          </div>
        ))}
        {messages.length === 1 && !sending && (
          <div className="flex flex-wrap gap-2 pt-2">
            {suggestions.map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => void sendMessage(undefined, suggestion)} className="rounded-full border border-brand-olive/20 bg-white px-3 py-2 text-xs font-medium text-brand-charcoal transition hover:border-brand-olive hover:bg-brand-olive/5">{suggestion}</button>
            ))}
          </div>
        )}
        {sending && <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle aria-hidden="true" className="size-4 animate-spin" />Checking verified store information…</p>}
      </div>

      {image && (
        <div className="flex shrink-0 items-center gap-3 border-t bg-white px-4 py-2">
          <Image src={image} alt="Selected image attachment preview" width={48} height={48} unoptimized className="size-12 rounded-lg object-cover" />
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">Image ready to send</span>
          <button type="button" onClick={() => setImage(null)} aria-label="Remove image" className="rounded-full p-1.5 hover:bg-muted"><X className="size-4" /></button>
        </div>
      )}
      {error && <p role="alert" className="shrink-0 px-4 pt-2 text-xs text-destructive">{error}</p>}
      <form onSubmit={(event) => void sendMessage(event)} className="flex shrink-0 items-center gap-1.5 border-t bg-white p-3 sm:gap-2 sm:p-4">
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Attach an image" onChange={(event) => chooseImage(event.currentTarget.files?.[0])} />
        <button type="button" aria-label="Attach an image" onClick={() => fileRef.current?.click()} className="flex size-10 shrink-0 items-center justify-center rounded-full text-brand-olive transition hover:bg-brand-olive/10"><ImagePlus className="size-5" /></button>
        <button type="button" aria-label={listening ? "Listening" : "Speak your message"} onClick={startVoiceInput} disabled={listening} className={`flex size-10 shrink-0 items-center justify-center rounded-full transition ${listening ? "bg-brand-gold/20 text-brand-charcoal" : "text-brand-olive hover:bg-brand-olive/10"}`}><Mic className="size-5" /></button>
        <label className="sr-only" htmlFor="ai-chat-message">Message the shopping assistant</label>
        <input ref={messageInputRef} id="ai-chat-message" value={input} onChange={(event) => setInput(event.target.value)} maxLength={1000} placeholder="Ask in English or Roman Urdu…" className="h-10 min-w-0 flex-1 rounded-full border border-input px-3 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-olive/20 sm:px-4" />
        <Button type="submit" size="icon" aria-label="Send message" disabled={sending || (!input.trim() && !image)} className="size-10 shrink-0 rounded-full bg-brand-olive hover:bg-brand-olive/90"><Send aria-hidden="true" className="size-4" /></Button>
      </form>
    </section>
  );
}
