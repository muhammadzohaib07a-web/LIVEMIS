import leenLogo from "@/assets/leen-textile-logo.png";

type BrandLogoProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: "h-8",
  md: "h-10",
  lg: "h-14",
};

export function BrandLogo({ size = "md", className }: BrandLogoProps) {
  return (
    <div
      className={`inline-flex items-center justify-center rounded-xl bg-black px-3 py-1.5 shadow-elegant ${className ?? ""}`}
    >
      <img
        src={leenLogo}
        alt="LEEN Textile Pvt. Ltd."
        className={`${sizes[size]} w-auto invert`}
      />
    </div>
  );
}
