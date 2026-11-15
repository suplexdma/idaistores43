import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXTAUTH_URL ?? "https://idai-stores-43.onrender.com";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/account", "/api"],
    },
    sitemap: `${siteUrl.replace(/\/$/, "")}/sitemap.xml`,
  };
}
