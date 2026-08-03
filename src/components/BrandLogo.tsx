import leenLogo from "@/assets/leen-textile-logo.png";

type BrandLogoProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: { image: "h-8", box: "px-2.5 py-1.5" },
  md: { image: "h-10", box: "px-3 py-2" },
  lg: { image: "h-24", box: "px-7 py-4" },
};

export function BrandLogo({ size = "md", className }: BrandLogoProps) {
  const { image, box } = sizes[size];
  return (
    <div
      className={`inline-flex items-center justify-center rounded-xl border border-border/60 bg-white shadow-elegant dark:border-transparent dark:bg-black ${box} ${className ?? ""}`}
    >
      <img src={leenLogo} alt="LEEN Textile Pvt. Ltd." className={`${image} w-auto dark:invert`} />
    </div>
  );
}
