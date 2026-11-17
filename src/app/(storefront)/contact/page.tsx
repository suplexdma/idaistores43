import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { ContactActions } from "@/components/storefront/contact-actions";
import { ContactForm } from "@/components/storefront/contact-form";
import { CoverHero } from "@/components/storefront/cover-hero";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Contact IDAI STORES 43 in Kundan Sian, Daska for help with our non-food collection and orders.",
};

export default function ContactPage() {
  const publicEmail =
    process.env.NEXT_PUBLIC_CONTACT_EMAIL ??
    process.env.CONTACT_EMAIL ??
    process.env.SMTP_FROM;
  return (
    <div className="bg-[#fffefa]">
      <CoverHero
        eyebrow="We are here to help"
        title="Contact Us"
        description="Questions about an order or looking for a thoughtful find? Send us a message or talk with our team."
      />

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-[0.8fr_1.2fr] lg:px-12">
        <div className="space-y-5">
          <section className="rounded-2xl bg-brand-charcoal p-6 text-white shadow-lg sm:p-8">
            <h2 className="font-serif text-2xl font-semibold">Get in touch</h2>
            <ul className="mt-6 space-y-5 text-sm">
              <li className="flex items-start gap-3"><MapPin className="mt-0.5 size-5 shrink-0 text-brand-gold" /><span><strong className="block">Visit us</strong><span className="mt-1 block text-white/70">Kundan Sian, Daska, Punjab, Pakistan</span></span></li>
              <li className="flex items-start gap-3"><Phone className="mt-0.5 size-5 shrink-0 text-brand-gold" /><span><strong className="block">Call us</strong><a className="mt-1 block text-white/70 hover:text-white" href="tel:+923278505273">0327 8505273</a></span></li>
              <li className="flex items-start gap-3"><Mail className="mt-0.5 size-5 shrink-0 text-brand-gold" /><span><strong className="block">Email</strong>{publicEmail ? <a className="mt-1 block break-all text-white/70 hover:text-white" href={`mailto:${publicEmail}`}>{publicEmail}</a> : <span className="mt-1 block text-white/70">Send us a message using the contact form.</span>}</span></li>
            </ul>
            <ContactActions />
          </section>
          <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
            <iframe title="Map showing IDAI Stores 43 in Kundan Sian, Daska" src="https://maps.google.com/maps?q=32.32912155%2C74.3528708&t=&z=17&ie=UTF8&iwloc=&output=embed" loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-64 w-full border-0" />
            <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
              <span className="text-muted-foreground">IDAI Stores 43 · Kundan Sian, Daska</span>
              <Link href="https://www.google.com/maps/search/?api=1&query=32.32912155%2C74.3528708" target="_blank" rel="noreferrer" className="font-semibold text-brand-olive hover:underline">Open map</Link>
            </div>
          </div>
        </div>

        <section id="contact-form" className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm sm:p-8">
          <h2 className="font-serif text-2xl font-semibold">Send us a message</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Our team will get back to you as soon as possible.</p>
          <div className="mt-6"><ContactForm /></div>
        </section>
      </div>
    </div>
  );
}
