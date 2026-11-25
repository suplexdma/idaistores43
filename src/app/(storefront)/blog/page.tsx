import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connectToDatabase } from "@/lib/db";
import Post from "@/models/Post";
import { cloudinaryImageUrl, isCloudinaryImageUrl } from "@/lib/cloudinary-url";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Journal",
  description: "Stories, guides, and thoughtful finds from IDAI STORES 43.",
};

export default async function BlogPage() {
  await connectToDatabase();
  const posts = await Post.find({ status: "Published", deletedAt: null })
    .sort({ publishedAt: -1 })
    .select("title slug metaDescription coverImage publishedAt")
    .lean();

  return (
    <div className="bg-[#fffefa]">
      <header className="border-b bg-[#f7f7f2] px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-olive">IDAI STORES 43 · Journal</p>
          <h1 className="mt-4 max-w-3xl font-serif text-4xl font-semibold tracking-tight sm:text-6xl">Thoughtful stories for everyday living.</h1>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-12 sm:grid-cols-2 sm:px-8 lg:grid-cols-3 lg:px-12">
        {posts.map((post) => (
          <article key={post._id.toString()} className="group overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <Link href={`/blog/${post.slug}`} className="block">
              <div className="relative aspect-[1.55/1] bg-muted">
                {post.coverImage?.url && <Image src={cloudinaryImageUrl(post.coverImage.url, 768)} unoptimized={isCloudinaryImageUrl(post.coverImage.url)} alt="" fill sizes="(max-width: 640px) 95vw, (max-width: 1024px) 45vw, 30vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />}
              </div>
              <div className="p-5">
                {post.publishedAt && <time dateTime={post.publishedAt.toISOString()} className="text-xs text-muted-foreground">{new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeZone: "Asia/Karachi" }).format(post.publishedAt)} PKT</time>}
                <h2 className="mt-2 font-serif text-xl font-semibold leading-snug">{post.title}</h2>
                {post.metaDescription && <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{post.metaDescription}</p>}
              </div>
            </Link>
          </article>
        ))}
        {posts.length === 0 && <p className="py-12 text-center text-muted-foreground sm:col-span-2 lg:col-span-3">No stories have been published yet.</p>}
      </div>
    </div>
  );
}
