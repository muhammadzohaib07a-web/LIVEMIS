import { useRef } from "react";
import { toast } from "sonner";
import leenLogo from "@/assets/leen-textile-logo.png";
import { burstConfetti } from "@/lib/confetti";

type BrandLogoProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: { image: "h-8", box: "px-2.5 py-1.5" },
  md: { image: "h-10", box: "px-3 py-2" },
  lg: { image: "h-24", box: "px-7 py-4" },
};

const EASTER_EGG_CLICKS = 5;
const EASTER_EGG_WINDOW_MS = 2000;

export function BrandLogo({ size = "md", className }: BrandLogoProps) {
  const { image, box } = sizes[size];
  const clickCountRef = useRef(0);
  const firstClickAtRef = useRef(0);

  const handleClick = () => {
    const now = Date.now();
    if (now - firstClickAtRef.current > EASTER_EGG_WINDOW_MS) {
      firstClickAtRef.current = now;
      clickCountRef.current = 0;
    }
    clickCountRef.current += 1;
    if (clickCountRef.current >= EASTER_EGG_CLICKS) {
      clickCountRef.current = 0;
      burstConfetti();
      toast.success("You found it! Thanks for supporting the MIS team. — LEEN Textile");
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`inline-flex items-center justify-center rounded-xl border border-border/60 bg-white shadow-elegant dark:border-transparent dark:bg-black ${box} ${className ?? ""}`}
    >
      <img src={leenLogo} alt="LEEN Textile Pvt. Ltd." className={`${image} w-auto dark:invert`} />
    </div>
  );
}
