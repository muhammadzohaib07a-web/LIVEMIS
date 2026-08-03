import { useEffect, useRef } from "react";
import anime from "animejs";

// Fixed-look "sea green" splash used for the auth session check and page
// transitions. Deliberately ignores the app's light/dark theme — it always
// renders with its own dark sea-green palette, like a brand splash screen.
export function LeenLoader() {
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

    let isComplete = false;
    const instances: anime.AnimeInstance[] = [];

    const colors = ["#A8E6CF", "#F5A69A", "#F7F5F0", "#6DC3BA"];
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
      el.style.background = colors[Math.floor(Math.random() * colors.length)];
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
          "drop-shadow(0 4px 20px rgba(245,166,154,0.05))",
          "drop-shadow(0 4px 50px rgba(245,166,154,0.25))",
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
          background: ["rgba(245,166,154,0.10)", "rgba(245,166,154,0.70)"],
          boxShadow: ["0 0 0px rgba(245,166,154,0)", "0 0 24px rgba(245,166,154,0.25)"],
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
                "0 0 20px rgba(245,166,154,0)",
                "0 0 60px rgba(245,166,154,0.4)",
                "0 0 20px rgba(245,166,154,0)",
              ],
            } as anime.AnimeParams);
            nodes.forEach((n) => {
              anime({
                targets: n,
                duration: 500,
                easing: "easeOutQuad",
                background: "rgba(245,166,154,0.9)",
                scale: 4,
                boxShadow: "0 0 30px rgba(245,166,154,0.4)",
              } as anime.AnimeParams);
            });
            anime({
              targets: logoText,
              duration: 700,
              easing: "easeOutQuad",
              scale: [1, 1.02, 1],
              filter: [
                "drop-shadow(0 4px 30px rgba(245,166,154,0.15))",
                "drop-shadow(0 4px 60px rgba(245,166,154,0.4))",
                "drop-shadow(0 4px 30px rgba(245,166,154,0.15))",
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
  }, []);

  const handleRestart = () => {
    // Decorative click-to-replay, mirrors the original standalone preview.
  };

  return (
    <div className="ll-root" role="status" aria-label="LEEN Textile loading" onClick={handleRestart}>
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
  background: #0E3530;
  font-family: 'Playfair Display', serif;
  overflow: hidden;
  user-select: none;
}
.ll-root::before {
  content: '';
  position: fixed;
  inset: 0;
  background: radial-gradient(ellipse at 30% 20%, #1A5D52 0%, #0A2F2A 70%, #051E1A 100%);
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
  background: linear-gradient(90deg, transparent, #6DC3BA, #A8E6CF, #6DC3BA, transparent);
}
.ll-thread--v {
  width: 1.5px;
  top: -10%;
  height: 120%;
  background: linear-gradient(180deg, transparent, #6DC3BA, #A8E6CF, #6DC3BA, transparent);
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
  color: #F7F5F0;
  position: relative;
  display: inline-block;
  background: linear-gradient(135deg, #F7F5F0 0%, #F5C6C0 30%, #F7F5F0 60%, #F5A69A 80%, #F7F5F0 100%);
  background-size: 300% 300%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 4px 30px rgba(245, 166, 154, 0.15));
}
.ll-logo__sub {
  display: block;
  font-family: 'Cormorant Garamond', serif;
  font-weight: 300;
  font-style: italic;
  font-size: clamp(0.85rem, 1.6vw, 1.15rem);
  letter-spacing: 0.5em;
  text-transform: uppercase;
  color: #A0CEC7;
  margin-top: 0.1rem;
  opacity: 0.8;
  -webkit-text-fill-color: #A0CEC7;
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
  background: linear-gradient(90deg, transparent, #F5A69A);
}
.ll-ornament__line:last-child {
  background: linear-gradient(90deg, #F5A69A, transparent);
}
.ll-ornament__diamond {
  width: 6px;
  height: 6px;
  transform: rotate(45deg);
  border: 0.5px solid #F5A69A;
  background: rgba(245, 166, 154, 0.1);
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
  background: rgba(247, 245, 240, 0.08);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}
.ll-progress__fill {
  width: 0%;
  height: 100%;
  background: linear-gradient(90deg, #F5A69A, #F7CAC9, #F5A69A);
  background-size: 200% 100%;
  border-radius: 4px;
  position: relative;
  will-change: transform;
  box-shadow: 0 0 20px rgba(245, 166, 154, 0.15);
}
.ll-progress__label {
  font-family: 'Cormorant Garamond', serif;
  font-weight: 300;
  font-style: italic;
  font-size: 0.7rem;
  letter-spacing: 0.5em;
  text-transform: uppercase;
  color: #A0CEC7;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.ll-progress__label .ll-num {
  font-family: 'Playfair Display', serif;
  font-weight: 600;
  font-style: normal;
  font-size: 0.9rem;
  color: #F7CAC9;
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
  background: rgba(245, 166, 154, 0.15);
  will-change: transform, background;
}
.ll-weave-bg {
  position: absolute;
  inset: -40px;
  z-index: 0;
  pointer-events: none;
  opacity: 0.04;
  background-image:
    repeating-linear-gradient(0deg, transparent, transparent 22px, rgba(109, 195, 186, 0.3) 22px, rgba(109, 195, 186, 0.3) 23px),
    repeating-linear-gradient(90deg, transparent, transparent 22px, rgba(109, 195, 186, 0.3) 22px, rgba(109, 195, 186, 0.3) 23px);
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
  box-shadow: 0 0 6px rgba(168, 230, 207, 0.2);
}
.ll-vignette {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9998;
  background: radial-gradient(ellipse at center, transparent 60%, rgba(5, 30, 26, 0.3) 100%);
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
