import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, BookOpen, Loader2, PlusCircle } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";

type Article = Database["public"]["Tables"]["kb_articles"]["Row"];

export const Route = createFileRoute("/_authenticated/kb/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} — Knowledge Base` },
      { name: "description", content: "IT self-help article at MIS Support Hub." },
      { property: "og:title", content: "Knowledge Base article — MIS Support Hub" },
      { property: "og:description", content: "IT self-help article." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: KBArticle,
});

function KBArticle() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("kb_articles")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      setArticle(data);
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  if (!article) {
    return (
      <>
        <div className="mx-auto max-w-md py-16 text-center">
          <h1 className="text-2xl font-bold">Article not found</h1>
          <Button className="mt-6" onClick={() => navigate({ to: "/kb" })}>
            Back to Knowledge Base
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <Link
        to="/kb"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Knowledge Base
      </Link>
      <article className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary">
            <BookOpen className="h-3 w-3" /> {article.category}
          </span>
        </div>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{article.title}</h1>
        <div className="mt-6 whitespace-pre-wrap rounded-2xl border border-border/60 bg-surface/40 p-6 text-sm leading-relaxed text-foreground/90 backdrop-blur">
          {article.content}
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-border/60 bg-surface/40 p-5 backdrop-blur sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold">Didn't solve your problem?</p>
            <p className="text-xs text-muted-foreground">Open a ticket and MIS will help you directly.</p>
          </div>
          <Link
            to="/report"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant transition hover:opacity-90"
          >
            <PlusCircle className="h-4 w-4" /> Report a problem
          </Link>
        </div>
      </article>
    </>
  );
}
