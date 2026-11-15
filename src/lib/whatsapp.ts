export function normalizeWhatsAppNumber(value: string): string {
  const digits = value.replace(/\D/g, "").replace(/^00/, "");
  return digits.startsWith("0") ? `92${digits.slice(1)}` : digits;
}

export const PUBLIC_WHATSAPP_NUMBER = normalizeWhatsAppNumber(
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "03278505273",
);
