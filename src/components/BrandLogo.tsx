import leenLogo from "@/assets/leen-textile-logo.png";

type BrandLogoProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: "h-11",
  md: "h-14",
  lg: "h-20",
};

export function BrandLogo({ size = "md", className }: BrandLogoProps) {
  return (
    <div
      className={`inline-flex items-center justify-center rounded-xl border border-border/60 bg-white px-4 py-2 shadow-elegant dark:border-transparent dark:bg-black ${className ?? ""}`}
    >
      <img
        src={leenLogo}
        alt="LEEN Textile Pvt. Ltd."
        className={`${sizes[size]} w-auto dark:invert`}
      />
    </div>
  );
}
