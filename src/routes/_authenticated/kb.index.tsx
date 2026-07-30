import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  BookOpen,
  ChevronRight,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { getCurrentUserContext, type AppRole } from "@/lib/current-user";
import { MIS_TICKET_CATEGORIES } from "@/lib/ticket-categories";

type Article = Database["public"]["Tables"]["kb_articles"]["Row"];
type KbCategory = Database["public"]["Enums"]["ticket_category"];

// kb_articles.category is the original fixed Postgres enum, not the newer
// expandable issue_categories text list that tickets use — so the article
// form can only offer the enum's values.
const KB_CATEGORY_VALUES: KbCategory[] = [
  "hardware",
  "software",
  "network",
  "email",
  "access",
  "erp",
  "printer",
  "server",
  "backup",
  "cctv",
  "attendance",
  "odoo",
  "other",
];
const KB_CATEGORY_OPTIONS = KB_CATEGORY_VALUES.map((value) => ({
  value,
  label: MIS_TICKET_CATEGORIES.find((item) => item.value === value)?.label ?? value,
}));

export const Route = createFileRoute("/_authenticated/kb/")({
  head: () => ({
    meta: [
      { title: "Knowledge Base — MIS Support Hub" },
      { name: "description", content: "Self-serve IT guides and fixes for employees." },
      { property: "og:title", content: "Knowledge Base — MIS Support Hub" },
      { property: "og:description", content: "Self-serve IT help articles." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: KBList,
});

function createSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

type ArticleForm = {
  title: string;
  category: KbCategory;
  content: string;
  published: boolean;
};

const emptyForm: ArticleForm = { title: "", category: "other", content: "", published: true };

function KBList() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<AppRole>("employee");
  const [formMode, setFormMode] = useState<"closed" | "create" | string>("closed");
  const [form, setForm] = useState<ArticleForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadArticles = async () => {
    setLoading(true);
    const context = await getCurrentUserContext();
    const currentRole = context?.role ?? "employee";
    setRole(currentRole);
    let query = supabase.from("kb_articles").select("*").order("title");
    if (currentRole !== "admin") query = query.eq("published", true);
    const { data } = await query;
    setArticles(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void loadArticles();
  }, []);

  const grouped = useMemo(() => {
    const filtered = articles.filter((a) =>
      !q ? true : (a.title + " " + a.content).toLowerCase().includes(q.toLowerCase()),
    );
    return filtered.reduce<Record<string, Article[]>>((acc, a) => {
      (acc[a.category] ??= []).push(a);
      return acc;
    }, {});
  }, [articles, q]);

  const startCreate = () => {
    setForm(emptyForm);
    setFormMode("create");
  };

  const startEdit = (article: Article) => {
    setForm({
      title: article.title,
      category: article.category,
      content: article.content,
      published: article.published,
    });
    setFormMode(article.id);
  };

  const closeForm = () => {
    setFormMode("closed");
    setForm(emptyForm);
  };

  const saveArticle = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = form.title.trim();
    const content = form.content.trim();
    if (title.length < 3 || content.length < 10) {
      toast.error("Enter a title and at least a few sentences of content.");
      return;
    }
    setSaving(true);
    try {
      if (formMode === "create") {
        const slug = createSlug(title);
        if (!slug) {
          toast.error("Could not generate a URL slug from this title.");
          return;
        }
        if (articles.some((a) => a.slug === slug)) {
          toast.error("An article with a very similar title already exists.");
          return;
        }
        const { error } = await supabase.from("kb_articles").insert({
          slug,
          title,
          category: form.category,
          content,
          published: form.published,
        });
        if (error) throw error;
        toast.success("Article created.");
      } else {
        const { error } = await supabase
          .from("kb_articles")
          .update({
            title,
            category: form.category,
            content,
            published: form.published,
          })
          .eq("id", formMode);
        if (error) throw error;
        toast.success("Article updated.");
      }
      closeForm();
      await loadArticles();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Article could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (article: Article) => {
    const { error } = await supabase
      .from("kb_articles")
      .update({ published: !article.published })
      .eq("id", article.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(article.published ? "Article unpublished." : "Article published.");
    await loadArticles();
  };

  const deleteArticle = async (article: Article) => {
    if (!window.confirm(`Delete "${article.title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("kb_articles").delete().eq("id", article.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Article deleted.");
    if (formMode === article.id) closeForm();
    await loadArticles();
  };

  return (
    <>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-muted-foreground">Self-help</p>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            Knowledge <span className="text-gradient">Base</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Try these fixes first — most common issues can be solved in under 2 minutes.
          </p>
        </div>
        {role === "admin" && (
          <Button type="button" onClick={startCreate}>
            <Plus className="mr-2 h-4 w-4" /> New Article
          </Button>
        )}
      </div>

      {formMode !== "closed" && (
        <form
          onSubmit={saveArticle}
          className="mb-6 space-y-4 rounded-2xl border border-primary/30 bg-surface/70 p-5 shadow-card"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">
              {formMode === "create" ? "New article" : "Edit article"}
            </h2>
            <button
              type="button"
              onClick={closeForm}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="kb-title">Title</Label>
              <Input
                id="kb-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Printer shows offline"
                maxLength={150}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(value) => setForm((f) => ({ ...f, category: value as KbCategory }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KB_CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setForm((f) => ({ ...f, published: !f.published }))}
                className="w-full"
              >
                {form.published ? (
                  <>
                    <Eye className="mr-2 h-4 w-4" /> Published
                  </>
                ) : (
                  <>
                    <EyeOff className="mr-2 h-4 w-4" /> Draft
                  </>
                )}
              </Button>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="kb-content">Content</Label>
              <Textarea
                id="kb-content"
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="Step-by-step fix…"
                rows={8}
                maxLength={4000}
                required
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {formMode === "create" ? "Create Article" : "Save Changes"}
            </Button>
            <Button type="button" variant="ghost" onClick={closeForm}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search articles…"
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-surface/40 py-16 text-center backdrop-blur">
          <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No articles match your search.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, list]) => (
            <section key={cat}>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {cat}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {list.map((a) => (
                  <div
                    key={a.id}
                    className="overflow-hidden rounded-2xl border border-border/60 bg-surface/60 backdrop-blur transition hover:border-primary/50"
                  >
                    <Link
                      to="/kb/$slug"
                      params={{ slug: a.slug }}
                      className="group flex items-start gap-3 p-4 transition hover:bg-surface"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant">
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold">{a.title}</p>
                          {!a.published && (
                            <span className="shrink-0 rounded-full bg-warning/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-warning">
                              Draft
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {a.content.slice(0, 120)}…
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-foreground" />
                    </Link>
                    {role === "admin" && (
                      <div className="flex items-center gap-1 border-t border-border/60 px-3 py-1.5">
                        <button
                          type="button"
                          onClick={() => startEdit(a)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void togglePublish(a)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          {a.published ? (
                            <>
                              <EyeOff className="h-3 w-3" /> Unpublish
                            </>
                          ) : (
                            <>
                              <Eye className="h-3 w-3" /> Publish
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteArticle(a)}
                          className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
