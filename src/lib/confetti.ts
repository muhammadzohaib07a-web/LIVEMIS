// Full-page confetti "rain" using the app's own theme colors (reads the
// live --primary/--accent/--success CSS variables), so it always stays
// on-brand across light/dark/green themes instead of stock rainbow colors.
// No dependency — a fixed canvas that spawns particles across the full
// width for `durationMs`, then removes itself once everything has fallen
// off-screen.
export function burstConfetti(durationMs = 5000) {
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

  const particles: Particle[] = [];

  function spawnBatch() {
    for (let i = 0; i < 6; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -20,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 2 + 2,
        size: Math.random() * 7 + 5,
        color: palette[Math.floor(Math.random() * palette.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
      });
    }
  }

  const gravity = 0.12;
  const spawnIntervalMs = 40;
  const startTime = performance.now();
  let lastSpawn = 0;

  function tick(now: number) {
    if (!ctx) return;
    const elapsed = now - startTime;
    if (elapsed < durationMs && now - lastSpawn > spawnIntervalMs) {
      lastSpawn = now;
      spawnBatch();
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vy += gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;
      if (p.y > canvas.height + 30) {
        particles.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (elapsed < durationMs || particles.length > 0) {
      requestAnimationFrame(tick);
    } else {
      canvas.remove();
    }
  }
  requestAnimationFrame(tick);
}
