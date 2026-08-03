import leenLogo from "@/assets/leen-textile-logo.png";

// Fixed, faint company mark behind every screen. Sits above body's own
// background gradient (painted as the canvas background, always bottommost)
// but below all normal page content via a negative z-index.
export function BrandWatermark() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 flex items-center justify-center overflow-hidden"
    >
      <img
        src={leenLogo}
        alt=""
        className="w-[36rem] max-w-[70vw] opacity-[0.05] grayscale dark:opacity-[0.09] dark:invert"
      />
    </div>
  );
}
