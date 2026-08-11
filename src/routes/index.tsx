import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowDown, Menu, X, Play, Pause } from "lucide-react";
import { Reveal } from "@/components/landing/Reveal";
import { ProcessCone } from "@/components/landing/ProcessCone";
import printedFabric from "@/assets/mill/printed-fabric.jpg";
import digitalPrinting from "@/assets/mill/digital-printing.jpg";
import embroideryMachine from "@/assets/mill/embroidery-machine.jpg";
import machineHead from "@/assets/mill/machine-head.jpg";
import embroideryDetail from "@/assets/mill/embroidery-detail.jpg";
import collectionWall from "@/assets/mill/collection-wall.jpg";

const COMPANY = "LEEN TEXTILE";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${COMPANY} — Printing, Embroidery & Finishing Under One Roof` },
      {
        name: "description",
        content:
          "LEEN Textile runs digital fabric printing, computerised embroidery, stitching and finishing in one facility — from greige fabric to a packed, ready-to-ship collection.",
      },
      { property: "og:title", content: `${COMPANY} — One roof, every process` },
      {
        property: "og:description",
        content:
          "Digital printing, computerised embroidery, stitching and wholesale finishing in a single facility.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

/**
 * Torn edge where the water meets the page. Built from mixed sine waves at
 * module scope rather than Math.random so the server and client render the
 * identical path — a random one would trip a hydration mismatch.
 */
const WATER_EDGE_PATH = (() => {
  const width = 1200;
  const steps = 190;
  const points: string[] = [];
  for (let i = steps; i >= 0; i--) {
    const x = (i / steps) * width;
    const y =
      7 + Math.sin(i * 1.73) * 2.6 + Math.sin(i * 0.47) * 2.2 + Math.sin(i * 3.29) * 1.4;
    points.push(`L${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return `M0,0 H${width} ${points.join(" ")} Z`;
})();

const NAV_LINKS = [
  { label: "Process", href: "#process" },
  { label: "Facility", href: "#facility" },
  { label: "Capability", href: "#capability" },
  { label: "Contact", href: "#contact" },
];

/** Hero "hand of cards" — each one is a live clip, not a still. The outer
 *  cards sit higher and slightly larger and the middle pair drops away, so
 *  the spread reads as a fanned deck rather than a flat row. */
const FAN = [
  {
    video: "/mill/fan/fan-1.mp4",
    poster: printedFabric,
    alt: "Freshly printed floral fabric on the line",
    facility: "printing" as const,
    rot: -14,
    y: 0,
    scale: 1.1,
  },
  {
    video: "/mill/fan/fan-2.mp4",
    poster: digitalPrinting,
    alt: "Digital fabric printing head at work",
    facility: "printing" as const,
    rot: -8,
    y: 20,
    scale: 1.05,
  },
  {
    video: "/mill/fan/fan-3.mp4",
    poster: embroideryMachine,
    alt: "Multi-head computerised embroidery machines",
    facility: "embroidery" as const,
    rot: -3,
    y: 40,
    scale: 1,
  },
  {
    video: "/mill/fan/fan-4.mp4",
    poster: machineHead,
    alt: "Embroidery machine head stitching a panel",
    facility: "embroidery" as const,
    rot: 3,
    y: 40,
    scale: 1,
  },
  {
    video: "/mill/fan/fan-5.mp4",
    poster: embroideryDetail,
    alt: "Hand-finished floral embroidery detail",
    facility: "embroidery" as const,
    rot: 8,
    y: 20,
    scale: 1.05,
  },
  {
    video: "/mill/fan/fan-6.mp4",
    poster: collectionWall,
    alt: "Finished collection on the wholesale wall",
    facility: "printing" as const,
    rot: 14,
    y: 0,
    scale: 1.1,
  },
];

const SERVICES = [
  {
    title: "Digital Fabric Printing",
    body: "Wide-format digital printing straight onto greige fabric — colour-matched, repeatable, and run in-house so a design goes from approval to printed metres without leaving the floor.",
    stages: ["Greige in", "Colour match", "Print", "Cured out"],
  },
  {
    title: "Computerised Embroidery",
    body: "Multi-head machines running digitised artwork across panels and dupattas, with hand-finishing on the pieces that need it. Complex layouts stay consistent from the first repeat to the last.",
    stages: ["Digitise", "Hoop", "Stitch", "Trim"],
  },
  {
    title: "Stitching & Finishing",
    body: "Cutting, stitching, trimming, pressing and packing under the same roof — so a delay in one stage is visible immediately instead of surfacing a week later at dispatch.",
    stages: ["Cut", "Stitch", "Press", "Check"],
  },
  {
    title: "Wholesale & Dispatch",
    body: "Catalogued collections packed to order for retail partners, with per-article counts checked at packing and dispatch tracked to the buyer.",
    stages: ["Catalogue", "Count", "Pack", "Dispatch"],
  },
];

/** Placeholder figures — swap these for the real numbers before sharing widely. */
const STATS = [
  { value: "3", suffix: "", label: "Production stages in one facility" },
  { value: "24", suffix: "/7", label: "Printing line uptime target" },
  { value: "100", suffix: "%", label: "In-house, no outsourced stitching" },
  { value: "48", suffix: "hr", label: "Sampling turnaround" },
];

const MARQUEE_WORDS = [
  "DIGITAL PRINTING",
  "COMPUTERISED EMBROIDERY",
  "CUTTING & STITCHING",
  "FINISHING",
  "QUALITY CHECK",
  "PACKING",
  "WHOLESALE DISPATCH",
];

const GALLERY = [
  {
    src: digitalPrinting,
    tag: "Printing",
    title: "Design approved in the morning, printed metres by evening",
  },
  {
    src: embroideryMachine,
    tag: "Embroidery",
    title: "Multi-head runs that hold their repeat across the whole lot",
  },
  {
    src: embroideryDetail,
    tag: "Finishing",
    title: "Where the machine stops and the hand-work starts",
  },
  {
    src: printedFabric,
    tag: "Printing",
    title: "Colour matched against the approved strike-off, every run",
  },
  {
    src: collectionWall,
    tag: "Wholesale",
    title: "Catalogued, counted and packed for the retail floor",
  },
  {
    src: machineHead,
    tag: "Embroidery",
    title: "Digitised artwork translated stitch by stitch",
  },
];

function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeService, setActiveService] = useState(0);
  // Auto-advance the service list until the visitor picks one themselves —
  // after that it stays where they put it.
  const [autoRotate, setAutoRotate] = useState(true);

  const printingRef = useRef<HTMLVideoElement>(null);
  const embroideryRef = useRef<HTMLVideoElement>(null);
  const fanRef = useRef<HTMLDivElement>(null);

  // Autoplaying clips are motion. Anyone who has asked the OS for less of it
  // gets the poster frames instead.
  useEffect(() => {
    if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    fanRef.current?.querySelectorAll("video").forEach((video) => video.pause());
  }, []);

  /**
   * Clicking a hero clip pops the full version out into the browser's
   * floating picture-in-picture window, so it keeps playing in the corner
   * while you carry on down the page. Where that API isn't available
   * (Firefox, older Safari) it falls back to scrolling to the clip and
   * playing it inline.
   */
  const openFacilityClip = async (which: "printing" | "embroidery") => {
    const video = which === "printing" ? printingRef.current : embroideryRef.current;
    if (!video) return;
    try {
      video.currentTime = 0;
      await video.play();
      if (document.pictureInPictureEnabled && !video.disablePictureInPicture) {
        await video.requestPictureInPicture();
        return;
      }
    } catch {
      /* Fall through to the inline behaviour below. */
    }
    video.scrollIntoView({ behavior: "smooth", block: "center" });
    void video.play().catch(() => undefined);
  };

  useEffect(() => {
    if (!autoRotate) return;
    const timer = window.setInterval(
      () => setActiveService((current) => (current + 1) % SERVICES.length),
      5000,
    );
    return () => window.clearInterval(timer);
  }, [autoRotate]);

  const pickService = (index: number) => {
    setAutoRotate(false);
    setActiveService(index);
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <FloatingNav menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden px-4 pb-24 pt-32 sm:px-6 sm:pt-40">
        <div className="mx-auto max-w-6xl text-center">
          <Reveal>
            <h1 className="text-4xl font-black leading-[1.15] tracking-tight sm:text-6xl lg:text-7xl">
              Every process
              <br />
              <span className="mt-3 inline-block bg-white px-4 py-1 text-[#080808] sm:mt-4">
                under one roof
              </span>
            </h1>
          </Reveal>

          {/* Fanned production gallery */}
          <div className="relative mx-auto mt-14 h-[220px] w-full max-w-4xl sm:h-[300px] lg:h-[340px]">
            <div
              ref={fanRef}
              className="absolute left-1/2 top-0 -translate-x-1/2 scale-[0.42] sm:scale-[0.62] lg:scale-90"
            >
              <div className="relative flex h-[380px] w-[900px] items-start justify-center">
                {FAN.map((card, index) => (
                  <Reveal key={card.video} delay={index * 90} className="-mx-7 first:ml-0 last:mr-0">
                    <button
                      type="button"
                      onClick={() => void openFacilityClip(card.facility)}
                      aria-label={`${card.alt} — play the full clip`}
                      // Lift and grow on hover, the way the card deck on the
                      // reference site does. Both the resting and hover
                      // transforms are classes reading the same CSS vars —
                      // an inline transform would outrank the hover rule.
                      className="group relative block overflow-hidden rounded-2xl border border-white/10 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] transition-[transform,box-shadow,border-color] duration-500 ease-out [transform:rotate(var(--rot))_translateY(var(--y))] hover:z-20 hover:border-white/40 hover:shadow-[0_40px_80px_-16px_rgba(0,0,0,1)] hover:[transform:rotate(var(--rot))_translateY(calc(var(--y)-34px))_scale(1.06)]"
                      style={
                        {
                          "--rot": `${card.rot}deg`,
                          "--y": `${card.y}px`,
                          width: 190 * card.scale,
                          height: 300 * card.scale,
                        } as React.CSSProperties
                      }
                    >
                      <video
                        src={card.video}
                        poster={card.poster}
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload={index < 3 ? "auto" : "metadata"}
                        aria-hidden
                        className="h-full w-full object-cover"
                      />
                      {/* Play affordance, revealed on hover */}
                      <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition duration-300 group-hover:bg-black/25 group-hover:opacity-100">
                        <span className="grid h-11 w-11 place-items-center rounded-full bg-white/95 text-[#080808] shadow-lg">
                          <Play className="ml-0.5 h-4 w-4 fill-current" />
                        </span>
                      </span>
                    </button>
                  </Reveal>
                ))}
              </div>
            </div>

            {/* Speech-bubble labels pinned over the fan */}
            <Bubble className="left-[2%] top-[8%] sm:left-[6%]" text="@printing" />
            <Bubble className="right-[2%] top-[4%] sm:right-[8%]" text="@embroidery" />
            <Bubble
              className="bottom-[2%] left-1/2 -translate-x-1/2"
              text="@wholesale"
              tail="top"
            />
          </div>

          <Reveal delay={200}>
            <p className="mx-auto mt-10 max-w-2xl text-balance text-sm leading-relaxed text-white/60 sm:text-base">
              Printing, embroidery, stitching and packing run in the same building — so nothing
              waits on a subcontractor, and a problem is caught on the floor instead of at dispatch.
            </p>
          </Reveal>

          <Reveal delay={300}>
            <a
              href="#process"
              className="mx-auto mt-12 grid h-12 w-12 place-items-center rounded-full border border-white/25 text-white/70 transition hover:border-white hover:text-white"
              aria-label="Scroll to process"
            >
              <ArrowDown className="h-4 w-4" />
            </a>
          </Reveal>
        </div>
      </section>

      {/* ---------------- Keyword marquee ---------------- */}
      <div className="overflow-hidden border-y border-white/10 py-5">
        <div className="animate-marquee-slide flex w-max">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0" aria-hidden={copy === 1}>
              {MARQUEE_WORDS.map((word) => (
                <span
                  key={`${copy}-${word}`}
                  className="flex items-center whitespace-nowrap px-6 text-xs font-semibold uppercase tracking-[0.25em] text-white/35"
                >
                  {word}
                  <span className="ml-6 h-1 w-1 rounded-full bg-white/25" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ---------------- Why / statement ---------------- */}
      <section
        id="process"
        className="scroll-mt-24 bg-white px-4 pb-28 pt-24 text-[#080808] sm:px-6 sm:pb-40 sm:pt-32"
      >
        <div className="mx-auto max-w-4xl text-center">
          {/* Oversized wordmark with its own reflection pooling underneath */}
          <Reveal>
            <div className="select-none leading-[0.78]">
              <h2 className="text-[26vw] font-black tracking-tighter sm:text-[13rem]">WHY</h2>
              {/* The letters again, mirrored onto water: two copies swaying
                  out of phase with each other, cut by drifting ripple lines.
                  The surface itself is full-bleed, so the waterline runs edge
                  to edge behind the centred column. */}
              <div aria-hidden className="relative h-[22vw] sm:h-44">
                <div className="absolute left-1/2 top-0 h-full w-screen -translate-x-1/2 overflow-hidden bg-gradient-to-b from-black/[0.07] via-black/[0.03] to-transparent">
                  <div
                    className="relative mx-auto h-full max-w-4xl"
                    style={{
                      maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.95), transparent 96%)",
                      WebkitMaskImage:
                        "linear-gradient(to bottom, rgba(0,0,0,0.95), transparent 96%)",
                    }}
                  >
                    <div className="animate-water-a absolute inset-x-0 top-0 text-[26vw] font-black tracking-tighter text-black/60 sm:text-[13rem]">
                      WHY
                    </div>
                    <div className="animate-water-b absolute inset-x-0 top-0 text-[26vw] font-black tracking-tighter text-black/30 sm:text-[13rem]">
                      WHY
                    </div>
                  </div>
                  <div
                    className="animate-water-lines absolute inset-0"
                    style={{
                      // Two ripple periods that don't divide into each other,
                      // so the banding reads as water rather than blinds.
                      backgroundImage: [
                        "repeating-linear-gradient(to bottom, transparent 0 3px, rgba(255,255,255,0.55) 3px 4.5px)",
                        "repeating-linear-gradient(to bottom, transparent 0 5.5px, rgba(255,255,255,0.3) 5.5px 7.3px)",
                      ].join(","),
                    }}
                  />
                  {/* Torn waterline, painted in the page colour so it bites
                      into the reflection and the surface together. */}
                  <svg
                    className="absolute inset-x-0 top-0 h-3 w-full"
                    viewBox="0 0 1200 14"
                    preserveAspectRatio="none"
                  >
                    <path d={WATER_EDGE_PATH} fill="#fff" />
                  </svg>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={140}>
            <div className="mt-10 space-y-3 text-lg font-bold leading-relaxed sm:text-2xl">
              <p>Quality slips in the handovers, not in the machines.</p>
              <p>Every extra factory is one more place for it to go wrong.</p>
              <p>
                That is why everything happens{" "}
                <span className="whitespace-nowrap bg-[#080808] px-2.5 py-0.5 text-white">
                  under one roof
                </span>
                .
              </p>
            </div>
          </Reveal>

          <Reveal delay={260}>
            <a
              href="#facility"
              className="mt-12 inline-flex items-center gap-3 rounded-full border border-black/25 px-7 py-3.5 text-sm font-semibold transition hover:border-black hover:bg-black hover:text-white"
            >
              See the facility
              <ArrowRight className="h-4 w-4" />
            </a>
          </Reveal>
        </div>
      </section>

      {/* ---------------- Company information ---------------- */}
      <section className="px-4 py-24 sm:px-6 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-white/40">
              Company Information
            </p>
          </Reveal>
          <div className="mt-16 grid grid-cols-2 gap-x-6 gap-y-14 lg:grid-cols-4">
            {STATS.map((stat, index) => (
              <Reveal key={stat.label} delay={index * 110} className="text-center">
                <div className="text-4xl font-black tracking-tight sm:text-5xl">
                  {stat.value}
                  <span className="text-white/45">{stat.suffix}</span>
                </div>
                <p className="mx-auto mt-3 max-w-[16ch] text-xs leading-relaxed text-white/45">
                  {stat.label}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Services + rotating cone ---------------- */}
      <section
        id="capability"
        className="scroll-mt-24 border-t border-white/10 px-4 py-24 sm:px-6 sm:py-32"
      >
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between border-b border-white/15 pb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">
              Our Capability
            </p>
            <p className="font-mono text-xs text-white/40">
              {String(activeService + 1).padStart(2, "0")} / {String(SERVICES.length).padStart(2, "0")}
            </p>
          </div>

          <div className="grid gap-10 pt-12 lg:grid-cols-2 lg:items-center">
            <div>
              <Reveal key={activeService}>
                <h2 className="text-3xl font-black tracking-tight sm:text-5xl">
                  {SERVICES[activeService].title}
                </h2>
                <p className="mt-6 max-w-lg leading-relaxed text-white/55">
                  {SERVICES[activeService].body}
                </p>
              </Reveal>
              <a
                href="#contact"
                className="mt-9 inline-flex items-center gap-3 rounded-full border border-white/30 px-7 py-3.5 text-sm font-semibold transition hover:border-white hover:bg-white hover:text-[#080808]"
              >
                Enquire about this
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>

            <div className="relative order-first h-[300px] lg:order-none lg:h-[420px]">
              <ProcessCone shape={activeService} className="h-full w-full" />
              {/* Stage labels down the right edge, re-lettered per capability */}
              <div className="pointer-events-none absolute inset-y-0 right-0 hidden flex-col justify-center gap-8 pr-2 sm:flex">
                {SERVICES[activeService].stages.map((stage, index) => (
                  <div key={stage} className="flex items-center gap-3">
                    <span className="h-px w-8 bg-white/25" />
                    <Reveal key={`${activeService}-${stage}`} delay={index * 70}>
                      <span className="block rounded bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/70">
                        {stage}
                      </span>
                    </Reveal>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Numbered selector */}
          <ul className="mt-14">
            {SERVICES.map((service, index) => {
              const active = index === activeService;
              return (
                <li key={service.title}>
                  <button
                    type="button"
                    onClick={() => pickService(index)}
                    aria-current={active}
                    className={`flex w-full items-center gap-5 border-t border-white/12 py-5 text-left transition ${
                      active ? "text-white" : "text-white/40 hover:text-white/75"
                    }`}
                  >
                    <span className="font-mono text-xs">{String(index + 1).padStart(2, "0")}</span>
                    <span className="text-base font-semibold sm:text-lg">{service.title}</span>
                    <ArrowRight
                      className={`ml-auto h-4 w-4 transition ${
                        active ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0"
                      }`}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ---------------- Video showcase ---------------- */}
      <section
        id="facility"
        className="scroll-mt-24 border-t border-white/10 px-4 py-24 sm:px-6 sm:py-32"
      >
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">
              Inside the facility
            </p>
            <h2 className="mt-6 max-w-2xl text-3xl font-black tracking-tight sm:text-5xl">
              Shot on the floor, not in a brochure.
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-8 sm:grid-cols-2">
            <Reveal>
              <FacilityVideo
                videoRef={printingRef}
                src="/mill/printing.mp4"
                poster="/mill/printing-poster.jpg"
                title="Digital printing line"
                caption="Greige fabric in, colour-matched print out — running continuously."
              />
            </Reveal>
            <Reveal delay={140}>
              <FacilityVideo
                videoRef={embroideryRef}
                src="/mill/embroidery.mp4"
                poster="/mill/embroidery-poster.jpg"
                title="Embroidery & finishing"
                caption="Multi-head embroidery through to stitching, checking and packing."
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------- Gallery grid ---------------- */}
      <section className="bg-white px-4 py-24 text-[#080808] sm:px-6 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-black/40">
              From the floor
            </p>
          </Reveal>
          <div className="mt-12 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {GALLERY.map((item, index) => (
              <Reveal key={item.title} delay={(index % 3) * 110}>
                <article className="group">
                  <div className="aspect-[4/3] overflow-hidden rounded-xl bg-black/5">
                    <img
                      src={item.src}
                      alt={item.title}
                      loading="lazy"
                      className="h-full w-full object-cover grayscale transition duration-700 group-hover:scale-[1.04] group-hover:grayscale-0"
                    />
                  </div>
                  <span className="mt-5 inline-block rounded-full border border-black/15 px-3 py-1 text-[11px] font-medium">
                    {item.tag}
                  </span>
                  <h3 className="mt-3 text-lg font-bold leading-snug">{item.title}</h3>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- CTA + footer ---------------- */}
      <footer id="contact" className="scroll-mt-24 px-4 pb-14 pt-24 sm:px-6 sm:pt-32">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <a
              href="mailto:info@leentextile.com"
              className="group block max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-5xl"
            >
              Have a collection to produce?
              <br />
              <span className="inline-flex items-center gap-4">
                Talk to the mill directly.
                <ArrowRight className="h-8 w-8 shrink-0 transition group-hover:translate-x-2 sm:h-10 sm:w-10" />
              </span>
            </a>
          </Reveal>

          <div className="mt-24 flex flex-col justify-between gap-10 border-t border-white/10 pt-10 sm:flex-row">
            <div className="text-sm text-white/45">
              <p className="font-bold tracking-tight text-white">{COMPANY} PVT. LTD.</p>
              <p className="mt-3">Printing · Embroidery · Stitching · Wholesale</p>
              <p className="mt-1">info@leentextile.com</p>
              <p className="mt-1">Working hours: Mon–Sat, 9:00–18:00</p>
            </div>
            <div className="flex flex-col items-start gap-3 text-sm sm:items-end">
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-2.5 font-semibold transition hover:border-white hover:bg-white hover:text-[#080808]"
              >
                Staff portal
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="text-xs text-white/35">
                © {new Date().getFullYear()} {COMPANY} Pvt. Ltd. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FloatingNav({
  menuOpen,
  setMenuOpen,
}: {
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
}) {
  return (
    <header className="fixed inset-x-0 top-4 z-50 px-4">
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between rounded-full bg-[#0f0f0f]/90 pl-5 pr-1.5 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.9)] ring-1 ring-white/10 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/80 transition hover:text-white"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          <span className="hidden sm:inline">Menu</span>
        </button>

        <a href="#top" className="text-sm font-black tracking-[0.2em]">
          {COMPANY}
        </a>

        <a
          href="#contact"
          className="rounded-full bg-white px-5 py-2.5 text-xs font-bold text-[#080808] transition hover:bg-white/85"
        >
          Enquire
        </a>
      </div>

      {menuOpen && (
        <nav className="mx-auto mt-2 max-w-2xl overflow-hidden rounded-3xl bg-[#0f0f0f]/95 p-2 ring-1 ring-white/10 backdrop-blur-xl">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="block rounded-2xl px-5 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/5 hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}

function Bubble({
  text,
  className = "",
  tail = "bottom",
}: {
  text: string;
  className?: string;
  tail?: "bottom" | "top";
}) {
  return (
    <span
      className={`absolute z-10 rounded-full bg-white px-3.5 py-1.5 text-[11px] font-semibold text-[#080808] shadow-lg sm:text-xs ${className}`}
    >
      {text}
      <span
        className={`absolute left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-white ${
          tail === "bottom" ? "-bottom-1" : "-top-1"
        }`}
      />
    </span>
  );
}

/** Muted, looping clip that only downloads once the visitor presses play —
 *  a landing page shouldn't pull megabytes of video nobody asked for.
 *  `playing` is derived from the element's own play/pause events rather than
 *  set alongside the call, so the button stays correct when a hero card
 *  starts this video from the outside. */
function FacilityVideo({
  src,
  poster,
  title,
  caption,
  videoRef,
}: {
  src: string;
  poster: string;
  title: string;
  caption: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}) {
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => undefined);
    else video.pause();
  };

  return (
    <figure>
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          muted
          loop
          playsInline
          // Metadata only: enough for the browser to hand this element to
          // picture-in-picture when a hero card asks for it, without
          // pulling the megabytes until someone actually plays it.
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          className="aspect-[4/5] w-full object-cover sm:aspect-[3/4]"
        />
        <button
          type="button"
          onClick={toggle}
          className={`absolute inset-0 grid place-items-center transition ${
            playing
              ? "bg-transparent opacity-0 hover:opacity-100 hover:bg-black/25"
              : "bg-gradient-to-t from-black/60 via-transparent to-transparent hover:bg-black/20"
          }`}
          aria-label={playing ? `Pause ${title}` : `Play ${title}`}
        >
          <span className="grid h-14 w-14 place-items-center rounded-full bg-white/95 text-[#080808] shadow-xl transition hover:scale-105">
            {playing ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="ml-0.5 h-5 w-5 fill-current" />
            )}
          </span>
        </button>
      </div>
      <figcaption className="mt-5">
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-white/50">{caption}</p>
      </figcaption>
    </figure>
  );
}
