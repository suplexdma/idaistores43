"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

export function CoverHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <section className="relative isolate flex min-h-[280px] items-center overflow-hidden bg-brand-charcoal sm:min-h-[340px]">
      <Image
        src="/images/hero-cover-1.jpg"
        alt="A curated display of stationery, gifts, bags, and home accessories"
        fill
        sizes="100vw"
        quality={88}
        className="object-cover object-center"
        priority
      />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-brand-charcoal/80 via-brand-charcoal/55 to-brand-charcoal/15" />
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.55 }}
        className="relative z-10 mx-auto w-full max-w-7xl px-5 py-14 text-white sm:px-8 sm:py-16 lg:px-12"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold">{eyebrow}</p>
        <h1 className="mt-3 max-w-3xl font-serif text-4xl font-semibold leading-tight sm:text-5xl">{title}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/80 sm:text-base">{description}</p>
      </motion.div>
    </section>
  );
}
