import type { Metadata } from "next";
import { AboutContent } from "@/components/storefront/about-content";

export const metadata: Metadata = {
  title: "About Us",
  description: "Discover the story, mission, vision, and values behind IDAI STORES 43.",
};

export default function AboutPage() {
  return <AboutContent />;
}
