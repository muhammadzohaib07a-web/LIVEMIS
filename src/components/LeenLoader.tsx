const LETTERS = ["L", "E", "E", "N"];

type LeenLoaderProps = {
  label?: string;
  fullScreen?: boolean;
};

// Branded loading state: each letter of LEEN rises and fades in a staggered
// loop, with a shimmering sweep underneath, used wherever the app needs a
// full loading screen (auth check, route transitions) instead of a bare spinner.
export function LeenLoader({ label, fullScreen }: LeenLoaderProps) {
  const content = (
    <div className="flex flex-col items-center gap-5">
      <div className="flex" aria-hidden="true">
        {LETTERS.map((letter, index) => (
          <span
            key={index}
            className="animate-letter-rise font-serif text-8xl font-bold tracking-[0.12em] text-foreground sm:text-9xl"
            style={{ animationDelay: `${index * 0.12}s` }}
          >
            {letter}
          </span>
        ))}
      </div>
      <span className="sr-only">Loading — LEEN Textile Pvt. Ltd.</span>
      <div
        className="h-0.5 w-56 animate-shimmer-sweep bg-[length:200%_100%] sm:w-72"
        style={{
          backgroundImage: "linear-gradient(90deg, transparent, var(--color-primary), transparent)",
        }}
      />
      <p className="text-xs font-semibold uppercase tracking-[0.5em] text-muted-foreground">
        Textile Pvt. Ltd.
      </p>
      {label && <p className="mt-1 text-sm text-muted-foreground">{label}</p>}
    </div>
  );

  if (!fullScreen) return content;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">{content}</div>
  );
}
