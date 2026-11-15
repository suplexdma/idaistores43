"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Compass, Heart, Lightbulb, ShieldCheck } from "lucide-react";
import { CoverHero } from "@/components/storefront/cover-hero";

const values = [
  { icon: Heart, title: "Thoughtful choices", text: "We look for useful, joyful finds that make everyday routines feel a little more special." },
  { icon: ShieldCheck, title: "Care you can trust", text: "Clear product information, attentive support, and Cash on Delivery for added peace of mind." },
  { icon: Compass, title: "Purpose in every pick", text: "Our collection is focused on stationery, toys, gifts, kitchenware, bags, and home essentials." },
];

export function AboutContent() {
  const reducedMotion = useReducedMotion();
  return (
    <div className="bg-[#fffefa]">
      <CoverHero
        eyebrow="The IDAI story"
        title="Purpose is more important than need."
        description="A thoughtful mix of everyday essentials and delightful finds, selected with care."
      />
      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-12 sm:grid-cols-2 sm:px-8 sm:py-16 lg:grid-cols-3 lg:px-12">
        {[
          { icon: Heart, title: "Our Story", text: "We believe a store can be more than a place to shop. IDAI is built around the small details that make a home, a school day, or a thoughtful gift feel just right." },
          { icon: Lightbulb, title: "Our Mission", text: "To make useful, well-chosen non-food products easy to discover, with warm service and convenient delivery across Pakistan." },
          { icon: Compass, title: "Our Vision", text: "To be a trusted destination where thoughtful choices, dependable service, and everyday inspiration come together." },
        ].map(({ icon: Icon, title, text }, index) => (
          <motion.article
            key={title}
            initial={reducedMotion ? false : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-30px" }}
            transition={{ duration: reducedMotion ? 0 : 0.4, delay: reducedMotion ? 0 : index * 0.07 }}
            className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm transition-shadow hover:shadow-lg sm:p-7"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-brand-olive/10 text-brand-olive"><Icon aria-hidden="true" className="size-5" /></span>
            <h2 className="mt-5 font-serif text-2xl font-semibold">{title}</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{text}</p>
          </motion.article>
        ))}
      </section>

      <section className="bg-[#f7f7f2]">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:px-12">
          <div className="grid items-center gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: reducedMotion ? 0 : 0.5 }}
              className="relative mx-auto h-[280px] w-full max-w-md overflow-hidden rounded-[1.5rem] shadow-xl sm:h-[340px]"
            >
              <Image src="/images/category-fashion-accessories.jpg" alt="Carefully arranged scarves, gloves, and jewelry accessories" fill sizes="(max-width: 1024px) 90vw, 35vw" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-charcoal/45 to-transparent" />
              <p className="absolute bottom-4 left-4 rounded-full border border-white/30 bg-white/90 px-4 py-2 text-xs font-semibold text-brand-charcoal">Thoughtfully selected, every day</p>
              <span aria-hidden="true" className="absolute -right-2 -top-2 size-20 rounded-full border-[10px] border-brand-gold/80" />
            </motion.div>
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, x: 18 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: reducedMotion ? 0 : 0.5, delay: reducedMotion ? 0 : 0.08 }}
              className="max-w-2xl"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-olive">What matters to us</p>
              <h2 className="mt-2 font-serif text-3xl font-semibold sm:text-4xl">Our Values</h2>
              <div className="mt-6 space-y-4">
                {values.map(({ icon: Icon, title, text }, index) => (
                  <motion.article
                    key={title}
                    initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: reducedMotion ? 0 : 0.35, delay: reducedMotion ? 0 : index * 0.06 }}
                    className="flex gap-4 rounded-xl border border-black/5 bg-white p-4 shadow-sm"
                  >
                    <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-olive" />
                    <div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></div>
                  </motion.article>
                ))}
              </div>
              <Link href="/shop" className="mt-7 inline-flex items-center gap-2 rounded-full bg-brand-olive px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-charcoal">Explore the collection <ArrowRight className="size-4" /></Link>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
