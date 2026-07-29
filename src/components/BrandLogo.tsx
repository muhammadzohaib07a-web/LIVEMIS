import { LifeBuoy } from "lucide-react";

type BrandLogoProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: { icon: "h-6 w-6", text: "text-sm" },
  md: { icon: "h-8 w-8", text: "text-base" },
  lg: { icon: "h-10 w-10", text: "text-lg" },
};

export function BrandLogo({ size = "md", className }: BrandLogoProps) {
  const { icon, text } = sizes[size];
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <div
        className={`grid ${icon} place-items-center rounded-lg bg-gradient-primary text-primary-foreground shadow-elegant`}
      >
        <LifeBuoy className="h-[55%] w-[55%]" strokeWidth={2.5} />
      </div>
      <span className={`font-bold tracking-tight ${text}`}>MIS Support Hub</span>
    </div>
  );
}
