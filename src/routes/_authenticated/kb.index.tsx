import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Search, BookOpen, ChevronRight, Loader2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Article = Database["public"]["Tables"]["kb_articles"]["Row"];

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

function KBList() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("kb_articles")
        .select("*")
        .eq("published", true)
        .order("title");
      setArticles(data ?? []);
      setLoading(false);
    })();
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

  return (
    <AppShell>
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">Self-help</p>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          Knowledge <span className="text-gradient">Base</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Try these fixes first — most common issues can be solved in under 2 minutes.
        </p>
      </div>

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
                  <Link
                    key={a.id}
                    to="/kb/$slug"
                    params={{ slug: a.slug }}
                    className="group flex items-start gap-3 rounded-2xl border border-border/60 bg-surface/60 p-4 backdrop-blur transition hover:border-primary/50 hover:bg-surface"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{a.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {a.content.slice(0, 120)}…
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-foreground" />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
