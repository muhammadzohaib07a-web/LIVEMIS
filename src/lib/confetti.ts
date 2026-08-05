// Lightweight canvas confetti burst using the app's own theme colors (reads
// the live --primary/--accent/--success CSS variables), so it always stays
// on-brand across light/dark/green themes instead of using stock rainbow
// colors. No dependency — a short-lived fixed canvas that removes itself.
export function burstConfetti() {
  if (typeof document === "undefined") return;

  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.zIndex = "9999";
  canvas.style.pointerEvents = "none";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  const rootStyle = getComputedStyle(document.documentElement);
  const themeColors = ["--primary", "--accent", "--success", "--primary-glow"]
    .map((name) => rootStyle.getPropertyValue(name).trim())
    .filter(Boolean);
  const palette = themeColors.length > 0 ? themeColors : ["#2563eb", "#0ea5e9", "#22c55e"];

  type Particle = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    rotation: number;
    rotationSpeed: number;
  };

  const particles: Particle[] = Array.from({ length: 70 }, () => ({
    x: canvas.width / 2 + (Math.random() - 0.5) * 140,
    y: canvas.height * 0.28 + (Math.random() - 0.5) * 40,
    vx: (Math.random() - 0.5) * 9,
    vy: Math.random() * -7 - 4,
    size: Math.random() * 6 + 4,
    color: palette[Math.floor(Math.random() * palette.length)],
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 14,
  }));

  const gravity = 0.25;
  const maxFrames = 110;
  let frame = 0;

  function tick() {
    if (!ctx) return;
    frame += 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const life = Math.max(0, 1 - frame / maxFrames);
    for (const p of particles) {
      p.vy += gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = life;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (frame < maxFrames) {
      requestAnimationFrame(tick);
    } else {
      canvas.remove();
    }
  }
  requestAnimationFrame(tick);
}
