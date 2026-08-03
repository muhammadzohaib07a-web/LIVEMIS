import { useEffect, useRef, useState } from "react";
import anime from "animejs";
import { getPreferredTheme } from "@/lib/theme";

const PALETTES = {
  dark: {
    bg: "#000000",
    beforeGradient: "radial-gradient(ellipse at 30% 20%, #141414 0%, #060606 70%, #000000 100%)",
    textGradient:
      "linear-gradient(135deg, #F7F5F0 0%, #F5C6C0 30%, #F7F5F0 60%, #F5A69A 80%, #F7F5F0 100%)",
    subColor: "#A0CEC7",
    threadColor: "#6DC3BA, #A8E6CF, #6DC3BA",
    progressGradient: "linear-gradient(90deg, #F5A69A, #F7CAC9, #F5A69A)",
    progressTrackBg: "rgba(247, 245, 240, 0.08)",
    accentRgb: "245,166,154",
    particleColors: ["#A8E6CF", "#F5A69A", "#F7F5F0", "#6DC3BA"],
    weaveLine: "rgba(109, 195, 186, 0.3)",
    vignette: "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.55) 100%)",
    particleGlow: "rgba(168, 230, 207, 0.2)",
  },
  light: {
    bg: "#FFFFFF",
    beforeGradient: "radial-gradient(ellipse at 30% 20%, #F2FAF7 0%, #FFFFFF 70%, #FFFFFF 100%)",
    textGradient:
      "linear-gradient(135deg, #16332E 0%, #C97B6E 30%, #16332E 60%, #B85C4E 80%, #16332E 100%)",
    subColor: "#2F7C6E",
    threadColor: "#3FA898, #1F5C50, #3FA898",
    progressGradient: "linear-gradient(90deg, #C97B6E, #E3A79A, #C97B6E)",
    progressTrackBg: "rgba(22, 51, 46, 0.08)",
    accentRgb: "201,123,110",
    particleColors: ["#2F7C6E", "#C97B6E", "#16332E", "#3FA898"],
    weaveLine: "rgba(63, 168, 152, 0.25)",
    vignette: "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.06) 100%)",
    particleGlow: "rgba(47, 124, 110, 0.2)",
  },
} as const;

// Splash used for the auth session check and page transitions. Follows the
// app's light/dark theme: black canvas + cream/coral accents in dark mode,
// white canvas + deep teal/coral accents in light mode.
export function LeenLoader() {
  const [theme] = useState(getPreferredTheme);
  const palette = PALETTES[theme];

  const particlesRef = useRef<HTMLDivElement>(null);
  const logoTextRef = useRef<HTMLSpanElement>(null);
  const logoSubRef = useRef<HTMLSpanElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const numLabelRef = useRef<HTMLSpanElement>(null);
  const threadRefs = useRef<(HTMLDivElement | null)[]>([]);
  const nodeRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const particlesContainer = particlesRef.current;
    const logoText = logoTextRef.current;
    const logoSub = logoSubRef.current;
    const fill = fillRef.current;
    const numLabel = numLabelRef.current;
    const threads = threadRefs.current.filter((el): el is HTMLDivElement => el !== null);
    const nodes = nodeRefs.current.filter((el): el is HTMLSpanElement => el !== null);
    if (!particlesContainer || !logoText || !logoSub || !fill || !numLabel) return;

    const accent = palette.accentRgb;
    let isComplete = false;
    const instances: anime.AnimeInstance[] = [];

    const particleCount = 32;
    const fragment = document.createDocumentFragment();
    const particleData: { el: HTMLSpanElement; delay: number; duration: number; x: number; y: number }[] = [];
    for (let i = 0; i < particleCount; i++) {
      const el = document.createElement("span");
      el.className = "ll-particle";
      const size = 1.5 + Math.random() * 3;
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.left = `${2 + Math.random() * 96}%`;
      el.style.top = `${2 + Math.random() * 96}%`;
      el.style.background = palette.particleColors[Math.floor(Math.random() * palette.particleColors.length)];
      el.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
      const data = {
        el,
        delay: Math.random() * 2.5,
        duration: 4 + Math.random() * 5,
        x: (Math.random() - 0.5) * 180,
        y: (Math.random() - 0.5) * 180,
      };
      particleData.push(data);
      fragment.appendChild(el);
    }
    particlesContainer.appendChild(fragment);

    threads.forEach((t, i) => {
      const isH = t.classList.contains("ll-thread--h");
      const dur = 6 + ((i * 0.7) % 3);
      const delay = (i * 0.2) % 1.2;
      const prop = isH ? "translateX" : "translateY";
      const scaleProp = isH ? "scaleX" : "scaleY";
      instances.push(
        anime({
          targets: t,
          duration: dur * 1000,
          delay: delay * 1000,
          loop: true,
          direction: "alternate",
          easing: "easeInOutQuad",
          [prop]: ["-18%", "18%"],
          [scaleProp]: [0.3, 1.8],
          opacity: [0.08, 0.4],
        } as anime.AnimeParams),
      );
    });

    instances.push(
      anime({
        targets: logoText,
        duration: 4500,
        loop: true,
        direction: "alternate",
        easing: "easeInOutSine",
        letterSpacing: ["0.04em", "0.12em"],
        filter: [
          `drop-shadow(0 4px 20px rgba(${accent},0.05))`,
          `drop-shadow(0 4px 50px rgba(${accent},0.25))`,
        ],
        translateY: [0, -4],
        update: (anim) => {
          const p = anim.progress / 100;
          const pos = 50 + 50 * Math.sin(p * Math.PI * 2);
          logoText.style.backgroundPosition = `${pos}% 50%`;
        },
      } as anime.AnimeParams),
    );

    instances.push(
      anime({
        targets: logoSub,
        duration: 5000,
        loop: true,
        direction: "alternate",
        easing: "easeInOutQuad",
        opacity: [0.5, 0.95],
        letterSpacing: ["0.3em", "0.8em"],
        translateY: [0, -5],
      }),
    );

    nodes.forEach((node, i) => {
      instances.push(
        anime({
          targets: node,
          duration: 1800,
          delay: i * 130,
          loop: true,
          direction: "alternate",
          easing: "easeInOutQuad",
          scale: [1, 3.0],
          background: [`rgba(${accent},0.10)`, `rgba(${accent},0.70)`],
          boxShadow: [`0 0 0px rgba(${accent},0)`, `0 0 24px rgba(${accent},0.25)`],
        } as anime.AnimeParams),
      );
    });

    particleData.forEach(({ el, delay, duration, x, y }) => {
      instances.push(
        anime({
          targets: el,
          duration: duration * 1000,
          delay: delay * 1000,
          loop: true,
          direction: "alternate",
          easing: "easeInOutSine",
          translateX: [0, `${x}%`],
          translateY: [0, `${y}%`],
          opacity: [0, 0.8, 0],
          scale: [0, 1.8, 0],
          rotate: [0, 360],
        } as anime.AnimeParams),
      );
    });

    let progressAnim: anime.AnimeInstance | null = null;
    const startProgress = () => {
      if (progressAnim) progressAnim.pause();
      progressAnim = anime({
        targets: { val: 0 },
        val: 100,
        duration: 4200,
        easing: "easeOutCubic",
        update: (anim) => {
          const v = Math.round((anim.animations[0] as unknown as { currentValue: number }).currentValue);
          const clamped = Math.min(Math.max(v, 0), 100);
          fill.style.width = `${clamped}%`;
          numLabel.textContent = String(clamped);
          if (clamped === 100 && !isComplete) {
            isComplete = true;
            anime({
              targets: fill,
              duration: 600,
              easing: "easeOutQuad",
              boxShadow: [
                `0 0 20px rgba(${accent},0)`,
                `0 0 60px rgba(${accent},0.4)`,
                `0 0 20px rgba(${accent},0)`,
              ],
            } as anime.AnimeParams);
            nodes.forEach((n) => {
              anime({
                targets: n,
                duration: 500,
                easing: "easeOutQuad",
                background: `rgba(${accent},0.9)`,
                scale: 4,
                boxShadow: `0 0 30px rgba(${accent},0.4)`,
              } as anime.AnimeParams);
            });
            anime({
              targets: logoText,
              duration: 700,
              easing: "easeOutQuad",
              scale: [1, 1.02, 1],
              filter: [
                `drop-shadow(0 4px 30px rgba(${accent},0.15))`,
                `drop-shadow(0 4px 60px rgba(${accent},0.4))`,
                `drop-shadow(0 4px 30px rgba(${accent},0.15))`,
              ],
            } as anime.AnimeParams);
          }
        },
      } as anime.AnimeParams);
      instances.push(progressAnim);
    };
    startProgress();

    return () => {
      instances.forEach((instance) => instance.pause());
      particlesContainer.replaceChildren();
    };
  }, [palette]);

  return (
    <div
      className="ll-root"
      role="status"
      aria-label="LEEN Textile loading"
      style={
        {
          "--ll-bg": palette.bg,
          "--ll-before-gradient": palette.beforeGradient,
          "--ll-text-gradient": palette.textGradient,
          "--ll-sub-color": palette.subColor,
          "--ll-thread-color": palette.threadColor,
          "--ll-progress-gradient": palette.progressGradient,
          "--ll-progress-track-bg": palette.progressTrackBg,
          "--ll-accent-rgb": palette.accentRgb,
          "--ll-weave-line": palette.weaveLine,
          "--ll-vignette": palette.vignette,
          "--ll-particle-glow": palette.particleGlow,
        } as React.CSSProperties
      }
    >
      <style>{LEEN_LOADER_CSS}</style>
      <div className="ll-vignette" />
      <div className="ll-loader">
        <div className="ll-weave-bg" aria-hidden="true" />
        <div className="ll-particles" ref={particlesRef} aria-hidden="true" />
        <div className="ll-threads" aria-hidden="true">
          {[10, 32, 54, 76].map((top, i) => (
            <div
              key={`h-${i}`}
              ref={(el) => {
                threadRefs.current[i] = el;
              }}
              className="ll-thread ll-thread--h"
              style={{ top: `${top}%` }}
            />
          ))}
          {[14, 36, 58, 80].map((left, i) => (
            <div
              key={`v-${i}`}
              ref={(el) => {
                threadRefs.current[4 + i] = el;
              }}
              className="ll-thread ll-thread--v"
              style={{ left: `${left}%` }}
            />
          ))}
        </div>

        <div className="ll-logo">
          <span className="ll-logo__main" ref={logoTextRef}>
            Leen Textile
          </span>
          <div className="ll-ornament">
            <span className="ll-ornament__line" />
            <span className="ll-ornament__diamond" />
            <span className="ll-ornament__line" />
          </div>
          <span className="ll-logo__sub" ref={logoSubRef}>
            · sea fabrics ·
          </span>
        </div>

        <div className="ll-progress">
          <div className="ll-progress__track">
            <div className="ll-progress__fill" ref={fillRef} />
          </div>
          <div className="ll-progress__label">
            <span>sailing</span>
            <span className="ll-num" ref={numLabelRef}>
              0
            </span>
            <span>%</span>
          </div>
        </div>

        <div className="ll-nodes" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              ref={(el) => {
                nodeRefs.current[i] = el;
              }}
              className="ll-node"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const LEEN_LOADER_CSS = `
.ll-root {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ll-bg);
  font-family: 'Playfair Display', serif;
  overflow: hidden;
  user-select: none;
}
.ll-root::before {
  content: '';
  position: fixed;
  inset: 0;
  background: var(--ll-before-gradient);
  pointer-events: none;
  z-index: 0;
}
.ll-loader {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 820px;
  padding: 2.5rem 2rem;
  z-index: 1;
  animation: ll-entrance 1s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.ll-threads {
  position: absolute;
  inset: -20px;
  pointer-events: none;
  overflow: hidden;
  z-index: 0;
  opacity: 0.25;
}
.ll-thread {
  position: absolute;
  border-radius: 2px;
  will-change: transform, opacity;
}
.ll-thread--h {
  height: 1.5px;
  left: -10%;
  width: 120%;
  background: linear-gradient(90deg, transparent, var(--ll-thread-color), transparent);
}
.ll-thread--v {
  width: 1.5px;
  top: -10%;
  height: 120%;
  background: linear-gradient(180deg, transparent, var(--ll-thread-color), transparent);
}
.ll-logo {
  position: relative;
  z-index: 2;
  text-align: center;
  margin-bottom: 3.2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.ll-logo__main {
  font-family: 'Playfair Display', serif;
  font-weight: 700;
  font-size: clamp(3.2rem, 10vw, 5.6rem);
  letter-spacing: 0.06em;
  line-height: 1.05;
  position: relative;
  display: inline-block;
  background: var(--ll-text-gradient);
  background-size: 300% 300%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 4px 30px rgba(var(--ll-accent-rgb), 0.15));
}
.ll-logo__sub {
  display: block;
  font-family: 'Cormorant Garamond', serif;
  font-weight: 300;
  font-style: italic;
  font-size: clamp(0.85rem, 1.6vw, 1.15rem);
  letter-spacing: 0.5em;
  text-transform: uppercase;
  color: var(--ll-sub-color);
  margin-top: 0.1rem;
  opacity: 0.8;
  -webkit-text-fill-color: var(--ll-sub-color);
}
.ll-ornament {
  display: flex;
  align-items: center;
  gap: 1.2rem;
  margin: 0.2rem 0 0.6rem 0;
  opacity: 0.6;
}
.ll-ornament__line {
  width: 40px;
  height: 0.5px;
  background: linear-gradient(90deg, transparent, rgba(var(--ll-accent-rgb), 0.9));
}
.ll-ornament__line:last-child {
  background: linear-gradient(90deg, rgba(var(--ll-accent-rgb), 0.9), transparent);
}
.ll-ornament__diamond {
  width: 6px;
  height: 6px;
  transform: rotate(45deg);
  border: 0.5px solid rgba(var(--ll-accent-rgb), 0.9);
  background: rgba(var(--ll-accent-rgb), 0.1);
}
.ll-progress {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8rem;
}
.ll-progress__track {
  width: 100%;
  height: 2px;
  background: var(--ll-progress-track-bg);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}
.ll-progress__fill {
  width: 0%;
  height: 100%;
  background: var(--ll-progress-gradient);
  background-size: 200% 100%;
  border-radius: 4px;
  position: relative;
  will-change: transform;
  box-shadow: 0 0 20px rgba(var(--ll-accent-rgb), 0.15);
}
.ll-progress__label {
  font-family: 'Cormorant Garamond', serif;
  font-weight: 300;
  font-style: italic;
  font-size: 0.7rem;
  letter-spacing: 0.5em;
  text-transform: uppercase;
  color: var(--ll-sub-color);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.ll-progress__label .ll-num {
  font-family: 'Playfair Display', serif;
  font-weight: 600;
  font-style: normal;
  font-size: 0.9rem;
  color: rgba(var(--ll-accent-rgb), 1);
  letter-spacing: 0.05em;
  min-width: 2.4rem;
  display: inline-block;
  text-align: center;
}
.ll-nodes {
  display: flex;
  gap: 14px;
  margin-top: 0.6rem;
  z-index: 2;
  position: relative;
}
.ll-node {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(var(--ll-accent-rgb), 0.15);
  will-change: transform, background;
}
.ll-weave-bg {
  position: absolute;
  inset: -40px;
  z-index: 0;
  pointer-events: none;
  opacity: 0.04;
  background-image:
    repeating-linear-gradient(0deg, transparent, transparent 22px, var(--ll-weave-line) 22px, var(--ll-weave-line) 23px),
    repeating-linear-gradient(90deg, transparent, transparent 22px, var(--ll-weave-line) 22px, var(--ll-weave-line) 23px);
  background-size: 44px 44px;
  mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
  -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
}
.ll-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: visible;
}
.ll-particle {
  position: absolute;
  border-radius: 50%;
  opacity: 0;
  will-change: transform, opacity;
  box-shadow: 0 0 6px var(--ll-particle-glow);
}
.ll-vignette {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9998;
  background: var(--ll-vignette);
}
@media (max-width: 480px) {
  .ll-loader { padding: 1.5rem 1rem; }
  .ll-logo__main { font-size: clamp(2.4rem, 12vw, 3.4rem); letter-spacing: 0.03em; }
  .ll-logo__sub { font-size: 0.6rem; letter-spacing: 0.3em; }
  .ll-progress { max-width: 260px; }
  .ll-ornament__line { width: 24px; }
  .ll-nodes { gap: 10px; }
  .ll-threads { opacity: 0.15; }
}
@keyframes ll-entrance {
  0% { opacity: 0; transform: scale(0.97) translateY(10px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
`;
