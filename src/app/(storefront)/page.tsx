import { StorefrontHome } from "@/components/storefront/storefront-home";

export default function HomePage() {
  const siteUrl = (process.env.NEXTAUTH_URL ?? "https://idai-stores-43.onrender.com").replace(/\/$/, "");
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "IDAI STORES 43",
    url: siteUrl,
    logo: `${siteUrl}/images/idai-stores-43-logo.png`,
    description:
      "Thoughtfully selected stationery, toys, gifts, kitchenware, beauty, home decor, and everyday essentials.",
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+92-327-8505273",
      contactType: "customer service",
      areaServed: "PK",
    },
  };
  const safeJsonLd = JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd }} />
      <StorefrontHome />
    </>
  );
}
