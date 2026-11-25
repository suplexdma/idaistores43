"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, FileText, Pencil, Trash2 } from "lucide-react";
import { MarkdownContent } from "@/components/storefront/markdown-content";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cloudinaryImageLoader } from "@/lib/cloudinary-url";

type PostStatus = "Draft" | "Published";
type PostRecord = {
  _id: string;
  title: string;
  slug: string;
  content?: string;
  status: PostStatus;
  coverImage?: { url?: string; publicId?: string };
  metaTitle?: string;
  metaDescription?: string;
  publishedAt?: string;
};
type PostDraft = {
  title: string;
  slug: string;
  content: string;
  status: PostStatus;
  coverImage?: { url: string; publicId: string };
  metaTitle: string;
  metaDescription: string;
};
const emptyDraft: PostDraft = { title: "", slug: "", content: "", status: "Draft", metaTitle: "", metaDescription: "" };

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function PostsManager() {
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [draft, setDraft] = useState<PostDraft>(emptyDraft);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/posts");
      const data = (await response.json()) as { posts?: PostRecord[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to load posts.");
      setPosts(data.posts ?? []);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load posts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadPosts(); }, [loadPosts]);

  function applyFormat(before: string, after = before) {
    const textarea = contentRef.current;
    const start = textarea?.selectionStart ?? draft.content.length;
    const end = textarea?.selectionEnd ?? start;
    const selected = draft.content.slice(start, end) || "text";
    const content = `${draft.content.slice(0, start)}${before}${selected}${after}${draft.content.slice(end)}`;
    setDraft((current) => ({ ...current, content }));
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  async function uploadCover(file: File) {
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/upload", { method: "POST", body });
      const data = (await response.json()) as { image?: { secureUrl: string; publicId: string }; error?: string };
      if (!response.ok || !data.image) throw new Error(data.error ?? "Cover upload failed.");
      setDraft((current) => ({ ...current, coverImage: { url: data.image!.secureUrl, publicId: data.image!.publicId } }));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload cover image.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function editPost(post: PostRecord) {
    setError("");
    try {
      const response = await fetch(`/api/admin/posts/${post._id}`);
      const data = (await response.json()) as { post?: PostRecord; error?: string };
      if (!response.ok || !data.post) throw new Error(data.error ?? "Unable to load post.");
      const item = data.post;
      setDraft({
        title: item.title,
        slug: item.slug,
        content: item.content ?? "",
        status: item.status,
        coverImage: item.coverImage?.url ? { url: item.coverImage.url, publicId: item.coverImage.publicId ?? "" } : undefined,
        metaTitle: item.metaTitle ?? "",
        metaDescription: item.metaDescription ?? "",
      });
      setEditingId(item._id);
      setPreview(false);
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "Unable to load post.");
    }
  }

  async function savePost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(editingId ? `/api/admin/posts/${editingId}` : "/api/admin/posts", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          coverImage: draft.coverImage,
          metaTitle: draft.metaTitle || undefined,
          metaDescription: draft.metaDescription || undefined,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Unable to save post.");
      setDraft(emptyDraft);
      setEditingId("");
      await loadPosts();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save post.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePost(post: PostRecord) {
    if (!window.confirm(`Move “${post.title}” to Trash?`)) return;
    setError("");
    try {
      const response = await fetch(`/api/admin/posts/${post._id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to move post to Trash.");
      await loadPosts();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to move post to Trash.");
    }
  }

  return (
    <div className="space-y-7">
      <div>
        <p className="text-sm font-medium text-brand-olive">Content</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Posts / Blog</h1>
        <p className="mt-2 text-muted-foreground">Create SEO-ready stories and publish them to the public blog.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>{editingId ? "Edit post" : "Create post"}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={savePost} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium">
                Title
                <Input required maxLength={180} value={draft.title} onChange={(event) => {
                  const title = event.target.value;
                  setDraft((current) => ({ ...current, title, slug: editingId ? current.slug : slugify(title) }));
                }} />
              </label>
              <label className="space-y-2 text-sm font-medium">
                Slug
                <Input required value={draft.slug} onChange={(event) => setDraft((current) => ({ ...current, slug: slugify(event.target.value) }))} />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => applyFormat("**")}>Bold</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => applyFormat("*")}>Italic</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => applyFormat("## ", "")}>Heading</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => applyFormat("- ", "")}>Bullet</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setPreview((current) => !current)}><Eye aria-hidden="true" className="mr-2 size-4" />{preview ? "Edit content" : "Preview"}</Button>
            </div>
            {preview ? (
              <div className="min-h-56 rounded-md border bg-background p-5"><MarkdownContent content={draft.content} /></div>
            ) : (
              <label className="block space-y-2 text-sm font-medium">
                Content
                <textarea ref={contentRef} required rows={14} maxLength={100000} value={draft.content} onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))} placeholder="Write the post. Use the formatting controls to add headings, emphasis, and lists." className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm leading-6" />
              </label>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 text-sm font-medium">
                <span>Cover image</span>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadCover(file);
                }} />
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? "Uploading..." : "Upload cover"}</Button>
                  {draft.coverImage?.url && <Button type="button" variant="ghost" onClick={() => setDraft((current) => ({ ...current, coverImage: undefined }))}>Remove</Button>}
                </div>
                {draft.coverImage?.url && <Image src={draft.coverImage.url} loader={cloudinaryImageLoader} alt="Post cover preview" width={640} height={320} className="mt-2 aspect-[2/1] max-h-40 w-full rounded-md border object-cover" />}
              </div>
              <label className="space-y-2 text-sm font-medium">
                Status
                <select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as PostStatus }))} className="h-10 w-full rounded-md border border-input bg-background px-3">
                  <option value="Draft">Draft</option><option value="Published">Published</option>
                </select>
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium">
                Meta title
                <Input maxLength={180} value={draft.metaTitle} onChange={(event) => setDraft((current) => ({ ...current, metaTitle: event.target.value }))} />
              </label>
              <label className="space-y-2 text-sm font-medium">
                Meta description
                <textarea maxLength={320} rows={2} value={draft.metaDescription} onChange={(event) => setDraft((current) => ({ ...current, metaDescription: event.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </label>
            </div>
            {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving || uploading}>{saving ? "Saving..." : draft.status === "Published" ? "Publish post" : "Save draft"}</Button>
              {editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(""); setDraft(emptyDraft); }}>Cancel</Button>}
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>All posts ({posts.length})</CardTitle></CardHeader>
        <CardContent className="divide-y p-0">
          {loading ? <p role="status" className="p-6 text-sm text-muted-foreground">Loading posts...</p> : posts.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No posts yet.</p> : posts.map((post) => (
            <div key={post._id} className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                {post.coverImage?.url ? <Image src={post.coverImage.url} loader={cloudinaryImageLoader} alt="" width={64} height={48} className="size-16 rounded-md object-cover" /> : <span className="flex size-16 items-center justify-center rounded-md bg-muted"><FileText aria-hidden="true" className="size-5 text-muted-foreground" /></span>}
                <div>
                  <p className="font-medium">{post.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">/blog/{post.slug} · {post.status}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => void editPost(post)}><Pencil aria-hidden="true" className="mr-2 size-3.5" />Edit</Button>
                <Button type="button" size="icon" variant="ghost" aria-label={`Move ${post.title} to Trash`} onClick={() => void deletePost(post)}><Trash2 aria-hidden="true" className="size-4 text-destructive" /></Button>
                {post.status === "Published" && <a className="inline-flex h-9 items-center rounded-md px-3 text-sm text-brand-olive hover:bg-muted" href={`/blog/${post.slug}`} target="_blank" rel="noreferrer">View</a>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
