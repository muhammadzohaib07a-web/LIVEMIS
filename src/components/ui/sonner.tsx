import { useEffect, useState } from "react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// sonner paints itself from its own stylesheet and ignores the `.toaster`
// ancestor the old shadcn class list was written against, so the look is set
// through the props it actually reads: `richColors` for the red/green variants,
// and `theme` kept in step with the class the app puts on <html>.
function useDocumentTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const read = () =>
      setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return theme;
}

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useDocumentTheme();

  return (
    <Sonner
      className="toaster"
      theme={theme}
      position="top-center"
      richColors
      closeButton
      {...props}
    />
  );
};

export { Toaster };
