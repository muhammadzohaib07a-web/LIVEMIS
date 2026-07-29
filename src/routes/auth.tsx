import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Building2, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { disablePreviewMode, enablePreviewMode, isPreviewMode } from "@/lib/preview-auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — MIS Support Hub" },
      {
        name: "description",
        content: "Sign in to your MIS Head-managed account to report and track internal IT issues.",
      },
      { property: "og:title", content: "Sign in — MIS Support Hub" },
      { property: "og:description", content: "Access the internal MIS helpdesk." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("real") === "1") {
      disablePreviewMode();
      window.history.replaceState({}, "", "/auth");
    }
    const preview = searchParams.get("preview");
    if (preview === "1" || preview === "employee" || preview === "mis" || preview === "head") {
      enablePreviewMode(preview === "head" ? "admin" : preview === "mis" ? "agent" : "employee");
      navigate({
        to: preview === "mis" || preview === "head" ? "/tickets" : "/dashboard",
        replace: true,
      });
      return;
    }
    if (isPreviewMode()) {
      navigate({ to: "/dashboard", replace: true });
      return;
    }
    const authError = searchParams.get("error_description") ?? searchParams.get("error");
    if (authError) {
      toast.error(decodeURIComponent(authError.replace(/\+/g, " ")));
      window.history.replaceState({}, "", "/auth");
    }
    let active = true;
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || !session || (event !== "SIGNED_IN" && event !== "INITIAL_SESSION")) return;
      navigate({ to: "/dashboard", replace: true });
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) navigate({ to: "/dashboard", replace: true });
      else setChecking(false);
    });
    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: signInEmail.trim().toLowerCase(),
      password: signInPassword,
    });
    setLoading(false);
    if (error) {
      toast.error(
        error.message === "Invalid login credentials"
          ? "Email/password is incorrect, or this is only a preview/unconfirmed account."
          : error.message,
      );
      return;
    }
    toast.success("Welcome back!");
    navigate({ to: "/dashboard", replace: true });
  };

  const handlePreview = () => {
    enablePreviewMode("employee");
    toast.success("Preview mode enabled");
    navigate({ to: "/dashboard", replace: true });
  };

  const handleMisPreview = () => {
    enablePreviewMode("agent");
    toast.success("MIS agent preview enabled");
    navigate({ to: "/tickets", replace: true });
  };

  const handleMisHeadPreview = () => {
    enablePreviewMode("admin");
    toast.success("MIS Head preview enabled");
    navigate({ to: "/tickets", replace: true });
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background">
      <div className="absolute inset-0 bg-gradient-hero" aria-hidden />
      <div className="absolute inset-0 bg-grid opacity-30" aria-hidden />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <div className="mb-8">
          <BrandLogo size="lg" />
          <p className="mt-3 text-sm text-muted-foreground">
            Secure access for textile mill employees and the MIS support team.
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-surface/60 p-6 shadow-elegant backdrop-blur">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-bold">Sign in to Support Hub</h1>
              <p className="text-xs text-muted-foreground">Use your MIS-issued account</p>
            </div>
          </div>

          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="si-email">Gmail / email address</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="si-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                  className="pl-9"
                  placeholder="yourname@gmail.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="si-pass">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="si-pass"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  className="pl-9"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
            </Button>
          </form>

          <div className="my-5 rounded-xl border border-primary/25 bg-primary/5 p-3 text-xs text-muted-foreground">
            <div className="flex gap-2">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="font-semibold text-foreground">Need an account?</p>
                <p className="mt-1">
                  Contact MIS Head Tahir Ghaffar. Your confirmed account, role, and department will
                  be assigned before you sign in.
                </p>
              </div>
            </div>
          </div>

          <Button type="button" variant="secondary" className="w-full" onClick={handlePreview}>
            Preview dashboard without sign in
          </Button>
          <Button type="button" variant="ghost" className="mt-2 w-full" onClick={handleMisPreview}>
            Preview as MIS Agent
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="mt-1 w-full"
            onClick={handleMisHeadPreview}
          >
            Preview as MIS Head
          </Button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to the internal IT usage policy.
        </p>
      </div>
    </div>
  );
}
