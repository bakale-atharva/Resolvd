"use client";

import { useMutation, useQuery } from "convex/react";
import {
  BookOpen,
  Edit3,
  Eye,
  ImagePlus,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { MarkdownPreview } from "./MarkdownPreview";

interface ArticleFormState {
  articleId?: Id<"articles">;
  title: string;
  slug: string;
  category: string;
  contentMarkdown: string;
  coverStorageId?: Id<" _storage" extends never ? never : "_storage"> | null;
  coverPreviewUrl?: string | null;
  isPopular: boolean;
  isPublished: boolean;
}

const EMPTY_FORM: ArticleFormState = {
  title: "",
  slug: "",
  category: "Getting Started",
  contentMarkdown: "",
  coverStorageId: undefined,
  coverPreviewUrl: null,
  isPopular: false,
  isPublished: true,
};

export function ArticlesTab() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"split" | "write" | "preview">(
    "split",
  );
  const [form, setForm] = useState<ArticleFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const articles = useQuery(api.articles.listArticles, {
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(selectedCategory ? { category: selectedCategory } : {}),
  });

  const generateUploadUrl = useMutation(api.articles.generateUploadUrl);
  const createArticle = useMutation(api.articles.createArticle);
  const updateArticle = useMutation(api.articles.updateArticle);
  const deleteArticle = useMutation(api.articles.deleteArticle);

  const categories = useMemo(() => {
    if (!articles) return [];
    return Array.from(new Set(articles.map((a) => a.category))).sort();
  }, [articles]);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setError(null);
    setEditorOpen(true);
  };

  const openEdit = (article: NonNullable<typeof articles>[number]) => {
    setForm({
      articleId: article._id,
      title: article.title,
      slug: article.slug,
      category: article.category,
      contentMarkdown: article.contentMarkdown,
      coverStorageId: article.coverStorageId,
      coverPreviewUrl: article.coverUrl,
      isPopular: article.isPopular,
      isPublished: article.isPublished,
    });
    setError(null);
    setEditorOpen(true);
  };

  const handleCoverUpload = async (file: File) => {
    setUploadingCover(true);
    setError(null);
    try {
      const postUrl = await generateUploadUrl();
      const res = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "image/png" },
        body: file,
      });
      if (!res.ok) throw new Error("Failed to upload cover image");
      const { storageId } = (await res.json()) as {
        storageId: Id<"_storage">;
      };
      setForm((prev) => ({
        ...prev,
        coverStorageId: storageId,
        coverPreviewUrl: URL.createObjectURL(file),
      }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not upload cover image",
      );
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (form.articleId) {
        await updateArticle({
          articleId: form.articleId,
          title: form.title,
          slug: form.slug || undefined,
          category: form.category,
          contentMarkdown: form.contentMarkdown,
          coverStorageId: form.coverStorageId,
          isPopular: form.isPopular,
          isPublished: form.isPublished,
        });
      } else {
        await createArticle({
          title: form.title,
          slug: form.slug || undefined,
          category: form.category,
          contentMarkdown: form.contentMarkdown,
          coverStorageId: form.coverStorageId ?? undefined,
          isPopular: form.isPopular,
          isPublished: form.isPublished,
        });
      }
      setEditorOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save article");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (articleId: Id<"articles">) => {
    setError(null);
    try {
      await deleteArticle({ articleId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete article");
    }
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search articles by title..."
              className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>

          {categories.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedCategory("")}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  selectedCategory === ""
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                )}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() =>
                    setSelectedCategory(selectedCategory === cat ? "" : cat)
                  }
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    selectedCategory === cat
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        <Button onClick={openNew} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          New Article
        </Button>
      </div>

      {error && !editorOpen && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Editor Panel */}
      {editorOpen && (
        <form
          onSubmit={handleSave}
          className="rounded-xl border border-border bg-card p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {form.articleId ? "Edit Helpdesk Article" : "New Helpdesk Article"}
              </h2>
              <p className="text-xs text-muted-foreground">
                Published articles are automatically indexed into your workspace
                RAG knowledge base.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
              aria-label="Close editor"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                Title
              </label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="e.g., How to configure SSO with Okta"
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                Category
              </label>
              <input
                type="text"
                value={form.category}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, category: e.target.value }))
                }
                placeholder="Getting Started"
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                URL Slug{" "}
                <span className="font-normal text-muted-foreground">
                  (auto-generated if blank)
                </span>
              </label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, slug: e.target.value }))
                }
                placeholder="how-to-configure-sso"
                className="h-9 w-full rounded-md border border-border bg-background px-3 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                Cover Image
              </label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleCoverUpload(file);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingCover}
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5"
                >
                  {uploadingCover ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-3.5 w-3.5" />
                  )}
                  {form.coverPreviewUrl ? "Replace cover" : "Upload cover"}
                </Button>
                {form.coverPreviewUrl && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={form.coverPreviewUrl}
                      alt="Cover preview"
                      className="h-9 w-14 rounded-md border border-border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          coverStorageId: null,
                          coverPreviewUrl: null,
                        }))
                      }
                      className="text-xs text-muted-foreground hover:text-destructive"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Markdown Editor & Live Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">
                Content (Markdown)
              </label>
              <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5 text-xs">
                {(["split", "write", "preview"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setEditorMode(mode)}
                    className={cn(
                      "rounded px-2.5 py-1 capitalize transition-colors",
                      editorMode === mode
                        ? "bg-card font-medium text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div
              className={cn(
                "grid gap-4",
                editorMode === "split" ? "lg:grid-cols-2" : "grid-cols-1",
              )}
            >
              {editorMode !== "preview" && (
                <textarea
                  required
                  rows={12}
                  value={form.contentMarkdown}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      contentMarkdown: e.target.value,
                    }))
                  }
                  placeholder="## Overview&#10;Write clear, helpful documentation in Markdown..."
                  className="w-full rounded-lg border border-border bg-background p-3 font-mono text-xs leading-relaxed text-foreground focus:border-primary focus:outline-none"
                />
              )}

              {editorMode !== "write" && (
                <div className="min-h-[260px] rounded-lg border border-border bg-background p-4 overflow-y-auto max-h-[340px]">
                  <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    <Eye className="h-3 w-3" />
                    Live Preview
                  </div>
                  <MarkdownPreview content={form.contentMarkdown} />
                </div>
              )}
            </div>
          </div>

          {/* Toggles & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      isPublished: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <span>Published (visible in Help Center & AI)</span>
              </label>

              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPopular}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      isPopular: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <span>Mark as Popular</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditorOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {form.articleId ? "Save Changes" : "Create Article"}
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* Articles List */}
      <div className="rounded-xl border border-border bg-card">
        {articles === undefined ? (
          <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Loading articles...</span>
          </div>
        ) : articles.length === 0 ? (
          <div className="p-10 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <h3 className="mt-3 text-sm font-semibold text-foreground">
              No helpdesk articles yet
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Create your first article to power the Help Center and AI support
              citations.
            </p>
            <Button onClick={openNew} size="sm" className="mt-4 gap-1.5">
              <Plus className="h-4 w-4" />
              Create Article
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {articles.map((article) => (
              <div
                key={article._id}
                className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
              >
                <div className="flex min-w-0 items-center gap-4">
                  {article.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={article.coverUrl}
                      alt={article.title}
                      className="h-12 w-16 shrink-0 rounded-md border border-border object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground">
                      <BookOpen className="h-4 w-4" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {article.title}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                          article.isPublished
                            ? "bg-accent text-accent-foreground"
                            : "bg-secondary text-secondary-foreground",
                        )}
                      >
                        {article.isPublished ? "Published" : "Draft"}
                      </span>
                      {article.isPopular && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                          <Sparkles className="h-2.5 w-2.5" />
                          Popular
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{article.category}</span>
                      <span className="font-mono text-[11px]">
                        /{article.slug}
                      </span>
                      <span className="tabular-nums">
                        Updated {new Date(article.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(article)}
                    className="gap-1.5"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleDelete(article._id)}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Delete ${article.title}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
