import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkdownContent } from "@/components/storefront/markdown-content";
import { connectToDatabase } from "@/lib/db";
import Post from "@/models/Post";
import { cloudinaryImageUrl, isCloudinaryImageUrl } from "@/lib/cloudinary-url";

export const dynamic = "force-dynamic";
type BlogPostPageProps = { params: { slug: string } };

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  await connectToDatabase();
  const post = await Post.findOne({ slug: params.slug, status: "Published", deletedAt: null })
    .select("title metaTitle metaDescription coverImage")
    .lean();
  if (!post) return { title: "Story not found" };
  return {
    title: post.metaTitle || post.title,
    description: post.metaDescription || undefined,
    alternates: { canonical: `/blog/${encodeURIComponent(params.slug)}` },
    openGraph: {
      type: "article",
      title: post.metaTitle || post.title,
      description: post.metaDescription || undefined,
      images: post.coverImage?.url ? [post.coverImage.url] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  await connectToDatabase();
  const post = await Post.findOne({ slug: params.slug, status: "Published", deletedAt: null }).lean();
  if (!post) notFound();

  return (
    <article className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
      <Link href="/blog" className="text-sm font-medium text-brand-olive hover:underline">← Back to journal</Link>
      <header className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-olive">IDAI STORES 43 · Journal</p>
        <h1 className="mt-4 font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">{post.title}</h1>
        {post.publishedAt && <time dateTime={post.publishedAt.toISOString()} className="mt-4 block text-sm text-muted-foreground">{new Intl.DateTimeFormat("en-PK", { dateStyle: "long", timeZone: "Asia/Karachi" }).format(post.publishedAt)} PKT</time>}
      </header>
      {post.coverImage?.url && <div className="relative mt-8 aspect-[1.8/1] overflow-hidden rounded-2xl bg-muted"><Image src={cloudinaryImageUrl(post.coverImage.url, 768)} unoptimized={isCloudinaryImageUrl(post.coverImage.url)} alt={post.title} fill priority sizes="(max-width: 768px) 95vw, 768px" className="object-cover" /></div>}
      <div className="prose-like mt-10 text-base text-brand-charcoal/80 sm:text-lg">
        <MarkdownContent content={post.content} />
      </div>
    </article>
  );
}
