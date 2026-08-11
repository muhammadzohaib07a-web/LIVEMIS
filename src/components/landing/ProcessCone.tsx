import { useMemo } from "react";

/** Every formation renders the same dots, so switching shape is a tween of
 *  each dot's transform rather than a swap of two different graphics. */
const DOTS = 364;

/** Positions are rounded before they reach the DOM: React's SSR serialiser
 *  truncates style floats to 6 significant digits while the client keeps the
 *  full value, which otherwise trips a hydration mismatch on every dot. */
const round = (value: number, places = 1) => Number(value.toFixed(places));

type Point = { x: number; y: number; z: number };

/** Pads or trims a generated formation to exactly DOTS points. */
function fit(points: Point[]): Point[] {
  if (points.length === DOTS) return points;
  if (points.length > DOTS) return points.slice(0, DOTS);
  const out = [...points];
  while (out.length < DOTS) out.push(points[out.length % points.length]);
  return out;
}

/** 01 — the production funnel: wide intake narrowing to finished output. */
function cone(): Point[] {
  const rings = 14;
  const perRing = 26;
  const points: Point[] = [];
  for (let ring = 0; ring < rings; ring++) {
    const t = ring / (rings - 1);
    const radius = 150 + (26 - 150) * t;
    for (let dot = 0; dot < perRing; dot++) {
      // Each ring is twisted a little further than the one above, so the dots
      // line up into spiral streaks — without that the cone is rotationally
      // symmetric and the spin would be invisible.
      const angle = (dot / perRing) * Math.PI * 2 + ring * 0.16;
      points.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        z: -ring * 20,
      });
    }
  }
  return points;
}

/** 02 — a dense stitch cluster, spread evenly with a Fibonacci sphere. */
function sphere(): Point[] {
  const radius = 128;
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: DOTS }, (_, i) => {
    const y = 1 - (i / (DOTS - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    return {
      x: Math.cos(theta) * r * radius,
      y: Math.sin(theta) * r * radius,
      z: y * radius - 130,
    };
  });
}

/** 03 — twin threads twisting down the line. */
function helix(): Point[] {
  const perStrand = DOTS / 2;
  const points: Point[] = [];
  for (let strand = 0; strand < 2; strand++) {
    for (let i = 0; i < perStrand; i++) {
      const t = i / (perStrand - 1);
      const angle = t * Math.PI * 6 + strand * Math.PI;
      points.push({
        x: Math.cos(angle) * 92,
        y: Math.sin(angle) * 92,
        z: -t * 280,
      });
    }
  }
  return points;
}

/** 04 — packed cartons: dots on the shell of a cube lattice. */
function box(): Point[] {
  const n = 9;
  const half = 112;
  const step = (half * 2) / (n - 1);
  const points: Point[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < n; k++) {
        const onShell = i === 0 || i === n - 1 || j === 0 || j === n - 1 || k === 0 || k === n - 1;
        if (!onShell) continue;
        points.push({
          x: -half + i * step,
          y: -half + j * step,
          z: -half + k * step - 140,
        });
      }
    }
  }
  return points;
}

/** Shifts a formation so its centroid sits on the origin. The parent tilts
 *  the whole field on X, which turns any leftover z-offset into the graphic
 *  hanging below the middle of its box — this keeps all four optically
 *  centred on the same spot as they morph. */
function centre(points: Point[]): Point[] {
  const mean = points.reduce(
    (acc, p) => ({ x: acc.x + p.x / points.length, y: acc.y + p.y / points.length, z: acc.z + p.z / points.length }),
    { x: 0, y: 0, z: 0 },
  );
  return points.map((p) => ({ x: p.x - mean.x, y: p.y - mean.y, z: p.z - mean.z }));
}

const SHAPES = [cone, sphere, helix, box].map((build) =>
  centre(fit(build())).map((p) => ({ x: round(p.x), y: round(p.y), z: round(p.z) })),
);

/**
 * A field of dots that slowly turns on its own axis and re-forms into a
 * different shape for each capability — funnel, cluster, twin threads,
 * packed cartons.
 *
 * Built from plain divs in a `preserve-3d` parent rather than canvas/WebGL:
 * the spin is one compositor-driven transform on the parent, and a shape
 * change is just new per-dot transforms that CSS tweens for us. Nothing
 * runs per frame in JS.
 */
export function ProcessCone({ shape = 0, className = "" }: { shape?: number; className?: string }) {
  const points = SHAPES[shape % SHAPES.length];

  // Staggering the tween by index makes the formation re-assemble in a
  // sweep instead of every dot arriving at once.
  const delays = useMemo(() => Array.from({ length: DOTS }, (_, i) => (i % 40) * 12), []);

  return (
    <div
      className={`pointer-events-none relative grid place-items-center ${className}`}
      style={{ perspective: "900px" }}
      aria-hidden
    >
      <div
        className="animate-funnel-spin relative h-0 w-0"
        style={{ transformStyle: "preserve-3d" }}
      >
        {points.map((point, index) => (
          <span
            key={index}
            className="absolute left-0 top-0 rounded-full bg-white"
            style={{
              width: 2.5,
              height: 2.5,
              opacity: 0.7,
              transform: `translate3d(${point.x}px, ${point.y}px, ${point.z}px)`,
              transition: "transform 1100ms cubic-bezier(0.16, 1, 0.3, 1)",
              transitionDelay: `${delays[index]}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
